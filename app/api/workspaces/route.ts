import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

// POST /api/workspaces — Create a new workspace
// Uses service client to bypass RLS for workspace_members + subscriptions inserts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { session },
    } = await supabase.auth.getSession();
    let user = session?.user ?? null;

    if (!user) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      user = authUser;
    }

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, slug } = body;

    if (
      !name ||
      typeof name !== "string" ||
      name.trim().length < 2 ||
      !slug ||
      typeof slug !== "string" ||
      slug.length < 2
    ) {
      return NextResponse.json(
        { error: "Name and slug are required (min 2 characters)" },
        { status: 400 }
      );
    }

    const cleanName = name.trim();
    const cleanSlug = slug
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 48);

    const service = createServiceClient();

    // Check slug uniqueness
    const { data: existing } = await service
      .from("workspaces")
      .select("id")
      .eq("slug", cleanSlug)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: "That URL is already taken — try a different one" },
        { status: 409 }
      );
    }

    // Create workspace
    const { data: workspace, error: wsError } = await service
      .from("workspaces")
      .insert({
        name: cleanName,
        slug: cleanSlug,
        owner_id: user.id,
        plan: "free",
      })
      .select("id")
      .single();

    if (wsError || !workspace) {
      console.error("Workspace creation failed:", wsError);
      return NextResponse.json(
        { error: "Failed to create workspace" },
        { status: 500 }
      );
    }

    // Add owner membership + free subscription in parallel
    const [memberResult, subResult] = await Promise.all([
      service.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: "owner",
        accepted_at: new Date().toISOString(),
      }),
      service.from("subscriptions").insert({
        workspace_id: workspace.id,
        plan: "free",
        status: "active",
      }),
    ]);

    if (memberResult.error) {
      console.error("Member insert failed:", memberResult.error);
    }
    if (subResult.error) {
      console.error("Subscription insert failed:", subResult.error);
    }

    return NextResponse.json({ id: workspace.id, slug: cleanSlug });
  } catch (err) {
    console.error("Workspace creation error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}

// PATCH /api/workspaces — Update workspace name/logo/api-keys (used by onboarding)
// Uses service client to bypass RLS for slug uniqueness check
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { workspaceId, name, logoUrl, outstandApiKey, userId: bodyUserId } = body;

    if (!workspaceId || !name || typeof name !== "string" || name.trim().length < 2) {
      return NextResponse.json(
        { error: "workspaceId and name are required (min 2 characters)" },
        { status: 400 }
      );
    }

    // Try to get authenticated user from session
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let userId = session?.user?.id ?? null;

    if (!userId) {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      userId = authUser?.id ?? null;
    }

    // Fallback: accept userId from request body (passed from server-rendered onboarding page)
    if (!userId && bodyUserId) {
      userId = bodyUserId;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const service = createServiceClient();

    // Verify user is the workspace owner (security check regardless of auth method)
    const { data: workspace } = await service
      .from("workspaces")
      .select("id, owner_id")
      .eq("id", workspaceId)
      .single();

    if (!workspace || workspace.owner_id !== userId) {
      return NextResponse.json(
        { error: "Forbidden — only the workspace owner can update it" },
        { status: 403 }
      );
    }

    // Generate slug and check uniqueness (service client can see ALL workspaces)
    let finalSlug = slugify(name.trim());

    const { data: existing } = await service
      .from("workspaces")
      .select("id")
      .eq("slug", finalSlug)
      .neq("id", workspaceId)
      .maybeSingle();

    if (existing) {
      finalSlug = `${finalSlug}-${Math.random().toString(36).slice(2, 6)}`;
    }

    // Update workspace
    const updatePayload: Record<string, string | null> = {
      name: name.trim(),
      slug: finalSlug,
    };
    if (logoUrl) {
      updatePayload.logo_url = logoUrl;
    }
    if (outstandApiKey) {
      updatePayload.outstand_api_key = outstandApiKey;
    }

    const { error: updateError } = await service
      .from("workspaces")
      .update(updatePayload)
      .eq("id", workspaceId);

    if (updateError) {
      return NextResponse.json(
        { error: "Failed to update workspace" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, slug: finalSlug });
  } catch (err) {
    console.error("Workspace update error:", err);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
