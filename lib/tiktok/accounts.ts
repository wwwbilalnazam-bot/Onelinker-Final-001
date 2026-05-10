// ════════════════════════════════════════════════════════════
// TIKTOK ACCOUNTS — OAuth, Profile Management
//
// Handles the full TikTok Login Kit OAuth flow:
//   1. Generate OAuth URL → user authorizes on TikTok
//   2. Exchange code for access + refresh tokens
//   3. Fetch TikTok user profile
//   4. Store tokens + profile in Supabase
//
// TikTok-specific OAuth requirements:
//   - Uses "client_key" (not "client_id")
//   - Redirect URI must be HTTPS in production
//   - State param is mandatory
//   - Access tokens expire in ~24 hours (refresh tokens ~365 days)
//   - Scopes use comma separation in auth URL
// ════════════════════════════════════════════════════════════

import {
  TIKTOK_AUTH_BASE,
  getTikTokClientKey,
  exchangeTikTokCode,
  tiktokGet,
  refreshTikTokToken,
} from "./client";
import { createServiceClient } from "@/lib/supabase/server";

// ── Types ───────────────────────────────────────────────────

export interface TikTokProfile {
  open_id: string;
  union_id?: string;
  display_name: string;
  avatar_url: string | null;
  follower_count?: number;
  username?: string;
}

// ── TikTok OAuth scopes ─────────────────────────────────────
// TikTok Login Kit scopes. Comma-separated in the auth URL.
// user.info.basic: Required for basic profile info
// video.publish: Required for posting videos
// video.list: For reading user's video list

// TikTok Login Kit scopes - start with minimal required scopes
// user.info.basic: Required for basic profile info (open_id, display_name)
// video.publish: Required for posting videos
// user.info.profile: Optional - gets follower count, avatar (may fail if not authorized)
// video.list: Optional - reading user's video list (may fail if not authorized)
const TIKTOK_SCOPES = [
  "user.info.basic",
  "video.publish",
].join(",");

// ── Helpers ─────────────────────────────────────────────────

function stripQueryParams(uri: string): string {
  try {
    const u = new URL(uri);
    return `${u.origin}${u.pathname}`;
  } catch {
    return uri.split("?")[0] ?? uri;
  }
}

export interface DecodedState {
  workspaceId: string;
  platform: string;
  nonce: string;
  codeVerifier?: string;
  redirectUri?: string;
}

