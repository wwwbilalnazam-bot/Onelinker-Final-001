"use client";

import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TikTokShareForm, TikTokShareData } from "./TikTokShareForm";
import { Loader2 } from "lucide-react";

interface CreatorInfo {
  nickname: string;
  username?: string;
  profilePicture?: string;
  canPost: boolean;
  remainingPostsToday: number;
  maxVideoDurationSec: number;
}

interface TikTokShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: TikTokShareData) => Promise<void>;
  accountId: string;
  accessToken?: string;
  videoDurationSec?: number;
  contentPreview?: string;
  isLoading?: boolean;
  mediaType?: 'photo' | 'video'; // TikTok: photos don't support duet/stitch
}

export function TikTokShareModal({
  isOpen,
  onClose,
  onSubmit,
  accountId,
  accessToken = "",
  videoDurationSec = 0,
  contentPreview = "",
  isLoading = false,
  mediaType = 'video',
}: TikTokShareModalProps) {
  const [creatorInfo, setCreatorInfo] = useState<CreatorInfo | null>(null);
  const [isLoadingCreatorInfo, setIsLoadingCreatorInfo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch creator info when modal opens
  useEffect(() => {
    if (!isOpen || !accountId) return;

    async function fetchCreatorInfo() {
      setIsLoadingCreatorInfo(true);
      setError(null);
      try {
        const response = await fetch("/api/tiktok/creator-info", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            // Note: The backend will fetch the token from the database if needed
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch creator info: ${response.status}`);
        }

        const data = await response.json() as CreatorInfo;
        setCreatorInfo(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load creator information. Please try again.";
        setError(message);
        console.error("[TikTokShareModal] Error:", err);
        // Don't proceed with fallback - user must reconnect or retry
        setCreatorInfo(null);
      } finally {
        setIsLoadingCreatorInfo(false);
      }
    }

    fetchCreatorInfo();
  }, [isOpen, accountId]);

  const handleSubmit = async (data: TikTokShareData) => {
    try {
      await onSubmit(data);
      onClose();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[TikTokShareModal] Submit error:", errMsg);
      // Error toast is handled by the parent publishManager
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>📱</span>
            TikTok Settings
          </DialogTitle>
          <DialogDescription>
            Configure your TikTok post settings below. Fill in all required fields.
          </DialogDescription>
        </DialogHeader>

        {isLoadingCreatorInfo ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Loading TikTok settings...</p>
          </div>
        ) : error && !creatorInfo ? (
          <div className="flex flex-col items-center justify-center py-12">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-center">
              <p className="text-sm font-medium text-red-700 mb-2">Unable to Load TikTok Settings</p>
              <p className="text-xs text-red-600 mb-4">{error}</p>
              <p className="text-xs text-muted-foreground">Please reconnect your TikTok account and try again.</p>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-sm text-amber-700">
                ⚠️ {error}
              </div>
            )}
            <TikTokShareForm
              creatorInfo={creatorInfo || undefined}
              onSubmit={handleSubmit}
              isSubmitting={isLoading}
              videoDurationSec={videoDurationSec}
              contentPreview={contentPreview}
              mediaType={mediaType}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
