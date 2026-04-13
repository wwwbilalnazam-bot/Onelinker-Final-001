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

  const apiParams: Record<string, string | number> = {
    fields: "id,from,message,created_time",
    limit: 50,
  };

  // Convert ISO timestamp to Unix timestamp if provided
  if (since) {
    const unixTs = Math.floor(new Date(since).getTime() / 1000);
    apiParams.since = unixTs;
  }

  try {
    const response = await graphGet<{
      data: Array<{
        id: string;
        from: { id: string; name: string };
        message: string;
        created_time: string;
      }>;
      paging?: { cursors: { before?: string; after?: string } };
    }>(`/${postId}/comments`, apiParams, pageAccessToken);

    return (response.data || []).map((comment) => ({
      externalId: comment.id,
      authorName: comment.from.name || "Unknown",
      authorAvatar: null, // Facebook Graph API doesn't provide avatar in /comments endpoint
      content: comment.message || "",
      receivedAt: comment.created_time,
    }));
  } catch (error) {
    if (error instanceof MetaApiError) {
      console.error(`[facebook] Error fetching comments for post ${postId}:`, error.message);
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

  const apiParams: Record<string, string | number> = {
    fields: "id,from.fields(id,username,name),text,timestamp,like_count",
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
        from?: { id: string; username: string; name: string };
        text: string;
        timestamp: string;
        like_count?: number;
      }>;
      paging?: { cursors: { before?: string; after?: string } };
    }>(`/${igMediaId}/comments`, apiParams, pageAccessToken);

    return (response.data || []).map((comment) => ({
      externalId: comment.id,
      authorName: comment.from?.username || comment.from?.name || "Unknown",
      authorAvatar: null, // Instagram Graph API doesn't provide avatar URL in /comments endpoint
      content: comment.text || "",
      receivedAt: comment.timestamp,
    }));
  } catch (error) {
    if (error instanceof MetaApiError) {
      console.error(`[instagram] Error fetching comments for media ${igMediaId}:`, error.message);
    } else {
      console.error(`[instagram] Unexpected error fetching comments:`, error);
    }
    return [];
  }
}
