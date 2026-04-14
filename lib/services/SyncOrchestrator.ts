// ════════════════════════════════════════════════════════════
// SYNC ORCHESTRATOR
// Coordinates syncing of comments and messages across all platforms
// Handles rate limiting, error logging, and deduplication
// ════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase/server";
import { ChannelAdapterFactory } from "@/lib/channels/factory";
import {
  FetchCommentsParams,
  FetchDirectMessagesParams,
  ChannelAdapterError,
  SyncResult,
} from "@/lib/channels/types";
import { Platform } from "@/types";
import { PostgrestError } from "@supabase/supabase-js";

export interface SyncParams {
  workspaceId: string;
  accountId: string; // outstand_account_id (e.g., "meta_fb_123456789")
  platform: Platform;
  accessToken: string;
  pageAccessToken?: string; // for Meta (Facebook/Instagram)
  syncComments?: boolean;
  syncMessages?: boolean;
  since?: string; // ISO timestamp to sync from
}

export interface SyncSummary {
  workspaceId: string;
  accountId: string;
  platform: Platform;
  commentsResult?: SyncResult;
  messagesResult?: SyncResult;
  syncLogId: string;
  totalDurationMs: number;
  status: 'success' | 'partial_success' | 'failed';
}

/**
 * Orchestrates syncing of comments and messages from all platforms
 * to Supabase inbox_messages and messages tables
 */
export class SyncOrchestrator {
  private supabase = createServiceClient();

