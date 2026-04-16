// ════════════════════════════════════════════════════════════
// CHANNEL ADAPTER TYPES
// Common interface for all social media platforms
// ════════════════════════════════════════════════════════════

import { Platform } from "@/types";

// ── Basic Types ───────────────────────────────────────────

export interface FetchedComment {
  externalId: string; // platform's unique comment ID
  authorName: string;
  authorAvatar: string | null;
  authorUserId: string | null;
  content: string;
  receivedAt: string; // ISO timestamp
  parentCommentId?: string; // for nested replies
  likesCount?: number;
  replyCount?: number;
}

export interface FetchedDirectMessage {
  externalId: string; // platform's unique message ID
  conversationId: string; // for grouping threads
  senderName: string;
  senderUserId: string;
  senderAvatar: string | null;
  recipientName?: string;
  recipientUserId?: string;
  content: string;
  messageType: 'text' | 'image' | 'video' | 'link'; // type of message
  mediaUrls?: string[];
  receivedAt: string; // ISO timestamp
  parentMessageId?: string; // if this is a reply
}

export interface SyncResult {
  platform: Platform;
  accountId: string;
  syncType: 'comments' | 'messages' | 'both';
  syncedCount: number;
  skippedCount: number;
  errorCount: number;
  status: 'success' | 'partial_success' | 'failed';
  errorMessage?: string;
  nextCursor?: string; // for pagination/resuming
  durationMs: number;
}

// ── Fetch Parameters ───────────────────────────────────────

export interface FetchCommentsParams {
  postId: string; // platform's post/media ID
  pageAccessToken?: string; // varies by platform
  accessToken?: string;
  since?: string; // ISO timestamp to fetch comments after
  limit?: number;
  cursor?: string; // for pagination
}

export interface FetchDirectMessagesParams {
  accountId: string; // account owner ID on platform
  accessToken: string;
  since?: string; // ISO timestamp
  limit?: number;
  cursor?: string; // for pagination
  conversationId?: string; // to fetch specific conversation
}

export interface SendReplyParams {
  targetId: string; // comment ID or message ID
  content: string;
  accessToken: string;
  targetType: 'comment' | 'message';
  postId?: string; // for comments, the post it belongs to
}

// ── Channel Adapter Interface ──────────────────────────────

export interface IChannelAdapter {
  platform: Platform;

  /**
   * Fetch top-level comments on a post/media
   */
  fetchComments(params: FetchCommentsParams): Promise<FetchedComment[]>;

  /**
   * Fetch direct messages for an account
   */
  fetchDirectMessages(params: FetchDirectMessagesParams): Promise<FetchedDirectMessage[]>;

  /**
   * Send a reply to a comment or message
   */
  sendReply(params: SendReplyParams): Promise<{ externalId: string }>;

  /**
   * Fetch recent comments for the entire account (across all media/posts)
   */
  fetchAccountActivityComments?(params: {
    accountId: string;
    accessToken: string;
    pageAccessToken?: string;
    since?: string;
    limit?: number;
  }): Promise<Array<FetchedComment & { parentId?: string; parentType?: 'post' | 'comment' }>>;

  /**
   * Refresh OAuth token if expired
   * @returns new access token
   */
  refreshToken?(refreshToken: string): Promise<string>;

  /**
   * Get platform-specific character limit for replies
   */
  getCharacterLimit?(): number;

  /**
   * Validate access token is still valid
   */
  validateToken?(accessToken: string): Promise<boolean>;
}

// ── Rate Limit & Retry ─────────────────────────────────────

export interface RateLimitConfig {
  requestsPerSecond: number;
  requestsPerMinute: number;
  requestsPerHour: number;
  retryAttempts: number;
  initialBackoffMs: number; // exponential backoff base
}

export interface RateLimitStatus {
  isLimited: boolean;
  resetAt: Date;
  retryAfterMs: number;
}

// ── Error Types ────────────────────────────────────────────

export class ChannelAdapterError extends Error {
  constructor(
    public platform: Platform,
    public code: string, // 'RATE_LIMITED', 'INVALID_TOKEN', 'NOT_FOUND', etc.
    message: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(`[${platform}] ${code}: ${message}`);
    this.name = 'ChannelAdapterError';
  }
}

export interface AdapterErrorContext {
  platform: Platform;
  operation: string; // 'fetchComments', 'fetchMessages', 'sendReply'
  error: unknown;
  retryCount: number;
  lastRetryAt?: Date;
}
