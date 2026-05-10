"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, Info, ChevronDown, AlertTriangle, Wand2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { loadTikTokSettings, saveTikTokSettings } from "@/lib/tiktok/settings-storage";

interface CreatorInfo {
  nickname: string;
  username?: string;
  profilePicture?: string;
  canPost: boolean;
  remainingPostsToday: number;
  maxVideoDurationSec: number;
}

interface TikTokShareFormProps {
  creatorInfo?: CreatorInfo;
  onSubmit: (data: TikTokShareData) => Promise<void>;
  isSubmitting?: boolean;
  videoDurationSec?: number;
  contentPreview?: string;
}

export interface TikTokShareData {
  title: string;
  privacyStatus: "" | "SELF_ONLY" | "FRIEND_ONLY" | "PUBLIC"; // Empty string = no default selected
  allowComment: boolean;
  allowDuet: boolean;
  allowStitch: boolean;
  isCommercialContent: boolean;
  yourBrand: boolean;
  brandedContent: boolean;
}

// NO DEFAULT for privacy status - user must manually select (TikTok requirement)
const DEFAULT_DATA: TikTokShareData = {
  title: "",
  privacyStatus: "", // MUST BE EMPTY - user must manually select
  allowComment: false,
  allowDuet: false,
  allowStitch: false,
  isCommercialContent: false,
  yourBrand: false,
  brandedContent: false,
};

