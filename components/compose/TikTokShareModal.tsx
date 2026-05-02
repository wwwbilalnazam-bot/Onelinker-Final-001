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
        // Use fallback on error so user can still proceed
        setCreatorInfo({
          nickname: "TikTok Creator",
          username: "",
          profilePicture: "",
          canPost: true,
          remainingPostsToday: 15,
          maxVideoDurationSec: 600,
        });
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
      console.error("[TikTokShareModal] Submit error:", err);
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
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
