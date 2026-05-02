// ════════════════════════════════════════════════════════════
// PROVIDER INTERFACE — The contract every provider implements
//
// A "provider" is the service that handles OAuth, posting, and
// analytics for one or more platforms. Examples:
//   - Outstand (handles Twitter, Instagram, Facebook, etc.)
//   - Direct Twitter API (handles only Twitter)
//   - Buffer, Hootsuite, or any future provider
//
// API routes call the provider interface — never a specific
// provider directly. Swap providers without touching routes.
// ════════════════════════════════════════════════════════════

// ── OAuth ────────────────────────────────────────────────────

export interface OAuthStartResult {
  /** URL to redirect user to for OAuth authorization */
  oauthUrl: string;
}

export interface OAuthCallbackResult {
  /** Number of accounts successfully connected */
  accountsConnected: number;
  /** Accounts synced to Supabase */
  syncedCount: number;
}

// ── Account Management ───────────────────────────────────────

export interface ProviderAccount {
  /** Provider's unique ID for this account */
  providerAccountId: string;
  /** Platform identifier (twitter, instagram, etc.) */
  platform: string;
  /** Account username */
  username: string;
  /** Display name */
  displayName: string;
  /** Profile picture URL */
  profilePictureUrl: string | null;
  /** Whether account is active */
  isActive: boolean;
}

// ── Posting ──────────────────────────────────────────────────

export interface CreatePostPayload {
  content: string;
  /** Provider account IDs to post to */
  accountIds: string[];
  /** Media URLs (already uploaded to storage) */
  mediaUrls?: string[];
  /** ISO 8601 schedule time (omit for immediate) */
  scheduleAt?: string;
  /** IANA timezone */
  timezone?: string;
  /** First comment text (platform support varies) */
  firstComment?: string;
  /** Post title (YouTube, Pinterest) */
  title?: string;
  /** Post format: "post", "story", "reel", "short", "video" */
  format?: string;
  /** Platforms being published to */
  platforms?: string[];
  /** YouTube-specific configuration */
  youtubeConfig?: {
    privacyStatus?: "public" | "private" | "unlisted";
    categoryId?: string;
    tags?: string[];
    madeForKids?: boolean;
  };
  /** TikTok-specific configuration */
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
  /** Thumbnail data for video posts */
  thumbnail?: {
    type: "frame" | "custom";
    frameOffset?: number;
    uploadedUrl?: string;
  };
  /** Optional video splitting data (start/end in seconds) */
  segments?: {
    start: number;
    end: number;
  }[];
}

export interface CreatePostResult {
  /** Provider's post ID */
  providerPostId: string;
  /** Post status */
  status: "published" | "scheduled" | "pending";
}

export interface PostStatusResult {
  providerPostId: string;
  status: "draft" | "scheduled" | "published" | "failed" | "cancelled";
  publishedAt?: string;
  errorMessage?: string;
}

// ── Analytics ────────────────────────────────────────────────

export interface PostAnalytics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
}

export interface AccountAnalytics {
  followers: number;
  followerGrowth: number;
  reach: number;
  impressions: number;
  engagement: number;
}

// ── Webhook ──────────────────────────────────────────────────

export interface WebhookEvent {
  type: "post.published" | "post.error" | "account.disconnected";
  providerPostId?: string;
  providerAccountId?: string;
  error?: string;
  timestamp: string;
}

// ════════════════════════════════════════════════════════════
// THE PROVIDER INTERFACE
// ════════════════════════════════════════════════════════════

export interface SocialProvider {
  /** Unique provider identifier */
  readonly name: string;

  /** Which platforms this provider handles */
  readonly supportedPlatforms: string[];

  // ── OAuth ──────────────────────────────────────────────

  /** Generate OAuth URL for connecting an account */
  startOAuth(params: {
    platform: string;
    redirectUri: string;
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<OAuthStartResult>;

  /** Handle OAuth callback and sync accounts */
  handleCallback(params: {
    queryParams: Record<string, string>;
    workspaceId: string;
    redirectUri?: string;
    apiKey?: string | null;
  }): Promise<OAuthCallbackResult>;

  // ── Accounts ───────────────────────────────────────────

  /** List all connected accounts */
  listAccounts(params: {
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<ProviderAccount[]>;

  /** Sync provider accounts to Supabase */
  syncAccounts(params: {
    workspaceId: string;
    apiKey?: string | null;
  }): Promise<{ synced: number; errors: number }>;

  /** Disconnect an account */
  disconnectAccount(params: {
    providerAccountId: string;
    apiKey?: string | null;
  }): Promise<void>;

  // ── Posting ────────────────────────────────────────────

  /** Create or schedule a post */
  createPost(params: {
    payload: CreatePostPayload;
    workspaceId: string;
    authorId: string;
    apiKey?: string | null;
  }): Promise<CreatePostResult>;

  /** Get post status */
  getPostStatus(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<PostStatusResult>;

  /** Delete/cancel a post */
  deletePost(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<void>;

  // ── Analytics (optional) ───────────────────────────────

  /** Get analytics for a specific post */
  getPostAnalytics?(params: {
    providerPostId: string;
    apiKey?: string | null;
  }): Promise<PostAnalytics>;

  /** Get analytics for an account */
  getAccountAnalytics?(params: {
    providerAccountId: string;
    from: string;
    to: string;
    apiKey?: string | null;
  }): Promise<AccountAnalytics>;

  // ── Webhooks (optional) ────────────────────────────────

  /** Verify and parse webhook payload */
  parseWebhook?(params: {
    body: string;
    signature: string;
    secret: string;
  }): WebhookEvent | null;
}
