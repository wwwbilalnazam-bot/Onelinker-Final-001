// ════════════════════════════════════════════════════════════
// META POSTS — Publish to Facebook Pages & Instagram
//
// Facebook Page posting:
//   POST /{page-id}/feed          → text post
//   POST /{page-id}/photos        → single photo
//   POST /{page-id}/videos        → video upload
//
// Instagram publishing (container-based):
//   POST /{ig-user-id}/media       → create container
//   POST /{ig-user-id}/media_publish → publish container
//   (Carousels need multiple containers + a carousel container)
//
// Stories & Reels use the same container API with different media_type.
// ════════════════════════════════════════════════════════════

import { graphGet, graphPost } from "./client";
import { publishPhotoStory, publishVideoStory } from "./stories/facebook";
import { publishIGStory } from "./stories/instagram";

// ── Types ───────────────────────────────────────────────────

export interface MetaPostResult {
  id: string;
  platform: "facebook" | "instagram";
}

// ── Facebook Page Posts ─────────────────────────────────────

export async function createFacebookPost(params: {
  pageId: string;
  pageAccessToken: string;
  message: string;
  mediaUrls?: string[];
  scheduledTime?: number; // Unix timestamp (must be 10min–75days in future)
  format?: string; // "post" | "story" | "reel"
}): Promise<MetaPostResult> {
  const { pageId, pageAccessToken, message, mediaUrls = [], format = "post" } = params;

  // ── Story ────────────────────────────────────────────────
  if (format === "story") {
    if (!mediaUrls.length) {
      throw new Error("Stories require at least one image or video");
    }

    const mediaUrl = mediaUrls[0]!;
    const isVideo = isVideoUrl(mediaUrl);

    if (isVideo) {
      return publishVideoStory({
        pageId,
        pageAccessToken,
        videoUrl: mediaUrl,
        caption: message,
      });
    } else {
      return publishPhotoStory({
        pageId,
        pageAccessToken,
        imageUrl: mediaUrl,
        caption: message,
      });
    }
  }

  // ── Reel ─────────────────────────────────────────────────
  if (format === "reel") {
    if (mediaUrls.length === 0) {
      throw new Error("Facebook reels require a video");
    }
    const res = await graphPost<{ id: string }>(
      `/${pageId}/video_reels`,
      {
        video_url: mediaUrls[0]!,
        description: message,
      },
      pageAccessToken
    );
    return { id: res.id, platform: "facebook" };
  }

  // ── Text-only post ───────────────────────────────────────
  if (mediaUrls.length === 0) {
    const body: Record<string, unknown> = { message };
    if (params.scheduledTime) {
      body.published = false;
      body.scheduled_publish_time = params.scheduledTime;
    }
    const res = await graphPost<{ id: string }>(
      `/${pageId}/feed`,
      body,
      pageAccessToken
    );
    return { id: res.id, platform: "facebook" };
  }

  // ── Single photo ─────────────────────────────────────────
  if (mediaUrls.length === 1 && !isVideoUrl(mediaUrls[0]!)) {
    const body: Record<string, unknown> = {
      url: mediaUrls[0]!,
      message,
    };
    if (params.scheduledTime) {
      body.published = false;
      body.scheduled_publish_time = params.scheduledTime;
    }
    const res = await graphPost<{ id: string }>(
      `/${pageId}/photos`,
      body,
      pageAccessToken
    );
    return { id: res.id, platform: "facebook" };
  }

  // ── Single video ─────────────────────────────────────────
  if (mediaUrls.length === 1 && isVideoUrl(mediaUrls[0]!)) {
    const body: Record<string, unknown> = {
      file_url: mediaUrls[0]!,
      description: message,
    };
    if (params.scheduledTime) {
      body.published = false;
      body.scheduled_publish_time = params.scheduledTime;
    }
    const res = await graphPost<{ id: string }>(
      `/${pageId}/videos`,
      body,
      pageAccessToken
    );
    return { id: res.id, platform: "facebook" };
  }

  // ── Multiple photos (multi-photo post) ───────────────────
  // Step 1: Upload each photo unpublished
  const photoIds: string[] = [];
  for (const url of mediaUrls) {
    if (isVideoUrl(url)) continue; // skip videos in multi-photo
    const res = await graphPost<{ id: string }>(
      `/${pageId}/photos`,
      { url, published: false },
      pageAccessToken
    );
    photoIds.push(res.id);
  }

  // Step 2: Create feed post referencing all photos
  const body: Record<string, unknown> = { message };
  photoIds.forEach((id, i) => {
    body[`attached_media[${i}]`] = JSON.stringify({ media_fbid: id });
  });
  if (params.scheduledTime) {
    body.published = false;
    body.scheduled_publish_time = params.scheduledTime;
  }

  const res = await graphPost<{ id: string }>(
    `/${pageId}/feed`,
    body,
    pageAccessToken
  );
  return { id: res.id, platform: "facebook" };
}

