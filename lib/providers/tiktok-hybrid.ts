// ════════════════════════════════════════════════════════════
// TIKTOK HYBRID PROVIDER
//
// Combines Outstand.so (primary) with official TikTok API
// as fallback. Uses Outstand for all posting operations.
// Falls back to official API only if Outstand fails.
//
// Strategy:
//   - Publishing (immediate & scheduled): Outstand → Official API
//   - Analytics: Outstand (if Outstand post) → Official API
//   - OAuth: Official (TikTok Login Kit only)
// ════════════════════════════════════════════════════════════

import type {
  SocialProvider,
  OAuthStartResult,
  OAuthCallbackResult,
  ProviderAccount,
  CreatePostPayload,
  CreatePostResult,
  PostStatusResult,
  PostAnalytics,
  WebhookEvent,
} from "./types";
import { TikTokDirectProvider } from "./tiktok-direct";
import {
  publishTikTokViaOutstand,
  scheduleTikTokViaOutstand,
  getTikTokAnalyticsViaOutstand,
} from "@/lib/outstand/tiktok";
import { OutstandApiError } from "@/lib/outstand/client";
import { fetchTikTokVideoMetrics } from "@/lib/tiktok/analytics";
import { getTikTokAccessToken } from "@/lib/tiktok/accounts";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export class TikTokHybridProvider implements SocialProvider {
  readonly name = "tiktok-hybrid";
  readonly supportedPlatforms = ["tiktok"];

  private directProvider = new TikTokDirectProvider();

  // ── OAuth (delegate to direct) ─────────────────────────

  async startOAuth(params: {
    platform: string;
    redirectUri: string;
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<OAuthStartResult> {
    return this.directProvider.startOAuth(params);
  }

  async handleCallback(params: {
    queryParams: Record<string, string>;
    workspaceId: string;
    redirectUri?: string;
    apiKey?: string | null;
  }): Promise<OAuthCallbackResult> {
    return this.directProvider.handleCallback(params);
  }

  // ── Accounts (delegate to direct) ─────────────────────

  async listAccounts(params: {
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<ProviderAccount[]> {
    return this.directProvider.listAccounts(params);
  }

  async syncAccounts(params: {
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<{ synced: number; errors: number }> {
    return this.directProvider.syncAccounts(params);
  }

  async disconnectAccount(params: {
    providerAccountId: string;
    apiKey?: string | null;
  }): Promise<void> {
    return this.directProvider.disconnectAccount(params);
  }

  // ── Posting (with fallback) ────────────────────────────

  async createPost(params: {
    payload: CreatePostPayload;
    workspaceId: string;
    authorId: string;
    apiKey?: string | null;
  }): Promise<CreatePostResult> {
    const { payload, workspaceId, authorId, apiKey } = params;

    // Primary: Outstand.so
    if (apiKey) {
      try {
        console.log("[tiktok-hybrid] Publishing via Outstand.so (primary)...");
        return await this.createPostViaOutstand(payload, apiKey);
      } catch (err) {
        console.warn(
          "[tiktok-hybrid] Outstand.so failed:",
          err instanceof Error ? err.message : String(err)
        );
        // Fall through to official API
      }
    }

    // Fallback: Official TikTok API
    try {
      console.log("[tiktok-hybrid] Falling back to official TikTok API...");
      const result = await this.directProvider.createPost({
        payload,
        workspaceId,
        authorId,
        apiKey,
      });

      console.log(
        "[tiktok-hybrid] ✓ Post published via official TikTok API:",
        result.providerPostId
      );

      this.logProviderUsed(result.providerPostId, "direct");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[tiktok-hybrid] Official TikTok API also failed:", message);
      throw new Error(
        `TikTok publishing failed via both Outstand and official API: ${message}`
      );
    }
  }

  private async createPostViaOutstand(
    payload: CreatePostPayload,
    apiKey: string
  ): Promise<CreatePostResult> {
    // TikTok requires a video
    if (!payload.mediaUrls?.length) {
      throw new Error("TikTok requires a video file to publish.");
    }

    const videoUrl = payload.mediaUrls[0];

    try {
      const result = payload.scheduleAt
        ? await scheduleTikTokViaOutstand(
            apiKey,
            payload.accountIds[0] || "",
            videoUrl,
            payload.content,
            payload.scheduleAt
          )
        : await publishTikTokViaOutstand(
            apiKey,
            payload.accountIds[0] || "",
            videoUrl,
            payload.content
          );

      console.log("[tiktok-hybrid] ✓ Post published via Outstand:", result.postId);

      // Log that Outstand was used
      this.logProviderUsed(result.postId, "outstand");

      return {
        providerPostId: `os_${result.postId}`, // Prefix to indicate Outstand source
        status: result.status,
      };
    } catch (err) {
      throw err;
    }
  }

  async getPostStatus(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<PostStatusResult> {
    // Delegate to direct provider (status is tracked in DB)
    return this.directProvider.getPostStatus(params);
  }

  async deletePost(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<void> {
    return this.directProvider.deletePost(params);
  }

  // ── Analytics (with fallback) ──────────────────────────

  async getPostAnalytics(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<PostAnalytics> {
    const { providerPostId, apiKey } = params;

    // Check if this post was published via Outstand (prefix: os_)
    const isOutstandPost = providerPostId.startsWith("os_");

    if (isOutstandPost && apiKey) {
      try {
        console.log(
          "[tiktok-hybrid] Fetching analytics for Outstand post:",
          providerPostId
        );
        const metrics = await getTikTokAnalyticsViaOutstand(
          apiKey,
          providerPostId.replace("os_", "")
        );

        return {
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          reach: metrics.views,
          impressions: metrics.views,
          clicks: 0,
        };
      } catch (err) {
        console.error("[tiktok-hybrid] Outstand analytics failed:", err);
        return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
      }
    }

    // Try official TikTok API analytics first
    try {
      const videoId = providerPostId.replace("tt_", "").replace("os_", "");
      if (!videoId) {
        return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
      }

      const serviceClient = createServiceClient();
      const { data: post } = await serviceClient
        .from("posts")
        .select("workspace_id, account_ids")
        .eq("outstand_post_id", providerPostId)
        .single();

      if (!post || !post.workspace_id || !post.account_ids?.[0]) {
        return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
      }

      const tokenData = await getTikTokAccessToken(post.workspace_id, post.account_ids[0]);
      if (!tokenData) {
        return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
      }

      console.log("[tiktok-hybrid] Fetching analytics via official TikTok API");
      const stats = await fetchTikTokVideoMetrics(videoId, tokenData.accessToken);

      return {
        likes: stats.likes,
        comments: stats.comments,
        shares: stats.shares,
        reach: stats.views,
        impressions: stats.views,
        clicks: 0,
      };
    } catch (err) {
      console.error("[tiktok-hybrid] Official TikTok analytics failed:", err);

      // Fallback to Outstand if official failed
      if (apiKey) {
        try {
          const metrics = await getTikTokAnalyticsViaOutstand(
            apiKey,
            providerPostId.replace("tt_", "").replace("os_", "")
          );

          return {
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            reach: metrics.views,
            impressions: metrics.views,
            clicks: 0,
          };
        } catch (fallbackErr) {
          console.error("[tiktok-hybrid] Outstand fallback also failed:", fallbackErr);
        }
      }

      return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
    }
  }

  // ── Webhooks (delegate to direct) ──────────────────────

  parseWebhook(params: {
    body: string;
    signature: string;
    secret: string;
  }): WebhookEvent | null {
    return this.directProvider.parseWebhook(params);
  }

  // ── Logging ────────────────────────────────────────────

  private async logProviderUsed(postId: string, provider: "direct" | "outstand"): Promise<void> {
    try {
      console.log(`[tiktok-hybrid] Post ${postId} published via: ${provider}`);
      // Could also update a metrics table here if needed
    } catch (err) {
      console.error("[tiktok-hybrid] Error logging provider:", err);
    }
  }
}
