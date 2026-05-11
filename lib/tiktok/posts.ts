// ════════════════════════════════════════════════════════════
// TIKTOK POSTS — VIDEO UPLOAD & PUBLISHING
//
// Implements the TikTok Content Posting API (Official v2)
// Reference: https://developers.tiktok.com/doc/content-posting-api/
//
// Workflow:
//   1. Query creator info (get privacy options, etc.)
//   2. Initialize video upload (get publish_id and upload_url)
//   3. Upload video file (PUT to upload_url)
//   4. Poll status until published
//
// Requirements:
//   - video.publish scope authorized
//   - Direct Post feature enabled in Developer Portal
//   - Access token from authorized user
// ════════════════════════════════════════════════════════════

import { tiktokPost } from "./client";

export interface TikTokPostResult {
  postId: string;
  status: "published" | "pending" | "failed";
  error?: string;
}

// ── Creator Info ────────────────────────────────────────────

export interface CreatorInfoResponse {
  data: {
    creator_avatar_url: string;
    creator_username: string;
    creator_nickname: string;
    privacy_level_options: ("PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY")[];
    comment_disabled: boolean;
    duet_disabled: boolean;
    stitch_disabled: boolean;
    max_video_post_duration_sec: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Query creator info before posting
 * Required to get privacy level options and other creator settings
 * Reference: https://developers.tiktok.com/doc/content-posting-api/#Query-Creator-Info
 */
export async function queryCreatorInfo(
  accessToken: string
): Promise<CreatorInfoResponse["data"]> {
  const response = await tiktokPost<CreatorInfoResponse>(
    "/post/publish/creator_info/query/",
    {}, // Empty body for query endpoint
    accessToken
  );

  console.log("[tiktok/posts] Creator info FULL response:", JSON.stringify(response, null, 2));

  if (response.error?.code && response.error.code !== "ok") {
    console.error("[tiktok/posts] Creator info error - CODE:", response.error.code);
    console.error("[tiktok/posts] Creator info error - MESSAGE:", response.error.message);
    throw new Error(
      `Failed to query creator info: ${response.error.code} - ${response.error.message}`
    );
  }

  if (!response.data) {
    console.error("[tiktok/posts] No data in creator info response - full response was:", JSON.stringify(response));
    throw new Error("No creator info received from TikTok");
  }

  console.log("[tiktok/posts] ✓ Creator info retrieved successfully");
  console.log("[tiktok/posts] Privacy options available:", response.data.privacy_level_options);
  console.log("[tiktok/posts] Max video duration:", response.data.max_video_post_duration_sec, "seconds");

  return response.data;
}

// ── Video Init ──────────────────────────────────────────────

export interface VideoInitRequest {
  post_info: {
    title: string;
    privacy_level: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";
    disable_comment?: boolean;
    disable_duet?: boolean;
    disable_stitch?: boolean;
    video_cover_timestamp_ms?: number;
  };
  source_info: {
    source: "FILE_UPLOAD";
    video_size: number;
    chunk_size: number;
    total_chunk_count: number;
  };
}

export interface VideoInitResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Initialize a video upload session
 * Returns upload_url where the video should be PUT
 * Also returns publish_id for status tracking
 */
export async function initializeVideoUpload(
  accessToken: string,
  videoBuffer: Buffer | ArrayBuffer,
  fileName: string,
  title: string,
  privacyLevel: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY" = "PUBLIC_TO_EVERYONE",
  interactions?: {
    allowComment?: boolean;
    allowDuet?: boolean;
    allowStitch?: boolean;
  }
): Promise<{ publishId: string; uploadUrl: string }> {
  const videoSize = videoBuffer.byteLength;

  // For TikTok API, if uploading as single file, total_chunk_count should be 1
  // If chunking, chunk_size must be consistent and total_chunk_count accurate
  const chunkSize = videoSize; // Single chunk upload (upload entire file at once)
  const totalChunkCount = 1;   // Single chunk

  console.log("[tiktok/posts] Video info:", {
    videoSize,
    chunkSize,
    totalChunkCount,
  });

  const payload = {
    post_info: {
      title,
      privacy_level: privacyLevel,
      disable_comment: !interactions?.allowComment,
      disable_duet: !interactions?.allowDuet,
      disable_stitch: !interactions?.allowStitch,
    },
    source_info: {
      source: "FILE_UPLOAD",
      video_size: videoSize,
      chunk_size: chunkSize,
      total_chunk_count: totalChunkCount,
    },
  };

  console.log("[tiktok/posts] Sending init request with payload:", JSON.stringify(payload, null, 2));

  const response = await tiktokPost<VideoInitResponse>(
    "/post/publish/video/init/",
    payload,
    accessToken
  );

  if (response.error?.code && response.error.code !== "ok") {
    console.error("[tiktok/posts] TikTok error response:", JSON.stringify(response, null, 2));
    throw new Error(`TikTok video init failed: ${response.error.message}`);
  }

  if (!response.data?.upload_url || !response.data?.publish_id) {
    throw new Error("No upload URL or publish ID received from TikTok");
  }

  return {
    publishId: response.data.publish_id,
    uploadUrl: response.data.upload_url,
  };
}

// ── Video Upload ────────────────────────────────────────────

/**
 * Upload video file to TikTok
 * The uploadUrl is obtained from initializeVideoUpload
 */
export async function uploadVideoFile(
  uploadUrl: string,
  videoBuffer: Buffer | ArrayBuffer
): Promise<void> {
  const videoSize = videoBuffer.byteLength;

  const res = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Range": `bytes 0-${videoSize - 1}/${videoSize}`,
    },
    body: videoBuffer,
  });

  if (!res.ok) {
    const errorText = await res.text().catch(() => "");
    throw new Error(`Video upload failed: ${res.status} ${res.statusText} - ${errorText}`);
  }
}

