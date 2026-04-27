import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getOutstandBaseUrl } from "@/lib/outstand/client";

// GET /api/outstand/validate-key?workspaceId=xxx
// Validates the Outstand API key by making a test request to Outstand
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ valid: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get("workspaceId");

    if (!workspaceId) {
      return NextResponse.json(
        { valid: false, error: "Missing workspaceId" },
        { status: 400 }
      );
    }

    // Verify user is workspace member
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .maybeSingle();

    if (!member) {
      return NextResponse.json(
        { valid: false, error: "Not a workspace member" },
        { status: 403 }
      );
    }

    // Get the API key from workspace
    const service = createServiceClient();
    const { data: workspace, error: wsError } = await service
      .from("workspaces")
      .select("outstand_api_key")
      .eq("id", workspaceId)
      .single();

    if (wsError || !workspace?.outstand_api_key) {
      return NextResponse.json(
        { valid: false, error: "No API key configured" },
        { status: 400 }
      );
    }

    const apiKey = workspace.outstand_api_key;

    // Validate format
    if (!apiKey.startsWith("post_") || apiKey.length < 32) {
      return NextResponse.json(
        { valid: false, error: "Invalid API key format (must start with 'post_')" },
        { status: 400 }
      );
    }

    // Test the API key with a simple request to Outstand
    const baseUrl = getOutstandBaseUrl();
    const res = await fetch(`${baseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    // If the API returns 200 or 401 (invalid key but API responded), key format is valid
    // A 5xx error might mean Outstand is down
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json(
        { valid: false, error: "API key rejected by Outstand (invalid or revoked)" },
        { status: 200 }
      );
    }

    if (res.status >= 500) {
      return NextResponse.json(
        { valid: false, error: "Outstand API is currently unavailable" },
        { status: 200 }
      );
    }

    if (!res.ok && res.status !== 404) {
      return NextResponse.json(
        { valid: false, error: `Unexpected response from Outstand: ${res.status}` },
        { status: 200 }
      );
    }

    return NextResponse.json({
      valid: true,
      message: "API key is valid and connected to Outstand",
    });
  } catch (err) {
    console.error("[validate-key] Error:", err);
    return NextResponse.json(
      { valid: false, error: "Failed to validate API key" },
      { status: 500 }
    );
  }
}