export function decodeState(state: string): DecodedState {
  try {
    const payload = Buffer.from(state, "base64url").toString("utf-8");
    return JSON.parse(payload);
  } catch (err) {
    throw new Error(`Failed to decode state: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── PKCE Helpers ────────────────────────────────────────────
// TikTok sandbox requires PKCE (Proof Key for Code Exchange)

function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Buffer.from(array).toString("base64url").replace(/[^a-zA-Z0-9-._~]/g, "");
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Buffer.from(hash).toString("base64url").replace(/[^a-zA-Z0-9-._~]/g, "");
}

// ── Step 1: Generate OAuth URL ──────────────────────────────
// TikTok uses /v2/auth/authorize/ with "client_key" param.
// Requires PKCE in sandbox mode.

export async function buildTikTokOAuthUrl(params: {
  redirectUri: string;
  workspaceId: string;
}): Promise<{ url: string; codeVerifier: string }> {
  const clientKey = getTikTokClientKey();

  // Diagnostic logging
  console.log(
    `[tiktok/oauth] Building auth URL for workspace: ${params.workspaceId}`
  );
  console.log(
    `[tiktok/oauth] Client key length: ${clientKey.length}, first 4 chars: ${clientKey.slice(0, 4)}...`
  );
  console.log(
    `[tiktok/oauth] Redirect URI: ${params.redirectUri}`
  );

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  const statePayload = JSON.stringify({
    workspaceId: params.workspaceId,
    platform: "tiktok",
    nonce: crypto.randomUUID(),
    codeVerifier, // Include in state for retrieval in callback
    redirectUri: params.redirectUri, // Include original redirectUri to prevent mismatch
  });
  const state = Buffer.from(statePayload).toString("base64url");

  const cleanRedirectUri = stripQueryParams(params.redirectUri);

  // TikTok Login Kit v2 authorization URL
  const url = new URL(`${TIKTOK_AUTH_BASE}/v2/auth/authorize/`);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("redirect_uri", cleanRedirectUri);
  url.searchParams.set("scope", TIKTOK_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  // Force login screen to appear - allows connecting different accounts
  url.searchParams.set("opt_display", "popup");

  console.log("[tiktok/oauth] Generated OAuth URL with scopes:", TIKTOK_SCOPES);
  console.log("[tiktok/oauth] Full URL:", url.toString().substring(0, 150) + "...");

  return { url: url.toString(), codeVerifier };
}

// ── Step 2: Handle callback — exchange code, get profile ────

export interface TikTokOAuthResult {
  profile: TikTokProfile;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  refreshExpiresIn: number;
}

export async function handleTikTokOAuthCode(
  code: string,
  redirectUri: string,
  codeVerifier?: string
): Promise<TikTokOAuthResult> {
  // Exchange code for tokens (with PKCE code_verifier if available)
  const tokenData = await exchangeTikTokCode(code, redirectUri, codeVerifier);

  // Fetch user profile using TikTok User Info endpoint
  // TikTok v2 requires fields parameter to specify which data to return
  // Start with basic fields only - if that fails, it means scope issue
  let profileRes = await tiktokGet<{
    data: {
      user: {
        open_id: string;
        union_id?: string;
        display_name: string;
        avatar_url?: string;
        follower_count?: number;
        username?: string;
      };
    };
    error: { code: string; message: string };
  }>("/user/info/", {
    // Request only basic fields that are guaranteed by user.info.basic scope
    fields: "open_id,display_name",
  }, tokenData.access_token);

  const user = profileRes.data?.user;
  if (!user?.open_id) {
    throw new Error("No TikTok profile received. Check app permissions.");
  }

  return {
    profile: {
      open_id: user.open_id,
      union_id: user.union_id,
      display_name: user.display_name ?? "TikTok User",
      avatar_url: user.avatar_url ?? null,
      follower_count: user.follower_count ?? 0,
      username: user.username,
    },
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresIn: tokenData.expires_in,
    refreshExpiresIn: tokenData.refresh_expires_in,
  };
}

// ── Step 3: Store profile + tokens in Supabase ──────────────

export async function syncTikTokProfileToSupabase(
  workspaceId: string,
  oauthResult: TikTokOAuthResult
): Promise<{ synced: number; errors: number }> {
  const serviceClient = createServiceClient();
  const { profile } = oauthResult;

  const accountId = `tt_${profile.open_id}`;

  try {
    // Upsert social account
    const { error } = await serviceClient
      .from("social_accounts")
      .upsert(
        {
          workspace_id: workspaceId,
          outstand_account_id: accountId,
          platform: "tiktok",
          username: profile.username ?? profile.display_name,
          display_name: profile.display_name,
          profile_picture: profile.avatar_url,
          followers_count: profile.follower_count ?? 0,
          is_active: true,
          health_status: "healthy",
          last_synced: new Date().toISOString(),
        },
        { onConflict: "workspace_id,outstand_account_id" }
      );

    if (error) {
      console.error("[tiktok/accounts] Upsert profile failed:", JSON.stringify(error));
      throw new Error(`Failed to save TikTok profile: ${error.message}`);
    }

    // Store tokens
    const { error: tokenError } = await serviceClient
      .from("tiktok_tokens")
      .upsert(
        {
          workspace_id: workspaceId,
          account_id: accountId,
          tiktok_open_id: profile.open_id,
          access_token: oauthResult.accessToken,
          refresh_token: oauthResult.refreshToken,
          expires_at: new Date(Date.now() + oauthResult.expiresIn * 1000).toISOString(),
          refresh_expires_at: new Date(Date.now() + oauthResult.refreshExpiresIn * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,account_id" }
      );

    if (tokenError) {
      console.error("[tiktok/accounts] Token upsert failed:", JSON.stringify(tokenError));
      throw new Error(`Failed to save TikTok tokens: ${tokenError.message}`);
    }

    return { synced: 1, errors: 0 };
  } catch (err) {
    console.error("[tiktok/accounts] Sync error:", err);
    throw err;
  }
}

// ── Get access token (auto-refresh if expired) ──────────────

export async function getTikTokAccessToken(
  workspaceId: string,
  accountId: string
): Promise<{ accessToken: string; openId: string } | null> {
  const serviceClient = createServiceClient();

  const { data } = await serviceClient
    .from("tiktok_tokens")
    .select("access_token, refresh_token, tiktok_open_id, expires_at, refresh_expires_at")
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId)
    .single();

  if (!data) return null;

  // Check if access token is still valid (5-min buffer)
  const expiresAt = new Date(data.expires_at);
  const now = new Date(Date.now() + 5 * 60 * 1000);

  if (expiresAt > now) {
    return { accessToken: data.access_token, openId: data.tiktok_open_id };
  }

  // Access token expired — check if refresh token is still valid
  if (!data.refresh_token) {
    return markTokenExpired(serviceClient, workspaceId, accountId);
  }

  const refreshExpiresAt = new Date(data.refresh_expires_at);
  if (refreshExpiresAt < new Date()) {
    return markTokenExpired(serviceClient, workspaceId, accountId);
  }

  // Refresh the access token
  try {
    const refreshed = await refreshTikTokToken(data.refresh_token);

    await serviceClient
      .from("tiktok_tokens")
      .update({
        access_token: refreshed.accessToken,
        refresh_token: refreshed.refreshToken,
        expires_at: new Date(Date.now() + refreshed.expiresIn * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("account_id", accountId);

    return { accessToken: refreshed.accessToken, openId: data.tiktok_open_id };
  } catch (err) {
    console.error("[tiktok/accounts] Token refresh failed:", err);
    return markTokenExpired(serviceClient, workspaceId, accountId);
  }
}

async function markTokenExpired(
  serviceClient: ReturnType<typeof createServiceClient>,
  workspaceId: string,
  accountId: string
): Promise<null> {
  console.warn("[tiktok/accounts] Token expired for", accountId);
  await serviceClient
    .from("social_accounts")
    .update({ health_status: "token_expired", is_active: false })
    .eq("workspace_id", workspaceId)
    .eq("outstand_account_id", accountId);
  return null;
}

// ── Disconnect ──────────────────────────────────────────────

export async function disconnectTikTokAccount(
  workspaceId: string,
  accountId: string
): Promise<void> {
  const serviceClient = createServiceClient();

  await serviceClient
    .from("tiktok_tokens")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("account_id", accountId);

  await serviceClient
    .from("social_accounts")
    .update({ is_active: false, health_status: "disconnected" })
    .eq("workspace_id", workspaceId)
    .eq("outstand_account_id", accountId);
}
