/**
 * Thumbnail Generation Utility
 *
 * Generates thumbnails from media files:
 * - Videos: Extracts frame at 5% duration
 * - Images: Resizes to 600x600px
 * - Fallback: Uses original media URL
 */

import { createServiceClient } from "@/lib/supabase/server";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import ffmpegStatic from "ffmpeg-static";
import { createReadStream, writeFileSync, unlinkSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

// Set FFmpeg path for fluent-ffmpeg
if (ffmpegStatic) {
  ffmpeg.setFfmpegPath(ffmpegStatic);
}

export interface ThumbnailGenerationResult {
  success: boolean;
  thumbnailUrl?: string;
  error?: string;
}

/**
 * Download a file from URL and return as Buffer
 */
async function downloadFile(url: string): Promise<Buffer> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.statusText}`);
  }
  return Buffer.from(await response.arrayBuffer());
}

/**
 * Extract a frame from video and return as buffer
 * Extracts frame at 5% of video duration
 */
function extractVideoFrame(inputPath: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const tempDir = mkdtempSync(join(tmpdir(), "thumbnail-"));
    const outputPath = join(tempDir, `thumbnail.jpg`);

    ffmpeg(inputPath)
      .outputOptions("-vf", "scale=600:600:force_original_aspect_ratio=decrease,pad=600:600:(ow-iw)/2:(oh-ih)/2")
      .outputOptions("-ss", "5%")
      .outputOptions("-vframes", "1")
      .outputOptions("-q:v", "2")
      .output(outputPath)
      .on("error", (err) => {
        console.error(`[thumbnails] FFmpeg error:`, err.message);
        try {
          unlinkSync(outputPath);
        } catch {}
        reject(err);
      })
      .on("end", () => {
        try {
          const stream = createReadStream(outputPath);
          const chunks: Buffer[] = [];

          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("end", () => {
            try {
              unlinkSync(outputPath);
              unlinkSync(tempDir);
            } catch {}
            resolve(Buffer.concat(chunks));
          });
          stream.on("error", (err) => {
            try {
              unlinkSync(outputPath);
              unlinkSync(tempDir);
            } catch {}
            reject(err);
          });
        } catch (err) {
          try {
            unlinkSync(outputPath);
            unlinkSync(tempDir);
          } catch {}
          reject(err);
        }
      })
      .run();
  });
}

/**
 * Upload a thumbnail buffer to Supabase Storage
 */
async function uploadThumbnailToStorage(
  workspaceId: string,
  postId: string,
  thumbnailBuffer: Buffer,
  extension: string = "jpg"
): Promise<string> {
  const serviceClient = createServiceClient();

  const fileName = `${postId}-${randomUUID()}.${extension}`;
  const filePath = `workspaces/${workspaceId}/thumbnails/${fileName}`;

  const { data, error } = await serviceClient.storage
    .from("posts")
    .upload(filePath, thumbnailBuffer as unknown as File, {
      contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
      upsert: true,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = serviceClient.storage.from("posts").getPublicUrl(filePath);

  return publicUrlData?.publicUrl || filePath;
}

/**
 * Generate a thumbnail from a media URL
 * Supports video (frame extraction) and images (resizing)
 */
export async function generateThumbnailFromMedia(
  mediaUrl: string,
  postId: string,
  workspaceId: string,
  mediaType: "video" | "image" = "image"
): Promise<ThumbnailGenerationResult> {
  let tempFilePath: string | null = null;
  let tempDir: string | null = null;

  try {
    console.log(`[thumbnails] Generating ${mediaType} thumbnail from: ${mediaUrl.substring(0, 80)}...`);

    if (mediaType === "video") {
      try {
        // Download video
        console.log(`[thumbnails] Downloading video...`);
        const videoBuffer = await downloadFile(mediaUrl);

        // Save to temp file for FFmpeg processing
        tempDir = mkdtempSync(join(tmpdir(), "video-"));
        tempFilePath = join(tempDir, `video.mp4`);
        writeFileSync(tempFilePath, videoBuffer);

        console.log(`[thumbnails] Saved video to temp: ${tempFilePath} (${videoBuffer.length} bytes)`);

        // Extract frame
        console.log(`[thumbnails] Extracting frame at 5% duration...`);
        const thumbnailBuffer = await extractVideoFrame(tempFilePath);

        console.log(`[thumbnails] Frame extracted (${thumbnailBuffer.length} bytes)`);

        // Upload to storage
        console.log(`[thumbnails] Uploading thumbnail to storage...`);
        const thumbnailUrl = await uploadThumbnailToStorage(
          workspaceId,
          postId,
          thumbnailBuffer,
          "jpg"
        );

        console.log(`[thumbnails] ✓ Video thumbnail generated: ${thumbnailUrl}`);
        return {
          success: true,
          thumbnailUrl,
        };
      } catch (videoError) {
        const err = videoError instanceof Error ? videoError.message : String(videoError);
        console.warn(`[thumbnails] Video thumbnail generation failed: ${err}. Using media URL as fallback.`);
        // Fallback to media URL if extraction fails
        return {
          success: true,
          thumbnailUrl: mediaUrl,
        };
      }
    } else {
      // Image processing with Sharp
      try {
        console.log(`[thumbnails] Downloading and resizing image...`);
        const imageBuffer = await downloadFile(mediaUrl);

        const resizedBuffer = await sharp(imageBuffer)
          .resize(600, 600, {
            fit: "cover",
            position: "center",
          })
          .jpeg({ quality: 85 })
          .toBuffer();

        console.log(`[thumbnails] Image resized (${resizedBuffer.length} bytes)`);

        // Upload to storage
        console.log(`[thumbnails] Uploading image thumbnail to storage...`);
        const thumbnailUrl = await uploadThumbnailToStorage(
          workspaceId,
          postId,
          resizedBuffer,
          "jpg"
        );

        console.log(`[thumbnails] ✓ Image thumbnail generated: ${thumbnailUrl}`);
        return {
          success: true,
          thumbnailUrl,
        };
      } catch (imageError) {
        const err = imageError instanceof Error ? imageError.message : String(imageError);
        console.warn(`[thumbnails] Image thumbnail generation failed: ${err}. Using media URL as fallback.`);
        // Fallback to media URL if processing fails
        return {
          success: true,
          thumbnailUrl: mediaUrl,
        };
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[thumbnails] Generation failed:`, errorMessage);
    return {
      success: false,
      error: errorMessage,
    };
  } finally {
    // Clean up temp files
    if (tempFilePath) {
      try {
        unlinkSync(tempFilePath);
      } catch {}
    }
    if (tempDir) {
      try {
        unlinkSync(tempDir);
      } catch {}
    }
  }
}

