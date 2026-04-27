'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWorkspace } from '@/hooks/useWorkspace';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare, Clock, RefreshCw, Facebook, Instagram, Twitter, Youtube,
  MoreHorizontal, ChevronDown, X, CornerDownRight, Search
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Post {
  id: string;
  content: string;
  platforms: string[];
  published_at: string;
  thumbnail_url?: string;
  media_urls?: string[];
}

interface Message {
  id: string;
  platform: string;
  author_name?: string;
  sender_name?: string;
  content: string;
  status: 'unread' | 'read' | 'replied' | 'archived';
  received_at: string;
  message_type: 'comment' | 'message';
  author_avatar?: string;
  sender_avatar?: string;
  post?: Post;
  reply_text?: string;
  external_reply_id?: string;
  replied_at?: string;
  replied_by_user_id?: string;
}

const PLATFORM_ICONS: Record<string, React.ElementType> = {
  facebook: Facebook,
  instagram: Instagram,
  twitter: Twitter,
  youtube: Youtube,
};

const PLATFORM_COLORS: Record<string, { bg: string; text: string; badge: string }> = {
  facebook: { bg: 'bg-blue-50 dark:bg-blue-950', text: 'text-blue-700 dark:text-blue-400', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  instagram: { bg: 'bg-pink-50 dark:bg-pink-950', text: 'text-pink-700 dark:text-pink-400', badge: 'bg-pink-100 text-pink-700 dark:bg-pink-900 dark:text-pink-300' },
  twitter: { bg: 'bg-sky-50 dark:bg-sky-950', text: 'text-sky-700 dark:text-sky-400', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900 dark:text-sky-300' },
  youtube: { bg: 'bg-red-50 dark:bg-red-950', text: 'text-red-700 dark:text-red-400', badge: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' },
};

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'read', label: 'Read' },
  { value: 'replied', label: 'Replied' },
  { value: 'archived', label: 'Archived' },
];

const STATUS_BADGE_VARIANT: Record<string, any> = {
  unread: 'warning',
  read: 'outline',
  replied: 'success',
  archived: 'secondary',
};

const PLATFORM_OPTIONS = [
  { value: 'facebook', label: 'Facebook' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'twitter', label: 'Twitter/X' },
  { value: 'youtube', label: 'YouTube' },
];

const TYPE_FILTERS = [
  { value: 'all', label: 'All Messages' },
  { value: 'comments', label: 'Comments' },
  { value: 'messages', label: 'Direct Messages' },
];

export default function InboxPage() {
  const { workspace } = useWorkspace();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [type, setType] = useState<'all' | 'comments' | 'messages'>('all');
  const [status, setStatus] = useState('');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [limit, setLimit] = useState(50);
  const [unreadCount, setUnreadCount] = useState(0);

  // Action menus & Reply
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [isReplying, setIsReplying] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!workspace?.id) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const params = new URLSearchParams({
        workspace_id: workspace.id,
        type,
        limit: limit.toString(),
        offset: '0',
      });

      if (status) params.append('status', status);
      if (search) params.append('search', search);
      platforms.forEach((p) => params.append('platform', p));

      const response = await fetch(`/api/inbox/messages?${params.toString()}`);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to fetch messages');
      }

      const result = await response.json();
      setMessages(result.data || []);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to fetch messages';
      setError(errorMsg);
      console.error('[inbox] Error:', errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, [workspace?.id, type, status, platforms, search, limit]);

  // Fetch unread count
  useEffect(() => {
    if (!workspace?.id) return;

    const fetchUnreadCount = async () => {
      try {
        const params = new URLSearchParams({
          workspace_id: workspace.id,
          status: 'unread',
          limit: '1',
          offset: '0',
        });

        const response = await fetch(`/api/inbox/messages?${params.toString()}`);
        if (response.ok) {
          const result = await response.json();
          setUnreadCount(result.total || 0);
        }
      } catch (err) {
        console.error('[unread count] Error:', err);
      }
    };

    fetchUnreadCount();
  }, [workspace?.id]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  // Real-time subscription for new messages and updates
  useEffect(() => {
    if (!workspace?.id) return;

    let mounted = true;
    const subscriptions: any[] = [];

    const setupSubscriptions = async () => {
      const supabase = await createClient();

      try {
        // Unsubscribe from any existing channels first
        await supabase.removeAllChannels();

        // Subscribe to inbox_messages (comments) INSERT and UPDATE events
        const commentsChannel = supabase
          .channel(`inbox-comments-${workspace.id}`, { realtime: { broadcast: { ack: true } } })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'inbox_messages',
              filter: `workspace_id=eq.${workspace.id}`,
            },
            (payload) => {
              if (!mounted) return;
              console.log('[real-time] New comment:', payload.new);
              setMessages((prev) => [payload.new as Message, ...prev]);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'inbox_messages',
              filter: `workspace_id=eq.${workspace.id}`,
            },
            (payload) => {
              if (!mounted) return;
              console.log('[real-time] Comment updated:', payload.new);
              setMessages((prev) =>
                prev.map((m) => (m.id === payload.new.id ? { ...payload.new as Message, message_type: 'comment' } : m))
              );
            }
          );

        subscriptions.push(commentsChannel);

        // Subscribe to messages (DMs) INSERT and UPDATE events
        const dmsChannel = supabase
          .channel(`inbox-dms-${workspace.id}`, { realtime: { broadcast: { ack: true } } })
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `workspace_id=eq.${workspace.id}`,
            },
            (payload) => {
              if (!mounted) return;
              console.log('[real-time] New DM:', payload.new);
              setMessages((prev) => [{ ...payload.new, message_type: 'message' } as Message, ...prev]);
            }
          )
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'messages',
              filter: `workspace_id=eq.${workspace.id}`,
            },
            (payload) => {
              if (!mounted) return;
              console.log('[real-time] DM updated:', payload.new);
              setMessages((prev) =>
                prev.map((m) => (m.id === payload.new.id ? { ...payload.new as Message, message_type: 'message' } : m))
              );
            }
          );

        subscriptions.push(dmsChannel);

        // Subscribe all channels at once
        await Promise.all([commentsChannel.subscribe(), dmsChannel.subscribe()]);
      } catch (error) {
        console.error('[real-time] Setup error:', error);
      }
    };

    setupSubscriptions();

    return () => {
      mounted = false;
      subscriptions.forEach((channel) => {
        channel?.unsubscribe();
      });
    };
  }, [workspace?.id]);

  const handleSync = async () => {
    if (!workspace?.id || isSyncing) return;

    try {
      setIsSyncing(true);
      const toastId = toast.loading('Syncing messages...');

      const response = await fetch('/api/inbox/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: workspace.id,
          platforms: platforms.length > 0 ? platforms : undefined,
          syncComments: type === 'all' || type === 'comments',
          syncMessages: type === 'all' || type === 'messages',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.details || result.error || 'Sync failed');
      }

      const syncedCount = result.data?.synced || 0;
      toast.success(`Sync complete! ${syncedCount} items updated.`, { id: toastId });

      await fetchMessages();
    } catch (err) {
      console.error('[InboxSync] Error:', err);
      toast.error(err instanceof Error ? err.message : 'Sync failed', { duration: 5000 });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateStatus = async (messageId: string, newStatus: string, table: 'inbox_messages' | 'messages') => {
    try {
      // Find current message to get previous status
      const currentMessage = messages.find(m => m.id === messageId);

      const response = await fetch(`/api/inbox/messages/${messageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, table }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      // Optimistically update local state
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status: newStatus as any } : m))
      );

      toast.success(`Message marked as ${newStatus}`);
      setOpenMenuId(null);
    } catch (err) {
      toast.error('Failed to update status');
      console.error('[update status] Error:', err);
    }
  };

  const handleReply = async (messageId: string, table: 'inbox_messages' | 'messages') => {
    if (!replyContent.trim()) return;

    try {
      setIsReplying(true);
      const response = await fetch(`/api/inbox/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, table, content: replyContent.trim() }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to send reply');
      }

      // Optimistically update local state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? { ...m, status: 'replied' as any, reply_text: replyContent.trim() }
            : m
        )
      );

      toast.success('Reply sent successfully!');
      setReplyId(null);
      setReplyContent('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send reply');
      console.error('[reply] Error:', err);
    } finally {
      setIsReplying(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  if (!workspace?.id) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-gray-500">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] md:h-[calc(100vh-3.5rem)] border rounded-xl overflow-hidden bg-white dark:bg-gray-800 shadow-sm border-gray-200 dark:border-gray-700">

      {/* Top Header */}
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Inbox</h1>
          {unreadCount > 0 && (
            <Badge variant="warning" className="rounded-full text-xs">
              {Math.min(unreadCount, 99)}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Search Input — Hidden on mobile */}
          <div className="relative hidden sm:flex w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 dark:text-gray-400" />
            <Input
              type="text"
              placeholder="Search messages..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          {/* Sync Button */}
          <Button
            onClick={handleSync}
            disabled={isSyncing}
            className="gap-2 shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
            <span className="sm:hidden">{isSyncing ? '' : 'Sync'}</span>
          </Button>
        </div>
      </div>

      {/* Filter Strip */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 overflow-x-auto shrink-0">

        {/* Type Filter — Grouped button segment */}
        <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 gap-0.5 shrink-0 bg-gray-50/50 dark:bg-gray-900/50">
          {TYPE_FILTERS.map((tf) => (
            <Button
              key={tf.value}
              onClick={() => setType(tf.value as any)}
              variant={type === tf.value ? 'default' : 'ghost'}
              size="sm"
              className="rounded-md text-xs h-7 px-2"
            >
              {tf.label}
            </Button>
          ))}
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Status Tabs */}
        {STATUS_TABS.map((tab) => (
          <Button
            key={tab.value}
            onClick={() => setStatus(tab.value)}
            variant={status === tab.value ? 'default' : 'outline'}
            size="sm"
            className="rounded-full gap-1 shrink-0 text-xs h-7 px-3 whitespace-nowrap"
          >
            {tab.label}
            {tab.value === 'unread' && unreadCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-blue-500 text-[9px] font-bold text-white">
                {Math.min(unreadCount, 99)}
              </span>
            )}
          </Button>
        ))}

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 dark:bg-gray-700 shrink-0" />

        {/* Platform Pills */}
        {PLATFORM_OPTIONS.map((p) => {
          const PlatformIcon = PLATFORM_ICONS[p.value] || MessageSquare;
          return (
            <Button
              key={p.value}
              onClick={() => togglePlatform(p.value)}
              variant={platforms.includes(p.value) ? 'default' : 'outline'}
              size="sm"
              className="rounded-full gap-1 shrink-0 text-xs h-7 px-2.5 whitespace-nowrap"
            >
              <PlatformIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{p.label}</span>
            </Button>
          );
        })}

        {/* Clear Filters */}
        {(status || platforms.length > 0 || search) && (
          <Button
            onClick={() => {
              setStatus('');
              setPlatforms([]);
              setSearch('');
            }}
            variant="ghost"
            size="sm"
            className="ml-auto gap-1 shrink-0 text-xs h-7 px-2"
          >
            <X className="h-3 w-3" />
            <span className="hidden sm:inline">Clear</span>
          </Button>
        )}

        {/* Mobile Search — Visible only on mobile */}
        <div className="sm:hidden ml-auto">
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
            <Search className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages List Container */}
      <div className="flex-1 overflow-y-auto px-6 py-6 bg-gray-50/50 dark:bg-gray-900/50">
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl mb-6 max-w-4xl mx-auto">
            <p className="text-red-700 dark:text-red-400 text-sm font-medium">{error}</p>
          </div>
        )}

        {isLoading && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="p-4 border border-gray-100 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-800 shadow-sm space-y-3">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && !error && messages.length === 0 && (
          <div className="text-center py-24">
            <MessageSquare className="mx-auto h-12 w-12 text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-900 dark:text-gray-200 font-medium text-lg">No messages found</p>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Select a different folder, clear your filters, or click Sync Now</p>
          </div>
        )}

        {!isLoading && messages.length > 0 && (
          <div className="space-y-4 max-w-4xl mx-auto">
            {messages.map((msg) => {
              const PlatformIcon = PLATFORM_ICONS[msg.platform] || MessageSquare;
              const colors = PLATFORM_COLORS[msg.platform] || PLATFORM_COLORS.facebook;
              const authorName = msg.author_name || msg.sender_name || 'Unknown';
              const isComment = msg.message_type === 'comment';
              const table = isComment ? 'inbox_messages' : 'messages';

              return (
                <div
                  key={msg.id}
                  className={`border rounded-xl overflow-hidden transition-all bg-white dark:bg-gray-800 shadow-sm ${
                    msg.status === 'unread'
                      ? 'border-l-4 border-l-blue-500 border-gray-200 dark:border-gray-700'
                      : 'border border-gray-200 dark:border-gray-700'
                  }`}
                >
                  {/* Post context (for comments only) */}
                  {isComment && msg.post && (
                    <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-900/50">
                      <div className="flex gap-2 items-center flex-wrap">
                        <MessageSquare className="h-4 w-4 text-gray-500" />
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Commenting on:</span>
                        <p className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-lg">
                          {msg.post.content}
                        </p>
                        <div className="ml-auto flex items-center gap-2">
                          <span className="text-[10px] text-gray-500">
                            {new Date(msg.post.published_at).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Message card */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-9 w-9 flex-shrink-0">
                            <AvatarImage
                              src={msg.author_avatar || msg.sender_avatar || ''}
                              alt={authorName}
                            />
                            <AvatarFallback className="text-xs font-semibold">
                              {authorName[0]}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-900 dark:text-white truncate text-sm">
                              {authorName}
                            </h3>
                          </div>

                          {/* Platform badge */}
                          <Badge variant="secondary" className="text-xs whitespace-nowrap flex-shrink-0 gap-1">
                            <PlatformIcon className="h-3 w-3" />
                            <span className="capitalize">{msg.platform}</span>
                          </Badge>
                        </div>

                        {/* Message content */}
                        <p className="text-gray-700 dark:text-gray-300 text-sm line-clamp-2 mb-2">{msg.content}</p>

                        {msg.reply_text && (
                          <div className="mt-3 pl-4 border-l-2 border-green-200 dark:border-green-900 space-y-1 bg-green-50/50 dark:bg-green-950/20 p-2 rounded">
                            <div className="flex items-center gap-1.5 text-[10px] font-medium text-green-700 dark:text-green-400 uppercase tracking-wider">
                              <CornerDownRight className="h-3 w-3" />
                              Your Reply
                            </div>
                            <p className="text-gray-700 dark:text-gray-300 text-sm">
                              "{msg.reply_text}"
                            </p>
                            {msg.replied_at && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                {new Date(msg.replied_at).toLocaleString()}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Metadata */}
                        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-600 dark:text-gray-400 mt-3">
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(msg.received_at).toLocaleString()}
                          </div>

                          {msg.message_type === 'message' && (
                            <Badge variant="secondary" className="text-xs">DM</Badge>
                          )}

                          <Badge variant={STATUS_BADGE_VARIANT[msg.status] || 'outline'} className="text-xs">
                            {msg.status === 'unread' ? '● Unread' : msg.status === 'replied' ? '✓ Replied' : msg.status}
                          </Badge>
                        </div>
                      </div>

                      {/* Actions menu */}
                      <div className="relative flex-shrink-0 flex items-center gap-1">
                        <Button
                          onClick={() => {
                            if (replyId === msg.id) {
                              setReplyId(null);
                            } else {
                              setReplyId(msg.id);
                              setReplyContent('');
                            }
                          }}
                          variant="ghost"
                          size="sm"
                          className="gap-1"
                        >
                          <CornerDownRight className="h-3 w-3" />
                          Reply
                        </Button>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {msg.status !== 'read' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, 'read', table)}>
                                Mark as Read
                              </DropdownMenuItem>
                            )}

                            {msg.status !== 'unread' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, 'unread', table)}>
                                Mark as Unread
                              </DropdownMenuItem>
                            )}

                            {msg.status !== 'replied' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, 'replied', table)}>
                                Mark as Replied
                              </DropdownMenuItem>
                            )}

                            {msg.status !== 'archived' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, 'archived', table)}>
                                Archive
                              </DropdownMenuItem>
                            )}

                            {msg.status === 'archived' && (
                              <DropdownMenuItem onClick={() => handleUpdateStatus(msg.id, 'unread', table)}>
                                Restore
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Inline Reply Interface */}
                    {replyId === msg.id && (
                      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex gap-3 items-start">
                          <CornerDownRight className="h-4 w-4 text-gray-400 mt-2 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <textarea
                              autoFocus
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              placeholder={`Reply to ${authorName}...`}
                              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                              rows={3}
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <Button
                                onClick={() => {
                                  setReplyId(null);
                                  setReplyContent('');
                                }}
                                variant="outline"
                                size="sm"
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={() => handleReply(msg.id, table)}
                                disabled={!replyContent.trim() || isReplying}
                                size="sm"
                                className="gap-1.5"
                              >
                                {isReplying && <RefreshCw className="h-3 w-3 animate-spin" />}
                                Send Reply
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load more */}
        {!isLoading && messages.length > 0 && (
          <div className="text-center mt-8">
            <Button
              onClick={() => setLimit((prev) => prev + 50)}
              variant="outline"
            >
              Load Older Messages
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
