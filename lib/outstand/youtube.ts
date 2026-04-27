// ════════════════════════════════════════════════════════════
// OUTSTAND.SO — YOUTUBE OPERATIONS
//
// Publishes videos to YouTube via Outstand.so API.
// Used as fallback when direct YouTube API fails.
//
// Assumes Outstand.so provides:
//   POST /posts — Create/schedule videos
//   GET /posts/{id}/analytics — Fetch analytics
// ════════════════════════════════════════════════════════════

import { outstandPost, outstandGet, OutstandApiError, OutstandPostResult } from "./client";

export interface YouTubeMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
}

// ── Publish (immediate) ─────────────────────────────────────

export async function publishYouTubeViaOutstand(
  apiKey: string,
  accountId: string,
  videoUrl: string,
  title: string,
  description: string,
  opts?: {
    privacyStatus?: "public" | "private" | "unlisted";
    categoryId?: string;
    tags?: string[];
    madeForKids?: boolean;
  }
): Promise<OutstandPostResult> {
  try {
    console.log("[outstand/youtube] Publishing video to YouTube via Outstand");

    const payload = {
      platform: "youtube",
      account_id: accountId,
      video_url: videoUrl,
      title,
      description,
      privacy_status: opts?.privacyStatus || "public",
      category_id: opts?.categoryId || "22",
      tags: opts?.tags || [],
      made_for_kids: opts?.madeForKids || false,
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
      console.error("[outstand/youtube] Outstand error:", response.error.message);
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
        "No video ID returned from Outstand",
        400
      );
    }

    console.log(
      `[outstand/youtube] ✓ Published via Outstand: postId=${postId}, status=${status}`
    );

    return {
      postId,
      status: status as "published" | "scheduled" | "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[outstand/youtube] Publishing via Outstand failed:", message);
    throw err;
  }
}

// ── Schedule ────────────────────────────────────────────────

export async function scheduleYouTubeViaOutstand(
  apiKey: string,
  accountId: string,
  videoUrl: string,
  title: string,
  description: string,
  scheduleAt: string,
  opts?: {
    privacyStatus?: "public" | "private" | "unlisted";
    categoryId?: string;
    tags?: string[];
    madeForKids?: boolean;
  }
): Promise<OutstandPostResult> {
  try {
    console.log("[outstand/youtube] Scheduling video to YouTube via Outstand");

    const payload = {
      platform: "youtube",
      account_id: accountId,
      video_url: videoUrl,
      title,
      description,
      privacy_status: opts?.privacyStatus || "private",
      category_id: opts?.categoryId || "22",
      tags: opts?.tags || [],
      made_for_kids: opts?.madeForKids || false,
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
      console.error("[outstand/youtube] Outstand error:", response.error.message);
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
        "No video ID returned from Outstand",
        400
      );
    }

    console.log(
      `[outstand/youtube] ✓ Scheduled via Outstand: postId=${postId}, status=${status}, scheduleAt=${scheduleAt}`
    );

    return {
      postId,
      status: status as "published" | "scheduled" | "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[outstand/youtube] Scheduling via Outstand failed:", message);
    throw err;
  }
}

// ── Analytics ───────────────────────────────────────────────

export async function getYouTubeAnalyticsViaOutstand(
  apiKey: string,
  postId: string
): Promise<YouTubeMetrics> {
  try {
    console.log("[outstand/youtube] Fetching analytics for video:", postId);

    const response = await outstandGet<{
      data: {
        views: number;
        likes: number;
        comments: number;
        shares: number;
        reach: number;
        impressions: number;
        clicks: number;
      };
      error?: { code: string; message: string };
    }>(`/posts/${postId}/analytics`, undefined, apiKey);

    if (response.error?.code) {
      console.error("[outstand/youtube] Outstand error:", response.error.message);
      throw new OutstandApiError(
        response.error.message,
        400,
        response.error.code
      );
    }

    const analytics = response.data || {
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      reach: 0,
      impressions: 0,
      clicks: 0,
    };

    console.log("[outstand/youtube] ✓ Analytics retrieved:", analytics);

    return {
      likes: analytics.likes || 0,
      comments: analytics.comments || 0,
      shares: 0,
      reach: analytics.views || analytics.reach || 0,
      impressions: analytics.views || analytics.impressions || 0,
      clicks: 0,
    };
  } catch (err) {
    console.error("[outstand/youtube] Analytics fetch failed:", err);
    return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
  }
}
