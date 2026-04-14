// ════════════════════════════════════════════════════════════
// INSTAGRAM CHANNEL ADAPTER
// Fetches comments and DMs from Instagram via Meta Graph API
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
import { graphGet, graphPost, MetaApiError } from "@/lib/meta/client";

export class InstagramAdapter extends BaseChannelAdapter {
  platform: Platform = Platform.Instagram;

  // Instagram uses the Meta Graph API
  private readonly GRAPH_API_BASE = "https://graph.facebook.com";

  /**
   * Fetch comments from an Instagram media object
   */
  async fetchComments(
    params: FetchCommentsParams
  ): Promise<FetchedComment[]> {
    return this.withRetry(
      async () => {
        const { postId, pageAccessToken, since, limit = 100 } = params;

        if (!pageAccessToken) {
          throw new ChannelAdapterError(
            this.platform,
            'MISSING_TOKEN',
            'Access token is required (Instagram requires a Page token)'
          );
        }

        if (!postId) {
          throw new ChannelAdapterError(
            this.platform,
            'INVALID_PARAMS',
            'Media ID is required'
          );
        }

        const apiParams: Record<string, string | number> = {
          fields: 'id,from{id,username},text,timestamp,like_count',
          limit,
        };

        console.log(`[InstagramAdapter] Fetching comments for Media ID: ${postId}`);

        if (since) {
          const unixTs = Math.floor(new Date(since).getTime() / 1000) - 60;
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
              replies?: { data?: Array<any> };
            }>;
          }>(`/${postId}/comments`, apiParams, pageAccessToken);

          return (response.data || []).map((comment) => ({
            externalId: comment.id,
            authorName: comment.from?.username || 'Instagram User',
            authorUserId: comment.from?.id || '',
            authorAvatar: null,
            content: comment.text || '',
            receivedAt: comment.timestamp,
            likesCount: comment.like_count || 0,
            replyCount: 0, // Replies require a separate fetch per comment or a complex nested query
          }));
        } catch (error) {
          console.error(`[InstagramAdapter] API Error for Media ${postId}:`, error);
          if (error instanceof MetaApiError) {
            throw new ChannelAdapterError(
              this.platform,
              'API_ERROR',
              error.message,
              error.status,
              error.status === 429 || error.status >= 500
            );
          }
          throw error;
        }
      },
      { platform: this.platform, operation: 'fetchComments' }
    );
  }

  /**
   * Fetch direct messages for an Instagram Business account
   */
  async fetchDirectMessages(
    params: FetchDirectMessagesParams
  ): Promise<FetchedDirectMessage[]> {
    return this.withRetry(
      async () => {
        const { accessToken, since, limit = 100, cursor } = params;

        if (!accessToken) {
          throw new ChannelAdapterError(
            this.platform,
            'MISSING_TOKEN',
            'Access token is required'
          );
        }

        const apiParams: Record<string, string | number> = {
          fields: 'id,participants,messages{id,text,created_time,from,to}',
          limit,
          platform: 'instagram', // Filter for Instagram DMs on /me/conversations
        };

        if (cursor) {
          apiParams.after = cursor;
        }

        try {
          const response = await graphGet<{
            data: Array<{
              id: string;
              participants?: { data: Array<{ id: string; name: string; username: string }> };
              messages?: {
                data: Array<{
                  id: string;
                  text: string;
                  created_time: string;
                  from: { id: string; username: string };
                  to: { data: Array<{ id: string; username: string }> };
                }>;
              };
            }>;
          }>('/me/conversations', apiParams, accessToken);

          const messages: FetchedDirectMessage[] = [];

          for (const conversation of response.data || []) {
            const lastMessage = conversation.messages?.data?.[0];
            if (lastMessage) {
              messages.push({
                externalId: lastMessage.id,
                conversationId: conversation.id,
                senderName: lastMessage.from?.username || 'Instagram User',
                senderUserId: lastMessage.from?.id || '',
                senderAvatar: null,
                content: lastMessage.text,
                messageType: 'text',
                receivedAt: lastMessage.created_time,
              });
            }
          }

          console.log(`[InstagramAdapter] Fetching DMs for account: ${accessToken.slice(0, 10)}...`);

          if (since) {
            const sinceDate = new Date(since).getTime();
            return messages.filter((m) => new Date(m.receivedAt).getTime() > sinceDate);
          }

          return messages;
        } catch (error) {
          if (error instanceof MetaApiError) {
            throw new ChannelAdapterError(
              this.platform,
              'API_ERROR',
              error.message,
              error.status,
              error.status === 429 || error.status >= 500
            );
          }
          throw error;
        }
      },
      {
        platform: this.platform,
        operation: 'fetchDirectMessages',
      }
    );
  }

  /**
   * Send a reply to an Instagram comment
   */
  async sendReply(params: SendReplyParams): Promise<{ externalId: string }> {
    return this.withRetry(
      async () => {
        const { targetId, content, accessToken, targetType } = params;

        if (!accessToken) {
          throw new ChannelAdapterError(
            this.platform,
            'MISSING_TOKEN',
            'Access token is required'
          );
        }

        if (!targetId || !content) {
          throw new ChannelAdapterError(
            this.platform,
            'INVALID_PARAMS',
            'Target ID and content are required'
          );
        }

        if (targetType !== 'comment') {
          throw new ChannelAdapterError(
            this.platform,
            'UNSUPPORTED_TARGET',
            'Only comments are supported for replies via this adapter'
          );
        }

        try {
          const response = await fetch(
            `${this.GRAPH_API_BASE}/${targetId}/replies`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                message: content,
                access_token: accessToken,
              }).toString(),
            }
          );

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new ChannelAdapterError(
              this.platform,
              'API_ERROR',
              errorData.error?.message || response.statusText,
              response.status,
              response.status === 429 || response.status >= 500
            );
          }

          const data = (await response.json()) as { id?: string };

          if (!data.id) {
            throw new ChannelAdapterError(
              this.platform,
              'INVALID_RESPONSE',
              'No comment ID returned from API'
            );
          }

          return { externalId: data.id };
        } catch (error) {
          if (error instanceof ChannelAdapterError) {
            throw error;
          }
          throw this.normalizeError(error, {
            platform: this.platform,
            operation: 'sendReply',
            retryCount: 0,
          });
        }
      },
      { platform: this.platform, operation: 'sendReply' }
    );
  }

  /**
   * Get Instagram's character limit for replies
   */
  getCharacterLimit(): number {
    return 2200; // Instagram's caption/comment limit
  }
}