/**
 * Update a post's thumbnail URL in the database
 */
export async function updatePostThumbnail(
  postId: string,
  thumbnailUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const serviceClient = createServiceClient();

    const { error } = await serviceClient
      .from("posts")
      .update({ thumbnail_url: thumbnailUrl })
      .eq("id", postId);

    if (error) {
      console.error(`[thumbnails] Database update failed:`, error);
      return { success: false, error: error.message };
    }

    console.log(`[thumbnails] ✓ Post thumbnail updated: ${postId}`);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[thumbnails] Update error:`, errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Generate thumbnail for existing posts that are missing one
 * (e.g., drafts created before thumbnail feature)
 */
export async function generateMissingThumbnails(
  workspaceId: string,
  limit: number = 100
): Promise<{ processed: number; success: number; failed: number }> {
  try {
    const serviceClient = createServiceClient();

    // Find posts without thumbnails that have media
    const { data: posts, error } = await serviceClient
      .from("posts")
      .select("id, media_urls")
      .eq("workspace_id", workspaceId)
      .is("thumbnail_url", null)
      .not("media_urls", "eq", "{}") // Has at least one media URL
      .limit(limit);

    if (error) {
      console.error(`[thumbnails] Query failed:`, error);
      return { processed: 0, success: 0, failed: 0 };
    }

    let success = 0;
    let failed = 0;

    for (const post of posts ?? []) {
      if (!post.media_urls || post.media_urls.length === 0) continue;

      const mediaUrl = post.media_urls[0];
      const mediaType = mediaUrl.toLowerCase().includes(".mp4") ? "video" : "image";

      const result = await generateThumbnailFromMedia(mediaUrl, post.id, workspaceId, mediaType);

      if (result.success && result.thumbnailUrl) {
        const updateResult = await updatePostThumbnail(post.id, result.thumbnailUrl);
        if (updateResult.success) {
          success++;
        } else {
          failed++;
        }
      } else {
        failed++;
      }

      // Rate limiting to avoid overwhelming the system
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const processed = success + failed;
    console.log(`[thumbnails] Batch generation complete: ${success}/${processed} successful`);
    return { processed, success, failed };
  } catch (error) {
    console.error(`[thumbnails] Batch generation error:`, error);
    return { processed: 0, success: 0, failed: 0 };
  }
}
