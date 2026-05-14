// ════════════════════════════════════════════════════════════
// META ACCOUNTS — OAuth, Pages, Instagram Business Accounts
//
// Handles the full Facebook Login flow:
//   1. Generate OAuth URL → user authorizes
//   2. Exchange code for token → get long-lived token
//   3. Fetch Facebook Pages (with page access tokens)
//   4. Fetch linked Instagram Business Accounts
//   5. Store tokens + accounts in Supabase
// ════════════════════════════════════════════════════════════

import {
  GRAPH_API_BASE,
  getMetaAppId,
  graphGet,
  exchangeCodeForToken,
  getLongLivedToken,
} from "./client";
import { createServiceClient } from "@/lib/supabase/server";

// ── Types ───────────────────────────────────────────────────

export interface MetaPage {
  id: string;
  name: string;
  access_token: string;
  category?: string;
  picture?: { data?: { url?: string } };
  username?: string;
  followers_count?: number;
  instagram_business_account?: { id: string };
}

export interface MetaIGAccount {
  id: string;
  name: string;
  username: string;
  profile_picture_url: string | null;
  followers_count: number;
  /** The Facebook Page ID that owns this IG account */
  pageId: string;
  /** The page access token (needed for IG API calls) */
  pageAccessToken: string;
}

// ── Facebook Login OAuth scopes ─────────────────────────────
// Only approved permissions from Meta App Review.
// Approved: pages_show_list, pages_read_engagement, pages_manage_engagement,
//           pages_manage_posts, pages_read_user_content,
//           instagram_basic, instagram_content_publish

const FACEBOOK_ONLY_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_manage_posts",
  "pages_read_user_content",
].join(",");

const INSTAGRAM_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "pages_read_user_content",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

const ALL_META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_engagement",
  "pages_manage_posts",
  "pages_read_user_content",
  "instagram_basic",
  "instagram_content_publish",
].join(",");

// ── Helpers ─────────────────────────────────────────────────

/** Strip query params from a URL — Facebook requires exact redirect_uri match */
function stripQueryParams(uri: string): string {
  try {
    const u = new URL(uri);
    return `${u.origin}${u.pathname}`;
  } catch {
    // If it's not a valid URL, return the part before '?'
    return uri.split("?")[0] ?? uri;
  }
}

// ── Step 1: Generate OAuth URL ──────────────────────────────

export function buildMetaOAuthUrl(params: {
  redirectUri: string;
  workspaceId: string;
  platform: string;
}): string {
  const appId = getMetaAppId();

  // Encode workspace + platform info in state for CSRF protection and routing
  const statePayload = JSON.stringify({
    workspaceId: params.workspaceId,
    platform: params.platform,
    nonce: crypto.randomUUID(),
  });
  const state = Buffer.from(statePayload).toString("base64url");

  // Strip query params from redirect_uri — workspace/platform info goes in state.
  // Facebook requires redirect_uri to EXACTLY match during code exchange.
  const cleanRedirectUri = stripQueryParams(params.redirectUri);

  const url = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", cleanRedirectUri);
  const scopes = params.platform === "instagram" ? INSTAGRAM_SCOPES
               : params.platform === "facebook" ? FACEBOOK_ONLY_SCOPES
               : ALL_META_SCOPES;
  url.searchParams.set("scope", scopes);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");

  return url.toString();
}

// ── Step 2: Handle callback — exchange code, get pages ──────

export interface MetaOAuthResult {
  pages: MetaPage[];
  igAccounts: MetaIGAccount[];
  userAccessToken: string;
  userId: string;
}

export async function handleMetaOAuthCode(
  code: string,
  redirectUri: string
): Promise<MetaOAuthResult> {
  // Exchange code for short-lived token
  const { accessToken: shortToken } = await exchangeCodeForToken(code, redirectUri);

  // Upgrade to long-lived token (~60 days)
  const { accessToken: longToken } = await getLongLivedToken(shortToken);

  // Get user info
  const user = await graphGet<{ id: string; name: string }>("/me", {
    fields: "id,name",
  }, longToken);

  // Fetch all Facebook Pages the user manages (with pagination)
  let pages: MetaPage[] = [];
  let after: string | undefined;
  let pagesFetched = 0;

  do {
    const pagesRes = await graphGet<{
      data: MetaPage[];
      paging?: { cursors?: { after?: string } };
    }>(`/${user.id}/accounts`, {
      fields: "id,name,access_token,category,picture,username,followers_count,instagram_business_account",
      limit: 100,
      ...(after ? { after } : {}),
    }, longToken);

    const batchPages = pagesRes.data ?? [];
    pages = pages.concat(batchPages);
    pagesFetched += batchPages.length;
    after = pagesRes.paging?.cursors?.after;

    console.log(`[meta/accounts] Fetched batch of ${batchPages.length} pages (total so far: ${pagesFetched})`);
  } while (after);

  console.log(`[meta/accounts] Fetched ${pages.length} total pages from Graph API:`, pages.map(p => ({ id: p.id, name: p.name, hasToken: !!p.access_token })));

  // For each page with an IG business account, fetch IG details
  const igAccounts: MetaIGAccount[] = [];

  for (const page of pages) {
    if (page.instagram_business_account?.id) {
      try {
        const ig = await graphGet<{
          id: string;
          name: string;
          username: string;
          profile_picture_url: string;
          followers_count: number;
        }>(`/${page.instagram_business_account.id}`, {
          fields: "id,name,username,profile_picture_url,followers_count",
        }, page.access_token);

        igAccounts.push({
          id: ig.id,
          name: ig.name,
          username: ig.username,
          profile_picture_url: ig.profile_picture_url ?? null,
          followers_count: ig.followers_count ?? 0,
          pageId: page.id,
          pageAccessToken: page.access_token,
        });
      } catch (err) {
        console.error(`[meta/accounts] Failed to fetch IG account for page ${page.id}:`, err);
      }
    }
  }

  return {
    pages,
    igAccounts,
    userAccessToken: longToken,
    userId: user.id,
  };
}