export function TikTokShareForm({
  creatorInfo,
  onSubmit,
  isSubmitting = false,
  videoDurationSec = 0,
  contentPreview = "",
}: TikTokShareFormProps) {
  const [formData, setFormData] = useState<TikTokShareData>(DEFAULT_DATA);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    creatorInfo: true,
    metadata: true,
    interactions: true,
    commercial: false,
  });
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [autoFilledTitle, setAutoFilledTitle] = useState("");

  // Load previous TikTok settings on mount
  useEffect(() => {
    const previousSettings = loadTikTokSettings();
    if (Object.keys(previousSettings).length > 0) {
      setFormData(prev => ({
        ...prev,
        ...previousSettings,
        // Keep title empty - it's auto-filled from content
        title: "",
      }));
    }
  }, []);

  // Auto-fill title from content preview
  useEffect(() => {
    if (contentPreview && !formData.title) {
      // Use first line of content as title, max 150 chars
      const firstLine = contentPreview.split("\n")[0] || contentPreview;
      const title = firstLine.substring(0, 150);
      setFormData(prev => ({ ...prev, title }));
      setAutoFilledTitle(title);
    }
  }, [contentPreview]);

  // Validation
  useEffect(() => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length > 150) {
      newErrors.title = "Title must be 150 characters or less";
    }

    // Privacy status MUST be manually selected (TikTok requirement - no default)
    if (!formData.privacyStatus || formData.privacyStatus === "") {
      newErrors.privacy = "Privacy status is required - please select one";
    }

    // Commercial content validation
    if (formData.isCommercialContent && !formData.yourBrand && !formData.brandedContent) {
      newErrors.commercial = "Select at least one option when commercial content is enabled";
    }

    // Branded content can't be private
    if (formData.brandedContent && formData.privacyStatus === "SELF_ONLY") {
      newErrors.privacy = "Branded content cannot be set to private. Please select 'Friend Only' or 'Public'.";
    }

    // Video duration validation
    if (videoDurationSec && creatorInfo?.maxVideoDurationSec) {
      if (videoDurationSec > creatorInfo.maxVideoDurationSec) {
        newErrors.duration = `Video duration (${videoDurationSec}s) exceeds maximum (${creatorInfo.maxVideoDurationSec}s)`;
      }
    }

    setErrors(newErrors);
  }, [formData, videoDurationSec, creatorInfo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (Object.keys(errors).length > 0) {
      return;
    }

    try {
      await onSubmit(formData);
      // Save settings after successful submit
      saveTikTokSettings(formData);
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error("[TikTokShareForm] Submit error:", errMsg);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getComplianceDeclaration = (): string => {
    if (formData.isCommercialContent) {
      if (formData.yourBrand && formData.brandedContent) {
        return "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation";
      } else if (formData.brandedContent) {
        return "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation";
      } else {
        return "By posting, you agree to TikTok's Music Usage Confirmation";
      }
    }
    return "By posting, you agree to TikTok's Music Usage Confirmation";
  };

  const canSubmit = Object.keys(errors).length === 0 && !isSubmitting && creatorInfo?.canPost;

  const generateTitleWithAI = async () => {
    if (!contentPreview.trim()) return;

    setIsGeneratingTitle(true);
    try {
      const response = await fetch("/api/ai/generate-caption", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: contentPreview,
          platform: "tiktok",
          maxLength: 150,
          tone: "engaging",
        }),
      });

      if (!response.ok) throw new Error("Failed to generate title");

      const data = await response.json() as { caption?: string; captions?: string[] };
      const generated = data.caption || (data.captions && data.captions[0]) || formData.title;

      if (generated) {
        setFormData(prev => ({ ...prev, title: generated.substring(0, 150) }));
      }
    } catch (err) {
      console.error("[TikTok] AI title generation error:", err);
    } finally {
      setIsGeneratingTitle(false);
    }
  };

  const restoreAutoFilledTitle = () => {
    if (autoFilledTitle) {
      setFormData(prev => ({ ...prev, title: autoFilledTitle }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 1: Creator Info */}
      {/* ──────────────────────────────────────────────────────── */}
      {creatorInfo && (
        <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50">
          <button
            type="button"
            onClick={() => toggleSection("creatorInfo")}
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full overflow-hidden flex-shrink-0 bg-black/10">
                {creatorInfo.profilePicture ? (
                  <img
                    src={creatorInfo.profilePicture}
                    alt={creatorInfo.nickname}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm font-bold">
                    👤
                  </div>
                )}
              </div>
              <div className="text-left">
                <h3 className="text-sm font-semibold text-foreground">{creatorInfo.nickname}</h3>
                {creatorInfo.username && (
                  <p className="text-xs text-muted-foreground">@{creatorInfo.username}</p>
                )}
              </div>
            </div>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-muted-foreground transition-transform",
                expandedSections.creatorInfo && "rotate-180"
              )}
            />
          </button>

          {expandedSections.creatorInfo && (
            <div className="px-4 py-3 border-t border-border/30 space-y-2 bg-muted/20">
              {/* Posting Capacity Check */}
              <div className="flex items-start gap-2">
                {creatorInfo.canPost ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {creatorInfo.canPost ? "Ready to Post" : "Cannot Post Now"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {creatorInfo.remainingPostsToday}/15 posts remaining today
                  </p>
                </div>
              </div>

              {/* Video Duration Limit */}
              <div className="flex items-start gap-2">
                {videoDurationSec && videoDurationSec <= creatorInfo.maxVideoDurationSec ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className="text-sm font-medium text-foreground">Video Duration</p>
                  <p className="text-xs text-muted-foreground">
                    {videoDurationSec || 0}s / {creatorInfo.maxVideoDurationSec}s maximum
                  </p>
                </div>
              </div>

              {!creatorInfo.canPost && (
                <div className="mt-3 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700">
                    You've reached your daily posting limit. Please try again later.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 2: Post Metadata */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50">
        <button
          type="button"
          onClick={() => toggleSection("metadata")}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center text-sm">
              📝
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">Post Details</h3>
              <p className="text-xs text-muted-foreground">Title & Privacy</p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expandedSections.metadata && "rotate-180"
            )}
          />
        </button>

        {expandedSections.metadata && (
          <div className="px-4 py-3 border-t border-border/30 space-y-4 bg-muted/20">
            {/* Title Input */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Post Title <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Enter an engaging title for your TikTok"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  className={cn(errors.title && "border-red-500 focus:ring-red-500")}
                  maxLength={150}
                  disabled={isSubmitting || isGeneratingTitle}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={generateTitleWithAI}
                  disabled={isSubmitting || isGeneratingTitle || !contentPreview.trim()}
                  title="Generate with AI"
                  className="flex-shrink-0"
                >
                  {isGeneratingTitle ? (
                    <span className="animate-spin h-4 w-4">✨</span>
                  ) : (
                    <Wand2 className="h-4 w-4" />
                  )}
                </Button>
                {autoFilledTitle && formData.title !== autoFilledTitle && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={restoreAutoFilledTitle}
                    disabled={isSubmitting || isGeneratingTitle}
                    title="Restore auto-filled title"
                    className="flex-shrink-0"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div className="flex justify-between items-start mt-1">
                <p className={cn(
                  "text-xs",
                  errors.title ? "text-red-500" : "text-muted-foreground"
                )}>
                  {errors.title ? errors.title : `${formData.title.length}/150`}
                </p>
              </div>
            </div>

            {/* Privacy Status Dropdown */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Privacy Status <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.privacyStatus}
                  onChange={e => setFormData(prev => ({ ...prev, privacyStatus: e.target.value as any }))}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg border bg-card text-foreground appearance-none cursor-pointer",
                    "transition-colors hover:border-border focus:ring-2 focus:ring-primary/20 focus:border-primary",
                    errors.privacy ? "border-red-500 focus:ring-red-500" : "border-border/50"
                  )}
                  disabled={isSubmitting}
                >
                  <option value="">Select privacy status...</option>
                  <option value="SELF_ONLY">🔒 Private (Only Me)</option>
                  <option value="FRIEND_ONLY">👥 Friends Only</option>
                  <option value="PUBLIC">🌍 Public</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              </div>
              {errors.privacy && (
                <p className="text-xs text-red-500 mt-1">{errors.privacy}</p>
              )}

              {/* Privacy Info */}
              {formData.privacyStatus === "SELF_ONLY" && (
                <p className="text-xs text-muted-foreground mt-2 p-2 bg-blue-500/5 rounded border border-blue-500/20">
                  🔒 Only you can see this video. To make it public, change your account to public and update privacy settings.
                </p>
              )}
              {formData.privacyStatus === "FRIEND_ONLY" && (
                <p className="text-xs text-muted-foreground mt-2 p-2 bg-blue-500/5 rounded border border-blue-500/20">
                  👥 Only your followers can see this video.
                </p>
              )}
              {formData.privacyStatus === "PUBLIC" && (
                <p className="text-xs text-muted-foreground mt-2 p-2 bg-blue-500/5 rounded border border-blue-500/20">
                  🌍 Everyone on TikTok can see this video.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 3: Interaction Settings */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50">
        <button
          type="button"
          onClick={() => toggleSection("interactions")}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-purple-500/10 flex items-center justify-center text-sm">
              💬
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">Interaction Settings</h3>
              <p className="text-xs text-muted-foreground">Duets, Comments & Stitches</p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expandedSections.interactions && "rotate-180"
            )}
          />
        </button>

        {expandedSections.interactions && (
          <div className="px-4 py-3 border-t border-border/30 space-y-3 bg-muted/20">
            <p className="text-xs text-muted-foreground mb-3">
              Select which interactions creators can use with your video:
            </p>

            {/* Allow Comments */}
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
              <Checkbox
                checked={formData.allowComment}
                onCheckedChange={checked =>
                  setFormData(prev => ({ ...prev, allowComment: checked as boolean }))
                }
                disabled={isSubmitting}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Allow Comments</p>
                <p className="text-xs text-muted-foreground">Others can comment on your video</p>
              </div>
            </label>

            {/* Allow Duets */}
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
              <Checkbox
                checked={formData.allowDuet}
                onCheckedChange={checked =>
                  setFormData(prev => ({ ...prev, allowDuet: checked as boolean }))
                }
                disabled={isSubmitting}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Allow Duets</p>
                <p className="text-xs text-muted-foreground">Others can create duets with your video</p>
              </div>
            </label>

            {/* Allow Stitches */}
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
              <Checkbox
                checked={formData.allowStitch}
                onCheckedChange={checked =>
                  setFormData(prev => ({ ...prev, allowStitch: checked as boolean }))
                }
                disabled={isSubmitting}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Allow Stitches</p>
                <p className="text-xs text-muted-foreground">Others can stitch your video</p>
              </div>
            </label>

            <div className="mt-3 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                None of these options are selected by default. Uncheck all if you want to restrict interactions.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* SECTION 4: Commercial Content Disclosure */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="border border-border/50 rounded-lg overflow-hidden bg-card/50">
        <button
          type="button"
          onClick={() => toggleSection("commercial")}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center text-sm">
              💼
            </div>
            <div className="text-left">
              <h3 className="text-sm font-semibold text-foreground">Commercial Disclosure</h3>
              <p className="text-xs text-muted-foreground">Promotional content?</p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expandedSections.commercial && "rotate-180"
            )}
          />
        </button>

        {expandedSections.commercial && (
          <div className="px-4 py-3 border-t border-border/30 space-y-3 bg-muted/20">
            {/* Commercial Content Toggle */}
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
              <Checkbox
                checked={formData.isCommercialContent}
                onCheckedChange={checked =>
                  setFormData(prev => ({ ...prev, isCommercialContent: checked as boolean }))
                }
                disabled={isSubmitting}
              />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">This is commercial content</p>
                <p className="text-xs text-muted-foreground">I'm promoting a brand, product, or service</p>
              </div>
            </label>

            {/* Commercial Options (shown only when enabled) */}
            {formData.isCommercialContent && (
              <div className="mt-4 space-y-3 ml-6 pt-3 border-t border-border/30">
                <p className="text-xs font-medium text-foreground mb-2">What are you promoting?</p>

                {/* Your Brand Option */}
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={formData.yourBrand}
                    onCheckedChange={checked =>
                      setFormData(prev => ({ ...prev, yourBrand: checked as boolean }))
                    }
                    disabled={isSubmitting}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Your Brand</p>
                    <p className="text-xs text-muted-foreground">
                      You are promoting yourself or your own business
                    </p>
                  </div>
                </label>

                {formData.yourBrand && (
                  <div className="ml-6 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">
                      ℹ️ Your photo/video will be labeled as "Promotional content"
                    </p>
                  </div>
                )}

                {/* Branded Content Option */}
                <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox
                    checked={formData.brandedContent}
                    onCheckedChange={checked =>
                      setFormData(prev => ({ ...prev, brandedContent: checked as boolean }))
                    }
                    disabled={isSubmitting}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">Branded Content</p>
                    <p className="text-xs text-muted-foreground">
                      You are promoting another brand or third party
                    </p>
                  </div>
                </label>

                {formData.brandedContent && (
                  <div className="ml-6 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <p className="text-xs text-blue-700 font-medium">
                      ℹ️ Your photo/video will be labeled as "Paid partnership"
                    </p>
                  </div>
                )}

                {/* Warning for private + branded */}
                {formData.brandedContent && formData.privacyStatus === "SELF_ONLY" && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">
                      ⚠️ Branded content visibility cannot be set to private. Please select "Friends Only" or "Public".
                    </p>
                  </div>
                )}

                {/* Validation Error */}
                {errors.commercial && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700">{errors.commercial}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* COMPLIANCE DECLARATION */}
      {/* ──────────────────────────────────────────────────────── */}
      <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg space-y-3">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground mb-1">
              {getComplianceDeclaration()}
            </p>
            <p className="text-xs text-muted-foreground">
              Processing time: Your content may take a few minutes to appear on your profile after publishing.
            </p>
          </div>
        </div>
      </div>

      {/* ──────────────────────────────────────────────────────── */}
      {/* CONTENT PREVIEW */}
      {/* ──────────────────────────────────────────────────────── */}
      {contentPreview && (
        <div className="p-4 bg-muted/30 border border-border/50 rounded-lg space-y-2">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Content Preview</h4>
          <p className="text-sm text-foreground line-clamp-3">{contentPreview}</p>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* SUBMIT BUTTON */}
      {/* ──────────────────────────────────────────────────────── */}
      <Button
        type="submit"
        disabled={!canSubmit}
        className="w-full"
        size="lg"
      >
        {isSubmitting ? (
          <>
            <span className="animate-spin mr-2">⏳</span>
            Publishing to TikTok...
          </>
        ) : (
          <>
            {canSubmit ? "✓ Publish to TikTok" : "Cannot Publish"}
          </>
        )}
      </Button>

      {!creatorInfo?.canPost && (
        <p className="text-xs text-red-600 text-center">
          You've reached your daily posting limit. Please try again later.
        </p>
      )}
    </form>
  );
}
