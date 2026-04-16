// ════════════════════════════════════════════════════════════
// FACEBOOK CHANNEL ADAPTER
// Fetches comments and DMs from Facebook via Meta Graph API
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

export class FacebookAdapter extends BaseChannelAdapter {
  platform: Platform = Platform.Facebook;

  // Facebook Graph API v21.0
  private readonly API_VERSION = "v21.0";
  private readonly GRAPH_API_BASE = "https://graph.facebook.com";

  // Rate limiting config for Facebook
  protected rateLimitConfig = {
    requestsPerSecond: 10,
    requestsPerMinute: 600,
    requestsPerHour: 10000,
    retryAttempts: 3,
    initialBackoffMs: 500,
  };

  /**
   * Fetch comments from a Facebook post
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
            'Page access token is required'
          );
        }

        if (!postId) {
          throw new ChannelAdapterError(
            this.platform,
            'INVALID_PARAMS',
            'Post ID is required'
          );
        }

        const apiParams: Record<string, string | number> = {
          fields: 'id,from{id,name,picture.type(large)},message,created_time,like_count,comments.limit(0).summary(total_count)',
          limit,
        };

        // Convert ISO timestamp to Unix timestamp if provided
        // Subtract 120 seconds to catch recently added comments and account for clock drift
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
              from: { id: string; name: string; picture?: { data?: { url: string } } };
              message: string;
              created_time: string;
              like_count?: number;
              comments?: { summary?: { total_count: number } };
            }>;
          }>(`/${postId}/comments`, apiParams, pageAccessToken);

          return (response.data || []).map((comment) => ({
            externalId: comment.id,
            authorName: comment.from?.name || 'Facebook User',
            authorUserId: comment.from?.id || '',
            authorAvatar: comment.from?.picture?.data?.url || null,
            content: comment.message || '',
            receivedAt: comment.created_time,
            likesCount: comment.like_count || 0,
            replyCount: comment.comments?.summary?.total_count || 0,
          }));
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
      { platform: this.platform, operation: 'fetchComments' }
    );
  }

  /**
   * Fetch direct messages (Messenger) for a Facebook page
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
          fields: 'id,senders,message,created_timestamp,from{id,name,email},to{data{id,name,email}}',
          limit,
        };

        if (cursor) {
          apiParams.after = cursor;
        }

        if (since) {
          const unixTs = Math.floor(new Date(since).getTime() / 1000);
          apiParams.since = unixTs;
        }

        try {
          const response = await graphGet<{
            data: Array<{
              id: string;
              senders?: { data?: Array<{ email: string; name: string }> };
              message?: string;
              created_timestamp: number;
              from?: { id: string; name: string; email: string };
              to?: { data?: Array<{ id: string; name: string; email: string }> };
            }>;
            paging?: { cursors?: { after?: string } };
          }>('/me/conversations', apiParams, accessToken);

          const messages: FetchedDirectMessage[] = [];

          for (const conversation of response.data || []) {
            if (conversation.message) {
              const sender = conversation.senders?.data?.[0];
              const recipient = conversation.to?.data?.[0];

              messages.push({
                externalId: conversation.id,
                conversationId: conversation.id,
                senderName: sender?.name || 'Unknown',
                senderUserId: sender?.email || '',
                senderAvatar: null,
                recipientName: recipient?.name,
                recipientUserId: recipient?.email,
                content: conversation.message,
                messageType: 'text',
                receivedAt: new Date(conversation.created_timestamp * 1000).toISOString(),
              });
            }
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
   * Send a reply to a Facebook comment
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
            'Only comments are supported for replies'
          );
        }

        try {
          const response = await fetch(
            `${this.GRAPH_API_BASE}/${targetId}/comments`,
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
   * Fetch recent comments across the entire Facebook Page (Discovery Mode)
   */
  async fetchAccountActivityComments(params: {
    accountId: string;
    accessToken: string;
    pageAccessToken?: string;
    since?: string;
    limit?: number;
  }): Promise<Array<FetchedComment & { parentId?: string; parentType?: 'post' | 'comment' }>> {
    return this.withRetry(
      async () => {
        const { accountId, pageAccessToken, since, limit = 25 } = params;

        if (!pageAccessToken) {
          throw new ChannelAdapterError(this.platform, 'MISSING_TOKEN', 'Page access token is required');
        }

        const pageId = accountId.replace(/^meta_fb_/, '');

        const apiParams: Record<string, string | number> = {
          fields: 'id,comments{id,from{id,name,picture},message,created_time,like_count}',
          limit,
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
              comments?: {
                data: Array<{
                  id: string;
                  from?: { id: string; name: string; picture?: { data: { url: string } } };
                  message: string;
                  created_time: string;
                  like_count?: number;
                }>;
              };
            }>;
          }>(`/${pageId}/feed`, apiParams, pageAccessToken);

          const allComments: Array<FetchedComment & { parentId?: string; parentType?: 'post' | 'comment' }> = [];

          for (const post of response.data || []) {
            if (post.comments?.data) {
              for (const comment of post.comments.data) {
                allComments.push({
                  externalId: comment.id,
                  authorName: comment.from?.name || 'Facebook User',
                  authorUserId: comment.from?.id || '',
                  authorAvatar: comment.from?.picture?.data?.url || null,
                  content: comment.message || '',
                  receivedAt: comment.created_time,
                  likesCount: comment.like_count || 0,
                  replyCount: 1, // Fallback
                  parentId: post.id,
                  parentType: 'post'
                });
              }
            }
          }

          return allComments;
        } catch (error) {
          console.error(`[FacebookAdapter] Error during account activity sync:`, error);
          if (error instanceof MetaApiError) {
            throw new ChannelAdapterError(this.platform, 'API_ERROR', error.message, error.status);
          }
          throw error;
        }
      },
      { platform: this.platform, operation: 'fetchAccountActivityComments' }
    );
  }

  /**
   * Get Facebook's character limit for replies
   */
  getCharacterLimit(): number {
    return 63206; // Facebook's limit is essentially unlimited, but practical limit
  }
}