// ── Instagram Posts (Container API) ─────────────────────────

export async function createInstagramPost(params: {
  igUserId: string;
  accessToken: string; // page access token
  caption: string;
  mediaUrls?: string[];
  format?: string; // "post" | "story" | "reel"
}): Promise<MetaPostResult> {
  const { igUserId, accessToken, caption, mediaUrls = [], format = "post" } = params;

  if (mediaUrls.length === 0) {
    throw new Error("Instagram posts require at least one image or video");
  }

  // ── Story ────────────────────────────────────────────────
  if (format === "story") {
    if (mediaUrls.length === 0) {
      throw new Error("Instagram stories require at least one image or video");
    }

    const mediaUrl = mediaUrls[0]!;
    const isVideo = isVideoUrl(mediaUrl);

    return publishIGStory({
      igUserId,
      accessToken,
      mediaUrl,
      isVideo,
    });
  }

  // ── Reel ─────────────────────────────────────────────────
  if (format === "reel") {
    const container = await graphPost<{ id: string }>(
      `/${igUserId}/media`,
      {
        media_type: "REELS",
        video_url: mediaUrls[0]!,
        caption,
      },
      accessToken
    );

    await waitForIGContainer(container.id, accessToken);

    const published = await graphPost<{ id: string }>(
      `/${igUserId}/media_publish`,
      { creation_id: container.id },
      accessToken
    );
    return { id: published.id, platform: "instagram" };
  }

  // ── Single image post ────────────────────────────────────
  if (mediaUrls.length === 1 && !isVideoUrl(mediaUrls[0]!)) {
    const container = await graphPost<{ id: string }>(
      `/${igUserId}/media`,
      {
        media_type: "IMAGE",
        image_url: mediaUrls[0]!,
        caption,
        upload_phase: "FINISH",
      },
      accessToken
    );

    const published = await graphPost<{ id: string }>(
      `/${igUserId}/media_publish`,
      { creation_id: container.id },
      accessToken
    );
    return { id: published.id, platform: "instagram" };
  }

  // ── Single video post ────────────────────────────────────
  if (mediaUrls.length === 1 && isVideoUrl(mediaUrls[0]!)) {
    const container = await graphPost<{ id: string }>(
      `/${igUserId}/media`,
      {
        media_type: "VIDEO",
        video_url: mediaUrls[0]!,
        caption,
      },
      accessToken
    );

    await waitForIGContainer(container.id, accessToken);

    const published = await graphPost<{ id: string }>(
      `/${igUserId}/media_publish`,
      { creation_id: container.id },
      accessToken
    );
    return { id: published.id, platform: "instagram" };
  }

  // ── Carousel (multiple images/videos) ────────────────────
  const childIds: string[] = [];

  for (const url of mediaUrls) {
    const isVideo = isVideoUrl(url);
    const child = await graphPost<{ id: string }>(
      `/${igUserId}/media`,
      {
        media_type: isVideo ? "VIDEO" : "IMAGE",
        ...(isVideo ? { video_url: url } : { image_url: url }),
        is_carousel_item: true,
        upload_phase: isVideo ? "UPLOAD" : "FINISH",
      },
      accessToken
    );

    if (isVideo) {
      await waitForIGContainer(child.id, accessToken);
    }
    childIds.push(child.id);
  }

  // Create carousel container
  const carousel = await graphPost<{ id: string }>(
    `/${igUserId}/media`,
    {
      media_type: "CAROUSEL",
      children: childIds.join(","),
      caption,
      upload_phase: "FINISH",
    },
    accessToken
  );

  const published = await graphPost<{ id: string }>(
    `/${igUserId}/media_publish`,
    { creation_id: carousel.id },
    accessToken
  );
  return { id: published.id, platform: "instagram" };
}

// ── Helpers ─────────────────────────────────────────────────

function isVideoUrl(url: string): boolean {
  const lower = url.toLowerCase().split("?")[0] ?? "";
  return /\.(mp4|mov|avi|wmv|flv|webm|mkv|m4v|3gp)$/.test(lower);
}

/**
 * Instagram container processing can take time for videos.
 * Poll until the container status is FINISHED or ERROR.
 */
async function waitForIGContainer(
  containerId: string,
  accessToken: string,
  maxAttempts = 30,
  intervalMs = 5000
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await graphGet<{
      status_code: string;
      status?: string;
    }>(`/${containerId}`, { fields: "status_code,status" }, accessToken);

    if (status.status_code === "FINISHED") return;
    if (status.status_code === "ERROR") {
      throw new Error(`Instagram container processing failed: ${status.status ?? "unknown error"}`);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  throw new Error("Instagram container processing timed out");
}
