// ════════════════════════════════════════════════════════════
// TIKTOK DIRECT PROVIDER
//
// Implements SocialProvider using the TikTok Content Posting API.
// Uses TikTok Login Kit for OAuth 2.0 authentication.
//
// TikTok-specific considerations:
//   - Uses "client_key" instead of "client_id"
//   - Access tokens expire in ~24 hours (must refresh frequently)
//   - Refresh tokens last ~365 days
//   - Video publishing uses the Content Posting API (async)
//
// Requires: TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET in env vars.
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
import {
  buildTikTokOAuthUrl,
  handleTikTokOAuthCode,
  syncTikTokProfileToSupabase,
  getTikTokAccessToken,
  disconnectTikTokAccount,
  decodeState,
} from "@/lib/tiktok/accounts";
import { publishTikTokVideo } from "@/lib/tiktok/posts";
import { fetchTikTokVideoMetrics } from "@/lib/tiktok/analytics";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export class TikTokDirectProvider implements SocialProvider {
  readonly name = "tiktok-direct";
  readonly supportedPlatforms = ["tiktok"];

  // ── OAuth ──────────────────────────────────────────────

  async startOAuth(params: {
    platform: string;
    redirectUri: string;
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<OAuthStartResult> {
    const { url: oauthUrl } = await buildTikTokOAuthUrl({
      redirectUri: params.redirectUri,
      workspaceId: params.workspaceId,
    });

    return { oauthUrl };
  }

  async handleCallback(params: {
    queryParams: Record<string, string>;
    workspaceId: string;
    redirectUri?: string;
    apiKey?: string | null;
  }): Promise<OAuthCallbackResult> {
    const { queryParams, workspaceId, redirectUri: passedRedirectUri } = params;

    const code = queryParams.code;
    const state = queryParams.state;

    if (!code) {
      throw new Error("Missing authorization code from TikTok OAuth");
    }

    // Decode state to get code_verifier (for PKCE) and original redirect_uri
    let codeVerifier: string | undefined;
    let redirectUri: string | undefined;

    if (state) {
      try {
        const decodedState = decodeState(state);
        codeVerifier = decodedState.codeVerifier;
        redirectUri = decodedState.redirectUri;
      } catch (err) {
        console.warn("[tiktok-direct] Failed to decode state:", err);
      }
    }

    // Use the redirect URI passed from the callback route (highest priority)
    if (passedRedirectUri) {
      redirectUri = passedRedirectUri;
    }

    // Fallback: reconstruct from NEXT_PUBLIC_APP_URL if not in state or passed
    if (!redirectUri) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      redirectUri = `${appUrl}/auth/tiktok/callback`;
    }

    console.log("[tiktok-direct] Exchanging code for token...");
    const oauthResult = await handleTikTokOAuthCode(code, redirectUri, codeVerifier);

    console.log("[tiktok-direct] OAuth success, user:", oauthResult.profile.display_name);

    const syncResult = await syncTikTokProfileToSupabase(workspaceId, oauthResult);

    console.log("[tiktok-direct] Sync result:", JSON.stringify(syncResult));

    if (syncResult.errors > 0 && syncResult.synced === 0) {
      throw new Error("Failed to save TikTok profile to database. Check server logs.");
    }

    return {
      accountsConnected: 1,
      syncedCount: syncResult.synced,
    };
  }

  // ── Accounts ───────────────────────────────────────────

  async listAccounts(params: {
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<ProviderAccount[]> {
    const serviceClient = createServiceClient();

    const { data: accounts } = await serviceClient
      .from("social_accounts")
      .select("outstand_account_id, platform, username, display_name, profile_picture, is_active")
      .eq("workspace_id", params.workspaceId)
      .eq("platform", "tiktok")
      .like("outstand_account_id", "tt_%");

    return (accounts ?? []).map((a) => ({
      providerAccountId: a.outstand_account_id,
      platform: a.platform,
      username: a.username,
      displayName: a.display_name,
      profilePictureUrl: a.profile_picture,
      isActive: a.is_active,
    }));
  }

  async syncAccounts(params: {
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<{ synced: number; errors: number }> {
    return { synced: 0, errors: 0 };
  }

  async disconnectAccount(params: {
    providerAccountId: string;
    apiKey?: string | null;
  }): Promise<void> {
    const serviceClient = createServiceClient();
    const { data } = await serviceClient
      .from("social_accounts")
      .select("workspace_id")
      .eq("outstand_account_id", params.providerAccountId)
      .single();

    if (data) {
      await disconnectTikTokAccount(data.workspace_id, params.providerAccountId);
    }
  }

  // ── Posting (stub — TikTok Content Posting API) ────────

  async createPost(params: {
    payload: CreatePostPayload;
    workspaceId: string;
    authorId: string;
    apiKey?: string | null;
  }): Promise<CreatePostResult> {
    const { payload, workspaceId, authorId } = params;
    const serviceClient = createServiceClient();
    const authClient = await createClient();
    const currentMonth = new Date().toISOString().slice(0, 7);

    // TikTok requires a video
    if (!payload.mediaUrls?.length) {
      throw new Error("TikTok requires a video file to publish.");
    }

    // ── Increment usage counter ──────────────────────────
    const { error: incError } = await authClient.rpc(
      "increment_post_usage",
      { p_workspace_id: workspaceId, p_month: currentMonth }
    );

    if (incError) {
      if (incError.message?.includes("limit") || incError.message?.includes("exceeded")) {
        throw new Error("You've reached your plan's post limit for this month. Upgrade to continue.");
      }
      throw new Error(`Publishing failed: ${incError.message}`);
    }

    // ── Resolve account ──────────────────────────────────
    let accountId = payload.accountIds[0] ?? "";

    if (!accountId.startsWith("tt_")) {
      const { data: found } = await serviceClient
        .from("social_accounts")
        .select("outstand_account_id")
        .eq("workspace_id", workspaceId)
        .eq("username", accountId)
        .like("outstand_account_id", "tt_%")
        .eq("is_active", true)
        .maybeSingle();

      if (found) {
        accountId = found.outstand_account_id;
      } else {
        await authClient.rpc("decrement_post_usage", {
          p_workspace_id: workspaceId,
          p_month: currentMonth,
        });
        throw new Error(`No valid access token for TikTok account ${accountId}. Please reconnect.`);
      }
    }

    const tokenData = await getTikTokAccessToken(workspaceId, accountId);
    if (!tokenData) {
      await authClient.rpc("decrement_post_usage", {
        p_workspace_id: workspaceId,
        p_month: currentMonth,
      });
      throw new Error("TikTok access token expired or invalid. Please reconnect.");
    }

    // ── Upload video to TikTok ──────────────────────────────
    // Fetch the video file from storage
    let videoBuffer: Buffer | undefined;

    try {
      if (payload.mediaUrls && payload.mediaUrls.length > 0) {
        const videoUrl = payload.mediaUrls[0];
        const res = await fetch(videoUrl);
        if (!res.ok) {
          throw new Error(`Failed to fetch video: ${res.status}`);
        }
        videoBuffer = Buffer.from(await res.arrayBuffer());
      } else {
        throw new Error("No video URL provided");
      }
    } catch (err) {
      await authClient.rpc("decrement_post_usage", {
        p_workspace_id: workspaceId,
        p_month: currentMonth,
      });
      throw new Error(`Video fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // ── Publish to TikTok ───────────────────────────────────
    const fileName = `onelinker-${Date.now()}.mp4`;
    const postResult = await publishTikTokVideo(
      tokenData.accessToken,
      videoBuffer,
      fileName,
      payload.content
    );

    if (postResult.status === "failed") {
      await authClient.rpc("decrement_post_usage", {
        p_workspace_id: workspaceId,
        p_month: currentMonth,
      });
      throw new Error(`TikTok publishing failed: ${postResult.error}`);
    }

    // ── Store post metadata ─────────────────────────────────
    const now = new Date().toISOString();
    const { error: postError } = await serviceClient
      .from("posts")
      .insert({
        workspace_id: workspaceId,
        author_id: authorId,
        outstand_post_id: `tt_${postResult.postId}`,
        platform: "tiktok",
        content: payload.content,
        status: "published",
        published_at: now,
        created_at: now,
      });

    if (postError) {
      console.error("[tiktok-direct] Post metadata save failed:", postError);
      // Don't fail if metadata storage fails — post was already published
    }

    return {
      providerPostId: `tt_${postResult.postId}`,
      status: "published",
    };
  }

  async getPostStatus(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<PostStatusResult> {
    const serviceClient = createServiceClient();

    const { data } = await serviceClient
      .from("posts")
      .select("status, published_at")
      .eq("outstand_post_id", params.providerPostId)
      .single();

    const statusMap: Record<string, PostStatusResult["status"]> = {
      scheduled: "scheduled",
      published: "published",
      failed: "failed",
      draft: "draft",
    };

    return {
      providerPostId: params.providerPostId,
      status: statusMap[data?.status ?? ""] ?? "draft",
      publishedAt: data?.published_at ?? undefined,
    };
  }

  async deletePost(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<void> {
    const serviceClient = createServiceClient();

    await serviceClient
      .from("posts")
      .update({ status: "cancelled" })
      .eq("outstand_post_id", params.providerPostId);
  }

  async getPostAnalytics(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<PostAnalytics> {
    const { providerPostId } = params;
    const videoId = providerPostId.replace("tt_", "");
    if (!videoId) return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };

    const serviceClient = createServiceClient();
    const { data: post } = await serviceClient
      .from("posts")
      .select("workspace_id, account_ids")
      .eq("outstand_post_id", providerPostId)
      .single();

    if (!post || !post.workspace_id || !post.account_ids?.[0]) {
      return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
    }

    const accountId = post.account_ids[0];
    const tokenData = await getTikTokAccessToken(post.workspace_id, accountId);
    if (!tokenData) return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };

    const stats = await fetchTikTokVideoMetrics(videoId, tokenData.accessToken);

    return {
      likes: stats.likes,
      comments: stats.comments,
      shares: stats.shares,
      reach: stats.views, // Use views as reach proxy
      impressions: stats.views,
      clicks: 0,
    };
  }

  // ── Webhooks ───────────────────────────────────────────

  parseWebhook(params: {
    body: string;
    signature: string;
    secret: string;
  }): WebhookEvent | null {
    void params;
    return null;
  }
}
