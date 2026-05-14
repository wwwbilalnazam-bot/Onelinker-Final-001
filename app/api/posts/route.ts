import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProviderForPlatform } from "@/lib/providers";
import { generateThumbnailFromMedia, updatePostThumbnail } from "@/lib/thumbnails/generate";

// POST /api/posts
// Body: { workspaceId, accountIds, content, channelContent?, scheduleMode, scheduledAt?, scheduledTime?, timezone?, mediaUrls?, firstComment? }
// Creates/schedules a post via the appropriate provider, or saves a draft to Supabase only.

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as {
      workspaceId?: string;
      accountIds?: string[];          // local social_accounts.id UUIDs
      content?: string;
      channelContent?: Record<string, string>; // platform → content (per-channel mode)
      accountContent?: Record<string, string>; // account UUID → content (per-account mode)
      scheduleMode?: "now" | "schedule" | "draft";
      scheduledAt?: string;           // "YYYY-MM-DD"
      scheduledTime?: string;         // "HH:MM"
      timezone?: string;
      mediaUrls?: string[];           // Supabase public URLs already uploaded
      firstComment?: string;
      platformFormats?: Record<string, string>; // platform → format id (e.g. "story", "reel")
      youtubeTitle?: string;
      youtubeConfig?: {
        privacyStatus?: "public" | "private" | "unlisted";
        categoryId?: string;
        tags?: string[];
        madeForKids?: boolean;
      };
      tiktokConfig?: {
        title?: string;
        privacyStatus?: "SELF_ONLY" | "FRIEND_ONLY" | "PUBLIC";
        allowComment?: boolean;
        allowDuet?: boolean;
        allowStitch?: boolean;
        isCommercialContent?: boolean;
        yourBrand?: boolean;
        brandedContent?: boolean;
      };
      thumbnail?: {
        type: "frame" | "custom";
        frameOffset?: number;
        uploadedUrl?: string;
      };
      segments?: {
        start: number;
        end: number;
      }[];
    };

    const {
      workspaceId,
      accountIds,
      content = "",
      channelContent,
      accountContent,
      scheduleMode = "now",
      scheduledAt,
      scheduledTime,
      timezone = "UTC",
      mediaUrls = [],
      firstComment,
      platformFormats,
      youtubeTitle,
      youtubeConfig,
      tiktokConfig,
      thumbnail,
      segments,
    } = body;

    if (!workspaceId) {
      return NextResponse.json(
        { data: null, error: "Missing required field: workspaceId" },
        { status: 400 }
      );
    }

    // Drafts don't require accountIds (auto-save may happen before selection)
    if (scheduleMode !== "draft" && !accountIds?.length) {
      return NextResponse.json(
        { data: null, error: "Missing required field: accountIds" },
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

    // Look up accounts
    const { data: accounts } = await serviceClient
      .from("social_accounts")
      .select("id, outstand_account_id, platform, username")
      .in("id", accountIds ?? [])
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    if (scheduleMode !== "draft" && !accounts?.length) {
      return NextResponse.json(
        { data: null, error: "No active connected accounts found" },
        { status: 400 }
      );
    }

    const platforms = [...new Set((accounts ?? []).map((a) => a.platform))];

    // ── DRAFT: save to Supabase only, skip provider ──────────
    if (scheduleMode === "draft") {
      const draftData = {
        workspace_id: workspaceId,
        author_id: user.id,
        content,
        platforms: platforms.length > 0 ? platforms : [],
        account_ids: accountIds ?? [],
        media_urls: mediaUrls,
        status: "draft" as const,
        first_comment: firstComment || null,
        channel_content: channelContent || null,
        account_content: accountContent || null,
        title: youtubeTitle || null,
        options: (youtubeConfig || tiktokConfig || thumbnail) ? { youtubeConfig, tiktokConfig, thumbnail } : null,
      };

      const { data: post, error } = await serviceClient
        .from("posts")
        .insert(draftData)
        .select("id")
        .single();

      if (error) {
        return NextResponse.json({ data: null, error: error.message }, { status: 500 });
      }

      // Generate thumbnail from first media URL if available
      if (mediaUrls.length > 0 && post) {
        try {
          const mediaUrl = mediaUrls[0];
          const mediaType = mediaUrl.toLowerCase().includes(".mp4") ? "video" : "image";

          console.log(`[api/posts] Generating thumbnail for draft post ${post.id}`);
          const thumbnailResult = await generateThumbnailFromMedia(mediaUrl, post.id, workspaceId, mediaType);

          if (thumbnailResult.success && thumbnailResult.thumbnailUrl) {
            await updatePostThumbnail(post.id, thumbnailResult.thumbnailUrl);
            console.log(`[api/posts] ✓ Thumbnail generated for draft`);
          }
        } catch (thumbnailError) {
          // Don't fail the draft creation if thumbnail generation fails
          console.warn(`[api/posts] Thumbnail generation failed (non-fatal):`, thumbnailError);
        }
      }

      return NextResponse.json({ data: { id: post.id, status: "draft" } });
    }

    // Get workspace API key
    const { data: workspace } = await serviceClient
      .from("workspaces")
      .select("outstand_api_key")
      .eq("id", workspaceId)
      .single();

    const apiKey = workspace?.outstand_api_key ?? null;

    // ── Build schedule_at ISO string ──────────────────────────
    let scheduleAtIso: string | undefined;
    if (scheduleMode === "schedule" && scheduledAt) {
      const time = scheduledTime || "09:00";
      const localStr = `${scheduledAt}T${time}:00`;
      try {
        // Convert the local time in the user's timezone to UTC
        const utcMs = new Date(
          new Date(localStr).toLocaleString("en-US", { timeZone: timezone })
        ).getTime();
        const localMs = new Date(localStr).getTime();
        const offsetMs = localMs - utcMs;
        scheduleAtIso = new Date(localMs + offsetMs).toISOString();
      } catch {
        // Fallback to treating as UTC if timezone is invalid
        scheduleAtIso = new Date(localStr).toISOString();
      }
    }

    // Determine primary platform format
    const postFormat = platforms.length > 0 ? (platformFormats?.[platforms[0]] ?? "post") : "post";
    
    // Resolve usernames/IDs for the provider
    const providerAccountIds = (accounts ?? [])
      .map((a) => a.username || a.outstand_account_id)
      .filter(Boolean) as string[];

    // ── Automated Story Splitting ───────────────────────────
    if (segments && segments.length > 1 && postFormat === "story") {
      const provider = getProviderForPlatform(platforms[0]!);
      console.log(`[Story Splitter] Splitting post into ${segments.length} sequential parts.`);
      const results: any[] = [];

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const res = await provider.createPost({
          payload: {
            content: i === 0 ? content : "", // caption on first part only
            accountIds: providerAccountIds,
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            scheduleAt: scheduleAtIso,
            timezone,
            firstComment: i === 0 ? (firstComment || undefined) : undefined,
            format: "story",
            platforms,
            title: platforms.includes("youtube") ? youtubeTitle : undefined,
            youtubeConfig: platforms.includes("youtube") ? youtubeConfig : undefined,
            tiktokConfig: platforms.includes("tiktok") ? tiktokConfig : undefined,
            thumbnail,
            segments: [seg as { start: number; end: number }],
          },
          workspaceId,
          authorId: user.id,
          apiKey,
        });
        results.push(res);
        if (i < segments.length - 1) await new Promise(r => setTimeout(r, 1000));
      }

      return NextResponse.json({
        data: { results, status: scheduleMode === "schedule" ? "scheduled" : "published" }
      });
    }

    // ── Per-account content logic ──────────────────────────
    const hasAccountContent = accountContent && Object.keys(accountContent).length > 0;

    if (hasAccountContent && accountContent) {
      const results: any[] = [];

      for (const account of (accounts ?? [])) {
        const caption = accountContent[account.id] ?? content;
        if (!caption.trim() && postFormat !== "story") continue;

        const provider = getProviderForPlatform(account.platform);
        const res = await provider.createPost({
          payload: {
            content: caption,
            accountIds: [account.username || account.outstand_account_id],
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            scheduleAt: scheduleAtIso,
            timezone,
            firstComment: firstComment || undefined,
            format: platformFormats?.[account.platform] ?? "post",
            platforms: [account.platform],
            title: account.platform === "youtube" ? youtubeTitle : undefined,
            youtubeConfig: account.platform === "youtube" ? youtubeConfig : undefined,
            tiktokConfig: account.platform === "tiktok" ? tiktokConfig : undefined,
            thumbnail,
          },
          workspaceId,
          authorId: user.id,
          apiKey,
        });
        results.push(res);
        // Small delay between provider calls to avoid rate limiting
        if (results.length < (accounts ?? []).length) {
          await new Promise(r => setTimeout(r, 300));
        }
      }

      return NextResponse.json({
        data: { results, status: scheduleMode === "schedule" ? "scheduled" : "published" }
      });
    }

    // ── Per-channel content logic ──────────────────────────
    const hasChannelContent = channelContent && Object.keys(channelContent).length > 0;

    if (hasChannelContent && channelContent) {
      const platformToAccounts: Record<string, string[]> = {};
      for (const account of (accounts ?? [])) {
        platformToAccounts[account.platform] ??= [];
        platformToAccounts[account.platform].push(account.username || account.outstand_account_id);
      }

      const results: any[] = [];
      for (const [platform, pAccounts] of Object.entries(platformToAccounts)) {
        const pContent = channelContent[platform] ?? content;
        if (!pContent.trim() && postFormat !== "story") continue;

        const provider = getProviderForPlatform(platform);
        const res = await provider.createPost({
          payload: {
            content: pContent,
            accountIds: pAccounts,
            mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
            scheduleAt: scheduleAtIso,
            timezone,
            firstComment: firstComment || undefined,
            format: platformFormats?.[platform] ?? "post",
            platforms: [platform],
            title: platform === "youtube" ? youtubeTitle : undefined,
            youtubeConfig: platform === "youtube" ? youtubeConfig : undefined,
            tiktokConfig: platform === "tiktok" ? tiktokConfig : undefined,
            thumbnail,
          },
          workspaceId,
          authorId: user.id,
          apiKey,
        });
        results.push(res);
      }

      return NextResponse.json({
        data: { results, status: scheduleMode === "schedule" ? "scheduled" : "published" }
      });
    }

    // ── Single shared post ───────────────────────────────────
    const provider = getProviderForPlatform(platforms[0]!);
    const result = await provider.createPost({
      payload: {
        content,
        accountIds: providerAccountIds,
        mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
        scheduleAt: scheduleAtIso,
        timezone,
        firstComment: firstComment || undefined,
        format: postFormat,
        platforms,
        title: platforms.includes("youtube") ? youtubeTitle : undefined,
        youtubeConfig: platforms.includes("youtube") ? youtubeConfig : undefined,
        tiktokConfig: platforms.includes("tiktok") ? tiktokConfig : undefined,
        thumbnail,
        segments,
      },
      workspaceId,
      authorId: user.id,
      apiKey,
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    console.error("[api/posts] Error:", err);
    return NextResponse.json(
      { data: null, error: err instanceof Error ? err.message : "Failed to create post" },
      { status: 500 }
    );
  }
}

// PATCH /api/posts
// Updates an existing draft post (used by auto-save)

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ data: null, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json() as {
      postId?: string;
      workspaceId?: string;
      accountIds?: string[];
      content?: string;
      mediaUrls?: string[];
      firstComment?: string;
      channelContent?: Record<string, string>;
      accountContent?: Record<string, string>;
      youtubeTitle?: string;
      youtubeConfig?: any;
      thumbnail?: any;
    };

    const { postId, workspaceId, content, accountIds, mediaUrls, firstComment, channelContent, accountContent, youtubeTitle, youtubeConfig, thumbnail } = body;

    if (!postId || !workspaceId) {
      return NextResponse.json(
        { data: null, error: "Missing required fields: postId, workspaceId" },
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

    // Verify the post exists, belongs to this workspace, is a draft, and is owned by the user
    const { data: existing } = await serviceClient
      .from("posts")
      .select("id, status, author_id, options")
      .eq("id", postId)
      .eq("workspace_id", workspaceId)
      .single();

    if (!existing) {
      return NextResponse.json({ data: null, error: "Post not found" }, { status: 404 });
    }

    if (existing.status !== "draft") {
      return NextResponse.json({ data: null, error: "Can only update draft posts" }, { status: 400 });
    }

    if (existing.author_id !== user.id) {
      return NextResponse.json({ data: null, error: "Can only update your own drafts" }, { status: 403 });
    }

    // Build update payload (only include provided fields)
    const updateData: Record<string, unknown> = {};
    if (content !== undefined) updateData.content = content;
    if (mediaUrls !== undefined) updateData.media_urls = mediaUrls;
    if (firstComment !== undefined) updateData.first_comment = firstComment || null;
    if (channelContent !== undefined) updateData.channel_content = channelContent || null;
    if (accountContent !== undefined) updateData.account_content = accountContent || null;
    if (youtubeTitle !== undefined) updateData.title = youtubeTitle || null;
    if (youtubeConfig !== undefined || thumbnail !== undefined) {
      updateData.options = { 
        ...(existing?.options || {}), 
        ...(youtubeConfig ? { youtubeConfig } : {}), 
        ...(thumbnail ? { thumbnail } : {}) 
      };
    }
    if (accountIds !== undefined) {
      updateData.account_ids = accountIds;
      // Resolve platforms from account IDs
      if (accountIds.length > 0) {
        const { data: accts } = await serviceClient
          .from("social_accounts")
          .select("platform")
          .in("id", accountIds)
          .eq("workspace_id", workspaceId);
        updateData.platforms = [...new Set((accts ?? []).map(a => a.platform))];
      }
    }

    const { error } = await serviceClient
      .from("posts")
      .update(updateData)
      .eq("id", postId);

    if (error) {
      return NextResponse.json({ data: null, error: error.message }, { status: 500 });
    }

    // Regenerate thumbnail if media URLs changed
    if (mediaUrls !== undefined && mediaUrls.length > 0) {
      try {
        const mediaUrl = mediaUrls[0];
        const mediaType = mediaUrl.toLowerCase().includes(".mp4") ? "video" : "image";

        console.log(`[api/posts] Regenerating thumbnail for draft post ${postId}`);
        const thumbnailResult = await generateThumbnailFromMedia(mediaUrl, postId, workspaceId, mediaType);

        if (thumbnailResult.success && thumbnailResult.thumbnailUrl) {
          await updatePostThumbnail(postId, thumbnailResult.thumbnailUrl);
          console.log(`[api/posts] ✓ Thumbnail regenerated for draft`);
        }
      } catch (thumbnailError) {
        // Don't fail the update if thumbnail generation fails
        console.warn(`[api/posts] Thumbnail regeneration failed (non-fatal):`, thumbnailError);
      }
    }

    return NextResponse.json({ data: { id: postId, status: "draft" } });
  } catch (err) {
    console.error("[api/posts] PATCH error:", err);
    const message = err instanceof Error ? err.message : "Failed to update draft";
    return NextResponse.json({ data: null, error: message }, { status: 500 });
  }
}
