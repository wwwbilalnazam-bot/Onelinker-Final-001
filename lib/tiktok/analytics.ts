import { tiktokPost } from "./client";

export interface TikTokMetrics {
  likes: number;
  comments: number;
  shares: number;
  views: number;
}

/**
 * Fetch TikTok video statistics.
 * Doc: https://developers.tiktok.com/doc/video-metrics-v2
 */
export async function fetchTikTokVideoMetrics(
  videoId: string,
  accessToken: string
): Promise<TikTokMetrics> {
  // TikTok Video Metrics API uses POST /video/query/
  // The videoId from Content Posting API is usually just the ID
  try {
    const res = await tiktokPost<any>(
      "/video/query/",
      {
        filters: {
          video_ids: [videoId],
        },
        fields: [
          "like_count",
          "comment_count",
          "share_count",
          "view_count",
        ],
      },
      accessToken
    );

    const video = res?.data?.videos?.[0];
    if (!video) {
      return { likes: 0, comments: 0, shares: 0, views: 0 };
    }

    return {
      likes: video.like_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
      views: video.view_count || 0,
    };
  } catch (err) {
    console.error(`[tiktok/analytics] Failed to fetch metrics for ${videoId}:`, err);
    return { likes: 0, comments: 0, shares: 0, views: 0 };
  }
}
