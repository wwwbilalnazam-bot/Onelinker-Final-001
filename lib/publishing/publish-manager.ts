/**
 * Publish Manager
 * Handles the complete publishing workflow with queue, notifications, and error handling
 */

import toast from "react-hot-toast";

export type PublishMode = "now" | "schedule" | "draft";
export type PublishStatus = "idle" | "preparing" | "uploading" | "publishing" | "success" | "error";

export interface PublishPayload {
  workspaceId?: string;
  accountIds?: string[];
  content?: string;
  channelContent?: Record<string, string>;
  accountContent?: Record<string, string>;
  scheduleMode?: PublishMode;
  scheduledAt?: string;
  scheduledTime?: string;
  timezone?: string;
  mediaUrls?: string[];
  firstComment?: string;
  platformFormats?: Record<string, string>;
  youtubeTitle?: string;
  youtubeConfig?: any;
  tiktokConfig?: any;
  thumbnail?: any;
  segments?: any[];
}

export interface PublishResult {
  success: boolean;
  status: PublishStatus;
  message: string;
  accountsAffected: number;
  timestamp: string;
  error?: string;
}

/**
 * Manages the complete publishing workflow
 */
export class PublishManager {
  private toastId: string | null = null;

  /**
   * Show a loading toast that can be updated
   */
  private showLoadingToast(message: string) {
    // Close any existing toast
    if (this.toastId) {
      toast.dismiss(this.toastId);
    }

    // Show new loading toast
    this.toastId = toast.loading(message);
  }

  /**
   * Update the loading toast
   */
  private updateLoadingToast(message: string) {
    if (this.toastId) {
      toast.dismiss(this.toastId);
    }
    this.toastId = toast.loading(message);
  }

  /**
   * Show success toast and close loading
   */
  private showSuccessToast(message: string) {
    if (this.toastId) {
      toast.dismiss(this.toastId);
      this.toastId = null;
    }
    toast.success(message, {
      duration: 4000,
      position: "bottom-right",
    });
  }

  /**
   * Show error toast and close loading
   */
  private showErrorToast(message: string, error?: string) {
    if (this.toastId) {
      toast.dismiss(this.toastId);
      this.toastId = null;
    }
    // Safely extract error message to avoid circular references
    let errorStr = "";
    if (error) {
      try {
        if (typeof error === "string") {
          errorStr = error;
        } else if (error instanceof Error) {
          errorStr = error.message;
        } else {
          errorStr = String(error);
        }
      } catch {
        errorStr = "Unknown error occurred";
      }
    }
    const fullMessage = errorStr ? `${message}\n${errorStr}` : message;
    toast.error(fullMessage, {
      duration: 5000,
      position: "bottom-right",
    });
  }

  /**
   * Publish a post to one or more platforms
   * Handles the complete workflow with notifications
   */
  async publish(payload: PublishPayload): Promise<PublishResult> {
    try {
      const scheduleMode = payload.scheduleMode || "now";
      const accountCount = payload.accountIds?.length || 0;

      // Step 1: Preparation
      this.showLoadingToast("🔄 Preparing your post...");
      await this.delay(500);

      // Step 2: Validation
      if (!payload.workspaceId) {
        throw new Error("Workspace ID is required");
      }

      if (!payload.accountIds || payload.accountIds.length === 0) {
        throw new Error("Please select at least one account");
      }

      // Step 3: Update loading state
      this.updateLoadingToast(`📤 Uploading to ${accountCount} platform${accountCount > 1 ? "s" : ""}...`);
      await this.delay(800);

      // Step 4: Make the API call
      let payloadStr: string;
      try {
        payloadStr = JSON.stringify(payload);
      } catch (e) {
        console.error("[publishManager] Payload serialization error:", e);
        throw new Error("Failed to prepare post data for publishing. Please try again.");
      }

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payloadStr,
      });

      let json: { data?: any; error?: string };
      try {
        json = await response.json() as { data?: any; error?: string };
      } catch (e) {
        throw new Error(`Invalid response from server: ${response.status}`);
      }

      if (!response.ok) {
        const errorMessage = json.error || "Failed to publish post";
        throw new Error(errorMessage);
      }

      // Step 5: Success handling
      this.updateLoadingToast("✅ Finalizing...");
      await this.delay(500);

      // Show appropriate success message
      let successMessage = "";
      if (scheduleMode === "draft") {
        successMessage = "📝 Post saved as draft!";
      } else if (scheduleMode === "schedule") {
        const dateTime = payload.scheduledDate
          ? `${payload.scheduledDate} at ${payload.scheduledTime || "09:00"}`
          : "scheduled";
        successMessage = `📅 Post scheduled for ${dateTime}!`;
      } else {
        successMessage = `🚀 Published to ${accountCount} platform${accountCount > 1 ? "s" : ""}!`;
      }

      this.showSuccessToast(successMessage);

      return {
        success: true,
        status: "success",
        message: successMessage,
        accountsAffected: accountCount,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Something went wrong";
      this.showErrorToast("❌ Failed to publish", errorMessage);

      return {
        success: false,
        status: "error",
        message: "Publishing failed",
        accountsAffected: 0,
        timestamp: new Date().toISOString(),
        error: errorMessage,
      };
    }
  }

  /**
   * Simple delay helper for UI transitions
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear any active toasts
   */
  clearToasts(): void {
    if (this.toastId) {
      toast.dismiss(this.toastId);
      this.toastId = null;
    }
  }
}

/**
 * Global publish manager instance
 */
export const publishManager = new PublishManager();

/**
 * Helper function to handle publishing with proper workflow
 */
export async function handlePublish(
  payload: PublishPayload,
  options?: {
    onSuccess?: () => void;
    onError?: (error: string) => void;
    onComplete?: () => void;
  }
): Promise<PublishResult> {
  const result = await publishManager.publish(payload);

  if (result.success) {
    options?.onSuccess?.();
  } else {
    options?.onError?.(result.error || "Unknown error");
  }

  options?.onComplete?.();
  return result;
}
