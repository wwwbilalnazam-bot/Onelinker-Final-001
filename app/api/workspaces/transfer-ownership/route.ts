import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const service = createServiceClient();

    // Verify authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { workspace_id, target_user_id } = await req.json();

    if (!workspace_id || !target_user_id) {
      return NextResponse.json(
        { error: "Missing workspace_id or target_user_id" },
        { status: 400 }
      );
    }

    // Verify current user is the owner
    const { data: currentMember } = await service
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id)
      .single();

    if (!currentMember || currentMember.role !== "owner") {
      return NextResponse.json(
        { error: "Only the owner can transfer ownership" },
        { status: 403 }
      );
    }

    // Verify target user is a member
    const { data: targetMember } = await service
      .from("workspace_members")
      .select("id, role")
      .eq("workspace_id", workspace_id)
      .eq("user_id", target_user_id)
      .single();

    if (!targetMember) {
      return NextResponse.json(
        { error: "Target user is not a member of this workspace" },
        { status: 404 }
      );
    }

    // Update new owner
    const { error: ownerError } = await service
      .from("workspace_members")
      .update({ role: "owner" })
      .eq("workspace_id", workspace_id)
      .eq("user_id", target_user_id);

    if (ownerError) {
      console.error("[Transfer] Update owner error:", ownerError);
      return NextResponse.json(
        { error: `Failed to update new owner: ${ownerError.message}` },
        { status: 500 }
      );
    }

    // Demote current owner to manager
    const { error: demoteError } = await service
      .from("workspace_members")
      .update({ role: "manager" })
      .eq("workspace_id", workspace_id)
      .eq("user_id", user.id);

    if (demoteError) {
      console.error("[Transfer] Demote owner error:", demoteError);
      return NextResponse.json(
        { error: `Failed to demote current owner: ${demoteError.message}` },
        { status: 500 }
      );
    }

    // Update workspace owner_id
    const { error: wsError } = await service
      .from("workspaces")
      .update({ owner_id: target_user_id })
      .eq("id", workspace_id);

    if (wsError) {
      console.error("[Transfer] Update workspace error:", wsError);
      return NextResponse.json(
        { error: `Failed to update workspace owner: ${wsError.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Ownership transferred successfully",
    });
  } catch (error) {
    console.error("[Transfer] Unexpected error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transfer failed" },
      { status: 500 }
    );
  }
}
