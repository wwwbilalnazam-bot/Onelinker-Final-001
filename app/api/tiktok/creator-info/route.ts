import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { getTikTokAccessToken } from "@/lib/tiktok/accounts";
import { queryCreatorInfo } from "@/lib/tiktok/posts";

// POST /api/tiktok/creator-info
// Fetches real creator info from TikTok API for display in the share form
// Required by TikTok: "API Clients must retrieve the latest creator info when rendering the Post to TikTok page"
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
      .select("id, display_name, username, profile_picture, workspace_id")
      .eq("id", accountId)
      .single();

    // If not found by id, try by outstand_account_id
    if (!account && !dbError) {
      const { data: accountByOutstand } = await serviceClient
        .from("social_accounts")
        .select("id, display_name, username, profile_picture, workspace_id")
        .eq("outstand_account_id", accountId)
        .single();
      account = accountByOutstand;
    }

    if (!account) {
      console.warn("[tiktok/creator-info] Account not found with ID:", accountId, dbError);
      return NextResponse.json(
        { error: "Account not found" },
        { status: 404 }
      );
    }

    // Fetch the access token for this account
    const tokenData = await getTikTokAccessToken(account.workspace_id, accountId);
    if (!tokenData) {
      console.warn("[tiktok/creator-info] No valid access token for account:", accountId);
      return NextResponse.json(
        { error: "Access token expired. Please reconnect your TikTok account." },
        { status: 401 }
      );
    }

    // Fetch REAL creator info from TikTok API
    console.log("[tiktok/creator-info] Fetching real creator info from TikTok API for account:", accountId);
    const tiktokCreatorInfo = await queryCreatorInfo(tokenData.accessToken);

    // Use TikTok's returned values (not hardcoded)
    const nickname = tiktokCreatorInfo.creator_nickname || account.display_name || "TikTok Creator";
    const username = tiktokCreatorInfo.creator_username || account.username || "";
    const profilePicture = tiktokCreatorInfo.creator_avatar_url || account.profile_picture || "";
    const maxVideoDurationSec = tiktokCreatorInfo.max_video_post_duration_sec || 600;

    // TikTok doesn't provide exact remaining posts via this API, but we know the daily cap is ~15
    // canPost is true if they haven't hit limits (TikTok will return error during publish if they have)
    const canPost = true; // TikTok API will reject during publish if limits exceeded

    console.log("[tiktok/creator-info] ✓ Creator info retrieved from TikTok API:", {
      nickname,
      username,
      maxVideoDurationSec,
    });

    return NextResponse.json({
      nickname,
      username,
      profilePicture,
      canPost,
      remainingPostsToday: 15, // TikTok cap (actual limit checked at publish time)
      maxVideoDurationSec,
    });

  } catch (error) {
    console.error("[tiktok/creator-info] Error fetching from TikTok API:", error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Return error response instead of fallback defaults
    // This forces the frontend to handle the error properly
    return NextResponse.json(
      { error: `Failed to fetch creator info: ${errorMsg}` },
      { status: 500 }
    );
  }
}
