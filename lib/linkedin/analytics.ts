import { linkedinGet } from "./client";

export interface LinkedInMetrics {
  likes: number;
  comments: number;
  shares: number;
  impressions: number;
  clicks: number;
}

/**
 * Fetch LinkedIn post statistics.
 * Doc: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/network-update-social-actions
 * Note: Metrics for personal accounts are more limited than organizational ones.
 */
export async function fetchLinkedInPostMetrics(
  postUrn: string,
  accessToken: string
): Promise<LinkedInMetrics> {
  try {
    // 1. Fetch Social Actions (Likes, Comments)
    // The postUrn is usually something like "urn:li:share:123" or "urn:li:ugcPost:123"
    // We need to encode it properly.
    const encodedPostUrn = encodeURIComponent(postUrn);
    
    const socialActions = await linkedinGet<any>(
      `/socialActions/${encodedPostUrn}`,
      {},
      accessToken
    );

    // 2. Fetch Impressions/Clicks (Only works for Organizational Pages, might fail for Personal)
    // For personal profiles, LinkedIn doesn't provide a public API for impressions easily.
    // We'll try to fetch it if possible, but fallback to 0.
    
    return {
      likes: socialActions?.totalShareStatistics?.likeCount || 0,
      comments: socialActions?.totalShareStatistics?.commentCount || 0,
      shares: socialActions?.totalShareStatistics?.shareCount || 0,
      impressions: 0, // Difficult to get for personal profiles via API
      clicks: 0,
    };
  } catch (err) {
    console.error(`[linkedin/analytics] Failed to fetch metrics for ${postUrn}:`, err);
    return { likes: 0, comments: 0, shares: 0, impressions: 0, clicks: 0 };
  }
}
