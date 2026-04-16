import { graphGet } from "./client";

export interface MetaMetrics {
  likes: number;
  comments: number;
  shares: number;
  reach: number;
  impressions: number;
  clicks: number;
}

/**
 * Fetch Facebook post insights.
 * Doc: https://developers.facebook.com/docs/graph-api/reference/v21.0/insights
 */
export async function fetchFacebookPostMetrics(
  pagePostId: string,
  pageAccessToken: string
): Promise<MetaMetrics> {
  // 1. Fetch Insights (Reach, Impressions, Clicks)
  const insightsMetrics = [
    "post_impressions",
    "post_impressions_unique", // Reach
    "post_clicks"
  ];

  try {
    const insightsRes = await graphGet<{ data: Array<{ name: string; values: Array<{ value: any }> }> }>(
      `/${pagePostId}/insights`,
      { metric: insightsMetrics.join(",") },
      pageAccessToken
    );

    const getInsight = (name: string) => {
      const item = insightsRes.data.find(d => d.name === name);
      return item?.values[0]?.value ?? 0;
    };

    // 2. Fetch Object Counts (Likes, Comments, Shares)
    // Doc: https://developers.facebook.com/docs/graph-api/reference/post/
    const objectRes = await graphGet<{
        likes?: { summary: { total_count: number } };
        comments?: { summary: { total_count: number } };
        shares?: { count: number };
    }>(
      `/${pagePostId}`,
      { fields: "likes.summary(true).limit(0),comments.summary(true).limit(0),shares" },
      pageAccessToken
    );

    return {
      likes: objectRes.likes?.summary?.total_count ?? 0,
      comments: objectRes.comments?.summary?.total_count ?? 0,
      shares: objectRes.shares?.count ?? 0,
      reach: Number(getInsight("post_impressions_unique")),
      impressions: Number(getInsight("post_impressions")),
      clicks: Number(getInsight("post_clicks")),
    };
  } catch (err) {
    console.error(`[meta/analytics] Failed to fetch FB insights for ${pagePostId}:`, err);
    return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
  }
}

/**
 * Fetch Instagram media insights.
 * Doc: https://developers.facebook.com/docs/instagram-api/reference/ig-media/insights
 */
export async function fetchInstagramMediaMetrics(
  igMediaId: string,
  pageAccessToken: string
): Promise<MetaMetrics> {
  // Metrics vary by media type (image vs video vs reel)
  const metrics = [
    "impressions",
    "reach",
    "saved",
    "video_views"
  ];

  try {
    const insightsRes = await graphGet<{ data: Array<{ name: string; values: Array<{ value: any }> }> }>(
      `/${igMediaId}/insights`,
      { metric: metrics.join(",") },
      pageAccessToken
    );

    const getInsight = (name: string) => {
      const item = insightsRes.data.find(d => d.name === name);
      return item?.values[0]?.value ?? 0;
    };

    // We also need likes and comments which are on the media object itself
    const mediaRes = await graphGet<{ like_count: number; comments_count: number }>(
      `/${igMediaId}`,
      { fields: "like_count,comments_count" },
      pageAccessToken
    );

    return {
      likes: mediaRes.like_count ?? 0,
      comments: mediaRes.comments_count ?? 0,
      shares: 0, // Shares (sends) for IG are only available in insights for specifically business accounts and sometimes only for reels.
      reach: Number(getInsight("reach")),
      impressions: Number(getInsight("impressions")),
      clicks: 0,
    };
  } catch (err) {
    console.error(`[meta/analytics] Failed to fetch IG insights for ${igMediaId}:`, err);
    return { likes: 0, comments: 0, shares: 0, reach: 0, impressions: 0, clicks: 0 };
  }
}
