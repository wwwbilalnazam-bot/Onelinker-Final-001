import { type NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// ── OAuth / Magic Link Callback Handler ──────────────────────
// Supabase redirects here after:
//  - Google OAuth sign in / sign up
//  - Magic link sign in
//  - Email verification
//  - Password reset (handled separately in reset-password page)

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  // ── Handle OAuth errors ─────────────────────────────────
  if (error) {
    const params = new URLSearchParams({
      error: errorDescription ?? error,
    });
    return NextResponse.redirect(`${origin}/login?${params.toString()}`);
  }

  // ── Exchange code for session ──────────────────────────
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      const params = new URLSearchParams({
        error: "Authentication failed. Please try again.",
      });
      return NextResponse.redirect(`${origin}/login?${params.toString()}`);
    }

    // Check if user needs onboarding
    // Use getSession() first (local JWT read — reliable after OAuth)
    // Fall back to getUser() only if needed
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let user = session?.user ?? null;

    if (!user) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (user) {
      // Use service client to bypass RLS — the user client's RLS can block
      // profile reads, causing an infinite redirect to onboarding.
      const serviceClient = createServiceClient();
      const { data: profile, error: profileError } = await serviceClient
        .from("profiles")
        .select("onboarded, id")
        .eq("id", user.id)
        .single();

      console.log("[callback] Profile check:", { userId: user.id, onboarded: profile?.onboarded, profileExists: !!profile, error: profileError?.message });

      // New user or not onboarded — redirect to onboarding
      if (!profile || !profile.onboarded) {
        console.log("[callback] Redirecting to onboarding");
        return NextResponse.redirect(`${origin}/onboarding`);
      }

      // User is onboarded — proceed to requested page or home
      if (next.startsWith("/")) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      return NextResponse.redirect(`${origin}/home`);
    }

    // No user — redirect to login
    return NextResponse.redirect(`${origin}/login`);
  }

  // ── No code — redirect to login ────────────────────────
  return NextResponse.redirect(`${origin}/login`);
}
