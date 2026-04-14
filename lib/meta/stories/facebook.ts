import { z } from "zod";
import { graphPost, graphPostMultipart } from "../client";

const FacebookPhotoStorySchema = z.object({
  pageId: z.string().min(1),
  pageAccessToken: z.string().min(1),
  imageUrl: z.string().url(),
  caption: z.string().optional(),
});

const FacebookVideoStorySchema = z.object({
  pageId: z.string().min(1),
  pageAccessToken: z.string().min(1),
  videoUrl: z.string().url(),
  caption: z.string().optional(),
});

type PhotoStoryInput = z.infer<typeof FacebookPhotoStorySchema>;
type VideoStoryInput = z.infer<typeof FacebookVideoStorySchema>;

export async function publishPhotoStory(
  input: PhotoStoryInput
): Promise<{ id: string; platform: "facebook" }> {
  const validated = FacebookPhotoStorySchema.parse(input);

  try {
    console.log(`[facebook-story] Publishing photo story via core /photos endpoint with is_story=true`);
    const imageBlob = await fetch(validated.imageUrl).then(r => r.blob());

    // Create form data for multipart upload
    const formData = new FormData();
    formData.append("source", imageBlob);
    if (validated.caption) {
      formData.append("caption", validated.caption);
    }

    const res = await graphPostMultipart<{ id: string }>(
      `/${validated.pageId}/photos?is_story=true&published=true`,
      formData,
      validated.pageAccessToken
    );

    console.log(`[facebook-story] Photo story published successfully: ${res.id}`);
    return { id: res.id, platform: "facebook" };
  } catch (err: any) {
    const errorCode = err?.code || err?.error?.code;
    const errorMsg = err?.message || err?.error?.message || String(err);
    const errorType = err?.type || err?.error?.type || "unknown";

    console.error(`[facebook-story] Photo story failed: code=${errorCode}, type=${errorType}, msg=${errorMsg}`);

    throw new Error(`Facebook Photo Story Error: ${errorMsg} (Code: ${errorCode}, Type: ${errorType}) ${err.fbTraceId ? `[Trace: ${err.fbTraceId}]` : ""}`);
  }
}

/**
 * Publish a video story to a Facebook Page (resumable upload)
 * 3-step flow: start → upload → finish
 * Uses POST /{page-id}/video_stories with upload_phase parameter
 * @throws {Error} If any step fails after max retries
 */
export async function publishVideoStory(
  input: VideoStoryInput,
  maxRetries = 3
): Promise<{ id: string; platform: "facebook" }> {
  const validated = FacebookVideoStorySchema.parse(input);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Step 1: Start upload session
      console.log(
        `[facebook-story] Starting video upload (attempt ${attempt + 1}/${maxRetries})`
      );
      const startRes = await graphPost<any>(
        `/${validated.pageId}/video_stories`,
        { upload_phase: "start" },
        validated.pageAccessToken
      );

      const sessionId = startRes.upload_session_id || startRes.video_id;
      const videoId = startRes.video_id;

      // Step 2: Upload video binary
      console.log(`[facebook-story] Uploading video binary to session: ${sessionId}`);
      const videoBlob = await fetch(validated.videoUrl).then((r) => r.blob());

      const uploadRes = await fetch(startRes.upload_url, {
        method: "POST", // Meta prefers POST for binary in many resumable contexts
        body: videoBlob,
        headers: {
          "Authorization": `OAuth ${validated.pageAccessToken}`,
          "offset": "0",
          "file_size": String(videoBlob.size),
          "Content-Type": "application/octet-stream"
        },
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text();
        throw new Error(`Upload failed (${uploadRes.status}): ${errText}`);
      }

      // Read response to ensure it's processed
      await uploadRes.text();

      // Step 3: Finish upload and publish
      // Small delay for cluster sync
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(
        `[facebook-story] Finalizing story with session ${sessionId}${videoId ? ` and video_id ${videoId}` : ''}`
      );
      const finishRes = await graphPost<any>(
        `/${validated.pageId}/video_stories`,
        {
          upload_phase: "finish",
          upload_session_id: sessionId,
          ...(videoId ? { video_id: videoId } : {}),
          video_state: "PUBLISHED",
          published: true,
          ...(validated.caption && { caption: validated.caption }),
        },
        validated.pageAccessToken
      );

      console.log(`[facebook-story] Video story published: ${finishRes.id || finishRes.video_id}`);
      return { id: finishRes.id || finishRes.video_id, platform: "facebook" };
    } catch (err: any) {
      const errorCode = err?.error?.code;
      const errorMsg = err?.error?.message || err?.message || String(err);
      const errorType = err?.error?.type || "unknown";
      const isRetryable =
        errorCode === 2 || errorMsg.includes("timeout") || errorMsg.includes("temporary");

      console.error(
        `[facebook-story] Attempt ${attempt + 1}/${maxRetries}: code=${errorCode}, type=${errorType}, msg=${errorMsg}`
      );

      if (isRetryable && attempt < maxRetries - 1) {
        const delay = Math.pow(2, attempt) * 1000; // exponential backoff
        console.warn(
          `[facebook-story] Retrying in ${delay}ms due to: ${errorMsg}`
        );
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      if (errorMsg.includes("permission") || errorCode === 200) {
        throw new Error(
          "Permission denied. Ensure scope `pages_manage_posts` is granted."
        );
      }
      if (errorCode === 100 || errorMsg.includes("invalid") || errorMsg.includes("Invalid")) {
        throw new Error(
          "Invalid video URL or format. Ensure the video is accessible (HTTPS), MP4 format, under 4GB, and 60s max."
        );
      }
      if (errorMsg === "Unknown" || errorMsg === "An unknown error has occurred") {
        throw new Error(
          "Unknown error from Meta. Please check: 1) Video URL is accessible, 2) Video is MP4 format, 3) Video is under 60 seconds, 4) Page is connected."
        );
      }
      throw new Error(`Failed to publish video story: ${errorMsg}`);
    }
  }

  throw new Error("Video story upload failed after max retries");
}
