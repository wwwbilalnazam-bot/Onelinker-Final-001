import { redirect } from "next/navigation";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";

// Prevent Next.js from caching — must always read fresh profile.onboarded state
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Get Started | Onelinker",
  description: "Set up your Onelinker workspace in 3 easy steps.",
};

export default async function OnboardingPage() {
  const supabase = await createClient();

  // Use getSession() (local JWT read) — middleware already validated the token.
  // Using getUser() here can fail on token refresh edge cases and cause redirect loops.
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user;

  if (!user) redirect("/login");

  // Use service client for profile & workspace checks to bypass RLS.
  // The user client's RLS can block profile reads (e.g. missing SELECT policy),
  // which causes an infinite onboarding trap where onboarded=true is never seen.
  const service = createServiceClient();

  // If already onboarded, skip to dashboard
  const { data: profile } = await service
    .from("profiles")
    .select("onboarded, full_name")
    .eq("id", user.id)
    .single();

  if (profile?.onboarded) redirect("/home");

  // Get their default workspace
  console.log("[Onboarding] Fetching workspace for user:", user.id);
  let { data: member, error: memberQueryError } = await service
    .from("workspace_members")
    .select("workspace_id, workspaces(id, name, slug)")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .order("invited_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberQueryError) {
    console.error("[Onboarding] Error fetching workspace_members:", memberQueryError);
  } else {
    console.log("[Onboarding] Workspace member query result:", { member, hasWorkspace: !!member?.workspaces });
  }

  let workspace = (member?.workspaces as unknown as { id: string; name: string; slug: string }) || null;

  // ── Auto-create workspace if the trigger never fired ─────────
  // This handles users who signed up before the trigger was in place.
  if (!workspace) {
    // Safety check: Does any membership exist for this user?
    const { data: realMember, error: memberError } = await service
      .from("workspace_members")
      .select("workspace_id, workspaces(id, name, slug)")
      .eq("user_id", user.id)
      .eq("role", "owner")
      .order("invited_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (realMember?.workspaces) {
      workspace = realMember.workspaces as unknown as { id: string; name: string; slug: string };
    }

    // If still no workspace, create one
    if (!workspace) {
      try {
        const emailPrefix = user.email?.split("@")[0] ?? "user";
        const baseSlug = emailPrefix.toLowerCase().replace(/[^a-z0-9]/g, "-");

        // Make slug unique with a maximum of 20 attempts
        let slug = baseSlug;
        let attempt = 0;
        while (attempt <= 20) {
          const { data: existing, error: slugError } = await service
            .from("workspaces")
            .select("id", { count: "exact" })
            .eq("slug", slug)
            .maybeSingle();
          if (slugError) {
            console.error("[Onboarding] Slug check error:", slugError);
            break;
          }
          if (!existing) break;
          attempt += 1;
          slug = `${baseSlug}-${attempt}`;
        }

        // Fallback to random ID if we've exhausted slug attempts
        if (attempt > 20) {
          slug = `${baseSlug}-${crypto.randomUUID().slice(0, 8)}`;
        }

        const displayName = profile?.full_name ?? emailPrefix;

        // Create workspace and related records in a transaction-like approach
        console.log("[Onboarding] Creating workspace with slug:", slug);
        const { data: newWorkspace, error: wsError } = await service
          .from("workspaces")
          .insert({
            name: `${displayName}'s Workspace`,
            slug,
            owner_id: user.id,
            plan: "free"
          })
          .select("id, name, slug")
          .single();

        if (wsError) {
          console.error("[Onboarding] Workspace creation error:", wsError);
          throw new Error(`Failed to create workspace: ${wsError.message}`);
        }

        console.log("[Onboarding] Workspace created successfully:", newWorkspace);

        if (newWorkspace?.id) {
          // Create workspace member and subscription
          const [memberResult, subResult] = await Promise.all([
            service.from("workspace_members").insert({
              workspace_id: newWorkspace.id,
              user_id: user.id,
              role: "owner",
              accepted_at: new Date().toISOString(),
            }),
            service.from("subscriptions").insert({
              workspace_id: newWorkspace.id,
              plan: "free",
              status: "active",
            }),
          ]);

          if (memberResult.error) {
            console.error("[Onboarding] Member insert error:", memberResult.error);
          } else {
            console.log("[Onboarding] Workspace member created successfully");
          }
          if (subResult.error) {
            console.error("[Onboarding] Subscription insert error:", subResult.error);
          } else {
            console.log("[Onboarding] Subscription created successfully");
          }

          workspace = newWorkspace;
        } else {
          console.error("[Onboarding] No workspace ID returned from creation");
        }
      } catch (error) {
        console.error("[Onboarding] Auto-workspace creation failed:", error);
      }
    }
  }

  console.log("[Onboarding] Final state:", {
    hasWorkspace: !!workspace,
    workspaceId: workspace?.id,
    workspaceName: workspace?.name,
    userId: user.id,
  });

  return (
    <OnboardingFlow
      userId={user.id}
      userEmail={user.email ?? ""}
      userName={profile?.full_name ?? user.email?.split("@")[0] ?? ""}
      workspaceId={workspace?.id ?? ""}
      workspaceName={workspace?.name ?? ""}
    />
  );
}