  /**
   * Main sync entry point
   * Fetches comments and/or messages for an account and upserts to Supabase
   */
  async sync(params: SyncParams): Promise<SyncSummary> {
    const startTime = Date.now();
    const {
      workspaceId,
      accountId,
      platform,
      accessToken,
      pageAccessToken,
      syncComments = true,
      syncMessages = true,
      since,
    } = params;

    // Create sync log entry
    const syncLogId = await this.createSyncLog({
      workspaceId,
      accountId,
      platform,
      syncType: syncComments && syncMessages ? 'both' : syncComments ? 'comments' : 'messages',
    });

    let commentsResult: SyncResult | undefined;
    let messagesResult: SyncResult | undefined;
    let hasErrors = false;

    try {
      let adapter;
      try {
        adapter = ChannelAdapterFactory.getAdapter(platform);
      } catch (adapterErr) {
        console.warn(`[SyncOrchestrator] Skipping sync for ${platform}: adapter not implemented`);
        return {
          workspaceId,
          accountId,
          platform,
          syncLogId,
          totalDurationMs: Date.now() - startTime,
          status: 'success',
        };
      }

      // Fetch comments
      if (syncComments) {
        try {
          commentsResult = await this.syncComments({
            workspaceId,
            accountId,
            platform,
            adapter,
            accessToken,
            pageAccessToken,
            since,
          });

          if (commentsResult.status === 'failed') {
            hasErrors = true;
          }
        } catch (error) {
          console.error(
            `[SyncOrchestrator] Error syncing comments for ${platform}/${accountId}:`,
            error
          );
          hasErrors = true;

          // Still record result
          commentsResult = {
            platform,
            accountId,
            syncType: 'comments',
            syncedCount: 0,
            skippedCount: 0,
            errorCount: 1,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Fetch messages
      if (syncMessages) {
        try {
          messagesResult = await this.syncMessages({
            workspaceId,
            accountId,
            platform,
            adapter,
            accessToken,
            pageAccessToken,
            since,
          });

          if (messagesResult.status === 'failed') {
            hasErrors = true;
          }
        } catch (error) {
          console.error(
            `[SyncOrchestrator] Error syncing messages for ${platform}/${accountId}:`,
            error
          );
          hasErrors = true;

          // Still record result
          messagesResult = {
            platform,
            accountId,
            syncType: 'messages',
            syncedCount: 0,
            skippedCount: 0,
            errorCount: 1,
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Update sync log with results
      const totalDurationMs = Date.now() - startTime;
      const status = hasErrors ? 'partial_success' : 'success';

      await this.updateSyncLog(syncLogId, {
        status,
        syncedCount: (commentsResult?.syncedCount || 0) + (messagesResult?.syncedCount || 0),
        errorCount: (commentsResult?.errorCount || 0) + (messagesResult?.errorCount || 0),
        skippedCount: (commentsResult?.skippedCount || 0) + (messagesResult?.skippedCount || 0),
        durationMs: totalDurationMs,
      });

      return {
        workspaceId,
        accountId,
        platform,
        commentsResult,
        messagesResult,
        syncLogId,
        totalDurationMs,
        status,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      // Update sync log with failure
      await this.updateSyncLog(syncLogId, {
        status: 'failed',
        errorMessage,
        durationMs: Date.now() - startTime,
      });

      throw new Error(`Sync failed for ${platform}/${accountId}: ${errorMessage}`);
    }
  }

  /**
   * Sync comments for an account
   */
  private async syncComments(options: {
    workspaceId: string;
    accountId: string;
    platform: Platform;
    adapter: any;
    accessToken: string;
    pageAccessToken?: string;
    since?: string;
  }): Promise<SyncResult> {
    const { workspaceId, accountId, platform, adapter, accessToken, pageAccessToken, since } =
      options;

    const startTime = Date.now();
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      // Get posts for this specific account to fetch comments for
      // accountId is the outstand_account_id (e.g., "meta_ig_..."), we need the local UUID first
      const { data: localAccount } = await this.supabase
        .from('social_accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('outstand_account_id', accountId)
        .single();

      const { data: posts, error: postsError } = await this.supabase
        .from('posts')
        .select('id, outstand_post_id, platforms, account_ids, published_at')
        .eq('workspace_id', workspaceId)
        .eq('status', 'published')
        .contains('platforms', [platform])
        .contains('account_ids', [localAccount?.id || ""])
        .order('published_at', { ascending: false })
        .limit(50);

      if (postsError) {
        throw new Error(`Failed to fetch posts: ${postsError.message}`);
      }

      console.log(`[SyncOrchestrator] Account ${accountId}: Found ${posts?.length || 0} published posts to sync`);

      const inboxMessages: any[] = [];

      for (const post of posts || []) {
        if (!post.outstand_post_id) {
          skippedCount++;
          continue;
        }

        // Extract platform-specific post ID (handle 'meta_' prefix and comma-separated IDs)
        // Find index of current platform in post.platforms to get the matching ID
        const platformIndex = post.platforms.indexOf(platform);
        if (platformIndex === -1) {
          skippedCount++;
          continue;
        }

        const ids = post.outstand_post_id.replace(/^meta_/, '').split(',');
        const postId = ids[platformIndex] || ids[0]; // fallback to first if index out of bounds

        try {
          // Fetch comments
          const comments = await adapter.fetchComments({
            postId,
            pageAccessToken,
            accessToken,
            since: since || post.published_at,
          });

          // Map to inbox_messages format
          for (const comment of comments) {
            inboxMessages.push({
              workspace_id: workspaceId,
              platform,
              account_id: accountId,
              external_message_id: comment.externalId,
              author_name: comment.authorName,
              author_avatar: comment.authorAvatar,
              content: comment.content,
              post_id: post.id,
              status: 'unread',
              received_at: comment.receivedAt,
            });

            syncedCount++;
          }
        } catch (error) {
          console.error(`Error fetching comments for post ${post.id}:`, error);
          errorCount++;
        }
      }

      // Upsert all messages to database
      if (inboxMessages.length > 0) {
        const { error: upsertError } = await this.supabase
          .from('inbox_messages')
          .upsert(inboxMessages, {
            onConflict: 'workspace_id,external_message_id',
            ignoreDuplicates: true,
          });

        if (upsertError) {
          throw new Error(`Failed to upsert messages: ${upsertError.message}`);
        }
      }

      return {
        platform,
        accountId,
        syncType: 'comments',
        syncedCount,
        skippedCount,
        errorCount,
        status: errorCount === 0 ? 'success' : 'partial_success',
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform,
        accountId,
        syncType: 'comments',
        syncedCount,
        skippedCount,
        errorCount: errorCount + 1,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync direct messages for an account
   */
  private async syncMessages(options: {
    workspaceId: string;
    accountId: string;
    platform: Platform;
    adapter: any;
    accessToken: string;
    pageAccessToken?: string;
    since?: string;
  }): Promise<SyncResult> {
    const { workspaceId, accountId, platform, adapter, accessToken, pageAccessToken, since } =
      options;

    const startTime = Date.now();
    let syncedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    try {
      // Fetch direct messages
      const messages = await adapter.fetchDirectMessages({
        accessToken: pageAccessToken || accessToken,
        since,
        limit: 100,
      });

      const dbMessages: any[] = [];

      for (const message of messages) {
        // Check for duplicate
        const { data: existing } = await this.supabase
          .from('messages')
          .select('id')
          .eq('workspace_id', workspaceId)
          .eq('external_message_id', message.externalId)
          .maybeSingle();

        if (existing) {
          skippedCount++;
          continue;
        }

        dbMessages.push({
          workspace_id: workspaceId,
          platform,
          account_id: accountId,
          external_message_id: message.externalId,
          conversation_id: message.conversationId,
          sender_id: message.senderUserId,
          sender_name: message.senderName,
          sender_avatar: message.senderAvatar,
          recipient_id: message.recipientUserId,
          recipient_name: message.recipientName,
          recipient_avatar: message.recipientAvatar,
          content: message.content,
          message_type: message.messageType,
          media_urls: message.mediaUrls || [],
          status: 'unread',
          received_at: message.receivedAt,
          is_sent_by_user: false,
        });

        syncedCount++;
      }

      // Upsert all messages to database
      if (dbMessages.length > 0) {
        const { error: upsertError } = await this.supabase
          .from('messages')
          .upsert(dbMessages, {
            onConflict: 'workspace_id,external_message_id',
            ignoreDuplicates: true,
          });

        if (upsertError) {
          throw new Error(`Failed to upsert messages: ${upsertError.message}`);
        }
      }

      return {
        platform,
        accountId,
        syncType: 'messages',
        syncedCount,
        skippedCount,
        errorCount,
        status: errorCount === 0 ? 'success' : 'partial_success',
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        platform,
        accountId,
        syncType: 'messages',
        syncedCount,
        skippedCount,
        errorCount: errorCount + 1,
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Create a sync log entry
   */
  private async createSyncLog(params: {
    workspaceId: string;
    accountId: string;
    platform: Platform;
    syncType: string;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('sync_logs')
      .insert({
        workspace_id: params.workspaceId,
        account_id: params.accountId,
        platform: params.platform,
        sync_type: params.syncType,
        status: 'in_progress',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create sync log: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update a sync log entry
   */
  private async updateSyncLog(
    syncLogId: string,
    updates: {
      status: string;
      syncedCount?: number;
      skippedCount?: number;
      errorCount?: number;
      durationMs: number;
      errorMessage?: string;
    }
  ): Promise<void> {
    const { error } = await this.supabase
      .from('sync_logs')
      .update({
        status: updates.status,
        synced_count: updates.syncedCount,
        skipped_count: updates.skippedCount,
        error_count: updates.errorCount,
        duration_ms: updates.durationMs,
        error_message: updates.errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId);

    if (error) {
      console.error('Failed to update sync log:', error);
    }
  }
}
