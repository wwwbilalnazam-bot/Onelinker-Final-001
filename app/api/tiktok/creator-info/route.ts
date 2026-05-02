import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

// POST /api/tiktok/creator-info
// Fetches creator info for display in the share form
export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      accountId: string;
    };

    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { error: "Missing accountId" },
        { status: 400 }
      );
    }

    // Fetch the account details from the database
    const serviceClient = createServiceClient();

    // Try querying by the provided accountId (could be id or outstand_account_id)
    let { data: account, error: dbError } = await serviceClient
      .from("social_accounts")
      .select("display_name, username, profile_picture")
      .eq("id", accountId)
      .single();

    // If not found by id, try by outstand_account_id
    if (!account && !dbError) {
      const { data: accountByOutstand } = await serviceClient
        .from("social_accounts")
        .select("display_name, username, profile_picture")
        .eq("outstand_account_id", accountId)
        .single();
      account = accountByOutstand;
    }

    if (!account) {
      console.warn("[tiktok/creator-info] Account not found with ID:", accountId, dbError);
      // Return defaults on error
      return NextResponse.json({
        nickname: "TikTok Creator",
        username: "",
        profilePicture: "",
        canPost: true,
        remainingPostsToday: 15,
        maxVideoDurationSec: 600,
      });
    }

    // Use display_name if available, otherwise fallback to username
    const nickname = account.display_name || account.username || "TikTok Creator";
    const username = account.username || "";

    // Return creator info with actual nickname and profile picture
    // The limits are standard per TikTok's Direct Post API
    return NextResponse.json({
      nickname, // Actual account name from database
      username, // Account username
      profilePicture: account.profile_picture || "", // Profile picture URL
      canPost: true, // In production, could check real status via TikTok API
      remainingPostsToday: 15, // Default limit per TikTok (0-15 posts per 24h)
      maxVideoDurationSec: 600, // 10 minutes max per TikTok guidelines
    });

  } catch (error) {
    console.error("[tiktok/creator-info] Error:", error);
    // Return defaults on error
    return NextResponse.json({
      nickname: "TikTok Creator",
      username: "",
      profilePicture: "",
      canPost: true,
      remainingPostsToday: 15,
      maxVideoDurationSec: 600,
    });
  }
}
