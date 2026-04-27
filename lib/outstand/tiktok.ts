// ════════════════════════════════════════════════════════════
// OUTSTAND.SO — TIKTOK OPERATIONS
//
// Publishes videos to TikTok via Outstand.so API.
// Used as fallback when direct TikTok API fails.
//
// Assumes Outstand.so provides:
//   POST /posts — Create/schedule posts
//   GET /posts/{id}/analytics — Fetch analytics
// ════════════════════════════════════════════════════════════

import { outstandPost, outstandGet, OutstandApiError } from "./client";

export interface OutstandPostResult {
  postId: string;
  status: "published" | "scheduled" | "pending";
}

export interface TikTokMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

// ── Publish (immediate) ─────────────────────────────────────

/**
 * Publish a TikTok video immediately via Outstand.so
 * The video file should already be uploaded to a public URL.
 */
export async function publishTikTokViaOutstand(
  apiKey: string,
  accountId: string,
  videoUrl: string,
  caption: string
): Promise<OutstandPostResult> {
  try {
    console.log("[outstand/tiktok] Publishing video to TikTok via Outstand");

    const payload = {
      platform: "tiktok",
      account_id: accountId,
      video_url: videoUrl,
      caption: caption,
      // Outstand may support additional fields like:
      // visibility: "public" | "private" | "friends",
      // disable_comments: boolean,
      // hashtags: string[],
    };

    const response = await outstandPost<{
      data: {
        id: string;
        post_id: string;
        status: "published" | "scheduled" | "pending";
      };
      error?: { code: string; message: string };
    }>("/posts", payload, apiKey);

    if (response.error?.code) {
      console.error("[outstand/tiktok] Outstand error:", response.error.message);
      throw new OutstandApiError(
        response.error.message,
        400,
        response.error.code
      );
    }

    const postId = response.data?.post_id || response.data?.id;
    const status = response.data?.status || "pending";

    if (!postId) {
      throw new OutstandApiError(
        "No post ID returned from Outstand",
        400
      );
    }

    console.log(
      `[outstand/tiktok] ✓ Published via Outstand: postId=${postId}, status=${status}`
    );

    return {
      postId,
      status: status as "published" | "scheduled" | "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[outstand/tiktok] Publishing via Outstand failed:", message);
    throw err;
  }
}

// ── Schedule ────────────────────────────────────────────────

/**
 * Schedule a TikTok video via Outstand.so
 * scheduleAt should be an ISO 8601 datetime string.
 */
export async function scheduleTikTokViaOutstand(
  apiKey: string,
  accountId: string,
  videoUrl: string,
  caption: string,
  scheduleAt: string // ISO 8601
): Promise<OutstandPostResult> {
  try {
    console.log("[outstand/tiktok] Scheduling video to TikTok via Outstand");

    const payload = {
      platform: "tiktok",
      account_id: accountId,
      video_url: videoUrl,
      caption: caption,
      scheduled_at: scheduleAt,
    };

    const response = await outstandPost<{
      data: {
        id: string;
        post_id: string;
        status: "published" | "scheduled" | "pending";
      };
      error?: { code: string; message: string };
    }>("/posts", payload, apiKey);

    if (response.error?.code) {
      console.error("[outstand/tiktok] Outstand error:", response.error.message);
      throw new OutstandApiError(
        response.error.message,
        400,
        response.error.code
      );
    }

    const postId = response.data?.post_id || response.data?.id;
    const status = response.data?.status || "scheduled";

    if (!postId) {
      throw new OutstandApiError(
        "No post ID returned from Outstand",
        400
      );
    }

    console.log(
      `[outstand/tiktok] ✓ Scheduled via Outstand: postId=${postId}, status=${status}, scheduleAt=${scheduleAt}`
    );

    return {
      postId,
      status: status as "published" | "scheduled" | "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[outstand/tiktok] Scheduling via Outstand failed:", message);
    throw err;
  }
}

// ── Analytics ───────────────────────────────────────────────

/**
 * Fetch analytics for a TikTok post via Outstand.so
 */
export async function getTikTokAnalyticsViaOutstand(
  apiKey: string,
  postId: string
): Promise<TikTokMetrics> {
  try {
    console.log("[outstand/tiktok] Fetching analytics for post:", postId);

    const response = await outstandGet<{
      data: {
        likes: number;
        comments: number;
        shares: number;
        views: number;
        // Outstand may return additional fields
      };
      error?: { code: string; message: string };
    }>(`/posts/${postId}/analytics`, undefined, apiKey);

    if (response.error?.code) {
      console.error("[outstand/tiktok] Outstand error:", response.error.message);
      throw new OutstandApiError(
        response.error.message,
        400,
        response.error.code
      );
    }

    const analytics = response.data || {
      likes: 0,
      comments: 0,
      shares: 0,
      views: 0,
    };

    console.log("[outstand/tiktok] ✓ Analytics retrieved:", analytics);

    return {
      likes: analytics.likes || 0,
      comments: analytics.comments || 0,
      shares: analytics.shares || 0,
      views: analytics.views || 0,
    };
  } catch (err) {
    console.error("[outstand/tiktok] Analytics fetch failed:", err);
    // Return zeros on failure rather than throwing
    return { likes: 0, comments: 0, shares: 0, views: 0 };
  }
}
