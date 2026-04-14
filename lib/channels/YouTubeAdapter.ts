// ════════════════════════════════════════════════════════════
// YOUTUBE CHANNEL ADAPTER
// Fetches comments from YouTube via YouTube Data API v3
// ════════════════════════════════════════════════════════════

import { Platform } from "@/types";
import { BaseChannelAdapter } from "./BaseAdapter";
import {
  FetchCommentsParams,
  FetchDirectMessagesParams,
  SendReplyParams,
  FetchedComment,
  FetchedDirectMessage,
  ChannelAdapterError,
} from "./types";
import { fetchYouTubeVideoComments } from "@/lib/youtube/comments";

export class YouTubeAdapter extends BaseChannelAdapter {
  platform: Platform = Platform.YouTube;

  /**
   * Fetch comments from a YouTube video
   */
  async fetchComments(
    params: FetchCommentsParams
  ): Promise<FetchedComment[]> {
    return this.withRetry(
      async () => {
        const { postId, accessToken, since, limit = 50 } = params;

        if (!accessToken) {
          throw new ChannelAdapterError(
            this.platform,
            'MISSING_TOKEN',
            'OAuth access token is required'
          );
        }

        if (!postId) {
          throw new ChannelAdapterError(
            this.platform,
            'INVALID_PARAMS',
            'Video ID is required'
          );
        }

        try {
          // Adjust since to be a bit earlier to avoid missing edge cases
          let publishedAfter: string | undefined = since;
          if (since) {
             const date = new Date(since);
             date.setMinutes(date.getMinutes() - 5); // 5 minute window for YouTube
             publishedAfter = date.toISOString();
          }

          const comments = await fetchYouTubeVideoComments({
            videoId: postId,
            accessToken,
            publishedAfter,
            maxResults: limit,
          });

          return comments.map((comment) => ({
            ...comment,
            likesCount: 0, // YouTube comments API requires additional parts for likes
            replyCount: 0,
          }));
        } catch (error) {
          throw new ChannelAdapterError(
            this.platform,
            'API_ERROR',
            error instanceof Error ? error.message : 'Failed to fetch YouTube comments'
          );
        }
      },
      { platform: this.platform, operation: 'fetchComments' }
    );
  }

  /**
   * YouTube DMs are not supported via standard API
   */
  async fetchDirectMessages(
    params: FetchDirectMessagesParams
  ): Promise<FetchedDirectMessage[]> {
    return [];
  }

  /**
   * Send a reply to a YouTube comment
   */
  async sendReply(params: SendReplyParams): Promise<{ externalId: string }> {
    throw new ChannelAdapterError(
      this.platform,
      'NOT_IMPLEMENTED',
      'Replying to YouTube comments is not yet implemented'
    );
  }

  /**
   * Get YouTube's character limit for comments
   */
  getCharacterLimit(): number {
    return 10000;
  }
}
