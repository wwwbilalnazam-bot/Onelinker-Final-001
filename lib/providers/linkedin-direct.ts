// ════════════════════════════════════════════════════════════
// LINKEDIN DIRECT PROVIDER
//
// Implements SocialProvider using the LinkedIn API directly.
// Uses your own LinkedIn OAuth app credentials.
//
// Requires: LINKEDIN_CLIENT_ID + LINKEDIN_CLIENT_SECRET in env vars.
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
  buildLinkedInOAuthUrl,
  handleLinkedInOAuthCode,
  syncLinkedInProfileToSupabase,
  getLinkedInAccessToken,
  disconnectLinkedInAccount,
} from "@/lib/linkedin/accounts";
import { fetchLinkedInPostMetrics } from "@/lib/linkedin/analytics";
import {
  createLinkedInPost,
  deleteLinkedInPost,
} from "@/lib/linkedin/posts";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export class LinkedInDirectProvider implements SocialProvider {
  readonly name = "linkedin-direct";
  readonly supportedPlatforms = ["linkedin"];

  // ── OAuth ──────────────────────────────────────────────

  async startOAuth(params: {
    platform: string;
    redirectUri: string;
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<OAuthStartResult> {
    const oauthUrl = buildLinkedInOAuthUrl({
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
    if (!code) {
      throw new Error("Missing authorization code from LinkedIn OAuth");
    }

    // Use the redirect URI passed from the callback route
    let redirectUri = passedRedirectUri;
    if (!redirectUri) {
      // Fallback for backwards compatibility
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      redirectUri = `${appUrl}/auth/linkedin/callback`;
    }

    console.log("[linkedin-direct] Exchanging code for token...");
    const oauthResult = await handleLinkedInOAuthCode(code, redirectUri);

    console.log("[linkedin-direct] OAuth success, profile:", oauthResult.profile.name, oauthResult.profile.sub);

    const syncResult = await syncLinkedInProfileToSupabase(workspaceId, oauthResult);

    console.log("[linkedin-direct] Sync result:", JSON.stringify(syncResult));

    if (syncResult.errors > 0 && syncResult.synced === 0) {
      throw new Error("Failed to save LinkedIn profile to database. Check server logs.");
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
      .eq("platform", "linkedin")
      .like("outstand_account_id", "li_%");

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
      await disconnectLinkedInAccount(data.workspace_id, params.providerAccountId);
    }
  }

  // ── Posting ────────────────────────────────────────────

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

    if (!accountId.startsWith("li_")) {
      // Resolve username → outstand_account_id
      const { data: found } = await serviceClient
        .from("social_accounts")
        .select("outstand_account_id")
        .eq("workspace_id", workspaceId)
        .eq("username", accountId)
        .like("outstand_account_id", "li_%")
        .eq("is_active", true)
        .maybeSingle();

      if (found) {
        accountId = found.outstand_account_id;
      } else {
        await authClient.rpc("decrement_post_usage", {
          p_workspace_id: workspaceId,
          p_month: currentMonth,
        });
        throw new Error(`No valid access token for LinkedIn account ${accountId}. Please reconnect.`);
      }
    }

    const tokenData = await getLinkedInAccessToken(workspaceId, accountId);
    if (!tokenData) {
      await authClient.rpc("decrement_post_usage", {
        p_workspace_id: workspaceId,
        p_month: currentMonth,
      });
      throw new Error("LinkedIn access token expired or invalid. Please reconnect.");
    }

    // ── Create post ───────────────────────────────────────
    let result;
    try {
      result = await createLinkedInPost({
        authorUrn: tokenData.linkedinUrn,
        accessToken: tokenData.accessToken,
        text: payload.content,
        mediaUrls: payload.mediaUrls,
        format: payload.format,
      });
    } catch (err) {
      await authClient.rpc("decrement_post_usage", {
        p_workspace_id: workspaceId,
        p_month: currentMonth,
      });
      throw err;
    }

    // ── Save post record ─────────────────────────────────
    const providerPostId = `li_${result.postUrn}`;

    await serviceClient
      .from("posts")
      .insert({
        workspace_id: workspaceId,
        author_id: authorId,
        content: payload.content,
        platforms: ["linkedin"],
        account_ids: payload.accountIds,
        media_urls: payload.mediaUrls ?? [],
        status: "published",
        scheduled_at: null,
        published_at: new Date().toISOString(),
        outstand_post_id: providerPostId,
        first_comment: payload.firstComment ?? null,
      });

    return {
      providerPostId,
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

    // Try to delete from LinkedIn
    const postUrn = params.providerPostId.replace("li_", "");
    const { data } = await serviceClient
      .from("posts")
      .select("workspace_id, account_ids")
      .eq("outstand_post_id", params.providerPostId)
      .single();

    if (data?.account_ids?.[0] && data.workspace_id) {
      try {
        const tokenData = await getLinkedInAccessToken(data.workspace_id, data.account_ids[0]);
        if (tokenData) {
          await deleteLinkedInPost(postUrn, tokenData.accessToken);
        }
      } catch (err) {
        console.error("[linkedin-direct] Failed to delete from LinkedIn:", err);
      }
    }

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
    const postUrn = providerPostId.replace("li_", "");
    if (!postUrn) return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };

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
    const tokenData = await getLinkedInAccessToken(post.workspace_id, accountId);
    if (!tokenData) return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };

    const stats = await fetchLinkedInPostMetrics(postUrn, tokenData.accessToken);

    return {
      likes: stats.likes,
      comments: stats.comments,
      shares: stats.shares,
      reach: stats.impressions, // Use impressions as reach proxy if reach not available
      impressions: stats.impressions,
      clicks: stats.clicks,
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
