import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getMetaAccessToken } from "@/lib/meta/accounts";
import { getYouTubeAccessToken } from "@/lib/youtube/accounts";
import { fetchFacebookPostComments, fetchInstagramMediaComments } from "@/lib/meta/comments";
import { fetchYouTubeVideoComments } from "@/lib/youtube/comments";

// POST /api/comments/sync
// Body: { workspaceId }
// Fetches recent comments from Facebook, Instagram, and YouTube and syncs them to inbox_messages

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { workspaceId?: string };
    const { workspaceId } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { data: null, error: "Missing required field: workspaceId" },
        { status: 400 }
      );
    }

    // Verify workspace membership
    const { data: member } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .not("accepted_at", "is", null)
      .maybeSingle();

    if (!member) {
      return NextResponse.json({ data: null, error: "Not a workspace member" }, { status: 403 });
    }

    const serviceClient = createServiceClient();

    // Query recent published posts (last 30 days, limit 20 most recent)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: posts, error: postsError } = await serviceClient
      .from("posts")
      .select("id, outstand_post_id, platforms, account_ids, published_at, status")
      .eq("workspace_id", workspaceId)
      .eq("status", "published")
      .gte("published_at", thirtyDaysAgo.toISOString())
      .order("published_at", { ascending: false })
      .limit(20);

    if (postsError) {
      console.error("[api/comments/sync] Error querying posts:", postsError);
      return NextResponse.json(
        { data: null, error: "Failed to query posts" },
        { status: 500 }
      );
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    console.log(`[sync] Found ${posts?.length || 0} published posts from last 30 days`);

    // Collect all comments to upsert
    const inboxMessages: Array<{
      workspace_id: string;
      platform: string;
      account_id: string;
      external_message_id: string;
      author_name: string;
      author_avatar: string | null;
      content: string;
      post_id: string;
      status: string;
      received_at: string;
    }> = [];

    // Process each post
    for (const post of posts || []) {
      console.log(`[sync] Processing post ${post.id}:`, {
        platforms: post.platforms,
        account_ids: post.account_ids,
        outstand_post_id: post.outstand_post_id,
        published_at: post.published_at,
      });

      if (!post.platforms || !Array.isArray(post.platforms)) continue;
      if (!post.account_ids || !Array.isArray(post.account_ids)) continue;

      // Process each platform in the post
      for (const platform of post.platforms) {
        try {
          // Find the account ID for this platform from the post's account list
          // Note: account_ids are social_accounts.id (UUIDs)
          const { data: platformAccount } = await serviceClient
            .from("social_accounts")
            .select("id, outstand_account_id")
            .in("id", post.account_ids)
            .eq("platform", platform)
            .limit(1)
            .maybeSingle();

          if (!platformAccount) {
            console.warn(`[sync] No account found for platform ${platform} in post ${post.id}`);
            continue;
          }

          const resolvedAccountId = platformAccount.outstand_account_id;
          console.log(`[sync] Fetching ${platform} comments for post ${post.id} with account ${resolvedAccountId}`);

          if (platform === "facebook") {
            // Fetch Facebook comments
            const tokenData = await getMetaAccessToken(workspaceId, resolvedAccountId);
            if (!tokenData) {
              console.warn(`[sync] No valid token for Facebook account ${resolvedAccountId}`);
              skipped++;
              continue;
            }

            const fbIndex = post.platforms.indexOf("facebook");
            const fbPostId = post.outstand_post_id?.replace("meta_", "").split(",")[fbIndex] || post.outstand_post_id?.replace("meta_", "").split(",")[0] || "";
            if (!fbPostId) {
              console.warn(`[sync] No Facebook post ID for post ${post.id}`);
              continue;
            }

            console.log(`[sync] Fetching FB comments for post ID: ${fbPostId}`);
            const comments = await fetchFacebookPostComments({
              postId: fbPostId,
              pageAccessToken: tokenData.accessToken,
              since: post.published_at || undefined,
            });

            console.log(`[sync] Found ${comments.length} Facebook comments for post ${post.id}`);

            for (const comment of comments) {
              inboxMessages.push({
                workspace_id: workspaceId,
                platform: "facebook",
                account_id: resolvedAccountId,
                external_message_id: comment.externalId,
                author_name: comment.authorName,
                author_avatar: comment.authorAvatar,
                content: comment.content,
                post_id: post.id,
                status: "unread",
                received_at: comment.receivedAt,
              });
            }

            synced += comments.length;
          } else if (platform === "instagram") {
            // Fetch Instagram comments
            const tokenData = await getMetaAccessToken(workspaceId, resolvedAccountId);
            if (!tokenData) {
              console.warn(`[sync] No valid token for Instagram account ${resolvedAccountId}`);
              skipped++;
              continue;
            }

            const igIndex = post.platforms.indexOf("instagram");
            const igMediaId = post.outstand_post_id?.replace("meta_", "").split(",")[igIndex] || post.outstand_post_id?.replace("meta_", "").split(",")[0] || "";
            if (!igMediaId) {
              console.warn(`[sync] No Instagram media ID for post ${post.id}`);
              continue;
            }

            console.log(`[sync] Fetching IG comments for media ID: ${igMediaId}`);
            const comments = await fetchInstagramMediaComments({
              igMediaId,
              pageAccessToken: tokenData.accessToken,
              since: post.published_at || undefined,
            });

            console.log(`[sync] Found ${comments.length} Instagram comments for post ${post.id}`);

            for (const comment of comments) {
              inboxMessages.push({
                workspace_id: workspaceId,
                platform: "instagram",
                account_id: resolvedAccountId,
                external_message_id: comment.externalId,
                author_name: comment.authorName,
                author_avatar: comment.authorAvatar,
                content: comment.content,
                post_id: post.id,
                status: "unread",
                received_at: comment.receivedAt,
              });
            }

            synced += comments.length;
          } else if (platform === "youtube") {
            // Fetch YouTube comments
            const tokenData = await getYouTubeAccessToken(workspaceId, resolvedAccountId);
            if (!tokenData) {
              console.warn(`[sync] No valid token for YouTube account ${resolvedAccountId}`);
              skipped++;
              continue;
            }

            const videoId = post.outstand_post_id?.replace("yt_", "") || "";
            if (!videoId) continue;

            const comments = await fetchYouTubeVideoComments({
              videoId,
              accessToken: tokenData.accessToken,
              publishedAfter: post.published_at || undefined,
            });

            for (const comment of comments) {
              inboxMessages.push({
                workspace_id: workspaceId,
                platform: "youtube",
                account_id: resolvedAccountId,
                external_message_id: comment.externalId,
                author_name: comment.authorName,
                author_avatar: comment.authorAvatar,
                content: comment.content,
                post_id: post.id,
                status: "unread",
                received_at: comment.receivedAt,
              });
            }

            synced += comments.length;
          }
        } catch (err) {
          console.error(`[sync] Error processing post ${post.id}:`, err);
          errors++;
        }
      }
    }

    // Upsert all collected messages to inbox_messages
    if (inboxMessages.length > 0) {
      console.log(`[sync] Upserting ${inboxMessages.length} comments to inbox_messages`);
      const { error: upsertError } = await serviceClient
        .from("inbox_messages")
        .upsert(inboxMessages, {
          onConflict: "workspace_id,external_message_id",
          ignoreDuplicates: true, // Preserve existing status (read/replied/archived)
        });

      if (upsertError) {
        console.error("[sync] Error upserting comments:", upsertError);
        errors += inboxMessages.length;
      } else {
        console.log(`[sync] Successfully upserted ${inboxMessages.length} comments`);
      }
    } else {
      console.log(`[sync] No comments found to upsert`);
    }

    console.log(`[sync] Completed: synced=${synced}, skipped=${skipped}, errors=${errors}`);

    return NextResponse.json({
      data: { synced, skipped, errors },
      error: null,
    });
  } catch (err) {
    console.error("[api/comments/sync] Unexpected error:", err);
    return NextResponse.json(
      { data: null, error: "Internal server error" },
      { status: 500 }
    );
  }
}
