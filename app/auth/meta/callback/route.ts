import { type NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProviderForPlatform } from "@/lib/providers";
import {
  popupClose,
  extractCallbackParams,
  verifyCallbackAuth,
  clearDeletedTracking,
} from "@/lib/oauth/callback-helpers";

// ── Meta OAuth Callback (/auth/meta/callback) ───────────────
// Handles OAuth callbacks for both:
// 1. USER AUTHENTICATION: Facebook/Instagram user login (via Supabase OAuth)
// 2. ACCOUNT CONNECTIONS: Connecting Meta business accounts for posting
//
// Detection logic:
// - If 'code' param exists + 'workspace_id' NOT in state → User auth
// - If 'code' param exists + 'workspace_id' in state → Account connection

export async function GET(request: NextRequest) {
  const logPrefix = "[auth/meta/callback]";
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const platform = searchParams.get("platform") ?? "facebook";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  console.log(`${logPrefix} Callback received. Platform: ${platform}, Has code: ${!!code}, Error: ${error ?? "none"}`);

  // ── ROUTE 1: USER AUTHENTICATION (Supabase OAuth) ────────────────
  // When user logs in via "Continue with Facebook"
  // State param has no workspace_id, so this is not an account connection

  if (code && !searchParams.get("state")) {
    console.log(`${logPrefix} User authentication flow detected`);

    // Handle OAuth errors
    if (error) {
      const params = new URLSearchParams({
        error: errorDescription ?? error,
      });
      console.error(`${logPrefix} OAuth error:`, error);
      return NextResponse.redirect(`${origin}/login?${params.toString()}`);
    }

    try {
      const supabase = await createClient();
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error(`${logPrefix} Code exchange error:`, exchangeError.message);
        const params = new URLSearchParams({
          error: "Authentication failed. Please try again.",
        });
        return NextResponse.redirect(`${origin}/login?${params.toString()}`);
      }

      // Get authenticated user
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let user = session?.user ?? null;

      if (!user) {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        user = authUser;
      }

      if (user) {
        console.log(`${logPrefix} User authenticated:`, user.id);

        const serviceClient = createServiceClient();
        const { data: profile } = await serviceClient
          .from("profiles")
          .select("onboarded")
          .eq("id", user.id)
          .single();

        // New user or not onboarded — redirect to onboarding
        if (!profile?.onboarded) {
          console.log(`${logPrefix} User not onboarded, redirecting to onboarding`);
          return NextResponse.redirect(`${origin}/onboarding`);
        }
      }

      // Redirect to requested page or home
      const redirectTo = next && next.startsWith("/")
        ? `${origin}${next}`
        : `${origin}/home`;
      console.log(`${logPrefix} User auth complete, redirecting to:`, redirectTo);
      return NextResponse.redirect(redirectTo);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`${logPrefix} User auth error:`, errMsg);
      const params = new URLSearchParams({
        error: "An unexpected error occurred. Please try again.",
      });
      return NextResponse.redirect(`${origin}/login?${params.toString()}`);
    }
  }

  // ── ROUTE 2: ACCOUNT CONNECTION (Workspace OAuth) ────────────────
  // When user connects their Meta business account in the app

  console.log(`${logPrefix} Account connection flow detected`);

  // Extract and validate params from the callback URL
  const params = extractCallbackParams(request, "meta");
  if (params instanceof Response) return params;

  const { workspaceId, platform: connectedPlatform, allParams } = params;
  console.log(`${logPrefix} Workspace: ${workspaceId}, Platform: ${connectedPlatform}`);

  try {
    // Verify the user is authenticated and has workspace access
    const auth = await verifyCallbackAuth(request, workspaceId);
    if (!auth.ok) return auth.response;

    // Extract the redirect URI from the current request origin
    // This must match exactly what was sent to Meta in startOAuth
    const { origin } = new URL(request.url);
    const redirectUri = `${origin}/auth/meta/callback`;

    // Let the Meta provider handle token exchange + account sync
    const provider = getProviderForPlatform(connectedPlatform);
    const result = await provider.handleCallback({
      queryParams: allParams,
      workspaceId,
      redirectUri,
    });

    console.log(`${logPrefix} Provider result:`, JSON.stringify(result));
    console.log(`${logPrefix} Synced ${result.syncedCount} accounts for platform: ${connectedPlatform}`);

    // Clear deleted-account tracking so reconnected accounts aren't blocked
    await clearDeletedTracking(workspaceId, connectedPlatform);

    console.log(`${logPrefix} Callback complete - accounts should be visible now`);
    return popupClose();
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`${logPrefix} Error:`, errMsg, err);
    return popupClose(`Connection failed: ${errMsg}`, true);
  }
}
