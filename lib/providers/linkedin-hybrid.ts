// ════════════════════════════════════════════════════════════
// LINKEDIN HYBRID PROVIDER
//
// Combines Outstand.so (primary) with official LinkedIn API
// as fallback. Uses Outstand for all posting operations.
// Falls back to official API only if Outstand fails.
//
// Strategy:
//   - Publishing (immediate & scheduled): Outstand → LinkedIn API
//   - Analytics: Outstand (if Outstand post) → LinkedIn API
//   - OAuth: Official (LinkedIn Login Kit only)
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
import { LinkedInDirectProvider } from "./linkedin-direct";
import {
  publishLinkedInViaOutstand,
  scheduleLinkedInViaOutstand,
  getLinkedInAnalyticsViaOutstand,
} from "@/lib/outstand/linkedin";
import { OutstandApiError } from "@/lib/outstand/client";

export class LinkedInHybridProvider implements SocialProvider {
  readonly name = "linkedin-hybrid";
  readonly supportedPlatforms = ["linkedin"];

  private directProvider = new LinkedInDirectProvider();

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
        console.log("[linkedin-hybrid] Publishing via Outstand.so (primary)...");
        return await this.createPostViaOutstand(payload, apiKey);
      } catch (err) {
        console.warn(
          "[linkedin-hybrid] Outstand.so failed:",
          err instanceof Error ? err.message : String(err)
        );
        // Fall through to official API
      }
    }

    // Fallback: Official LinkedIn API
    try {
      console.log("[linkedin-hybrid] Falling back to official LinkedIn API...");
      const result = await this.directProvider.createPost({
        payload,
        workspaceId,
        authorId,
        apiKey,
      });

      console.log(
        "[linkedin-hybrid] ✓ Post published via official LinkedIn API:",
        result.providerPostId
      );

      this.logProviderUsed(result.providerPostId, "direct");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[linkedin-hybrid] Official LinkedIn API also failed:", message);
      throw new Error(
        `LinkedIn posting failed via both Outstand and official API: ${message}`
      );
    }
  }

  private async createPostViaOutstand(
    payload: CreatePostPayload,
    apiKey: string
  ): Promise<CreatePostResult> {
    const accountId = payload.accountIds?.[0];
    if (!accountId) {
      throw new Error("No account ID provided");
    }

    try {
      const result = payload.scheduleAt
        ? await scheduleLinkedInViaOutstand(
            apiKey,
            accountId,
            payload.content,
            payload.scheduleAt,
            payload.mediaUrls
          )
        : await publishLinkedInViaOutstand(
            apiKey,
            accountId,
            payload.content,
            payload.mediaUrls
          );

      console.log("[linkedin-hybrid] ✓ Post published via Outstand:", result.postId);

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
          "[linkedin-hybrid] Fetching analytics for Outstand post:",
          providerPostId
        );
        const postId = providerPostId.replace("os_", "");
        const metrics = await getLinkedInAnalyticsViaOutstand(apiKey, postId);

        return {
          likes: metrics.likes,
          comments: metrics.comments,
          shares: metrics.shares,
          reach: metrics.reach,
          impressions: metrics.impressions,
          clicks: metrics.clicks,
        };
      } catch (err) {
        console.error("[linkedin-hybrid] Outstand analytics failed:", err);
        return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
      }
    }

    // Try official LinkedIn API analytics
    try {
      return await this.directProvider.getPostAnalytics(params);
    } catch (err) {
      console.error("[linkedin-hybrid] Official LinkedIn analytics failed:", err);

      // Fallback to Outstand if official failed
      if (apiKey && isOutstandPost) {
        try {
          const postId = providerPostId.replace("os_", "");
          const metrics = await getLinkedInAnalyticsViaOutstand(apiKey, postId);

          return {
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            reach: metrics.reach,
            impressions: metrics.impressions,
            clicks: metrics.clicks,
          };
        } catch (fallbackErr) {
          console.error("[linkedin-hybrid] Outstand fallback also failed:", fallbackErr);
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
      console.log(`[linkedin-hybrid] Post ${postId} published via: ${provider}`);
    } catch (err) {
      console.error("[linkedin-hybrid] Error logging provider:", err);
    }
  }
}
