// ════════════════════════════════════════════════════════════
// YOUTUBE HYBRID PROVIDER
//
// Combines Outstand.so (primary) with official YouTube API
// as fallback. Uses Outstand for all posting operations.
// Falls back to official API only if Outstand fails.
//
// Strategy:
//   - Publishing (immediate & scheduled): Outstand → YouTube API
//   - Analytics: Outstand (if Outstand post) → YouTube API
//   - OAuth: Official (YouTube Login Kit only)
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
import { YouTubeDirectProvider } from "./youtube-direct";
import {
  publishYouTubeViaOutstand,
  scheduleYouTubeViaOutstand,
  getYouTubeAnalyticsViaOutstand,
} from "@/lib/outstand/youtube";
import { OutstandApiError } from "@/lib/outstand/client";

export class YouTubeHybridProvider implements SocialProvider {
  readonly name = "youtube-hybrid";
  readonly supportedPlatforms = ["youtube"];

  private directProvider = new YouTubeDirectProvider();

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

    // Guard: YouTube requires a video
    if (!payload.mediaUrls?.length) {
      throw new Error("YouTube requires a video file to publish.");
    }

    // Primary: Outstand.so
    if (apiKey) {
      try {
        console.log("[youtube-hybrid] Publishing via Outstand.so (primary)...");
        return await this.createPostViaOutstand(payload, apiKey);
      } catch (err) {
        console.warn(
          "[youtube-hybrid] Outstand.so failed:",
          err instanceof Error ? err.message : String(err)
        );
        // Fall through to official API
      }
    }

    // Fallback: Official YouTube API
    try {
      console.log("[youtube-hybrid] Falling back to official YouTube API...");
      const result = await this.directProvider.createPost({
        payload,
        workspaceId,
        authorId,
        apiKey,
      });

      console.log(
        "[youtube-hybrid] ✓ Video published via official YouTube API:",
        result.providerPostId
      );

      this.logProviderUsed(result.providerPostId, "direct");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[youtube-hybrid] Official YouTube API also failed:", message);
      throw new Error(
        `YouTube publishing failed via both Outstand and official API: ${message}`
      );
    }
  }

  private async createPostViaOutstand(
    payload: CreatePostPayload,
    apiKey: string
  ): Promise<CreatePostResult> {
    const videoUrl = payload.mediaUrls![0];
    const title = payload.title || "YouTube Video";
    const description = payload.content;

    try {
      const result = payload.scheduleAt
        ? await scheduleYouTubeViaOutstand(
            apiKey,
            payload.accountIds[0] || "",
            videoUrl,
            title,
            description,
            payload.scheduleAt,
            {
              privacyStatus: payload.youtubeConfig?.privacyStatus as any,
              categoryId: payload.youtubeConfig?.categoryId,
              tags: payload.youtubeConfig?.tags,
              madeForKids: payload.youtubeConfig?.madeForKids,
            }
          )
        : await publishYouTubeViaOutstand(
            apiKey,
            payload.accountIds[0] || "",
            videoUrl,
            title,
            description,
            {
              privacyStatus: payload.youtubeConfig?.privacyStatus as any,
              categoryId: payload.youtubeConfig?.categoryId,
              tags: payload.youtubeConfig?.tags,
              madeForKids: payload.youtubeConfig?.madeForKids,
            }
          );

      console.log("[youtube-hybrid] ✓ Video published via Outstand:", result.postId);

      // Log that Outstand was used
      this.logProviderUsed(result.postId, "outstand");

      return {
        providerPostId: `os_${result.postId}`,
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
          "[youtube-hybrid] Fetching analytics for Outstand video:",
          providerPostId
        );
        const videoId = providerPostId.replace("os_", "");
        const metrics = await getYouTubeAnalyticsViaOutstand(apiKey, videoId);

        return {
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          reach: metrics.reach,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
        };
      } catch (err) {
        console.error("[youtube-hybrid] Outstand analytics failed:", err);
        return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
      }
    }

    // Try official YouTube API analytics
    try {
      return await this.directProvider.getPostAnalytics(params);
    } catch (err) {
      console.error("[youtube-hybrid] Official YouTube analytics failed:", err);

      // Fallback to Outstand if official failed
      if (apiKey && isOutstandPost) {
        try {
          const videoId = providerPostId.replace("os_", "");
          const metrics = await getYouTubeAnalyticsViaOutstand(apiKey, videoId);

          return {
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            reach: metrics.reach,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
          };
        } catch (fallbackErr) {
          console.error("[youtube-hybrid] Outstand fallback also failed:", fallbackErr);
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
      console.log(`[youtube-hybrid] Video ${postId} published via: ${provider}`);
    } catch (err) {
      console.error("[youtube-hybrid] Error logging provider:", err);
    }
  }
}
