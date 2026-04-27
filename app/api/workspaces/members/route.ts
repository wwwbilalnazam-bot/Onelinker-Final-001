import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) {
    return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });
  }

  // Verify authenticated user
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const service = createServiceClient();

  // Verify caller is a member of this workspace
  const { data: callerMember } = await service
    .from("workspace_members")
    .select("role, deactivated_at")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();

  if (!callerMember) {
    return NextResponse.json({ error: "Not a member of this workspace" }, { status: 403 });
  }

  if (callerMember.deactivated_at) {
    return NextResponse.json({ error: "Your access has been deactivated" }, { status: 403 });
  }

  // Fetch all members with profiles
  const { data: members, error } = await service
    .from("workspace_members")
    .select(`
      id, user_id, role, invited_at, deactivated_at,
      profiles(full_name, avatar_url)
    `)
    .eq("workspace_id", workspaceId)
    .order("invited_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch emails from auth.users for all members
  const userIds = (members ?? []).map((m: any) => m.user_id);
  const { data: { users: authUsers = [] } } = await service.auth.admin.listUsers();

  const emailMap = new Map(authUsers.map((u: any) => [u.id, u.email]));

  // Transform to include emails
  const membersWithEmails = (members ?? []).map((m: any) => ({
    ...m,
    email: emailMap.get(m.user_id) || "",
  }));

  // Fetch pending invitations
  const { data: invitations } = await service
    .from("invitations")
    .select("id, email, role, created_at, expires_at")
    .eq("workspace_id", workspaceId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return NextResponse.json({
    members: membersWithEmails,
    invitations: invitations ?? [],
    currentUserId: user.id,
    currentUserEmail: user.email,
  });
}