// ── Status Checking ─────────────────────────────────────────

export interface StatusResponse {
  data: {
    status: "PROCESSING" | "PUBLISH_COMPLETE" | "PUBLISH_FAILED";
    error_code?: string;
    error_message?: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Check status of a published video
 */
export async function getPostStatus(
  accessToken: string,
  publishId: string
): Promise<"PROCESSING" | "PUBLISH_COMPLETE" | "PUBLISH_FAILED"> {
  const response = await tiktokPost<StatusResponse>(
    "/post/publish/status/fetch/",
    { publish_id: publishId },
    accessToken
  );

  console.log("[tiktok/posts] Status check response:", JSON.stringify(response, null, 2));

  if (response.error?.code && response.error.code !== "ok") {
    console.error("[tiktok/posts] Status fetch error - CODE:", response.error.code);
    console.error("[tiktok/posts] Status fetch error - MESSAGE:", response.error.message);
    throw new Error(`Failed to fetch post status: ${response.error.code} - ${response.error.message}`);
  }

  // Log detailed status info
  if (response.data?.status === "PUBLISH_FAILED") {
    console.error("[tiktok/posts] ❌ POST FAILED");
    console.error("[tiktok/posts] Error code:", response.data.error_code);
    console.error("[tiktok/posts] Error message:", response.data.error_message);
  }

  return response.data?.status ?? "PROCESSING";
}

/**
 * Poll for post status until completion
 * Extended timeout for sandbox (can take 2-5 minutes)
 */
export async function pollPostStatus(
  accessToken: string,
  publishId: string,
  maxAttempts: number = 90,  // Increased from 30 to 90 (3 minutes instead of 1 minute)
  delayMs: number = 2000
): Promise<boolean> {
  console.log(`[tiktok/posts] Starting status polling (max ${maxAttempts} attempts, ${delayMs}ms delay = ${(maxAttempts * delayMs / 1000 / 60).toFixed(1)} minutes timeout)`);

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const status = await getPostStatus(accessToken, publishId);

      if (status === "PUBLISH_COMPLETE") {
        console.log(`[tiktok/posts] ✅ Post published successfully (attempt ${i + 1}/${maxAttempts})`);
        return true;
      }

      if (status === "PUBLISH_FAILED") {
        console.error(`[tiktok/posts] ❌ Post publishing failed at attempt ${i + 1}`);
        return false;
      }

      // Still processing
      const elapsed = ((i + 1) * delayMs / 1000 / 60).toFixed(1);
      console.log(`[tiktok/posts] ⏳ Processing... (attempt ${i + 1}/${maxAttempts}, elapsed: ${elapsed}m)`);

      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error) {
      console.error(`[tiktok/posts] Status check error at attempt ${i + 1}:`, error);
      if (i < maxAttempts - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  console.warn(`[tiktok/posts] ⚠️ Status polling timeout after ${maxAttempts} attempts (${(maxAttempts * delayMs / 1000 / 60).toFixed(1)}m). Video is likely still processing in sandbox. publish_id: ${publishId}`);
  return false; // Timeout - but video may still be processing
}

/**
 * Full video publishing workflow:
 *   1. Query creator info
 *   2. Initialize upload
 *   3. Upload file
 *   4. Poll status
 */
export async function publishTikTokVideo(
  accessToken: string,
  videoBuffer: Buffer | ArrayBuffer,
  fileName: string,
  description?: string,
  tiktokConfig?: {
    title?: string;
    privacyStatus?: "SELF_ONLY" | "MUTUAL_FOLLOW_FRIENDS" | "PUBLIC_TO_EVERYONE";
    allowComment?: boolean;
    allowDuet?: boolean;
    allowStitch?: boolean;
    isCommercialContent?: boolean;
    yourBrand?: boolean;
    brandedContent?: boolean;
  }
): Promise<TikTokPostResult> {
  try {
    // Step 1: Query creator info to get privacy options
    console.log("[tiktok/posts] Querying creator info...");
    try {
      const creatorInfo = await queryCreatorInfo(accessToken);
      console.log("[tiktok/posts] Creator info:", JSON.stringify({
        username: creatorInfo.creator_username,
        privacy_options: creatorInfo.privacy_level_options,
        max_duration: creatorInfo.max_video_post_duration_sec,
      }));

      // Use provided privacy status or fall back to SELF_ONLY for unaudited apps
      const privacyLevel = tiktokConfig?.privacyStatus || (
        creatorInfo.privacy_level_options.includes("SELF_ONLY")
          ? "SELF_ONLY"
          : creatorInfo.privacy_level_options[0] ?? "PUBLIC_TO_EVERYONE"
      );

      // Step 2: Initialize upload
      const videoTitle = tiktokConfig?.title || description || "Video posted with Onelinker";
      console.log("[tiktok/posts] Initializing video upload...", {
        fileName,
        videoSize: videoBuffer.byteLength,
        title: videoTitle,
        privacyLevel,
        allowComment: tiktokConfig?.allowComment ?? false,
        allowDuet: tiktokConfig?.allowDuet ?? false,
        allowStitch: tiktokConfig?.allowStitch ?? false,
        isCommercialContent: tiktokConfig?.isCommercialContent ?? false,
      });
      const { publishId, uploadUrl } = await initializeVideoUpload(
        accessToken,
        videoBuffer,
        fileName,
        videoTitle,
        privacyLevel,
        {
          allowComment: tiktokConfig?.allowComment,
          allowDuet: tiktokConfig?.allowDuet,
          allowStitch: tiktokConfig?.allowStitch,
        }
      );

      console.log(`[tiktok/posts] Got publish_id: ${publishId}, uploadUrl: ${uploadUrl.substring(0, 50)}...`);

      // Step 3: Upload video file
      console.log(`[tiktok/posts] Uploading video file (${videoBuffer.byteLength} bytes)...`);
      await uploadVideoFile(uploadUrl, videoBuffer);
      console.log("[tiktok/posts] Video uploaded successfully");

      // Step 4: Poll status (with extended timeout for sandbox)
      console.log("[tiktok/posts] Polling for publish status (max 3 minutes)...");
      const success = await pollPostStatus(accessToken, publishId);

      if (!success) {
        // Status polling timed out, but video may still be processing in sandbox
        console.warn("[tiktok/posts] ⚠️ Status polling timeout - video may still be processing");
        return {
          postId: publishId,
          status: "pending",  // Changed from "failed" to "pending" - video is likely still processing
          error: "Video is being processed by TikTok (sandbox can take 2-5 minutes). Check back later.",
        };
      }

      console.log("[tiktok/posts] ✓ Publishing complete");
      return {
        postId: publishId,
        status: "published",
      };
    } catch (stepError) {
      const message = stepError instanceof Error ? stepError.message : String(stepError);
      console.error("[tiktok/posts] Step failed:", message, stepError);
      throw stepError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[tiktok/posts] Publishing failed:", message, error);
    return {
      postId: "",
      status: "failed",
      error: message,
    };
  }
}