// ── Step 3: Store accounts + tokens in Supabase ─────────────
//
// We store:
//   - Each Facebook Page as a social_account (platform = "facebook")
//   - Each Instagram Business Account as a social_account (platform = "instagram")
//   - Page access tokens in meta_tokens table (encrypted at rest by Supabase)

export async function syncMetaAccountsToSupabase(
  workspaceId: string,
  oauthResult: MetaOAuthResult,
  /** Which platform was requested: "facebook" or "instagram". Only sync that one. */
  targetPlatform?: string
): Promise<{ synced: number; errors: number }> {
  const { TokenVault } = await import("@/lib/services/TokenVault");
  const serviceClient = createServiceClient();
  let synced = 0;
  let errors = 0;

  const syncFacebook = !targetPlatform || targetPlatform === "facebook";
  const syncInstagram = !targetPlatform || targetPlatform === "instagram";

  // Validate encryption is configured
  if (!TokenVault.isConfigured()) {
    console.error("[meta/accounts] TOKEN_ENCRYPTION_KEY not configured. Tokens cannot be stored securely.");
    throw new Error("TOKEN_ENCRYPTION_KEY not configured. Set it in .env.local");
  }

  // ── Sync Facebook Pages (only if connecting Facebook) ──────
  if (!syncFacebook) {
    // Still need to store FB page tokens for Instagram
    // because IG API uses the parent page's access token
    if (syncInstagram) {
      for (const page of oauthResult.pages) {
        if (page.instagram_business_account?.id) {
          try {
            const encryptedToken = TokenVault.encrypt(page.access_token);
            await serviceClient
              .from("meta_tokens")
              .upsert(
                {
                  workspace_id: workspaceId,
                  account_id: `meta_fb_${page.id}`,
                  platform: "facebook",
                  page_id: page.id,
                  access_token: encryptedToken,
                  user_access_token: TokenVault.encrypt(oauthResult.userAccessToken),
                  meta_user_id: oauthResult.userId,
                  expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
                  updated_at: new Date().toISOString(),
                },
                { onConflict: "workspace_id,account_id" }
              );
          } catch (err) {
            console.error("[meta/accounts] Failed to encrypt tokens:", err);
            errors++;
          }
        }
      }
    }
  }

  console.log(`[meta/accounts] Starting sync: syncFacebook=${syncFacebook}, syncInstagram=${syncInstagram}, totalPages=${oauthResult.pages.length}, totalIGAccounts=${oauthResult.igAccounts.length}, targetPlatform=${targetPlatform}`);

  for (const page of oauthResult.pages) {
    if (!syncFacebook) {
      console.log(`[meta/accounts] Skipping Facebook page ${page.id} (targetPlatform=${targetPlatform})`);
      continue;
    }
    try {
      const accountId = `meta_fb_${page.id}`;
      const encryptedToken = TokenVault.encrypt(page.access_token);
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(); // ~60 days

      // Upsert social account WITH encrypted token
      const { error } = await serviceClient
        .from("social_accounts")
        .upsert(
          {
            workspace_id: workspaceId,
            outstand_account_id: accountId,
            platform: "facebook",
            username: page.username || page.name,
            display_name: page.name,
            profile_picture: page.picture?.data?.url ?? null,
            followers_count: page.followers_count ?? 0,
            is_active: true,
            health_status: "healthy",
            encrypted_access_token: encryptedToken,
            token_expires_at: expiresAt,
            connected_at: new Date().toISOString(),
            last_synced: new Date().toISOString(),
          },
          { onConflict: "workspace_id,outstand_account_id" }
        );

      if (error) {
        console.error("[meta/accounts] Upsert FB page failed:", error);
        errors++;
        continue;
      }

      // Also store in meta_tokens for legacy compatibility
      const encryptedMetaToken = TokenVault.encrypt(page.access_token);
      await serviceClient
        .from("meta_tokens")
        .upsert(
          {
            workspace_id: workspaceId,
            account_id: accountId,
            platform: "facebook",
            page_id: page.id,
            access_token: encryptedMetaToken,
            user_access_token: TokenVault.encrypt(oauthResult.userAccessToken),
            meta_user_id: oauthResult.userId,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,account_id" }
        );

      console.log(`[meta/accounts] Successfully synced Facebook page: ${accountId}`);
      synced++;
    } catch (err) {
      console.error("[meta/accounts] FB page sync error:", err);
      errors++;
    }
  }

  // ── Sync Instagram Business Accounts (only if connecting Instagram) ──
  for (const ig of oauthResult.igAccounts) {
    if (!syncInstagram) continue;
    try {
      const accountId = `meta_ig_${ig.id}`;
      const encryptedPageToken = TokenVault.encrypt(ig.pageAccessToken);
      const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

      // Upsert social account WITH encrypted token
      const { error } = await serviceClient
        .from("social_accounts")
        .upsert(
          {
            workspace_id: workspaceId,
            outstand_account_id: accountId,
            platform: "instagram",
            username: ig.username,
            display_name: ig.name,
            profile_picture: ig.profile_picture_url,
            followers_count: ig.followers_count,
            is_active: true,
            health_status: "healthy",
            encrypted_access_token: encryptedPageToken, // IG API uses the page token
            token_expires_at: expiresAt,
            connected_at: new Date().toISOString(),
            last_synced: new Date().toISOString(),
          },
          { onConflict: "workspace_id,outstand_account_id" }
        );

      if (error) {
        console.error("[meta/accounts] Upsert IG account failed:", error);
        errors++;
        continue;
      }

      // Also store in meta_tokens for legacy compatibility
      const encryptedMetaToken = TokenVault.encrypt(ig.pageAccessToken);
      await serviceClient
        .from("meta_tokens")
        .upsert(
          {
            workspace_id: workspaceId,
            account_id: accountId,
            platform: "instagram",
            page_id: ig.pageId,
            ig_user_id: ig.id,
            access_token: encryptedMetaToken,
            user_access_token: TokenVault.encrypt(oauthResult.userAccessToken),
            meta_user_id: oauthResult.userId,
            expires_at: expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "workspace_id,account_id" }
        );

      console.log(`[meta/accounts] Successfully synced Instagram account: ${accountId}`);
      synced++;
    } catch (err) {
      console.error("[meta/accounts] IG account sync error:", err);
      errors++;
    }
  }

  return { synced, errors };
}

// ── Get stored access token for a social account ────────────

export async function getMetaAccessToken(
  workspaceId: string,
  accountId: string
): Promise<{ accessToken: string; pageId: string; igUserId?: string } | null> {
  const { TokenVault } = await import("@/lib/services/TokenVault");
  const serviceClient = createServiceClient();

  const { data } = await serviceClient
    .from("meta_tokens")
    .select("access_token, page_id, ig_user_id, expires_at")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .single();

  if (!data) return null;

  // Check if token is expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    console.warn("[meta/accounts] Token expired for", accountId);
    // Mark account as needing reconnection
    await serviceClient
      .from("social_accounts")
      .update({ health_status: "token_expired", is_active: false })
      .eq("workspace_id", workspaceId)
      .eq("outstand_account_id", accountId);
    return null;
  }

  try {
    // Decrypt the token (may be encrypted with TokenVault or plaintext for backwards compatibility)
    let decryptedToken = data.access_token;
    try {
      decryptedToken = TokenVault.decrypt(data.access_token);
    } catch {
      // Token might be plaintext (old data), try using as-is
      if (!data.access_token.includes(":")) {
        decryptedToken = data.access_token;
      } else {
        throw new Error("Failed to decrypt token");
      }
    }

    return {
      accessToken: decryptedToken,
      pageId: data.page_id,
      igUserId: data.ig_user_id ?? undefined,
    };
  } catch (err) {
    console.error(`[meta/accounts] Failed to decrypt token for ${accountId}:`, err);
    return null;
  }
}

// ── Disconnect a Meta account ───────────────────────────────

export async function disconnectMetaAccount(
  workspaceId: string,
  accountId: string
): Promise<void> {
  const serviceClient = createServiceClient();

  // Remove token
  await serviceClient
    .from("meta_tokens")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId);

  // Mark as disconnected
  await serviceClient
    .from("social_accounts")
    .update({ is_active: false, health_status: "disconnected" })
    .eq("workspace_id", workspaceId)
    .eq("outstand_account_id", accountId);
}

// ── Decode state param from OAuth callback ──────────────────

export function decodeOAuthState(state: string): {
  workspaceId: string;
  platform: string;
  nonce: string;
} | null {
  try {
    const json = Buffer.from(state, "base64url").toString("utf-8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}
