// ════════════════════════════════════════════════════════════
// META (FACEBOOK + INSTAGRAM) COMMENTS FETCHER
//
// Fetches comments from Facebook pages and Instagram media
// using the Graph API v21.0
// ════════════════════════════════════════════════════════════

import { graphGet, MetaApiError } from "./client";

export interface FetchedComment {
  externalId: string;       // platform's comment ID
  authorName: string;
  authorAvatar: string | null;
  content: string;
  receivedAt: string;       // ISO timestamp
}

// ── Facebook Comments ───────────────────────────────────────

/**
 * Fetch top-level comments on a Facebook Page post.
 *
 * @param postId - Facebook post ID (format: "123456789_987654321")
 * @param pageAccessToken - Page access token for authentication
 * @param since - Optional ISO timestamp; only fetch comments after this date
 * @returns Array of FetchedComment objects
 */
export async function fetchFacebookPostComments(params: {
  postId: string;
  pageAccessToken: string;
  since?: string;
}): Promise<FetchedComment[]> {
  const { postId, pageAccessToken, since } = params;

  // Use the full PAGEID_POSTID if possible, though PostID alone often works
  const apiParams: Record<string, string | number> = {
    fields: "id,from{id,name,picture},message,created_time",
    limit: 50,
  };

  if (since) {
    const unixTs = Math.floor(new Date(since).getTime() / 1000);
    apiParams.since = unixTs;
  }

  try {
    const response = await graphGet<{
      data: Array<{
        id: string;
        from?: { id: string; name: string; picture?: { data: { url: string } } };
        message: string;
        created_time: string;
      }>;
      paging?: { cursors: { before?: string; after?: string } };
    }>(`/${postId}/comments`, apiParams, pageAccessToken);

    return (response.data || []).map((comment) => ({
      externalId: comment.id,
      authorName: comment.from?.name || "Facebook User",
      authorAvatar: comment.from?.picture?.data?.url || null,
      content: comment.message || "",
      receivedAt: comment.created_time,
    }));
  } catch (error) {
    if (error instanceof MetaApiError) {
      console.error(`[facebook] Error fetching comments for post ${postId}:`, {
        message: error.message,
        code: error.code,
        subcode: error.subcode
      });
    } else {
      console.error(`[facebook] Unexpected error fetching comments:`, error);
    }
    return [];
  }
}

// ── Instagram Comments ──────────────────────────────────────

/**
 * Fetch top-level comments on an Instagram media object.
 *
 * @param igMediaId - Instagram media ID
 * @param pageAccessToken - Page access token (Instagram-connected page token)
 * @param since - Optional ISO timestamp; only fetch comments after this date
 * @returns Array of FetchedComment objects
 */
export async function fetchInstagramMediaComments(params: {
  igMediaId: string;
  pageAccessToken: string;
  since?: string;
}): Promise<FetchedComment[]> {
  const { igMediaId, pageAccessToken, since } = params;

  // Note: 'from' on IG comments requires the 'instagram_manage_comments' permission
  // and for some apps, advanced access.
  const apiParams: Record<string, string | number> = {
    fields: "id,from{id,username},text,timestamp",
    limit: 50,
  };

  if (since) {
    const sinceDate = new Date(since);
    if (!isNaN(sinceDate.getTime())) {
      const unixTs = Math.floor(sinceDate.getTime() / 1000) - 120;
      apiParams.since = unixTs;
    }
  }

  try {
    const response = await graphGet<{
      data: Array<{
        id: string;
        from?: { id: string; username: string };
        text: string;
        timestamp: string;
      }>;
      paging?: { cursors: { before?: string; after?: string } };
    }>(`/${igMediaId}/comments`, apiParams, pageAccessToken);

    return (response.data || []).map((comment) => ({
      externalId: comment.id,
      authorName: comment.from?.username || "Instagram User",
      authorAvatar: null, // IG API doesn't easily provide avatars for comment authors without extra scopes
      content: comment.text || "",
      receivedAt: comment.timestamp,
    }));
  } catch (error) {
    // Fallback: If 'from' causes error (common with missing Advanced Access), try without it
    if (error instanceof MetaApiError && (error.code === 100 || error.code === 200 || error.status === 403)) {
      console.warn(`[instagram] Retrying without 'from' field for media ${igMediaId}`);
      apiParams.fields = "id,text,timestamp";
      const fallbackRes = await graphGet<any>(`/${igMediaId}/comments`, apiParams, pageAccessToken);
      return (fallbackRes.data || []).map((comment: any) => ({
        externalId: comment.id,
        authorName: "Instagram User",
        authorAvatar: null,
        content: comment.text || "",
        receivedAt: comment.timestamp,
      }));
    }

    if (error instanceof MetaApiError) {
      console.error(`[instagram] Error fetching comments for media ${igMediaId}:`, {
        message: error.message,
        code: error.code,
        subcode: error.subcode
      });
    } else {
      console.error(`[instagram] Unexpected error fetching comments:`, error);
    }
    return [];
  }
}
