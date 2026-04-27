// ════════════════════════════════════════════════════════════
// OUTSTAND.SO — FACEBOOK OPERATIONS
//
// Publishes content to Facebook via Outstand.so API.
// Used as fallback when direct Meta API fails.
//
// Assumes Outstand.so provides:
//   POST /posts — Create/schedule posts
//   GET /posts/{id}/analytics — Fetch analytics
// ════════════════════════════════════════════════════════════

import { outstandPost, outstandGet, OutstandApiError, OutstandPostResult } from "./client";

export interface FacebookMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
}

// ── Publish (immediate) ─────────────────────────────────────

export async function publishFacebookViaOutstand(
  apiKey: string,
  accountId: string,
  content: string,
  mediaUrls?: string[],
  format?: string
): Promise<OutstandPostResult> {
  try {
    console.log("[outstand/facebook] Publishing post to Facebook via Outstand");

    const payload = {
      platform: "facebook",
      account_id: accountId,
      caption: content,
      media_urls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
      format: format || "post",
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
      console.error("[outstand/facebook] Outstand error:", response.error.message);
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
      `[outstand/facebook] ✓ Published via Outstand: postId=${postId}, status=${status}`
    );

    return {
      postId,
      status: status as "published" | "scheduled" | "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[outstand/facebook] Publishing via Outstand failed:", message);
    throw err;
  }
}

// ── Schedule ────────────────────────────────────────────────

export async function scheduleFacebookViaOutstand(
  apiKey: string,
  accountId: string,
  content: string,
  scheduleAt: string,
  mediaUrls?: string[],
  format?: string
): Promise<OutstandPostResult> {
  try {
    console.log("[outstand/facebook] Scheduling post to Facebook via Outstand");

    const payload = {
      platform: "facebook",
      account_id: accountId,
      caption: content,
      media_urls: mediaUrls && mediaUrls.length > 0 ? mediaUrls : undefined,
      format: format || "post",
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
      console.error("[outstand/facebook] Outstand error:", response.error.message);
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
      `[outstand/facebook] ✓ Scheduled via Outstand: postId=${postId}, status=${status}, scheduleAt=${scheduleAt}`
    );

    return {
      postId,
      status: status as "published" | "scheduled" | "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[outstand/facebook] Scheduling via Outstand failed:", message);
    throw err;
  }
}

// ── Analytics ───────────────────────────────────────────────

export async function getFacebookAnalyticsViaOutstand(
  apiKey: string,
  postId: string
): Promise<FacebookMetrics> {
  try {
    console.log("[outstand/facebook] Fetching analytics for post:", postId);

    const response = await outstandGet<{
      data: {
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
      console.error("[outstand/facebook] Outstand error:", response.error.message);
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
      reach: 0,
      impressions: 0,
      clicks: 0,
    };

    console.log("[outstand/facebook] ✓ Analytics retrieved:", analytics);

    return {
      likes: analytics.likes || 0,
      comments: analytics.comments || 0,
      shares: analytics.shares || 0,
      reach: analytics.reach || 0,
      impressions: analytics.impressions || 0,
      clicks: analytics.clicks || 0,
    };
  } catch (err) {
    console.error("[outstand/facebook] Analytics fetch failed:", err);
    return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
  }
}
