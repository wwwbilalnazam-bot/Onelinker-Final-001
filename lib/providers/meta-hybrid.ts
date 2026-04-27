// ════════════════════════════════════════════════════════════
// META HYBRID PROVIDER
//
// Combines Outstand.so (primary) with Meta Graph API
// as fallback. Uses Outstand for all posting operations.
// Falls back to official API only if Outstand fails.
//
// Strategy:
//   - Publishing (immediate & scheduled): Outstand → Meta API
//   - Analytics: Outstand (if Outstand post) → Meta API
//   - OAuth: Official (Meta Login Kit only)
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
import { MetaDirectProvider } from "./meta-direct";
import {
  publishFacebookViaOutstand,
  scheduleFacebookViaOutstand,
  getFacebookAnalyticsViaOutstand,
} from "@/lib/outstand/facebook";
import {
  publishInstagramViaOutstand,
  scheduleInstagramViaOutstand,
  getInstagramAnalyticsViaOutstand,
} from "@/lib/outstand/instagram";
import { OutstandApiError } from "@/lib/outstand/client";

export class MetaHybridProvider implements SocialProvider {
  readonly name = "meta-hybrid";
  readonly supportedPlatforms = ["facebook", "instagram"];

  private directProvider = new MetaDirectProvider();

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

    // Determine platform from payload or first account
    const platform = payload.platforms?.[0] || "facebook";

    // Primary: Outstand.so
    if (apiKey) {
      try {
        console.log("[meta-hybrid] Publishing via Outstand.so (primary)...");
        return await this.createPostViaOutstand(platform, payload, apiKey);
      } catch (err) {
        console.warn(
          "[meta-hybrid] Outstand.so failed:",
          err instanceof Error ? err.message : String(err)
        );
        // Fall through to official API
      }
    }

    // Fallback: Official Meta API
    try {
      console.log("[meta-hybrid] Falling back to official Meta API...");
      const result = await this.directProvider.createPost({
        payload,
        workspaceId,
        authorId,
        apiKey,
      });

      console.log(
        "[meta-hybrid] ✓ Post published via official Meta API:",
        result.providerPostId
      );

      this.logProviderUsed(result.providerPostId, "direct");
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[meta-hybrid] Official Meta API also failed:", message);
      throw new Error(
        `Meta posting failed via both Outstand and official API: ${message}`
      );
    }
  }

  private async createPostViaOutstand(
    platform: string,
    payload: CreatePostPayload,
    apiKey: string
  ): Promise<CreatePostResult> {
    const accountId = payload.accountIds?.[0];
    if (!accountId) {
      throw new Error("No account ID provided");
    }

    // Strip meta_ prefix if present
    const cleanAccountId = accountId.replace(/^meta_(fb|ig)_/, "");

    try {
      const result = payload.scheduleAt
        ? platform === "instagram"
          ? await scheduleInstagramViaOutstand(
              apiKey,
              cleanAccountId,
              payload.content,
              payload.scheduleAt,
              payload.mediaUrls,
              payload.format
            )
          : await scheduleFacebookViaOutstand(
              apiKey,
              cleanAccountId,
              payload.content,
              payload.scheduleAt,
              payload.mediaUrls,
              payload.format
            )
        : platform === "instagram"
        ? await publishInstagramViaOutstand(
            apiKey,
            cleanAccountId,
            payload.content,
            payload.mediaUrls,
            payload.format
          )
        : await publishFacebookViaOutstand(
            apiKey,
            cleanAccountId,
            payload.content,
            payload.mediaUrls,
            payload.format
          );

      console.log("[meta-hybrid] ✓ Post published via Outstand:", result.postId);

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
          "[meta-hybrid] Fetching analytics for Outstand post:",
          providerPostId
        );
        const postId = providerPostId.replace("os_", "");

        // Try to determine platform from DB or assume both
        // For now, try Facebook first, then Instagram
        try {
          const metrics = await getFacebookAnalyticsViaOutstand(apiKey, postId);
          return metrics;
        } catch {
          const metrics = await getInstagramAnalyticsViaOutstand(apiKey, postId);
          return metrics;
        }
      } catch (err) {
        console.error("[meta-hybrid] Outstand analytics failed:", err);
        return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
      }
    }

    // Try official Meta API analytics
    try {
      return await this.directProvider.getPostAnalytics(params);
    } catch (err) {
      console.error("[meta-hybrid] Official Meta analytics failed:", err);
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
      console.log(`[meta-hybrid] Post ${postId} published via: ${provider}`);
    } catch (err) {
      console.error("[meta-hybrid] Error logging provider:", err);
    }
  }
}
