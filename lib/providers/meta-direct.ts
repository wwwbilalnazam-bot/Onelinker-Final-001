// ════════════════════════════════════════════════════════════
// META DIRECT PROVIDER
//
// Implements SocialProvider using the Facebook Graph API directly.
// Use this instead of Outstand when you want to test with your
// own Meta developer app (development mode).
//
// Requires: META_APP_ID + META_APP_SECRET in env vars.
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
  buildMetaOAuthUrl,
  handleMetaOAuthCode,
  syncMetaAccountsToSupabase,
  getMetaAccessToken,
  disconnectMetaAccount,
  decodeOAuthState,
} from "@/lib/meta/accounts";
import {
  createFacebookPost,
  createInstagramPost,
} from "@/lib/meta/posts";
import {
  fetchFacebookPostMetrics,
  fetchInstagramMediaMetrics,
} from "@/lib/meta/analytics";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export class MetaDirectProvider implements SocialProvider {
  readonly name = "meta-direct";
  readonly supportedPlatforms = ["facebook", "instagram"];

  // ── OAuth ──────────────────────────────────────────────

  async startOAuth(params: {
    platform: string;
    redirectUri: string;
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<OAuthStartResult> {
    // Both facebook and instagram use the same Facebook Login flow
    const oauthUrl = buildMetaOAuthUrl({
      redirectUri: params.redirectUri,
      workspaceId: params.workspaceId,
      platform: params.platform,
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
      throw new Error("Missing authorization code from Meta OAuth");
    }

    // Use the redirect URI passed from the callback route (which matches the request origin)
    // instead of reconstructing from env vars. This ensures it matches what was sent to Meta.
    let redirectUri = passedRedirectUri;
    if (!redirectUri) {
      // Fallback for backwards compatibility
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
      redirectUri = `${appUrl}/auth/meta/callback`;
    }

    // Only sync the platform the user clicked on (facebook OR instagram, not both)
    const targetPlatform = queryParams.platform; // "facebook" or "instagram"

    // Exchange code for tokens and fetch pages/IG accounts
    // Pass targetPlatform so only relevant accounts are returned
    const oauthResult = await handleMetaOAuthCode(code, redirectUri, targetPlatform);

    // Sync filtered accounts to Supabase
    const syncResult = await syncMetaAccountsToSupabase(workspaceId, oauthResult, targetPlatform);

    const totalAccounts = targetPlatform === "instagram"
      ? oauthResult.igAccounts.length
      : oauthResult.pages.length;

    return {
      accountsConnected: totalAccounts,
      syncedCount: syncResult.synced,
    };
  }

  // ── Accounts ───────────────────────────────────────────

  async listAccounts(params: {
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<ProviderAccount[]> {
    const serviceClient = createServiceClient();

    console.log(`[meta-direct] Listing accounts for workspace: ${params.workspaceId}`);

    const { data: accounts, error } = await serviceClient
      .from("social_accounts")
      .select("outstand_account_id, platform, username, display_name, profile_picture, is_active")
      .eq("workspace_id", params.workspaceId)
      .in("platform", ["facebook", "instagram"])
      .like("outstand_account_id", "meta_%"); // only meta-direct accounts

    if (error) {
      console.error(`[meta-direct] Error querying accounts:`, error);
      return [];
    }

    console.log(`[meta-direct] Found ${accounts?.length ?? 0} Meta accounts for workspace ${params.workspaceId}:`);
    accounts?.forEach(a => {
      console.log(`  • ${a.platform.toUpperCase()}: ${a.display_name} (@${a.username}) - Active: ${a.is_active}`);
    });

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
    // For meta-direct, accounts are synced during OAuth callback.
    // This is a no-op for now — could re-fetch page tokens if needed.
    return { synced: 0, errors: 0 };
  }

  async disconnectAccount(params: {
    providerAccountId: string;
    apiKey?: string | null;
  }): Promise<void> {
    // Find the workspace for this account
    const serviceClient = createServiceClient();
    const { data } = await serviceClient
      .from("social_accounts")
      .select("workspace_id")
      .eq("outstand_account_id", params.providerAccountId)
      .single();

    if (data) {
      await disconnectMetaAccount(data.workspace_id, params.providerAccountId);
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

    // ── Resolve account identifiers ────────────────────────
    // The post route may send usernames OR outstand_account_ids.
    // We need to resolve them to outstand_account_ids (meta_fb_xxx / meta_ig_xxx)
    // to look up tokens and determine the platform.
    const resolvedAccounts: Array<{ outstandId: string; platform: string }> = [];

    for (const accountId of payload.accountIds) {
      if (accountId.startsWith("meta_fb_") || accountId.startsWith("meta_ig_")) {
        // Already an outstand_account_id
        resolvedAccounts.push({
          outstandId: accountId,
          platform: accountId.startsWith("meta_fb_") ? "facebook" : "instagram",
        });
      } else {
        // It's a username — look up the outstand_account_id from social_accounts
        const { data: found } = await serviceClient
          .from("social_accounts")
          .select("outstand_account_id, platform")
          .eq("workspace_id", workspaceId)
          .eq("username", accountId)
          .like("outstand_account_id", "meta_%")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();

        if (found) {
          resolvedAccounts.push({
            outstandId: found.outstand_account_id,
            platform: found.platform,
          });
        } else {
          throw new Error(`No valid access token for account ${accountId}. Please reconnect.`);
        }
      }
    }

    // ── Publish to each account ──────────────────────────
    const results: Array<{ id: string; platform: string }> = [];

    try {
      for (const account of resolvedAccounts) {
        const tokenData = await getMetaAccessToken(workspaceId, account.outstandId);
        if (!tokenData) {
          throw new Error(`No valid access token for account ${account.outstandId}. Please reconnect.`);
        }

        // Determine scheduled time as Unix timestamp
        let scheduledTime: number | undefined;
        if (payload.scheduleAt) {
          scheduledTime = Math.floor(new Date(payload.scheduleAt).getTime() / 1000);
        }

        if (account.platform === "facebook") {
          // Facebook Page post
          const result = await createFacebookPost({
            pageId: tokenData.pageId,
            pageAccessToken: tokenData.accessToken,
            message: payload.content,
            mediaUrls: payload.mediaUrls,
            scheduledTime,
            format: payload.format,
          });
          results.push(result);
        } else if (account.platform === "instagram" && tokenData.igUserId) {
          // Instagram post
          const result = await createInstagramPost({
            igUserId: tokenData.igUserId,
            accessToken: tokenData.accessToken,
            caption: payload.content,
            mediaUrls: payload.mediaUrls,
            format: payload.format,
          });
          results.push(result);
        }
      }
    } catch (err) {
      // Rollback usage counter on failure
      await authClient.rpc("decrement_post_usage", {
        p_workspace_id: workspaceId,
        p_month: currentMonth,
      });
      throw err;
    }

    // ── Save post record ─────────────────────────────────
    const status = payload.scheduleAt ? "scheduled" : "published";
    const providerPostId = results.map((r) => r.id).join(",");

    await serviceClient
      .from("posts")
      .insert({
        workspace_id: workspaceId,
        author_id: authorId,
        content: payload.content,
        platforms: results.map((r) => r.platform),
        account_ids: payload.accountIds,
        media_urls: payload.mediaUrls ?? [],
        status,
        scheduled_at: payload.scheduleAt ?? null,
        published_at: status === "published" ? new Date().toISOString() : null,
        outstand_post_id: `meta_${providerPostId}`, // prefix for meta-direct posts
        first_comment: payload.firstComment ?? null,
      });

    return {
      providerPostId: `meta_${providerPostId}`,
      status: status as "published" | "scheduled",
    };
  }

  async getPostStatus(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<PostStatusResult> {
    // For meta-direct, post status is tracked in our DB
    // Graph API doesn't have a simple "post status" endpoint
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
    // Delete from our DB — we could also call Graph API DELETE /{post-id}
    // but that requires knowing the token. For now just mark as cancelled.
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
    
    // providerPostId is like "meta_ID1,ID2,..."
    const rawId = providerPostId.replace("meta_", "").split(",")[0]; // Just get the first one for simplicity
    if (!rawId) return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };

    // We need the workspaceId and the resolved platform to get the token.
    // Unfortunately the provider interface doesn't pass workspaceId to getPostAnalytics.
    // We'll have to look up the post in our DB to get the workspaceId and specific account.
    const serviceClient = createServiceClient();
    const { data: post } = await serviceClient
      .from("posts")
      .select("workspace_id, account_ids, platforms")
      .eq("outstand_post_id", providerPostId)
      .single();

    if (!post || !post.workspace_id || !post.account_ids?.[0]) {
      return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
    }

    // Determine platform
    const platform = post.platforms?.[0] as "facebook" | "instagram";
    const accountId = post.account_ids[0]; // outstand_account_id

    // Fetch token
    const tokenData = await getMetaAccessToken(post.workspace_id, accountId);
    if (!tokenData) return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };

    if (platform === "facebook") {
      return fetchFacebookPostMetrics(rawId, tokenData.accessToken);
    } else {
      return fetchInstagramMediaMetrics(rawId, tokenData.accessToken);
    }
  }

  // ── Webhooks ───────────────────────────────────────────

  parseWebhook(params: {
    body: string;
    signature: string;
    secret: string;
  }): WebhookEvent | null {
    // Meta webhook verification uses app secret HMAC
    // This is a structural placeholder for now
    void params;
    return null;
  }
}
