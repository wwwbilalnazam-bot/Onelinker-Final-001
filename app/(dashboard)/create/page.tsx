"use client";

import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Send, Clock, FileText, X, Plus, PenSquare,
  Twitter, Linkedin, Instagram, Facebook, Youtube,
  Sparkles, Image as ImageIcon, Hash, Smile, RotateCcw,
  Check, AlertCircle, Upload, Film, Trash2, Globe,
  Eye, Heart, MessageCircle, Share2, Bookmark, ThumbsUp, ThumbsDown,
  Settings2, RefreshCw, Loader2, Zap, Newspaper,
  MoreHorizontal, Music, Disc, Wand2, Copy, ArrowRight, ArrowLeft, ChevronDown, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetClose } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useSearchParams, useRouter } from "next/navigation";
import type { SocialAccount } from "@/types";
import toast from "react-hot-toast";
import { VideoPlayer } from "@/components/compose/VideoPlayer";
import { VideoTrimmer } from "@/components/compose/VideoTrimmer";
import { ThumbnailPicker, EMPTY_THUMBNAIL, type ThumbnailData } from "@/components/compose/ThumbnailPicker";
import { ComposeModal } from "@/components/compose/ComposeModal";
import { TikTokShareModal } from "@/components/compose/TikTokShareModal";
import { TikTokShareData } from "@/components/compose/TikTokShareForm";
import { parseAspectRatio, detectAllPlatformFormats } from "@/lib/media/auto-format-detector";
import { publishManager, type PublishPayload } from "@/lib/publishing/publish-manager";

// ─── Platform definitions ────────────────────────────────────
const PLATFORMS = [
  { id: "instagram", label: "Instagram",   icon: Instagram, color: "text-pink-600 dark:text-pink-500",  bg: "bg-pink-500/15 dark:bg-pink-500/10",  limit: 2200,  hashtagLimit: 30 },
  { id: "facebook",  label: "Facebook",    icon: Facebook,  color: "text-blue-700 dark:text-blue-600",  bg: "bg-blue-600/15 dark:bg-blue-600/10",  limit: 2000,  hashtagLimit: 3  },
  { id: "tiktok",    label: "TikTok",      icon: Music,     color: "text-foreground",     bg: "bg-muted/20",     limit: 2200,  hashtagLimit: 5  },
  { id: "youtube",   label: "YouTube",     icon: Youtube,   color: "text-red-600 dark:text-red-500",   bg: "bg-red-500/15 dark:bg-red-500/10",   limit: 5000,  hashtagLimit: 15 },
  { id: "twitter",   label: "X (Twitter)", icon: Twitter,   color: "text-sky-600 dark:text-sky-400",   bg: "bg-sky-500/15 dark:bg-sky-500/10",   limit: 280,   hashtagLimit: 2  },
  { id: "linkedin",  label: "LinkedIn",    icon: Linkedin,  color: "text-blue-600 dark:text-blue-500",  bg: "bg-blue-500/15 dark:bg-blue-500/10",  limit: 3000,  hashtagLimit: 5  },
] as const;

// Map platform string → PLATFORMS entry (for accounts on any platform)
const PLATFORM_META: Record<string, { label: string; icon: React.FC<{ className?: string }>; color: string; bg: string }> = {
  instagram:  { label: "Instagram",   icon: Instagram, color: "text-white",  bg: "bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]" },
  facebook:   { label: "Facebook",    icon: Facebook,  color: "text-white",  bg: "bg-[#1877F2]" },
  youtube:    { label: "YouTube",     icon: Youtube,   color: "text-white",  bg: "bg-[#FF0000]" },
  twitter:    { label: "X",           icon: Twitter,   color: "text-white",  bg: "bg-black" },
  linkedin:   { label: "LinkedIn",    icon: Linkedin,  color: "text-white",  bg: "bg-[#0A66C2]" },
  tiktok:     { label: "TikTok",      icon: Music,     color: "text-white",  bg: "bg-black" },
  threads:    { label: "Threads",     icon: MessageCircle, color: "text-white", bg: "bg-black" },
  bluesky:    { label: "Bluesky",     icon: Share2,    color: "text-white",  bg: "bg-[#0560ff]" },
  pinterest:  { label: "Pinterest",   icon: Bookmark,  color: "text-white",  bg: "bg-[#E60023]" },
  google_business: { label: "Google Business", icon: Globe, color: "text-white", bg: "bg-[#4285F4]" },
};

type PlatformId = typeof PLATFORMS[number]["id"];

// ─── File size limits per platform (in MB) ───────────────────
const PLATFORM_FILE_LIMITS: Record<PlatformId, { imageMax: number; videoMax: number; label: string }> = {
  instagram:  { imageMax: 8,    videoMax: 100,   label: "Instagram" },
  facebook:   { imageMax: 10,   videoMax: 1024,  label: "Facebook" },    // 1 GB
  tiktok:     { imageMax: 10,   videoMax: 287,   label: "TikTok" },      // 287 MB
  youtube:    { imageMax: 10,   videoMax: 12288, label: "YouTube" },      // 12 GB (we cap at 5 GB for web)
  twitter:    { imageMax: 5,    videoMax: 512,   label: "X (Twitter)" },
  linkedin:   { imageMax: 10,   videoMax: 200,   label: "LinkedIn" },
};

function formatFileSize(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(mb >= 10240 ? 0 : 1)} GB` : `${mb} MB`;
}

// ─── Format definitions per platform ────────────────────────
interface FormatConfig {
  id: string;
  label: string;
  category: "post" | "reel" | "story" | "video" | "short"; 
  aspect: string;          // CSS aspect-ratio value
  size: string;            // "WxH" recommended size
  description: string;
  isVertical: boolean;     // 9:16 orientation
  maxDurationSec?: number; // video only
  icon: "post" | "story" | "reel" | "video" | "short" | "photo";
}

const PLATFORM_FORMATS: Record<PlatformId, FormatConfig[]> = {
  twitter: [
    { id: "post",    label: "Post",  category: "post", aspect: "16 / 9", size: "1600×900",  description: "Standard horizontal post", isVertical: false, icon: "post" },
    { id: "square",  label: "Post",  category: "post", aspect: "1 / 1",  size: "1200×1200", description: "Square post",            isVertical: false, icon: "post" },
  ],
  linkedin: [
    { id: "post",    label: "Post",   category: "post", aspect: "1.91 / 1", size: "1200×627",  description: "Standard post",   isVertical: false, icon: "post" },
    { id: "square",  label: "Post",   category: "post", aspect: "1 / 1",    size: "1200×1200", description: "Square post",     isVertical: false, icon: "post" },
    { id: "portrait",label: "Post",   category: "post", aspect: "4 / 5",    size: "1080×1350", description: "Portrait post",   isVertical: false, icon: "post" },
  ],
  instagram: [
    { id: "post",         label: "Post",    category: "post",  aspect: "1 / 1",   size: "1080×1080", description: "Square feed post",    isVertical: false, icon: "post" },
    { id: "post_portrait",label: "Post",    category: "post",  aspect: "4 / 5",   size: "1080×1350", description: "Portrait feed post",  isVertical: false, icon: "post" },
    { id: "story",        label: "Story",   category: "story", aspect: "9 / 16",  size: "1080×1920", description: "24-hour story",       isVertical: true,  icon: "story", maxDurationSec: 15 },
    { id: "reel",         label: "Reel",    category: "reel",  aspect: "9 / 16",  size: "1080×1920", description: "Short video up to 90s",isVertical: true, icon: "reel",  maxDurationSec: 90 },
  ],
  facebook: [
    { id: "post",     label: "Post",    category: "post",  aspect: "16 / 9", size: "1200×630",  description: "Standard horizontal post",   isVertical: false, icon: "post" },
    { id: "square",   label: "Post",    category: "post",  aspect: "1 / 1",  size: "1080×1080", description: "Square feed post",         isVertical: false, icon: "post" },
    { id: "portrait", label: "Post",    category: "post",  aspect: "4 / 5",  size: "1080×1350", description: "Portrait feed post",       isVertical: false, icon: "post" },
    { id: "story",    label: "Story",   category: "story", aspect: "9 / 16", size: "1080×1920", description: "24-hour story",            isVertical: true,  icon: "story", maxDurationSec: 20 },
    { id: "reel",     label: "Reel",    category: "reel",  aspect: "9 / 16", size: "1080×1920", description: "Short video up to 60s",    isVertical: true,  icon: "reel",  maxDurationSec: 60 },
  ],
  tiktok: [
    { id: "video", label: "Video", category: "reel",  aspect: "9 / 16", size: "1080×1920", description: "Vertical video up to 10min", isVertical: true, icon: "reel", maxDurationSec: 600 },
    { id: "post",  label: "Photo", category: "post",  aspect: "1 / 1",  size: "1080×1080", description: "Photo post / carousel",      isVertical: false, icon: "post" },
  ],
  youtube: [
    { id: "video", label: "Video", category: "video", aspect: "16 / 9", size: "1920×1080", description: "Standard horizontal video", isVertical: false, icon: "video" },
    { id: "short", label: "Short", category: "short", aspect: "9 / 16", size: "1080×1920", description: "Vertical short ≤60s",       isVertical: true,  icon: "short", maxDurationSec: 60 },
  ],
};

function getFormat(platformId: PlatformId, selectedId?: string): FormatConfig {
  const formats = PLATFORM_FORMATS[platformId];
  return formats.find(f => f.id === selectedId) ?? formats[0]!;
}

// ─── Crop ratios ─────────────────────────────────────────────
const CROP_RATIOS = [
  { id: "original", label: "Original", aspect: undefined },
  { id: "1:1",      label: "1:1",      aspect: "1 / 1" },
  { id: "4:5",      label: "4:5",      aspect: "4 / 5" },
  { id: "16:9",     label: "16:9",     aspect: "16 / 9" },
  { id: "9:16",     label: "9:16",     aspect: "9 / 16" },
] as const;
type CropRatioId = typeof CROP_RATIOS[number]["id"];

// ─── Other constants ─────────────────────────────────────────
const TIMEZONES: Record<string, string> = {
  "UTC":                  "UTC",
  "America/New_York":     "EST — New York",
  "America/Chicago":      "CST — Chicago",
  "America/Denver":       "MST — Denver",
  "America/Los_Angeles":  "PST — Los Angeles",
  "Europe/London":        "GMT — London",
  "Europe/Paris":         "CET — Paris",
  "Asia/Dubai":           "GST — Dubai",
  "Asia/Karachi":         "PKT — Karachi",
  "Asia/Kolkata":         "IST — India",
  "Asia/Singapore":       "SGT — Singapore",
  "Asia/Tokyo":           "JST — Tokyo",
  "Australia/Sydney":     "AEST — Sydney",
};

// AI tone options
const AI_TONES = [
  { id: "professional",  label: "Professional",  emoji: "💼" },
  { id: "casual",        label: "Casual",        emoji: "😊" },
  { id: "funny",         label: "Funny",         emoji: "😂" },
  { id: "viral",         label: "Viral",         emoji: "🔥" },
  { id: "inspirational", label: "Inspirational", emoji: "✨" },
  { id: "educational",   label: "Educational",   emoji: "📚" },
] as const;

import { findBestFormat } from "@/lib/media/auto-format-detector";

const EMOJI_GROUPS: Record<string, string[]> = {
  "Smileys":  ["😀","😂","😍","🥰","😎","🤔","😅","😭","🤩","😏","🙃","😇"],
  "Gestures": ["👍","👎","🙌","👏","🤝","✌️","🤞","👌","💪","🫡","🤙","👋"],
  "Objects":  ["⭐","🔥","✅","❌","💡","🎉","🚀","💯","🎯","📢","⚡","🏆"],
  "Symbols":  ["❤️","💙","💚","💛","🧡","💜","🌟","🌍","🌈","💫","✨","🎨"],
};

type AiToneId = typeof AI_TONES[number]["id"];

// ─── Types ───────────────────────────────────────────────────
type UploadStatus = "pending" | "uploading" | "done" | "error";

interface UploadedFile {
  id: string;
  file: File;
  type: "image" | "video";
  blobUrl: string;
  supabaseUrl: string;
  storagePath: string;
  uploadStatus: UploadStatus;
  uploadProgress: number;
  errorMessage: string;
  altText: string;
  cropRatio: CropRatioId;
  trimStart: number;
  trimEnd: number;
  videoDuration: number;
  naturalWidth: number;
  naturalHeight: number;
}

// ─── Format icon helper ───────────────────────────────────────
function FormatIcon({ type, className }: { type: FormatConfig["icon"]; className?: string }) {
  if (type === "story") return <Zap className={className} />;
  if (type === "reel")  return <Film className={className} />;
  if (type === "short") return <Film className={className} />;
  if (type === "video") return <Eye className={className} />;
  return <Newspaper className={className} />;
}

// ─── Media thumbnail with progress ───────────────────────────
function FileThumbnail({
  f, isActive, onClick, onRemove, isDragOver,
  onDragStart, onDragOver, onDragEnd, onDrop,
}: {
  f: UploadedFile; isActive: boolean; onClick: () => void; onRemove: () => void;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onClick={onClick}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDrop={onDrop}
      className={cn(
        "relative shrink-0 h-16 w-16 rounded-lg overflow-hidden border-2 cursor-grab transition-all bg-muted/30",
        isActive ? "border-primary shadow-md" : "border-transparent hover:border-primary/50",
        isDragOver && "border-primary/80 scale-105 shadow-lg"
      )}
    >
      {f.type === "image" ? (
        <img src={f.blobUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <VideoPlayer src={f.blobUrl} className="h-full w-full" aspectRatio="1 / 1" compact />
      )}

      {/* Uploading overlay */}
      {f.uploadStatus === "uploading" && (
        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-0.5">
          <Loader2 className="h-4 w-4 text-white animate-spin" />
          <span className="text-[9px] text-white font-bold">{f.uploadProgress}%</span>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40">
            <div className="h-full bg-blue-500 transition-all duration-200" style={{ width: `${f.uploadProgress}%` }} />
          </div>
        </div>
      )}

      {/* Error overlay */}
      {f.uploadStatus === "error" && (
        <div className="absolute inset-0 bg-red-900/70 flex items-center justify-center">
          <AlertCircle className="h-5 w-5 text-red-300" />
        </div>
      )}

      {/* Done badge */}
      {f.uploadStatus === "done" && (
        <div className="absolute bottom-0.5 left-0.5 h-4 w-4 rounded-full bg-green-500 flex items-center justify-center">
          <Check className="h-2.5 w-2.5 text-white" />
        </div>
      )}

      {/* Video badge */}
      {f.type === "video" && f.uploadStatus !== "uploading" && (
        <div className="absolute top-0.5 left-0.5 rounded bg-black/60 px-1 py-0.5">
          <Film className="h-2.5 w-2.5 text-white" />
        </div>
      )}

      <button
        onClick={e => { e.stopPropagation(); onRemove(); }}
        className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-black/70 flex items-center justify-center hover:bg-red-600 transition-colors"
      >
        <X className="h-2.5 w-2.5 text-white" />
      </button>
    </div>
  );
}

// ─── Preview sub-components ───────────────────────────────────

/** Media shown inside a preview card — capped to max 4:3 tall to keep previews compact */
function PreviewMedia({
  media, format, className, thumbnail,
}: {
  media: UploadedFile[];
  format: FormatConfig;
  className?: string;
  thumbnail?: ThumbnailData;
}) {
  const first = media[0];
  if (!first) return null;
  const src = first.supabaseUrl || first.blobUrl;
  const aspect = format.aspect;
  
  // Use selected thumbnail as poster for videos
  const poster = first.type === "video" && thumbnail?.previewUrl ? thumbnail.previewUrl : undefined;

  return (
    <div
      className={cn("relative overflow-hidden w-full", className)}
      style={{ aspectRatio: aspect }}
    >
      {first.type === "image" ? (
        <img src={src} alt={first.altText} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <VideoPlayer 
          src={first.blobUrl} 
          compact 
          poster={poster}
          className="absolute inset-0 w-full h-full" 
          trimStart={first.trimStart} 
          trimEnd={first.trimEnd > 0 ? first.trimEnd : undefined} 
        />
      )}
      {media.length > 1 && (
        <div className="absolute bottom-1.5 right-1.5 rounded-full bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5">
          +{media.length - 1}
        </div>
      )}
    </div>
  );
}

// ─── Platform-accurate preview helpers ──────────────────────
function AccountAvatar({ account, size = "sm", fallbackColor = "bg-muted/40" }: { account?: SocialAccount | null; size?: "xs" | "sm" | "md"; fallbackColor?: string }) {
  const px = size === "xs" ? "h-5 w-5" : size === "sm" ? "h-7 w-7" : "h-9 w-9";
  const txt = size === "xs" ? "text-[8px]" : size === "sm" ? "text-[10px]" : "text-sm";
  const name = account?.display_name || account?.username || "?";
  if (account?.profile_picture) return <img src={account.profile_picture} alt="" className={cn(px, "rounded-full object-cover shrink-0")} />;
  return <div className={cn(px, fallbackColor, "rounded-full flex items-center justify-center shrink-0 font-bold text-foreground/70", txt)}>{name.charAt(0).toUpperCase()}</div>;
}

function VerticalMediaBg({ media }: { media: UploadedFile[] }) {
  const first = media[0];
  const src = first ? (first.supabaseUrl || first.blobUrl) : null;
  return (
    <>
      {src && first?.type === "image" && <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />}
      {first?.type === "video" && <VideoPlayer src={first.blobUrl} compact className="absolute inset-0 w-full h-full" trimStart={first.trimStart} trimEnd={first.trimEnd > 0 ? first.trimEnd : undefined} />}
      {!src && <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center"><ImageIcon className="h-8 w-8 text-white/20" /></div>}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════
// INSTAGRAM REEL — matches real IG Reels UI
// ═══════════════════════════════════════════════════════════════
function IGReelPreview({ content, media, account }: { content: string; media: UploadedFile[]; account?: SocialAccount | null }) {
  const name = account?.username || account?.display_name || "your_account";
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black mx-auto w-full" style={{ aspectRatio: "9 / 16" }}>
      <VerticalMediaBg media={media} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />

      {/* Right-side actions — IG style */}
      <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center"><Heart className="h-6 w-6 text-white" /></div>
        <div className="flex flex-col items-center"><MessageCircle className="h-6 w-6 text-white" /></div>
        <div className="flex flex-col items-center"><Send className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><MoreHorizontal className="h-6 w-6 text-white" /></div>
        {/* Audio disc */}
        <div className="h-6 w-6 rounded-md border border-white/30 bg-gradient-to-br from-gray-700 to-gray-900 overflow-hidden mt-1">
          {account?.profile_picture ? <img src={account.profile_picture} alt="" className="w-full h-full object-cover" /> : <Music className="h-3 w-3 text-white/60 m-auto" />}
        </div>
      </div>

      {/* Bottom — account + caption */}
      <div className="absolute bottom-0 left-0 right-10 p-3">
        <div className="flex items-center gap-2 mb-2">
          <AccountAvatar account={account} size="xs" fallbackColor="bg-white/20" />
          <span className="text-[11px] font-semibold text-white">{name}</span>
          <span className="text-[9px] text-white/50">· Follow</span>
        </div>
        {content && <p className="text-[10px] text-white/90 leading-relaxed line-clamp-2">{content.slice(0, 100)}{content.length > 100 && "…"}</p>}
        <div className="flex items-center gap-1.5 mt-2">
          <Music className="h-2.5 w-2.5 text-white/60" />
          <span className="text-[9px] text-white/60">{name} · Original audio</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INSTAGRAM STORY — matches real IG Stories UI
// ═══════════════════════════════════════════════════════════════
function IGStoryPreview({ content, media, account }: { content: string; media: UploadedFile[]; account?: SocialAccount | null }) {
  const name = account?.username || account?.display_name || "your_account";
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black mx-auto w-full" style={{ aspectRatio: "9 / 16" }}>
      <VerticalMediaBg media={media} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30 pointer-events-none" />

      {/* Top — progress bars + account */}
      <div className="absolute top-0 left-0 right-0 p-2">
        <div className="flex gap-0.5 mb-2">
          {[1, 2, 3].map(i => <div key={i} className={cn("h-[2px] flex-1 rounded-full", i === 1 ? "bg-white" : "bg-white/30")} />)}
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-full p-[1.5px] bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500">
              <AccountAvatar account={account} size="xs" fallbackColor="bg-black" />
            </div>
            <span className="text-[11px] font-semibold text-white">{name}</span>
            <span className="text-[9px] text-white/50">2s</span>
          </div>
          <div className="flex items-center gap-2">
            <MoreHorizontal className="h-4 w-4 text-white/80" />
            <X className="h-4 w-4 text-white/80" />
          </div>
        </div>
      </div>

      {/* Bottom — reply bar */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {content && <p className="text-[10px] text-white/90 leading-relaxed line-clamp-2 mb-2">{content.slice(0, 80)}</p>}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-8 rounded-full border border-white/30 flex items-center px-3">
            <span className="text-[10px] text-white/40">Send message</span>
          </div>
          <Heart className="h-5 w-5 text-white/70 shrink-0" />
          <Send className="h-5 w-5 text-white/70 shrink-0" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK REEL — matches real FB Reels UI
// ═══════════════════════════════════════════════════════════════
function FBReelPreview({ content, media, account }: { content: string; media: UploadedFile[]; account?: SocialAccount | null }) {
  const name = account?.display_name || account?.username || "Your Page";
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black mx-auto w-full" style={{ aspectRatio: "9 / 16" }}>
      <VerticalMediaBg media={media} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />

      {/* Right-side actions — FB Reel style */}
      <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center"><ThumbsUp className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><MessageCircle className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><Share2 className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><MoreHorizontal className="h-5 w-5 text-white" /></div>
      </div>

      {/* Bottom — account + caption */}
      <div className="absolute bottom-0 left-0 right-10 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <AccountAvatar account={account} size="xs" fallbackColor="bg-blue-600/30" />
          <span className="text-[11px] font-semibold text-white">{name}</span>
          <span className="text-[9px] text-white border border-white/40 rounded px-1.5 py-0.5">Follow</span>
        </div>
        {content && <p className="text-[10px] text-white/90 leading-relaxed line-clamp-2">{content.slice(0, 100)}{content.length > 100 && "…"}</p>}
        <div className="flex items-center gap-1.5 mt-2">
          <Music className="h-2.5 w-2.5 text-white/60" />
          <span className="text-[9px] text-white/60">{name} · Original audio</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK STORY — matches real FB Stories UI
// ═══════════════════════════════════════════════════════════════
function FBStoryPreview({ content, media, account }: { content: string; media: UploadedFile[]; account?: SocialAccount | null }) {
  const name = account?.display_name || account?.username || "Your Page";
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black mx-auto w-full" style={{ aspectRatio: "9 / 16" }}>
      <VerticalMediaBg media={media} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/30 pointer-events-none" />

      {/* Top — progress + account */}
      <div className="absolute top-0 left-0 right-0 p-2">
        <div className="flex gap-0.5 mb-2">
          <div className="h-[2px] flex-1 rounded-full bg-white" />
          <div className="h-[2px] flex-1 rounded-full bg-white/30" />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AccountAvatar account={account} size="xs" fallbackColor="bg-blue-600/30" />
            <span className="text-[11px] font-semibold text-white">{name}</span>
            <span className="text-[9px] text-white/50">Just now</span>
          </div>
          <div className="flex items-center gap-2">
            <MoreHorizontal className="h-4 w-4 text-white/80" />
            <X className="h-4 w-4 text-white/80" />
          </div>
        </div>
      </div>

      {/* Bottom — reply */}
      <div className="absolute bottom-0 left-0 right-0 p-3">
        {content && <p className="text-[10px] text-white/90 line-clamp-2 mb-2">{content.slice(0, 80)}</p>}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-8 rounded-full border border-white/30 flex items-center px-3">
            <span className="text-[10px] text-white/40">Reply to {name}...</span>
          </div>
          <ThumbsUp className="h-5 w-5 text-white/70" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// YOUTUBE SHORT — matches real YT Shorts UI
// ═══════════════════════════════════════════════════════════════
function YTShortPreview({ content, media, account, title }: { content: string; media: UploadedFile[]; account?: SocialAccount | null; title: string }) {
  const channelName = account?.display_name || account?.username || "Your Channel";
  return (
    <div className="relative rounded-2xl overflow-hidden bg-black mx-auto w-full" style={{ aspectRatio: "9 / 16" }}>
      <VerticalMediaBg media={media} />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />

      {/* Right-side actions — YT Shorts style */}
      <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-4">
        <div className="flex flex-col items-center"><ThumbsUp className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><ThumbsDown className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><MessageCircle className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><Share2 className="h-5 w-5 text-white" /></div>
        <div className="flex flex-col items-center"><MoreHorizontal className="h-5 w-5 text-white" /></div>
        {/* Audio disc */}
        <div className="h-7 w-7 rounded-full border-2 border-white/30 overflow-hidden animate-[spin_3s_linear_infinite_paused]">
          {account?.profile_picture ? <img src={account.profile_picture} alt="" className="w-full h-full object-cover" /> : <Disc className="h-4 w-4 text-white/40 m-auto" />}
        </div>
      </div>

      {/* Bottom — channel + caption */}
      <div className="absolute bottom-0 left-0 right-10 p-3">
        <div className="flex items-center gap-2 mb-1.5">
          <AccountAvatar account={account} size="xs" fallbackColor="bg-red-500/20" />
          <span className="text-[11px] font-semibold text-white">@{account?.username || channelName}</span>
          <span className="text-[8px] text-white bg-white/20 rounded px-1.5 py-0.5 font-medium">Subscribe</span>
        </div>
        <p className={cn("text-[10px] font-medium text-white line-clamp-1 mb-0.5", !title && "text-white/40 italic")}>{title || "Add a title…"}</p>
        {content && <p className="text-[10px] text-white/80 line-clamp-1">{content.slice(0, 80)}</p>}
        <div className="flex items-center gap-1.5 mt-1.5">
          <Music className="h-2.5 w-2.5 text-white/60" />
          <span className="text-[9px] text-white/60">{channelName} · Original sound</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TIKTOK POST — matches real TikTok UI
// ═══════════════════════════════════════════════════════════════
function TikTokPreview({ content, media, format, account }: { content: string; media: UploadedFile[]; format: FormatConfig; account?: SocialAccount | null }) {
  const name = account?.username || account?.display_name || "your_account";
  const isVertical = format.isVertical !== false;

  if (isVertical) {
    return (
      <div className="relative rounded-2xl overflow-hidden bg-black mx-auto w-full" style={{ aspectRatio: "9 / 16" }}>
        <VerticalMediaBg media={media} />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/80 pointer-events-none" />
        <div className="absolute right-2.5 bottom-20 flex flex-col items-center gap-4">
          <div className="flex flex-col items-center"><Heart className="h-6 w-6 text-white" /></div>
          <div className="flex flex-col items-center"><MessageCircle className="h-6 w-6 text-white" /></div>
          <div className="flex flex-col items-center"><Bookmark className="h-5 w-5 text-white" /></div>
          <div className="flex flex-col items-center"><Share2 className="h-5 w-5 text-white" /></div>
          <Disc className="h-7 w-7 text-white/60 animate-spin" style={{ animationDuration: "3s" }} />
        </div>
        <div className="absolute bottom-0 left-0 right-10 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AccountAvatar account={account} size="xs" fallbackColor="bg-white/20" />
            <span className="text-[11px] font-semibold text-white">@{name}</span>
          </div>
          {content && <p className="text-[10px] text-white/90 leading-relaxed line-clamp-3">{content.slice(0, 150)}{content.length > 150 && "…"}</p>}
          <div className="flex items-center gap-1.5 mt-2">
            <Music className="h-2.5 w-2.5 text-white/60" />
            <span className="text-[9px] text-white/60">{name} · Original sound</span>
          </div>
        </div>
      </div>
    );
  }

  // Photo / carousel post
  return (
    <div className="rounded-2xl border border-border/40 bg-card overflow-hidden mx-auto">
      <div className="flex items-center gap-2 px-2.5 py-2">
        <AccountAvatar account={account} size="xs" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1"><span className="text-[11px] font-semibold truncate">@{name}</span></div>
        </div>
      </div>
      {media.length > 0 && <PreviewMedia media={media} format={format} />}
      <div className="px-2.5 py-2">
        {content && <p className="text-[11px] text-foreground/90 leading-relaxed whitespace-pre-wrap line-clamp-4">{content}</p>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// TWITTER / X POST — matches real X UI
// ═══════════════════════════════════════════════════════════════
function TwitterPreview({ content, media, format, account }: { content: string; media: UploadedFile[]; format: FormatConfig; account?: SocialAccount | null }) {
  const name = account?.display_name || account?.username || "Your account";
  const handle = account?.username || "handle";
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 overflow-hidden">
      <div className="p-2.5">
        <div className="flex gap-2">
          <AccountAvatar account={account} size="sm" fallbackColor="bg-sky-500/15" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                <span className="text-[11px] font-bold text-foreground truncate">{name}</span>
                <span className="text-[10px] text-muted-foreground truncate">@{handle} · now</span>
              </div>
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
            </div>
            <p className="text-[11px] text-foreground mt-0.5 whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
              {content || <span className="text-muted-foreground/40 italic">Your post…</span>}
            </p>
          </div>
        </div>
        {media.length > 0 && <PreviewMedia media={media} format={format} className="mt-2 rounded-xl ml-9" />}
        <div className="flex items-center justify-between mt-2 ml-9 text-muted-foreground/40">
          <MessageCircle className="h-3.5 w-3.5" />
          <RefreshCw className="h-3.5 w-3.5" />
          <Heart className="h-3.5 w-3.5" />
          <Eye className="h-3.5 w-3.5" />
          <Bookmark className="h-3.5 w-3.5" />
          <Share2 className="h-3.5 w-3.5" />
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// LINKEDIN POST — matches real LinkedIn UI
// ═══════════════════════════════════════════════════════════════
function LinkedInPreview({ content, media, format, account }: { content: string; media: UploadedFile[]; format: FormatConfig; account?: SocialAccount | null }) {
  const name = account?.display_name || account?.username || "Your account";
  const truncated = content.length > 200;
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 overflow-hidden">
      <div className="p-2.5">
        <div className="flex gap-2 mb-1.5">
          <AccountAvatar account={account} size="sm" fallbackColor="bg-blue-500/15" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-foreground leading-tight">{name}</p>
            <p className="text-[9px] text-muted-foreground leading-tight">Connections · Just now · 🌐</p>
          </div>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        </div>
        <p className="text-[11px] text-foreground whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
          {content
            ? <>{content.slice(0, 200)}{truncated && <span className="text-blue-500 cursor-pointer"> …see more</span>}</>
            : <span className="text-muted-foreground/40 italic">Your post…</span>}
        </p>
      </div>
      {media.length > 0 && <PreviewMedia media={media} format={format} />}
      {/* Reaction bar */}
      <div className="px-2.5 py-1 border-t border-border/20">
        <div className="flex gap-2 text-muted-foreground/50 justify-around">
          <span className="flex items-center gap-1 text-[10px] font-medium"><ThumbsUp className="h-3.5 w-3.5" /> Like</span>
          <span className="flex items-center gap-1 text-[10px] font-medium"><MessageCircle className="h-3.5 w-3.5" /> Comment</span>
          <span className="flex items-center gap-1 text-[10px] font-medium"><RefreshCw className="h-3.5 w-3.5" /> Repost</span>
          <span className="flex items-center gap-1 text-[10px] font-medium"><Send className="h-3.5 w-3.5" /> Send</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// INSTAGRAM POST — matches real IG feed post
// ═══════════════════════════════════════════════════════════════
function InstagramPreview({ content, media, format, account }: { content: string; media: UploadedFile[]; format: FormatConfig; account?: SocialAccount | null }) {
  if (format.icon === "reel") return <IGReelPreview content={content} media={media} account={account} />;
  if (format.icon === "story") return <IGStoryPreview content={content} media={media} account={account} />;

  const name = account?.username || account?.display_name || "your_account";
  const first = media[0];
  const src = first ? (first.supabaseUrl || first.blobUrl) : null;
  const truncated = content.length > 125;
  const mediaAspect = first && first.naturalWidth > 0 && first.naturalHeight > 0
    ? `${first.naturalWidth} / ${first.naturalHeight}` : format.aspect;

  return (
    <div className="rounded-xl border border-border/40 bg-background/40 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-2.5 py-2">
        <div className="flex items-center gap-2">
          <div className="rounded-full p-[1.5px] bg-gradient-to-br from-yellow-400 via-pink-500 to-purple-600">
            <div className="rounded-full bg-background p-[1px]">
              <AccountAvatar account={account} size="xs" fallbackColor="bg-pink-500/15" />
            </div>
          </div>
          <span className="text-[11px] font-semibold text-foreground">{name}</span>
        </div>
        <MoreHorizontal className="h-4 w-4 text-foreground/60" />
      </div>
      {/* Media */}
      <div className="bg-black relative" style={{ aspectRatio: mediaAspect }}>
        {src && first?.type === "image" && <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {first?.type === "video" && <VideoPlayer src={first.blobUrl} className="absolute inset-0 w-full h-full" aspectRatio={mediaAspect} compact />}
        {!src && <div className="absolute inset-0 bg-gradient-to-br from-pink-500/10 to-purple-500/10 flex items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground/20" /></div>}
        {media.length > 1 && <div className="absolute top-2 right-2 rounded-lg bg-black/60 text-white text-[9px] font-bold px-1.5 py-0.5">1/{media.length}</div>}
      </div>
      {/* Actions */}
      <div className="px-2.5 pt-2">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex gap-3">
            <Heart className="h-4.5 w-4.5 text-foreground/70" />
            <MessageCircle className="h-4.5 w-4.5 text-foreground/70" />
            <Send className="h-4.5 w-4.5 text-foreground/70" />
          </div>
          <Bookmark className="h-4.5 w-4.5 text-foreground/70" />
        </div>
        <p className="text-[11px] text-foreground leading-relaxed pb-2.5">
          <span className="font-semibold">{name} </span>
          {content
            ? <>{content.slice(0, 125)}{truncated && <span className="text-muted-foreground"> ...more</span>}</>
            : <span className="text-muted-foreground/40 italic">Write a caption…</span>}
        </p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FACEBOOK POST / REEL / STORY — matches real FB UI
// ═══════════════════════════════════════════════════════════════
function FacebookPreview({ content, media, format, account }: { content: string; media: UploadedFile[]; format: FormatConfig; account?: SocialAccount | null }) {
  if (format.icon === "reel") return <FBReelPreview content={content} media={media} account={account} />;
  if (format.icon === "story") return <FBStoryPreview content={content} media={media} account={account} />;

  const name = account?.display_name || account?.username || "Your Page";
  return (
    <div className="rounded-xl border border-border/40 bg-background/40 overflow-hidden">
      <div className="p-2.5">
        <div className="flex items-start gap-2 mb-1.5">
          <AccountAvatar account={account} size="sm" fallbackColor="bg-blue-600/15" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] font-bold text-foreground leading-tight">{name}</p>
            <div className="flex items-center gap-1">
              <span className="text-[9px] text-muted-foreground">Just now</span>
              <span className="text-[9px] text-muted-foreground">·</span>
              <Globe className="h-2 w-2 text-muted-foreground" />
            </div>
          </div>
          <MoreHorizontal className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        </div>
        <p className="text-[11px] text-foreground whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
          {content || <span className="text-muted-foreground/40 italic">What&apos;s on your mind?</span>}
        </p>
      </div>
      {media.length > 0 && <PreviewMedia media={media} format={format} />}
      {/* Reaction bar */}
      <div className="px-2.5 py-1 border-t border-border/20">
        <div className="flex gap-2 text-muted-foreground/50 justify-around">
          <span className="flex items-center gap-1 text-[10px] font-medium"><ThumbsUp className="h-3.5 w-3.5" /> Like</span>
          <span className="flex items-center gap-1 text-[10px] font-medium"><MessageCircle className="h-3.5 w-3.5" /> Comment</span>
          <span className="flex items-center gap-1 text-[10px] font-medium"><Share2 className="h-3.5 w-3.5" /> Share</span>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// YOUTUBE VIDEO / SHORT — matches real YT UI
// ═══════════════════════════════════════════════════════════════
function YoutubePreview({ content, media, format, title, account, thumbnailPreview }: { content: string; media: UploadedFile[]; format: FormatConfig; title: string; account?: SocialAccount | null; thumbnailPreview?: string }) {
  const channelName = account?.display_name || account?.username || "Your Channel";
  const [playing, setPlaying] = React.useState(false);

  // Reset to thumbnail view when thumbnail changes
  React.useEffect(() => { setPlaying(false); }, [thumbnailPreview]);

  if (format.id === "short") return <YTShortPreview content={content} media={media} account={account} title={title} />;

  const thumb = media.find(f => f.type === "image") ?? media[0];
  const src = thumb ? (thumb.supabaseUrl || thumb.blobUrl) : null;
  const trimDuration = thumb?.type === "video" && thumb.trimEnd > 0 ? thumb.trimEnd - thumb.trimStart : thumb?.videoDuration || 0;
  const durationStr = trimDuration > 0 ? `${Math.floor(trimDuration / 60)}:${String(Math.floor(trimDuration % 60)).padStart(2, "0")}` : "";

  const hasThumbnail = !!thumbnailPreview;
  // Show thumbnail overlay when we have one and user hasn't clicked play
  const showThumbOverlay = hasThumbnail && !playing;

  return (
    <div className="rounded-xl overflow-hidden bg-background group cursor-default">
      {/* Thumbnail / Video — 16:9 */}
      <div className="relative bg-black rounded-xl overflow-hidden" style={{ aspectRatio: "16 / 9" }}>
        {/* Video player always renders underneath when we have video */}
        {thumb?.type === "video" && (playing || !hasThumbnail) && <VideoPlayer src={thumb.blobUrl} className="absolute inset-0 w-full h-full" aspectRatio="16 / 9" compact />}
        {/* Thumbnail overlay — click to play */}
        {showThumbOverlay && (
          <button onClick={() => setPlaying(true)} className="absolute inset-0 w-full h-full z-10 cursor-pointer group/vid">
            <img src={thumbnailPreview} alt="Video thumbnail" className="absolute inset-0 w-full h-full object-cover" />
            {/* YouTube-style play button */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex h-12 w-[68px] items-center justify-center rounded-xl bg-black/80 group-hover/vid:bg-red-600 transition-colors">
                <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6 ml-0.5"><polygon points="5,3 19,12 5,21" /></svg>
              </div>
            </div>
          </button>
        )}
        {/* Fallbacks when no thumbnail */}
        {!hasThumbnail && src && thumb?.type === "image" && <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        {!hasThumbnail && !src && !thumb?.type && <div className="absolute inset-0 bg-zinc-900 flex items-center justify-center border border-white/5"><Youtube className="h-10 w-10 text-red-600/20" /></div>}
        {/* Duration badge — bottom right like YT */}
        {durationStr && <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-md z-20 shadow-sm">{durationStr}</div>}
      </div>
      {/* Video info */}
      <div className="pt-3 pb-2 flex gap-3 px-1">
        <AccountAvatar account={account} size="sm" fallbackColor="bg-red-600/10" />
        <div className="flex-1 min-w-0">
          <p className={cn("text-[13px] font-bold leading-snug line-clamp-2 transition-colors", title ? "text-foreground" : "text-muted-foreground/30 italic")}>
            {title || "Add an attention-grabbing title…"}
          </p>
          {!title && <div className="text-[10px] text-red-500 mt-1 font-semibold flex items-center gap-1 bg-red-500/5 px-2 py-0.5 rounded-full w-fit border border-red-500/10"><AlertCircle className="h-2.5 w-2.5" /> Missing Title</div>}
          <div className="mt-1.5 space-y-0.5 px-0.5">
            <p className="text-[11px] text-muted-foreground font-medium hover:text-foreground transition-colors cursor-pointer">{channelName}</p>
            <p className="text-[11px] text-muted-foreground">0 views • Just now</p>
          </div>
        </div>
        <button className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-muted/50 transition-colors shrink-0">
          <MoreHorizontal className="h-4.5 w-4.5 text-muted-foreground/40" />
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────
export default function ComposePage() {
  const supabase = createClient();
  const { workspace } = useWorkspace();

  const [content, setContent]                     = useState("");
  const [firstComment, setFirstComment]           = useState("");
  const [showFirstComment, setShowFirstComment]   = useState(false);

  // Connected accounts (loaded from DB)
  const [accounts, setAccounts]                   = useState<SocialAccount[]>([]);
  const [accountsLoading, setAccountsLoading]     = useState(true);

  // Which account IDs are selected to publish to
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);

  // Per-platform format selection
  const [platformFormats, setPlatformFormats]     = useState<Partial<Record<PlatformId, string>>>({});

  // Per-channel content mode
  const [perChannelMode, setPerChannelMode]       = useState(false);
  const [activeEditTab, setActiveEditTab]         = useState<string>("twitter");
  const [channelContent, setChannelContent]       = useState<Partial<Record<PlatformId, string>>>({});

  // Per-account content mode
  const [accountContent, setAccountContent]       = useState<Record<string, string>>({});

  // Media
  const [mediaFiles, setMediaFiles]               = useState<UploadedFile[]>([]);
  const [activeMediaId, setActiveMediaId]         = useState<string | null>(null);
  const fileInputRef                              = useRef<HTMLInputElement>(null);
  const [dragOverId, setDragOverId]               = useState<string | null>(null);
  const dragItemRef                               = useRef<string | null>(null);

  // Panels / preview
  const [activePanel, setActivePanel]             = useState<"none" | "ai" | "hashtags" | "emojis" | "media">("none");
  const [previewPlatform, setPreviewPlatform]     = useState<PlatformId>("instagram");
  const [mobileAccountsExpanded, setMobileAccountsExpanded] = useState(false);
  const [postFormatExpanded, setPostFormatExpanded] = useState(false);
  const [livePreviewExpanded, setLivePreviewExpanded] = useState(false);

  // Schedule
  const [scheduleMode, setScheduleMode]           = useState<"now" | "schedule" | "draft">("now");
  const [scheduledDate, setScheduledDate]         = useState("");
  const [scheduledTime, setScheduledTime]         = useState("");
  const [timezone, setTimezone]                   = useState("UTC");
  const [isSubmitting, setIsSubmitting]           = useState(false);

  // YouTube title & config
  const [youtubeTitle, setYoutubeTitle]           = useState("");
  const [titleError, setTitleError]               = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [ytPrivacy, setYtPrivacy]                 = useState<"public" | "private" | "unlisted">("public");
  const [ytCategory, setYtCategory]               = useState("22");
  const [ytTags, setYtTags]                       = useState("");
  const [ytMadeForKids, setYtMadeForKids]         = useState(false);

  // Thumbnail
  const [thumbnail, setThumbnail]                 = useState<ThumbnailData>(EMPTY_THUMBNAIL);

  // Loading state
  const [isLoadingPost, setIsLoadingPost]         = useState(false);

  // TikTok modal state
  const [isTikTokModalOpen, setIsTikTokModalOpen] = useState(false);
  const [tiktokData, setTiktokData]               = useState<TikTokShareData | null>(null);
  const [pendingTiktokSubmit, setPendingTiktokSubmit] = useState(false);

  // Hook for query params
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get("edit");
  const isModal = searchParams.get("sheet") === "true";

  // AI caption generation
  const [aiTopic, setAiTopic]                     = useState("");
  const [aiTone, setAiTone]                       = useState<AiToneId>("professional");
  const [aiKeywords, setAiKeywords]               = useState("");
  const [aiCaptions, setAiCaptions]               = useState<string[]>([]);
  const [isGeneratingCaptions, setIsGeneratingCaptions] = useState(false);

  // AI rewrite
  const [rewriteTone, setRewriteTone]             = useState<AiToneId>("casual");
  const [isRewriting, setIsRewriting]             = useState(false);

  // AI hashtags — per platform
  const [aiHashtagsByPlatform, setAiHashtagsByPlatform] = useState<Record<string, string[]>>({});
  const [isGeneratingHashtags, setIsGeneratingHashtags] = useState(false);
  const [hashtagViewPlatform, setHashtagViewPlatform]   = useState<PlatformId>("instagram");

  // Auto-save draft
  const [draftId, setDraftId]                           = useState<string | null>(null);
  const [autoSaveStatus, setAutoSaveStatus]             = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer                                   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedContent                                = useRef<string>("");

  // ─── Derived ─────────────────────────────────────────────────
  // Unique platforms from selected accounts (preserving display order)
  const selectedPlatforms = PLATFORMS
    .map(p => p.id)
    .filter(pid => selectedAccountIds.some(id => accounts.find(a => a.id === id)?.platform === pid)) as PlatformId[];

  // Also include platforms not in PLATFORMS array (e.g. tiktok)
  const allSelectedPlatforms = [
    ...new Set(
      selectedAccountIds
        .map(id => accounts.find(a => a.id === id)?.platform)
        .filter(Boolean) as string[]
    ),
  ];

  // Channel selector: all accounts
  const filteredAccounts = useMemo(() => {
    return accounts;
  }, [accounts]);

  // Channel selector: unique platforms from all accounts
  const accountPlatforms = useMemo(() => {
    return Array.from(new Set(accounts.map(a => a.platform)));
  }, [accounts]);

  // Check if ALL selected platforms are in story format (stories don't need captions)
  const isAllStoryMode = selectedPlatforms.length > 0 && selectedPlatforms.every(pid => {
    const fmt = getFormat(pid, platformFormats[pid]);
    return fmt.icon === "story";
  });

  function getChannelContent(id: PlatformId): string {
    return perChannelMode ? (channelContent[id] ?? content) : content;
  }

  const currentEditContent = perChannelMode ? (accountContent[activeEditTab] ?? content) : content;
  const activeMedia = mediaFiles.find(f => f.id === activeMediaId) ?? null;

  function charInfo(id: PlatformId) {
    const p = PLATFORMS.find(pl => pl.id === id)!;
    const c = getChannelContent(id);
    const remaining = p.limit - c.length;
    return { remaining, isOver: remaining < 0, isNear: remaining >= 0 && remaining < 50, length: c.length, limit: p.limit };
  }

  function hashtagInfo(id: PlatformId) {
    const p = PLATFORMS.find(pl => pl.id === id)!;
    const c = getChannelContent(id);
    const hashtags = c.match(/#[a-zA-Z0-9_]+/g) ?? [];
    const count = hashtags.length;
    const limit = p.hashtagLimit;
    const isOver = count > limit;
    return { count, limit, isOver };
  }

  // YouTube title needed when any YouTube account is selected
  const youtubeSelected = allSelectedPlatforms.includes("youtube");
  const youtubeFormat   = getFormat("youtube", platformFormats["youtube"]);
  const needsYoutubeTitle = youtubeSelected;

  // Show thumbnail picker when there's a video and at least one platform supports thumbnails
  const videoFile = mediaFiles.find(f => f.type === "video" && f.uploadStatus === "done");
  const showThumbnailPicker = !!videoFile && allSelectedPlatforms.length > 0;

  // ─── Auto-save to draft after 30s of inactivity ───────────────
  const autoSaveDraft = useCallback(async () => {
    if (!workspace?.id || !content.trim() || isSubmitting) return;
    if (content.trim() === lastSavedContent.current) return;

    setAutoSaveStatus("saving");
    try {
      const mediaUrls = mediaFiles
        .filter(f => f.uploadStatus === "done" && f.supabaseUrl)
        .map(f => f.supabaseUrl);

      const res = await fetch("/api/posts", {
        method: draftId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(draftId ? { postId: draftId } : {}),
          workspaceId: workspace.id,
          accountIds: selectedAccountIds.length > 0 ? selectedAccountIds : undefined,
          content,
          channelContent: perChannelMode && Object.keys(channelContent).length > 0 ? channelContent : undefined,
          accountContent: perChannelMode && Object.keys(accountContent).length > 0 ? accountContent : undefined,
          scheduleMode: "draft",
          mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
          firstComment: activePanel === "comment" && firstComment.trim() ? firstComment.trim() : undefined,
          youtubeTitle: youtubeSelected ? youtubeTitle.trim() || undefined : undefined,
          youtubeConfig: youtubeSelected ? {
            privacyStatus: ytPrivacy,
            categoryId: ytCategory,
            tags: ytTags.trim() ? ytTags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
            madeForKids: ytMadeForKids,
          } : undefined,
        }),
      });

      const json = await res.json() as { data?: { id?: string }; error?: string };
      if (res.ok) {
        if (!draftId && json.data?.id) setDraftId(json.data.id);
        lastSavedContent.current = content.trim();
        setAutoSaveStatus("saved");
        setTimeout(() => setAutoSaveStatus("idle"), 3000);
      } else {
        setAutoSaveStatus("idle");
      }
    } catch {
      setAutoSaveStatus("idle");
    }
  }, [workspace?.id, content, mediaFiles, selectedAccountIds, perChannelMode, channelContent, accountContent, activePanel, firstComment, draftId, isSubmitting, youtubeSelected, youtubeTitle, ytPrivacy, ytCategory, ytTags, ytMadeForKids]);

  useEffect(() => {
    if (!content.trim() || isSubmitting) return;
    if (content.trim() === lastSavedContent.current) return;

    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => {
      autoSaveDraft();
    }, 30000); // 30 seconds of inactivity

    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, [content, channelContent, autoSaveDraft, isSubmitting]);

  // ─── Auto-fill YouTube title from content ───────────────────
  useEffect(() => {
    if (youtubeSelected && !youtubeTitle.trim() && content.trim()) {
      // Use first line of content as title, max 100 chars
      const firstLine = content.split("\n")[0] || content;
      const title = firstLine.substring(0, 100);
      setYoutubeTitle(title);
    }
  }, [youtubeSelected, content]);

  // ─── Load connected accounts ─────────────────────────────────
  useEffect(() => {
    if (!workspace?.id) return;
    setAccountsLoading(true);
    supabase
      .from("social_accounts")
      .select("id, workspace_id, outstand_account_id, platform, username, display_name, profile_picture, followers_count, is_active, connected_at")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("connected_at", { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          console.error("[Create] Failed to load accounts:", error);
          setAccountsLoading(false);
          return;
        }

        const rows = (data ?? []) as SocialAccount[];
        console.log("[Create] Loaded accounts:", rows.length, rows.map(a => ({ platform: a.platform, username: a.username })));
        setAccounts(rows);

        // Only pre-select all if NOT in edit mode
        if (!editId) {
          setSelectedAccountIds(rows.map(a => a.id));
          const firstKnown = rows.find(a => PLATFORMS.some(p => p.id === a.platform));
          if (firstKnown) setPreviewPlatform(firstKnown.platform as PlatformId);
        }

        setAccountsLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id, editId]);

  // ─── Load Post for Editing ───────────────────────────────────
  useEffect(() => {
    if (!editId || !workspace?.id) return;

    async function loadPost() {
      setIsLoadingPost(true);
      try {
        const { data, error } = await supabase
          .from("posts")
          .select("*")
          .eq("id", editId)
          .eq("workspace_id", workspace!.id)
          .single();

        if (error) {
          toast.error("Failed to load post for editing");
          console.error("[Edit Post Load Error]", error);
          router.replace("/create");
          return;
        }

        if (data) {
          // Verify status - only allow editing drafts and scheduled posts
          if (data.status === "published" || data.status === "failed" || data.status === "cancelled") {
            toast.error(`Cannot edit a ${data.status} post. Copy its content instead.`);
            router.replace("/create");
            return;
          }

          // Populate state
          setContent(data.content || "");
          setSelectedAccountIds(data.account_ids || []);
          setFirstComment(data.first_comment || "");
          setShowFirstComment(!!data.first_comment);
          setDraftId(data.id);
          
          // Handle per-channel content if it exists
          if (data.channel_content && typeof data.channel_content === "object") {
            setChannelContent(data.channel_content);
            setPerChannelMode(Object.keys(data.channel_content).length > 0);
          }

          // Handle per-account content if it exists
          if (data.account_content && typeof data.account_content === "object") {
            setAccountContent(data.account_content);
            setPerChannelMode(Object.keys(data.account_content).length > 0);
          }

          // Populate media
          if (data.media_urls && data.media_urls.length > 0) {
            const initialMedia: UploadedFile[] = data.media_urls.map((url: string, index: number) => {
              const type = url.match(/\.(mp4|mov|webm)$/i) ? "video" : "image";
              return {
                id: `existing-${index}`,
                file: new File([], "placeholder"), // Stub for type system
                type,
                blobUrl: url,
                supabaseUrl: url,
                storagePath: "", // Unknown from URL alone
                uploadStatus: "done",
                uploadProgress: 100,
                errorMessage: "",
                altText: "",
                cropRatio: "original",
                trimStart: 0,
                trimEnd: 0,
                videoDuration: 0,
                naturalWidth: 0,
                naturalHeight: 0,
              };
            });
            setMediaFiles(initialMedia);
          }

          // Handle scheduled date/time
          if (data.scheduled_at) {
            const d = new Date(data.scheduled_at);
            const dateStr = d.toISOString().split("T")[0];
            const timeStr = d.toTimeString().split(" ")[0]?.slice(0, 5);
            setScheduledDate(dateStr || "");
            setScheduledTime(timeStr || "");
            setScheduleMode("schedule");
          } else if (data.status === "draft") {
            setScheduleMode("draft");
          }

          // Handle YouTube-specifics
          if (data.title) setYoutubeTitle(data.title);
          if (data.options?.youtubeConfig) {
            setYtPrivacy(data.options.youtubeConfig.privacyStatus || "public");
            setYtCategory(data.options.youtubeConfig.categoryId || "22");
            setYtTags(data.options.youtubeConfig.tags?.join(", ") || "");
            setYtMadeForKids(data.options.youtubeConfig.madeForKids || false);

          }
          if (data.options?.thumbnail) {
            setThumbnail(data.options.thumbnail);
          }

          toast.success("Post loaded for editing");
        }
      } catch (err) {
        toast.error("An unexpected error occurred while loading the post");
      } finally {
        setIsLoadingPost(false);
      }
    }

    loadPost();
  }, [editId, workspace?.id, router, supabase]);




  async function handleGenerateTitle() {
    if (!workspace?.id) return;
    setIsGeneratingTitle(true);
    try {
      const res = await fetch("/api/ai/youtube-title", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim(), workspaceId: workspace.id }),
      });
      const json = await res.json() as { data?: { title: string }; error?: string };
      if (!res.ok) { toast.error(json.error ?? "Title generation failed"); return; }
      setYoutubeTitle(json.data?.title ?? "");
      setTitleError(false);
      toast.success("Title generated!");
    } catch {
      toast.error("Couldn't generate title — try typing one manually.");
    } finally {
      setIsGeneratingTitle(false);
    }
  }

  // ─── AI Caption Generation ──────────────────────────────────
  async function handleGenerateCaptions() {
    if (!workspace?.id) return;
    const topic = aiTopic.trim() || content.trim();
    if (!topic) { toast.error("Enter a topic or write some content first"); return; }

    // Use the shortest-limit platform to ensure captions fit everywhere
    const shortestPlatform = selectedPlatforms.length > 0
      ? selectedPlatforms.reduce((a, b) => {
          const la = PLATFORMS.find(p => p.id === a)!.limit;
          const lb = PLATFORMS.find(p => p.id === b)!.limit;
          return la < lb ? a : b;
        })
      : "twitter";

    setIsGeneratingCaptions(true);
    try {
      const res = await fetch("/api/ai/captions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic,
          tone: aiTone,
          platform: shortestPlatform,
          keywords: aiKeywords || undefined,
          workspaceId: workspace.id,
        }),
      });
      const json = await res.json() as { data?: { variations: string[] }; error?: string };
      if (!res.ok) { toast.error(json.error ?? "AI generation failed"); return; }
      setAiCaptions(json.data?.variations ?? []);
    } catch {
      toast.error("Failed to generate captions");
    } finally {
      setIsGeneratingCaptions(false);
    }
  }

  /** Apply a caption to ALL platforms + auto-generate YouTube title */
  async function applyCaption(caption: string) {
    // Apply to shared content
    setContent(caption);
    // If per-channel mode, also fill all channels
    if (perChannelMode) {
      const seed: Partial<Record<PlatformId, string>> = {};
      selectedPlatforms.forEach(id => { seed[id] = caption; });
      setChannelContent(seed);
    }
    toast.success("Caption applied to all platforms!");

    // Auto-generate YouTube title if YouTube is selected
    if (youtubeSelected && workspace?.id && !youtubeTitle.trim()) {
      setIsGeneratingTitle(true);
      try {
        const res = await fetch("/api/ai/youtube-title", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: caption, workspaceId: workspace.id }),
        });
        const json = await res.json() as { data?: { title: string }; error?: string };
        if (res.ok && json.data?.title) {
          setYoutubeTitle(json.data.title);
          setTitleError(false);
          toast.success("YouTube title generated!");
        }
      } catch { /* user can still type one manually */ }
      finally { setIsGeneratingTitle(false); }
    }
  }

  async function handleRewriteContent() {
    if (!workspace?.id) return;
    const text = currentEditContent.trim();
    if (!text) { toast.error("Write something first to rewrite"); return; }

    setIsRewriting(true);
    try {
      const res = await fetch("/api/ai/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text,
          tone: rewriteTone,
          platform: perChannelMode ? activeEditTab : (previewPlatform ?? "instagram"),
          workspaceId: workspace.id,
        }),
      });
      const json = await res.json() as { data?: { content: string }; error?: string };
      if (!res.ok) { toast.error(json.error ?? "AI rewrite failed"); return; }
      if (json.data?.content) {
        // Apply rewrite to current platform (shared or per-channel)
        setCurrentContent(json.data.content);
        toast.success("Caption rewritten!");
      }
    } catch {
      toast.error("Failed to rewrite");
    } finally {
      setIsRewriting(false);
    }
  }

  /** Generate hashtags for ALL selected platforms at once */
  async function handleGenerateHashtags() {
    if (!workspace?.id) return;
    const text = content.trim();
    if (!text) { toast.error("Write some content first to generate hashtags"); return; }

    setIsGeneratingHashtags(true);
    const platformsToGenerate = selectedPlatforms.length > 0 ? selectedPlatforms : ["instagram" as PlatformId];

    try {
      const results: Record<string, string[]> = {};
      // Generate for all selected platforms in parallel
      const promises = platformsToGenerate.map(async (platformId) => {
        const res = await fetch("/api/ai/hashtags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: text, platform: platformId, workspaceId: workspace!.id }),
        });
        const json = await res.json() as { data?: { hashtags: string[] }; error?: string };
        if (res.ok && json.data?.hashtags) {
          results[platformId] = json.data.hashtags;
        }
      });
      await Promise.all(promises);
      setAiHashtagsByPlatform(results);
      setHashtagViewPlatform(platformsToGenerate[0]!);
      toast.success(`Hashtags generated for ${Object.keys(results).length} platform${Object.keys(results).length > 1 ? "s" : ""}!`);
    } catch {
      toast.error("Failed to generate hashtags");
    } finally {
      setIsGeneratingHashtags(false);
    }
  }

  function insertHashtagsForPlatform(platformId: string) {
    const tags = aiHashtagsByPlatform[platformId];
    if (!tags?.length) return;
    if (perChannelMode) {
      const current = channelContent[platformId as PlatformId] ?? content;
      const sep = current && !current.endsWith("\n") ? "\n\n" : "";
      setChannelContent(prev => ({ ...prev, [platformId]: current + sep + tags.join(" ") }));
    } else {
      const sep = content && !content.endsWith("\n") ? "\n\n" : "";
      setContent(prev => prev + sep + tags.join(" "));
    }
    toast.success(`${tags.length} hashtags added!`);
  }

  function insertAllPlatformHashtags() {
    if (perChannelMode) {
      // Add each platform's hashtags to its own channel
      const updated = { ...channelContent };
      for (const [pid, tags] of Object.entries(aiHashtagsByPlatform)) {
        if (!tags.length) continue;
        const current = updated[pid as PlatformId] ?? content;
        const sep = current && !current.endsWith("\n") ? "\n\n" : "";
        updated[pid as PlatformId] = current + sep + tags.join(" ");
      }
      setChannelContent(updated);
      toast.success("Platform-specific hashtags added to all channels!");
    } else {
      // In shared mode, use the current preview platform's hashtags
      const tags = aiHashtagsByPlatform[previewPlatform] ?? Object.values(aiHashtagsByPlatform)[0] ?? [];
      if (!tags.length) return;
      const sep = content && !content.endsWith("\n") ? "\n\n" : "";
      setContent(prev => prev + sep + tags.join(" "));
      toast.success(`${tags.length} hashtags added!`);
    }
  }

  // ─── Content handlers ─────────────────────────────────────────
  function setCurrentContent(value: string) {
    if (perChannelMode) setAccountContent(prev => ({ ...prev, [activeEditTab]: value }));
    else setContent(value);
  }

  function toggleAccount(accountId: string) {
    setSelectedAccountIds(prev => {
      const isSelected = prev.includes(accountId);
      // Don't deselect the last account if we have only one selected
      if (isSelected && prev.length === 1) return prev;
      const next = isSelected ? prev.filter(id => id !== accountId) : [...prev, accountId];

      // After toggling, ensure previewPlatform is still valid
      const nextPlatforms = PLATFORMS
        .map(p => p.id)
        .filter(pid => next.some(id => accounts.find(a => a.id === id)?.platform === pid));
      if (nextPlatforms.length > 0 && !nextPlatforms.includes(previewPlatform)) {
        setPreviewPlatform(nextPlatforms[0]!);
      }
      // Ensure activeEditTab is still valid
      if (!nextPlatforms.includes(activeEditTab) && nextPlatforms[0]) {
        setActiveEditTab(nextPlatforms[0]);
      }
      return next;
    });
  }

  function toggleAllAccounts() {
    setSelectedAccountIds(prev => {
      // If all are selected, clear all (except maybe first one to keep state valid)
      if (prev.length === accounts.length) {
        const first = accounts[0]?.id ? [accounts[0].id] : [];
        return first;
      }
      // Otherwise, select all
      return accounts.map(a => a.id);
    });
  }

  function setFormatForPlatform(platformId: PlatformId, formatId: string) {
    setPlatformFormats(prev => ({ ...prev, [platformId]: formatId }));
  }

  function togglePerChannel() {
    if (!perChannelMode) {
      // Seed accountContent with shared content for each selected account
      const seed: Record<string, string> = {};
      (accounts ?? [])
        .filter(a => selectedAccountIds.includes(a.id))
        .forEach(a => { seed[a.id] = content; });
      setAccountContent(seed);
      // Set active tab to first selected account
      const firstAccountId = (accounts ?? [])
        .find(a => selectedAccountIds.includes(a.id))?.id;
      setActiveEditTab(firstAccountId ?? "");
    }
    setPerChannelMode(p => !p);
  }

  function addEmoji(emoji: string) { setCurrentContent(currentEditContent + emoji); }
  function addHashtag(tag: string) {
    const sep = currentEditContent && !currentEditContent.endsWith(" ") ? " " : "";
    setCurrentContent(currentEditContent + sep + tag + " ");
  }

  // ─── Auto-detect best format based on media aspect ratio ──────
  const autoDetectBestFormats = useCallback((width: number, height: number, type?: "image" | "video"): Partial<Record<PlatformId, string>> => {
    return detectAllPlatformFormats(width, height, type || "image", selectedPlatforms as any, PLATFORM_FORMATS);
  }, [selectedPlatforms]);

  // ─── Direct detection trigger ───
  const updateMedia = useCallback((id: string, updates: Partial<UploadedFile>) => {
    setMediaFiles(prev => {
      const next = prev.map(f => f.id === id ? { ...f, ...updates } : f);
      
      // Auto-detect formats when dimensions AND type are present
      const file = next.find(f => f.id === id);
      if (file && file.naturalWidth > 0 && file.naturalHeight > 0) {
        const detectedFormats = autoDetectBestFormats(file.naturalWidth, file.naturalHeight, file.type);
        if (Object.keys(detectedFormats).length > 0) {
          setPlatformFormats(prevFormats => ({ ...prevFormats, ...detectedFormats }));
        }
      }
      return next;
    });
  }, [autoDetectBestFormats]);

  async function uploadToSupabase(fileEntry: UploadedFile) {
    if (!workspace?.id) {
      updateMedia(fileEntry.id, { uploadStatus: "error", errorMessage: "No workspace selected" });
      return;
    }
    updateMedia(fileEntry.id, { uploadStatus: "uploading", uploadProgress: 0 });

    const safeName = fileEntry.file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storagePath = `${workspace.id}/${Date.now()}-${safeName}`;

    try {
      // Refresh session to get a fresh (non-expired) access token (required for Storage RLS)
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshedData?.session) {
        throw new Error("Session expired — please sign in again");
      }
      const accessToken = refreshedData.session.access_token;

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

        xhr.open("POST", `${supabaseUrl}/storage/v1/object/workspace-media/${encodeURIComponent(storagePath)}`);
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.setRequestHeader("Content-Type", fileEntry.file.type);
        xhr.setRequestHeader("x-upsert", "false");

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            updateMedia(fileEntry.id, { uploadProgress: Math.round((e.loaded / e.total) * 100) });
          }
        };
        xhr.onload  = () => {
          if (xhr.status >= 200 && xhr.status < 300) { resolve(); return; }
          try {
            const b = JSON.parse(xhr.responseText) as { message?: string; error?: string };
            reject(new Error(b.message ?? b.error ?? `Upload failed (${xhr.status})`));
          } catch { reject(new Error(`Upload failed (${xhr.status})`)); }
        };
        xhr.onerror = () => reject(new Error("Network error during upload"));
        xhr.onabort = () => reject(new Error("Upload aborted"));
        xhr.send(fileEntry.file);
      });

      const { data: { publicUrl } } = supabase.storage.from("workspace-media").getPublicUrl(storagePath);
      updateMedia(fileEntry.id, { uploadStatus: "done", uploadProgress: 100, supabaseUrl: publicUrl, storagePath });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upload failed";
      updateMedia(fileEntry.id, { uploadStatus: "error", errorMessage: msg });
      toast.error(`Upload failed: ${msg}`);
    }
  }

  function handleFileSelect(files: FileList | null) {
    if (!files) return;
    const ALLOWED = ["image/jpeg","image/png","image/gif","image/webp","video/mp4","video/quicktime","video/webm"];

    Array.from(files).forEach(file => {
      if (!ALLOWED.includes(file.type)) { toast.error(`${file.name}: unsupported type`); return; }
      const isVideo = file.type.startsWith("video/");
      const fileSizeMB = file.size / (1024 * 1024);

      // Validate against each selected platform's limit
      for (const pid of selectedPlatforms) {
        const limits = PLATFORM_FILE_LIMITS[pid];
        if (!limits) continue;
        const maxMB = isVideo ? limits.videoMax : limits.imageMax;
        if (fileSizeMB > maxMB) {
          toast.error(`${file.name} (${fileSizeMB.toFixed(1)} MB) exceeds ${limits.label} ${isVideo ? "video" : "image"} limit of ${formatFileSize(maxMB)}`);
          return;
        }
      }

      // Fallback limit if no platforms selected
      if (selectedPlatforms.length === 0) {
        if (!isVideo && fileSizeMB > 10)  { toast.error(`${file.name}: images must be ≤10 MB`); return; }
        if (isVideo  && fileSizeMB > 200) { toast.error(`${file.name}: videos must be ≤200 MB`); return; }
      }

      const blobUrl = URL.createObjectURL(file);
      const newFile: UploadedFile = {
        id: Math.random().toString(36).slice(2),
        file,
        type: isVideo ? "video" : "image",
        blobUrl,
        supabaseUrl: "", storagePath: "",
        uploadStatus: "pending", uploadProgress: 0, errorMessage: "",
        altText: "", cropRatio: "original", trimStart: 0, trimEnd: 60, videoDuration: 0,
        naturalWidth: 0, naturalHeight: 0,
      };

      // Detect natural dimensions
      if (isVideo) {
        const vid = document.createElement("video");
        vid.preload = "metadata";
        vid.onloadedmetadata = () => {
          updateMedia(newFile.id, { naturalWidth: vid.videoWidth, naturalHeight: vid.videoHeight, videoDuration: Math.round(vid.duration), trimEnd: Math.round(vid.duration) });
          vid.remove();
        };
        vid.src = blobUrl;
      } else {
        const img = new Image();
        img.onload = () => { updateMedia(newFile.id, { naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight }); };
        img.src = blobUrl;
      }

      setMediaFiles(prev => [...prev, newFile]);
      setActiveMediaId(newFile.id);
      uploadToSupabase(newFile);
    });
  }

  function removeMedia(id: string) {
    setMediaFiles(prev => {
      const f = prev.find(f => f.id === id);
      if (f) {
        URL.revokeObjectURL(f.blobUrl);
        if (f.storagePath) supabase.storage.from("workspace-media").remove([f.storagePath]).catch(() => {});
      }
      return prev.filter(f => f.id !== id);
    });
    setActiveMediaId(prev => prev === id ? null : prev);
  }

  function reorderMedia(fromId: string, toId: string) {
    if (fromId === toId) return;
    setMediaFiles(prev => {
      const copy = [...prev];
      const fromIdx = copy.findIndex(f => f.id === fromId);
      const toIdx = copy.findIndex(f => f.id === toId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [item] = copy.splice(fromIdx, 1) as [UploadedFile];
      copy.splice(toIdx, 0, item);
      return copy;
    });
  }

  async function retryUpload(id: string) {
    const f = mediaFiles.find(m => m.id === id);
    if (f) await uploadToSupabase(f);
  }

  // ─── Submit ───────────────────────────────────────────────────
  async function handleSubmit(overrideTiktokData?: TikTokShareData) {
    if (!selectedAccountIds.length) { toast.error("Select at least one account"); return; }

    const hasContent = perChannelMode
      ? selectedPlatforms.some(id => (channelContent[id] ?? content).trim())
      : content.trim();

    // Collect all missing fields and show them at once
    const missing: string[] = [];
    if (!hasContent && !isAllStoryMode) missing.push("caption");
    if (needsYoutubeTitle && !youtubeTitle.trim()) missing.push("YouTube title");
    if (youtubeSelected && !videoFile) missing.push("video file for YouTube");
    if (isAllStoryMode && mediaFiles.filter(f => f.uploadStatus === "done").length === 0) missing.push("at least one image or video for stories");
    if (scheduleMode === "schedule" && !scheduledDate) missing.push("scheduled date");

    if (missing.length > 0) {
      toast.error(`Missing: ${missing.join(", ")}`);
      if (missing.includes("YouTube title")) setTitleError(true);
      return;
    }

    const overLimit = selectedPlatforms.find(id => charInfo(id).isOver);
    if (overLimit) { toast.error(`Content too long for ${PLATFORMS.find(p => p.id === overLimit)?.label}`); return; }

    // Check YouTube Shorts duration limit
    if (youtubeSelected && platformFormats?.youtube === "short" && videoFile && videoFile.videoDuration > 60) {
      toast.error(`YouTube Shorts must be 60 seconds or less (your video is ${Math.round(videoFile.videoDuration)}s)`);
      return;
    }

    const uploading = mediaFiles.filter(f => f.uploadStatus === "uploading" || f.uploadStatus === "pending");
    if (uploading.length > 0) { toast.error("Wait for media to finish uploading"); return; }
    if (mediaFiles.some(f => f.uploadStatus === "error")) { toast.error("Remove or retry failed uploads first"); return; }

    setIsSubmitting(true);
    try {
      // Refresh session to ensure we have a valid token for any uploads during submit
      const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshedData?.session) {
        throw new Error("Session expired — please sign in again");
      }

      const mediaUrls = mediaFiles
        .filter(f => f.uploadStatus === "done" && f.supabaseUrl)
        .map(f => f.supabaseUrl);

      // Upload thumbnail to Supabase if needed (custom file or frame data URL for YouTube)
      let thumbnailForPublish = thumbnail;
      const needsThumbUpload =
        (thumbnail.type === "custom" && thumbnail.customFile && !thumbnail.uploadedUrl) ||
        (thumbnail.type === "frame" && thumbnail.previewUrl && !thumbnail.uploadedUrl && youtubeSelected);

      if (needsThumbUpload) {
        try {
          let thumbBlob: Blob;
          let thumbContentType: string;
          let thumbExt: string;

          if (thumbnail.type === "custom" && thumbnail.customFile) {
            thumbBlob = thumbnail.customFile;
            thumbContentType = thumbnail.customFile.type;
            thumbExt = thumbnail.customFile.name.split(".").pop() ?? "jpg";
          } else {
            // Convert frame data URL (base64) to blob for upload
            const dataUrl = thumbnail.previewUrl;
            const [header, base64] = dataUrl.split(",");
            const mime = header?.match(/:(.*?);/)?.[1] ?? "image/jpeg";
            const binary = atob(base64 ?? "");
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
            thumbBlob = new Blob([bytes], { type: mime });
            thumbContentType = mime;
            thumbExt = mime === "image/png" ? "png" : "jpg";
          }

          const thumbPath = `${workspace!.id}/thumbnails/${Date.now()}.${thumbExt}`;
          const { error: thumbErr } = await supabase.storage
            .from("workspace-media")
            .upload(thumbPath, thumbBlob, { contentType: thumbContentType, upsert: false });
          if (!thumbErr) {
            const { data: { publicUrl } } = supabase.storage.from("workspace-media").getPublicUrl(thumbPath);
            thumbnailForPublish = { ...thumbnail, uploadedUrl: publicUrl };
            setThumbnail(thumbnailForPublish);
          } else {
            console.warn("[Thumbnail upload failed]", thumbErr.message);
            // Continue publishing without thumbnail — don't block the post
          }
        } catch (thumbError) {
          console.warn("[Thumbnail upload error]", thumbError);
          // Continue publishing without thumbnail
        }
      }

      // If we have an auto-saved draft and user is publishing/scheduling,
      // delete the draft first (the publish creates a new provider-linked post)
      if (draftId && scheduleMode !== "draft") {
        await supabase.from("posts").delete().eq("id", draftId);
        setDraftId(null);
      }

      // ── Automated Story/Segment calculation ──
      let segmentsToSend: { start: number; end: number }[] | undefined = undefined;
      const primaryPlatform = selectedPlatforms[0];
      const primaryFormat = primaryPlatform ? (platformFormats[primaryPlatform] || "post") : "post";
      
      // If posting a video as a story, and it's longer than 15s, create segments
      const mainVideo = mediaFiles.find(f => f.type === "video" && f.uploadStatus === "done");
      if (mainVideo && (primaryFormat === "story" || primaryFormat === "reel") && mainVideo.videoDuration > 15) {
        const duration = mainVideo.videoDuration;
        const segmentLength = 15; // standard story length
        const numSegments = Math.ceil(duration / segmentLength);
        
        segmentsToSend = [];
        for (let i = 0; i < numSegments; i++) {
          segmentsToSend.push({
            start: i * segmentLength,
            end: Math.min((i + 1) * segmentLength, duration)
          });
        }
        console.log(`[Auto-Split] Detected long story video (${duration}s). Created ${segmentsToSend.length} segments.`);
      }

      // ── Check if posting to TikTok and show modal if needed ──
      const hasTiktok = allSelectedPlatforms.includes("tiktok");
      const effectiveTiktokData = overrideTiktokData || tiktokData;
      if (hasTiktok && !effectiveTiktokData && scheduleMode !== "draft") {
        setPendingTiktokSubmit(true);
        setIsTikTokModalOpen(true);
        setIsSubmitting(false);
        return;
      }

      // Build the publish payload
      const publishPayload: PublishPayload = {
        workspaceId: workspace?.id,
        accountIds: selectedAccountIds,
        content: isAllStoryMode ? "" : content,
        channelContent: perChannelMode && Object.keys(channelContent).length > 0 ? channelContent : undefined,
        accountContent: perChannelMode && Object.keys(accountContent).length > 0 ? accountContent : undefined,
        scheduleMode,
        scheduledAt: scheduledDate || undefined,
        scheduledTime: scheduledTime || undefined,
        timezone,
        mediaUrls,
        firstComment: activePanel === "comment" && firstComment.trim() ? firstComment.trim() : undefined,
        platformFormats: Object.keys(platformFormats).length > 0 ? platformFormats : undefined,
        youtubeTitle: youtubeSelected ? youtubeTitle.trim() || undefined : undefined,
        youtubeConfig: youtubeSelected ? {
          privacyStatus: ytPrivacy,
          categoryId: ytCategory,
          tags: ytTags.trim() ? ytTags.split(",").map(t => t.trim()).filter(Boolean) : undefined,
          madeForKids: ytMadeForKids,
        } : undefined,
        tiktokConfig: hasTiktok ? effectiveTiktokData : undefined,
        thumbnail: thumbnailForPublish.type !== "none" ? {
          type: thumbnailForPublish.type,
          frameOffset: thumbnailForPublish.frameOffset,
          uploadedUrl: thumbnailForPublish.uploadedUrl || undefined,
        } : undefined,
        segments: segmentsToSend,
      };

      // Execute publish with manager
      const result = await publishManager.publish(publishPayload);

      if (!result.success) {
        return;
      }

      // Close TikTok modal if it was open
      if (isTikTokModalOpen) {
        setIsTikTokModalOpen(false);
        setTiktokData(null);
      }

      // Reset pending TikTok submit flag
      setPendingTiktokSubmit(false);

      // Cancel any pending auto-save
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);

      // Clean up media resources
      mediaFiles.forEach(f => URL.revokeObjectURL(f.blobUrl));

      // Reset all form state
      setContent("");
      setChannelContent({});
      setAccountContent({});
      setMediaFiles([]);
      setActiveMediaId(null);
      setFirstComment("");
      setShowFirstComment(false);
      setActivePanel("none");
      setYoutubeTitle("");
      setTitleError(false);
      setPerChannelMode(false);
      setYtPrivacy("public");
      setYtCategory("22");
      setYtTags("");
      setYtMadeForKids(false);
      setThumbnail(EMPTY_THUMBNAIL);
      setAiCaptions([]);
      setAiHashtagsByPlatform({});
      setAiTopic("");
      setAiKeywords("");
      setDraftId(null);
      setAutoSaveStatus("idle");
      lastSavedContent.current = "";
      setTiktokData(null);

      // Small delay before redirect for better UX
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Redirect to posts page to show the published/scheduled post
      if (scheduleMode !== "draft") {
        router.push("/posts");
      }
    } catch (err) {
      console.error("[Publish error]", err);
      // Error is already handled by publishManager with toast
      // Just need to make sure modals are closed
      if (isTikTokModalOpen) {
        setIsTikTokModalOpen(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function tbBtn(active: boolean) {
    return cn(
      "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
      active ? "bg-muted/80 text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
    );
  }

  const uploadingCount = mediaFiles.filter(f => f.uploadStatus === "uploading" || f.uploadStatus === "pending").length;

  // Recommended crop based on active preview platform format
  const activePreviewFormat = getFormat(previewPlatform, platformFormats[previewPlatform]);

  // ─── JSX ─────────────────────────────────────────────────────
  const innerContent = (
    <>
      {!isModal && (
        <div className="mb-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <PenSquare className="h-5 w-5 text-foreground" />
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Compose</h1>
                {autoSaveStatus === "saved" && (
                  <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 ml-2">
                    <Check className="h-3 w-3 text-emerald-600" />
                    <span className="text-[11px] font-medium text-emerald-700">Draft saved</span>
                  </div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">Publish to all your platforms in one click.</p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-5 lg:gap-6">
        {/* ══════ LEFT ══════ */}
        <div className="lg:col-span-3 space-y-3 sm:space-y-4">

          {/* ── Account + Format selector ── */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-3 sm:p-4 space-y-3 sm:space-y-4">
            {/* Account chips */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Publish to</p>
                  {/* Desktop: select all toggle */}
                  <button
                    onClick={toggleAllAccounts}
                    className="hidden sm:inline-flex text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors hover:underline underline-offset-4 decoration-current/30"
                  >
                    {selectedAccountIds.length === accounts.length ? "Deselect all" : "Select all"}
                  </button>
                  {/* Mobile: account count + edit trigger */}
                  <button
                    onClick={() => setMobileAccountsExpanded(true)}
                    className="sm:hidden text-[10px] font-semibold text-primary/70 hover:text-primary transition-colors"
                  >
                    {selectedAccountIds.length} selected
                  </button>
                </div>
                {selectedPlatforms.length >= 2 && (
                  <button onClick={togglePerChannel} className="transition-all">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted/40 hover:bg-muted/70 border border-border/40 hover:border-border/60 transition-all duration-200 hover:shadow-sm">
                      <Settings2 className="h-3 w-3 text-muted-foreground/70 hover:text-muted-foreground" />
                      <span className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors">
                        {perChannelMode ? "Content is split" : "Customize per account"}
                      </span>
                    </div>
                  </button>
                )}
              </div>

              {accountsLoading ? (
                /* Loading skeleton */
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-9 w-36 rounded-lg bg-muted/30 animate-pulse" />
                  ))}
                </div>
              ) : accounts.length === 0 ? (
                /* No accounts connected */
                <div className="rounded-lg border border-dashed border-border/50 bg-muted/10 p-4 flex items-center gap-3">
                  <Share2 className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">No accounts connected</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Connect social accounts to start publishing.</p>
                  </div>
                  <a href="/accounts"
                    className="shrink-0 flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90">
                    Connect
                  </a>
                </div>
              ) : (
                <>
                  {/* Account chips — show 8 per row, scroll for rest on desktop */}
                  <div className={cn(
                    "gap-3 hidden sm:flex sm:flex-nowrap sm:overflow-x-auto sm:pb-2 scrollbar-hide"
                  )}>
                  {accounts
                    .filter(a => selectedAccountIds.includes(a.id))
                    .map(account => {
                    const sel = selectedAccountIds.includes(account.id);
                    const meta = PLATFORM_META[account.platform];
                    const PIcon = meta?.icon ?? Globe;
                    const displayName = account.display_name || account.username || account.platform;
                    return (
                      <button
                        key={account.id}
                        onClick={() => toggleAccount(account.id)}
                        className={cn(
                          "relative shrink-0 rounded-2xl p-2.5 transition-all duration-200 flex flex-col items-center gap-1.5 group",
                          sel
                            ? "bg-primary/8 border border-primary/30 shadow-sm hover:shadow-md hover:border-primary/40"
                            : "bg-transparent border border-transparent hover:bg-muted/30 hover:border-border/30"
                        )}
                        title={`Click to ${sel ? "deselect" : "select"} ${displayName}`}
                        aria-label={`${displayName} (@${account.username || account.platform})`}
                      >
                        <div className="relative">
                          {account.profile_picture ? (
                            <img src={account.profile_picture} alt={displayName}
                              className={cn(
                                "h-12 w-12 rounded-full object-cover ring-2 transition-all",
                                sel ? "ring-primary/40" : "ring-border/30 group-hover:ring-border/50"
                              )} />
                          ) : (
                            <div className={cn(
                              "h-12 w-12 rounded-full flex items-center justify-center text-sm font-bold ring-2 transition-all",
                              sel
                                ? "ring-primary/40 bg-primary/15 text-primary"
                                : "ring-border/30 bg-muted text-muted-foreground group-hover:ring-border/50"
                            )}>
                              {displayName.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {/* Platform badge */}
                          <div className={cn(
                            "absolute -bottom-0.5 -right-0.5 h-4.5 w-4.5 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-zinc-950 z-10 transition-transform",
                            meta?.bg || "bg-muted",
                            sel ? "scale-110" : "scale-100"
                          )}>
                            <PIcon className={cn("h-2.5 w-2.5", meta?.color || "text-white")} />
                          </div>
                        </div>
                        {/* Account name */}
                        <span className={cn(
                          "text-xs font-medium text-center leading-tight max-w-[80px] truncate transition-colors",
                          sel ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                        )}>
                          {displayName.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setMobileAccountsExpanded(true)}
                    className="h-14 w-14 rounded-full border-2 border-dashed border-border/50 flex items-center justify-center text-muted-foreground hover:border-foreground/30 hover:text-foreground/50 transition-colors shrink-0"
                    aria-label="Add more channels"
                  >
                    <Plus className="h-6 w-6" />
                  </button>
                  </div>

                  {/* Mobile: compact icon row with horizontal scroll — hidden on sm+ since desktop now uses same layout */}
                  <div className="flex items-center gap-2 sm:hidden overflow-x-auto scrollbar-hide pb-1 mb-3">
                    <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto scrollbar-hide">
                      {accounts
                        .filter(a => selectedAccountIds.includes(a.id))
                        .map(account => {
                          const meta = PLATFORM_META[account.platform];
                          const PIcon = meta?.icon ?? Globe;
                          const displayName = account.display_name || account.username || account.platform;
                          return (
                            <button
                              key={account.id}
                              onClick={() => toggleAccount(account.id)}
                              className={cn(
                                "relative shrink-0 rounded-xl p-1.5 transition-all duration-200 group",
                                "bg-primary/8 border border-primary/30 hover:bg-primary/12 hover:border-primary/40"
                              )}
                              title={`Click to deselect ${displayName}`}
                              aria-label={`Remove ${displayName}`}
                            >
                              {account.profile_picture ? (
                                <img src={account.profile_picture} alt={displayName}
                                  className="h-9 w-9 rounded-full object-cover ring-1.5 ring-primary/40" />
                              ) : (
                                <div className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-bold ring-1.5 ring-primary/40 bg-primary/15 text-primary">
                                  {displayName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full flex items-center justify-center shadow-sm border-2 border-white dark:border-zinc-950 z-10 scale-100 transition-transform",
                                meta?.bg || "bg-muted"
                              )}>
                                <PIcon className={cn("h-2 w-2", meta?.color || "text-white")} />
                              </div>
                            </button>
                          );
                        })
                      }
                    </div>
                    <button
                      onClick={() => setMobileAccountsExpanded(true)}
                      className="h-9 w-9 rounded-full border-2 border-dashed border-border flex items-center justify-center text-muted-foreground hover:border-primary hover:text-primary transition-colors shrink-0"
                      aria-label="Select channels"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Mobile Channel Selector Sheet */}
                  <Sheet open={mobileAccountsExpanded} onOpenChange={setMobileAccountsExpanded}>
                    <SheetContent
                      side="bottom"
                      className="h-[85vh] sm:h-[450px] sm:max-w-xl sm:inset-x-0 sm:mx-auto sm:mb-[10vh] sm:rounded-xl p-0 flex flex-col [&>button]:hidden overflow-hidden border-none shadow-xl"
                    >
                      {/* Header with selection count */}
                      <div className="sticky top-0 flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border/50 shrink-0 bg-card backdrop-blur-md z-20">
                        <button
                          onClick={() => setMobileAccountsExpanded(false)}
                          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors sm:hidden p-1"
                          aria-label="Back"
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </button>
                        <div className="flex items-center gap-2.5">
                          <h2 className="text-base font-bold text-foreground tracking-tight">Select Channels</h2>
                          {selectedAccountIds.length > 0 && (
                            <span className="flex h-6 min-w-[24px] items-center justify-center px-1.5 text-xs font-bold bg-primary text-white rounded-full shadow-md shadow-primary/20">
                              {selectedAccountIds.length}
                            </span>
                          )}
                        </div>
                        <SheetClose asChild>
                          <button className="text-xs font-bold text-foreground hover:text-foreground transition-all px-3 py-1.5 sm:bg-muted/50 sm:px-4 sm:py-2 sm:rounded-lg hover:sm:bg-muted rounded">
                            Done
                          </button>
                        </SheetClose>
                      </div>


                      {/* Select All / Clear All Button */}
                      {filteredAccounts.length > 0 && (
                        <div className="sticky top-[53px] px-4 sm:px-6 py-2 shrink-0 flex justify-end bg-muted/30 border-b border-border/20 z-20">
                          <button
                            onClick={() => {
                              if (selectedAccountIds.length === filteredAccounts.length) {
                                // Clear all filtered
                                setSelectedAccountIds(prev => prev.filter(id => !filteredAccounts.map(a => a.id).includes(id)));
                              } else {
                                // Select all filtered
                                const newIds = new Set(selectedAccountIds);
                                filteredAccounts.forEach(a => newIds.add(a.id));
                                setSelectedAccountIds(Array.from(newIds));
                              }
                            }}
                            className="text-xs font-semibold text-foreground hover:text-foreground transition-colors flex items-center gap-1.5 px-3 py-1 rounded-full hover:bg-muted/50"
                          >
                            {selectedAccountIds.length === filteredAccounts.length && filteredAccounts.length > 0 ? (
                              <>
                                <X className="h-3.5 w-3.5" />
                                <span>Clear all</span>
                              </>
                            ) : (
                              <>
                                <Plus className="h-3.5 w-3.5" />
                                <span>Select all</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Account List */}
                      <div className="flex-1 overflow-y-auto bg-card scrollbar-thin scrollbar-thumb-border">
                        {filteredAccounts.length === 0 ? (
                          <div className="flex flex-col items-center justify-center min-h-[320px] text-center px-6 py-12 bg-gradient-to-b from-card to-muted/30">
                            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-muted/80 to-muted flex items-center justify-center mb-5 shadow-sm">
                              <Search className="h-10 w-10 text-muted-foreground/40" />
                            </div>
                            <h3 className="text-base font-bold text-foreground mb-2">No channels found</h3>
                            <p className="text-sm text-muted-foreground/70 max-w-xs leading-relaxed">
                              Connect social media accounts in your workspace settings to start publishing.
                            </p>
                          </div>
                        ) : (
                          <div className="flex flex-col divide-y divide-border/30">
                            {filteredAccounts.map(account => {
                              const sel = selectedAccountIds.includes(account.id);
                              const meta = PLATFORM_META[account.platform];
                              const PIcon = meta?.icon ?? Globe;
                              const displayName = account.display_name || account.username || account.platform;
                              const accountType = PLATFORM_META[account.platform]?.label || account.platform;
                              return (
                                <button
                                  key={account.id}
                                  onClick={() => toggleAccount(account.id)}
                                  className={cn(
                                    "flex items-center gap-3 px-4 py-2.5 transition-all duration-200 text-left",
                                    sel
                                      ? "bg-muted/50 border-l-3 border-primary hover:bg-muted"
                                      : "bg-card hover:bg-muted/50"
                                  )}
                                >
                                  {/* Checkbox */}
                                  <div className={cn(
                                    "h-5 w-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 flex-shrink-0",
                                    sel
                                      ? "bg-primary text-white shadow-md shadow-slate-700/30"
                                      : "border-2 border-primary/50 bg-card hover:border-primary"
                                  )}>
                                    {sel && <Check className="h-3 w-3" strokeWidth={3} />}
                                  </div>

                                  {/* Profile Picture */}
                                  <div className="relative shrink-0">
                                    {account.profile_picture ? (
                                      <img
                                        src={account.profile_picture}
                                        alt={displayName}
                                        className={cn(
                                          "h-10 w-10 rounded-full object-cover border transition-all",
                                          sel ? "border-primary ring-1.5 ring-primary/30" : "border-border/50"
                                        )}
                                      />
                                    ) : (
                                      <div className={cn(
                                        "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold border transition-all",
                                        sel ? "border-slate-400 bg-muted text-foreground" : "border-border/50 bg-muted/70 text-muted-foreground"
                                      )}>
                                        {displayName.charAt(0).toUpperCase()}
                                      </div>
                                    )}
                                    {/* Platform Badge */}
                                    <div className={cn(
                                      "absolute -bottom-1 -right-1 h-5 w-5 rounded-full flex items-center justify-center shadow-sm border-1.5 border-white z-10",
                                      meta?.bg || "bg-slate-300"
                                    )}>
                                      <PIcon className={cn("h-2.5 w-2.5", meta?.color || "text-white")} />
                                    </div>
                                  </div>

                                  {/* Channel Info */}
                                  <div className="flex-1 min-w-0">
                                    <p className={cn(
                                      "text-sm font-semibold truncate transition-colors",
                                      sel ? "text-foreground" : "text-foreground"
                                    )}>{displayName}</p>
                                    <span className={cn(
                                      "text-[11px] font-semibold uppercase tracking-wide inline-flex items-center gap-1 mt-0.5",
                                      sel
                                        ? "text-muted-foreground/70"
                                        : "text-muted-foreground/60"
                                    )}>
                                      <PIcon className="h-2.5 w-2.5" />
                                      {accountType}
                                    </span>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </SheetContent>
                  </Sheet>
                </>
              )}
            </div>

            {/* Format selector per selected platform */}
            {selectedPlatforms.length > 0 && (
              <div className="border-t border-gray-200/50 pt-3 space-y-2.5">
                <button
                  onClick={() => setPostFormatExpanded(!postFormatExpanded)}
                  className="w-full flex items-center justify-between group hover:opacity-80 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Post format</p>
                    {activeMedia && activeMedia.naturalWidth > 0 && (
                      <div className="flex items-center gap-1 text-[10px] text-primary font-medium bg-primary/10 px-1.5 py-0.5 rounded-full border border-primary/20">
                        <Sparkles className="h-2.5 w-2.5" />
                        Auto-detected
                      </div>
                    )}
                  </div>
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", postFormatExpanded ? "rotate-180" : "")} />
                </button>

                {postFormatExpanded && selectedPlatforms.map(platformId => {
                  const p = PLATFORMS.find(pl => pl.id === platformId)!;
                  const formats = PLATFORM_FORMATS[platformId];
                  const activeFormatId = platformFormats[platformId] ?? formats[0]?.id;
                  const activeFmt = formats.find(f => f.id === activeFormatId) || formats[0]!;

                  // Get unique categories for this platform (Post, Reel, Story, etc.)
                  const categories = Array.from(new Set(formats.map(f => f.category)));

                  return (
                    <div key={platformId} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <div className="flex items-center gap-1.5 w-24 sm:w-24 shrink-0">
                        <p.icon className={cn("h-3.5 w-3.5 shrink-0", p.color)} />
                        <span className="text-xs text-muted-foreground truncate">{p.label.split(" ")[0]}</span>
                      </div>

                      <div className="flex sm:flex-wrap gap-1.5 overflow-x-auto scrollbar-hide pb-1 sm:pb-0">
                        {categories.map(cat => {
                          const isActive = activeFmt.category === cat;
                          // If current media matches this category, use that specific ID. 
                          // If not, find the default/best match for this category.
                          const bestMatchId = findBestFormat(
                            activeMedia?.naturalWidth || 0,
                            activeMedia?.naturalHeight || 0,
                            formats,
                            cat
                          ) || formats.find(f => f.category === cat)?.id;

                          return (
                            <button
                              key={cat}
                              onClick={() => bestMatchId && setFormatForPlatform(platformId, bestMatchId)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all relative overflow-hidden",
                                isActive
                                  ? "border-primary bg-primary text-white shadow-sm"
                                  : "border-border bg-card text-muted-foreground hover:border-border/80"
                              )}
                            >
                              <FormatIcon type={cat} className="h-3.5 w-3.5 shrink-0" />
                              <span className="capitalize">{cat}</span>
                              {isActive && activeMedia && activeMedia.naturalWidth > 0 && (
                                <div className="absolute top-0 right-0 p-0.5">
                                  <Sparkles className="h-2 w-2 text-foreground" />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      {/* Display summary of chosen format's ratio/size */}
                      {activeMedia && activeMedia.naturalWidth > 0 && (
                        <div className="hidden sm:block ml-auto text-[10px] font-mono text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded border border-border/20">
                          {activeFmt.aspect.replace(" / ", ":")}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>


          {/* ── Content editor ── */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
            {/* Per-account tabs */}
            {perChannelMode && (
              <div className="flex items-center gap-0.5 px-2 sm:px-3 pt-1.5 sm:pt-2 border-b border-border/50 overflow-x-auto">
                {(accounts ?? [])
                  .filter(a => selectedAccountIds.includes(a.id))
                  .map(account => {
                    const PlatformIcon = PLATFORMS.find(p => p.id === account.platform)?.icon;
                    const isCustomized = accountContent[account.id] !== undefined && accountContent[account.id] !== content;
                    return (
                      <button
                        key={account.id}
                        onClick={() => setActiveEditTab(account.id)}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium shrink-0 transition-all border-b-2 -mb-px",
                          activeEditTab === account.id
                            ? "border-foreground text-foreground bg-muted/30"
                            : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20"
                        )}
                      >
                        {/* Account avatar */}
                        <div className="h-5 w-5 rounded-full overflow-hidden bg-muted shrink-0 flex items-center justify-center">
                          {account.profile_picture ? (
                            <img src={account.profile_picture} alt={account.username} className="h-full w-full object-cover" />
                          ) : (
                            PlatformIcon && <PlatformIcon className="h-3 w-3" />
                          )}
                        </div>
                        {/* Account username */}
                        <span className="truncate max-w-[120px]">{account.username || account.display_name}</span>
                        {isCustomized && <span className="h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" title="Customized" />}
                      </button>
                    );
                  })}
              </div>
            )}

            {isAllStoryMode ? (
              /* Stories don't need captions — show media-only message */
              <div className="flex flex-col items-center justify-center min-h-[120px] sm:min-h-[180px] p-4 sm:p-6 text-center">
                <ImageIcon className="h-6 sm:h-8 w-6 sm:w-8 text-muted-foreground/50 mb-1.5 sm:mb-2" />
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Stories are media-only</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground/70 mt-0.5 sm:mt-1">Add an image or video below to publish.</p>
              </div>
            ) : (
              <>
                <Textarea
                  placeholder={
                    perChannelMode
                      ? `Customize content for ${PLATFORMS.find(p => p.id === activeEditTab)?.label}…`
                      : "What's on your mind? Write your post here…"
                  }
                  value={currentEditContent}
                  onChange={e => setCurrentContent(e.target.value)}
                  className="min-h-[140px] sm:min-h-[180px] resize-none border-0 bg-transparent text-base leading-relaxed placeholder:text-gray-400 focus-visible:ring-0 p-3 sm:p-4"
                />

                {/* Char & hashtag indicators with progress bars */}
                <div className="px-3 sm:px-4 pb-2 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-3">
                    {selectedPlatforms.map(id => {
                      const p = PLATFORMS.find(pl => pl.id === id)!;
                      const { remaining, isOver, isNear, length, limit } = charInfo(id);
                      const ht = hashtagInfo(id);
                      const pct = Math.min(100, (length / limit) * 100);
                      return (
                        <div key={id} className="flex items-center gap-1.5">
                          <p.icon className={cn("h-3 w-3", p.color)} />
                          <div className="w-16 h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div className={cn("h-full rounded-full transition-all duration-300",
                              isOver ? "bg-red-500" : isNear ? "bg-yellow-500" : "bg-primary/60"
                            )} style={{ width: `${pct}%` }} />
                          </div>
                          <span className={cn("text-[10px] font-mono font-medium tabular-nums",
                            isOver ? "text-red-500" : isNear ? "text-yellow-500" : "text-muted-foreground"
                          )}>
                            {remaining}
                            {isOver && <AlertCircle className="h-2.5 w-2.5 inline ml-0.5" />}
                          </span>
                          {ht.count > 0 && (
                            <span className={cn("text-[10px] font-mono font-medium tabular-nums",
                              ht.isOver ? "text-red-500" : "text-muted-foreground"
                            )}>
                              #{ht.count}/{ht.limit}
                              {ht.isOver && <AlertCircle className="h-2.5 w-2.5 inline ml-0.5" />}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {perChannelMode && channelContent[activeEditTab] !== undefined && (
                      <button
                        onClick={() => setChannelContent(prev => { const n = { ...prev }; delete n[activeEditTab]; return n; })}
                        className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                      >
                        ↩ Reset to shared
                      </button>
                    )}
                  </div>
                  {/* Over-limit warning */}
                  {selectedPlatforms.some(id => charInfo(id).isOver) && (
                    <div className="flex items-center gap-1.5 rounded-md bg-red-500/10 border border-red-500/20 px-2.5 py-1.5">
                      <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />
                      <p className="text-[11px] text-red-500 font-medium">
                        Content exceeds character limit for: {selectedPlatforms.filter(id => charInfo(id).isOver).map(id => PLATFORMS.find(p => p.id === id)?.label.split(" ")[0]).join(", ")}
                      </p>
                    </div>
                  )}
                  {/* Hashtag over-limit warning */}
                  {selectedPlatforms.some(id => hashtagInfo(id).isOver) && (
                    <div className="flex items-center gap-1.5 rounded-md bg-orange-500/10 border border-orange-500/20 px-2.5 py-1.5">
                      <AlertCircle className="h-3 w-3 text-orange-500 shrink-0" />
                      <p className="text-[11px] text-orange-500 font-medium">
                        Too many hashtags for: {selectedPlatforms.filter(id => hashtagInfo(id).isOver).map(id => {
                          const ht = hashtagInfo(id);
                          return `${PLATFORMS.find(p => p.id === id)?.label.split(" ")[0]} (${ht.count}/${ht.limit})`;
                        }).join(", ")}
                      </p>
                    </div>
                  )}
                </div>

                {/* First comment */}
                {activePanel === "comment" && (
                  <div className="border-t border-border/40 px-4 pb-3 pt-2">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-xs font-medium text-muted-foreground">First comment</p>
                      <button onClick={() => setShowFirstComment(false)} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Textarea
                      placeholder="Add a first comment (great for hashtags on Instagram)…"
                      value={firstComment}
                      onChange={e => setFirstComment(e.target.value)}
                      className="min-h-[80px] resize-none border border-border/50 bg-muted/40 text-sm focus-visible:ring-1 focus-visible:ring-primary/30"
                    />
                  </div>
                )}
              </>
            )}

            {/* Toolbar */}
            <div className="flex items-center border-t border-gray-200/50 px-2 sm:px-3 py-1.5 sm:py-2 gap-0.5 flex-wrap">
              {!isAllStoryMode && (
                <>
                  <button onClick={() => setActivePanel(p => p === "ai" ? "none" : "ai")} className={tbBtn(activePanel === "ai")}>
                    <Sparkles className="h-3.5 w-3.5" /> AI Write
                  </button>
                </>
              )}
              <button onClick={() => setActivePanel(p => p === "media" ? "none" : "media")} className={tbBtn(activePanel === "media" || mediaFiles.length > 0)}>
                <ImageIcon className="h-3.5 w-3.5" />
                Media{mediaFiles.length > 0 ? ` (${mediaFiles.length})` : ""}
                {uploadingCount > 0 && <Loader2 className="h-3 w-3 animate-spin ml-0.5" />}
              </button>
              {!isAllStoryMode && (
                <>
                  <button onClick={() => setActivePanel(p => p === "hashtags" ? "none" : "hashtags")} className={tbBtn(activePanel === "hashtags")}>
                    <Hash className="h-3.5 w-3.5" /> Tags
                  </button>
                  <button onClick={() => setActivePanel(p => p === "emojis" ? "none" : "emojis")} className={tbBtn(activePanel === "emojis")}>
                    <Smile className="h-3.5 w-3.5" /> Emoji
                  </button>
                  <button onClick={() => setActivePanel(p => p === "comment" ? "none" : "comment")} className={tbBtn(activePanel === "comment")}>
                    <MessageCircle className="h-3.5 w-3.5" /> Comment
                  </button>
                </>
              )}
            </div>

            {/* Mobile sticky bottom toolbar - hidden in favor of top toolbar on mobile */}
            <div className="hidden z-40 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg pb-safe">
              <div className="flex items-center justify-around px-2 py-2 gap-0.5">
                {!isAllStoryMode && (
                  <>
                    <button onClick={() => setActivePanel(p => p === "ai" ? "none" : "ai")} className={cn(
                      "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all",
                      activePanel === "ai" ? "bg-violet-50 text-violet-700" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}>
                      <Sparkles className="h-4 w-4" />
                      <span className="text-[10px] font-medium">AI</span>
                    </button>
                  </>
                )}
                <button onClick={() => setActivePanel(p => p === "media" ? "none" : "media")} className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all",
                  activePanel === "media" || mediaFiles.length > 0 ? "bg-violet-50 text-violet-700" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}>
                  <ImageIcon className="h-4 w-4" />
                  <span className="text-[10px] font-medium">Media</span>
                </button>
                {!isAllStoryMode && (
                  <>
                    <button onClick={() => setActivePanel(p => p === "hashtags" ? "none" : "hashtags")} className={cn(
                      "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all",
                      activePanel === "hashtags" ? "bg-violet-50 text-violet-700" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}>
                      <Hash className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Tags</span>
                    </button>
                    <button onClick={() => setActivePanel(p => p === "emojis" ? "none" : "emojis")} className={cn(
                      "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all",
                      activePanel === "emojis" ? "bg-violet-50 text-violet-700" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}>
                      <Smile className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Emoji</span>
                    </button>
                    <button onClick={() => setActivePanel(p => p === "comment" ? "none" : "comment")} className={cn(
                      "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-all",
                      activePanel === "comment" ? "bg-violet-50 text-violet-700" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    )}>
                      <MessageCircle className="h-4 w-4" />
                      <span className="text-[10px] font-medium">Comment</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
            multiple className="hidden"
            onChange={e => { handleFileSelect(e.target.files); e.target.value = ""; }}
          />

          {/* ── Media section ── */}
          {mediaFiles.length > 0 ? (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 space-y-4 mb-16 lg:mb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Media ({mediaFiles.length})</p>
                  {uploadingCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Uploading {uploadingCount}…
                    </span>
                  )}
                </div>
                <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" /> Add more
                </button>
              </div>

              {/* Thumbnails — drag to reorder */}
              <div className="flex gap-2 overflow-x-auto pb-1">
                {mediaFiles.map(f => (
                  <FileThumbnail
                    key={f.id} f={f}
                    isActive={activeMediaId === f.id}
                    isDragOver={dragOverId === f.id}
                    onClick={() => setActiveMediaId(f.id === activeMediaId ? null : f.id)}
                    onRemove={() => removeMedia(f.id)}
                    onDragStart={() => { dragItemRef.current = f.id; }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverId(f.id); }}
                    onDragEnd={() => { dragItemRef.current = null; setDragOverId(null); }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragItemRef.current) reorderMedia(dragItemRef.current, f.id);
                      dragItemRef.current = null;
                      setDragOverId(null);
                    }}
                  />
                ))}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="shrink-0 h-16 w-16 rounded-lg border-2 border-dashed border-border/60 flex items-center justify-center text-muted-foreground hover:border-primary/50 hover:text-foreground"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>

              {/* Active media panel */}
              {activeMedia && (
                <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-4">
                  {/* File header */}
                  <div className="flex items-center gap-2">
                    {activeMedia.type === "image" ? <ImageIcon className="h-4 w-4 text-muted-foreground shrink-0" /> : <Film className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <p className="text-xs font-medium text-foreground truncate flex-1">{activeMedia.file.name}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{(activeMedia.file.size / 1024 / 1024).toFixed(1)} MB</span>
                    {activeMedia.uploadStatus === "uploading" && (
                      <span className="flex items-center gap-1 text-xs text-primary shrink-0">
                        <Loader2 className="h-3 w-3 animate-spin" />{activeMedia.uploadProgress}%
                      </span>
                    )}
                    {activeMedia.uploadStatus === "done" && (
                      <span className="flex items-center gap-1 text-xs text-green-500 shrink-0">
                        <Check className="h-3 w-3" /> Uploaded
                      </span>
                    )}
                    {activeMedia.uploadStatus === "error" && (
                      <button onClick={() => retryUpload(activeMedia.id)} className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300 shrink-0">
                        <RotateCcw className="h-3 w-3" /> Retry
                      </button>
                    )}
                    <button onClick={() => removeMedia(activeMedia.id)} className="text-muted-foreground hover:text-destructive ml-1 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  {activeMedia.uploadStatus === "uploading" && (
                    <div>
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Uploading…</span><span>{activeMedia.uploadProgress}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full transition-all duration-200" style={{ width: `${activeMedia.uploadProgress}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {activeMedia.uploadStatus === "error" && (
                    <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
                      <p className="text-xs text-red-400">{activeMedia.errorMessage || "Upload failed"}</p>
                    </div>
                  )}


                  {/* Recommended size hint */}
                  <div className="rounded-lg bg-muted/20 border border-border/30 px-3 py-2 flex items-start gap-2">
                    <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Recommended size for {PLATFORMS.find(p => p.id === previewPlatform)?.label} {activePreviewFormat.label}:</span>
                        {" "}{activePreviewFormat.size} · aspect {activePreviewFormat.aspect.replace(" / ", ":")}
                      </p>
                      {activePreviewFormat.maxDurationSec && activeMedia.type === "video" && (
                        <p className="text-xs text-amber-500">⚠ Max duration: {activePreviewFormat.maxDurationSec}s for {activePreviewFormat.label}</p>
                      )}
                    </div>
                  </div>

                  {/* Image: crop */}
                  {activeMedia.type === "image" && (
                    <>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-medium text-muted-foreground">Crop aspect ratio</p>
                          {/* Quick-set from format */}
                          <button
                            onClick={() => {
                              const match = CROP_RATIOS.find(r => r.aspect === activePreviewFormat.aspect);
                              if (match) updateMedia(activeMedia.id, { cropRatio: match.id });
                            }}
                            className="text-[10px] text-primary hover:underline"
                          >
                            Apply {activePreviewFormat.label} ratio ({activePreviewFormat.aspect.replace(" / ", ":")})
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {CROP_RATIOS.map(r => (
                            <button
                              key={r.id}
                              onClick={() => updateMedia(activeMedia.id, { cropRatio: r.id })}
                              className={cn(
                                "rounded-lg border px-2.5 py-1 text-xs font-medium transition-all",
                                activeMedia.cropRatio === r.id
                                  ? "border-border bg-muted/60 text-foreground"
                                  : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                              )}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">Alt text (accessibility)</label>
                        <input
                          value={activeMedia.altText}
                          onChange={e => updateMedia(activeMedia.id, { altText: e.target.value })}
                          placeholder="Describe the image for screen readers…"
                          className="w-full h-9 rounded-lg border border-border/60 bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                      </div>
                    </>
                  )}

                  {/* Video: trim controls (preview shown on right side) */}
                  {activeMedia.type === "video" && (
                    <>
                      {/* Visual trimmer with draggable handles */}
                      <VideoTrimmer
                        src={activeMedia.blobUrl}
                        duration={activeMedia.videoDuration || 60}
                        trimStart={activeMedia.trimStart}
                        trimEnd={activeMedia.trimEnd}
                        maxDuration={activePreviewFormat.maxDurationSec}
                        onTrimChange={(start, end) => updateMedia(activeMedia.id, { trimStart: start, trimEnd: end })}
                      />
                    </>
                  )}
                </div>
              )}

              {/* Drop zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
                className="rounded-lg border-2 border-dashed border-border/50 p-3 flex items-center gap-3 cursor-pointer hover:border-primary/40 hover:bg-muted/10 transition-all"
              >
                <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Drop files or click to browse · JPG, PNG, GIF, WebP, MP4, MOV, WebM</p>
                  {selectedPlatforms.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      Limits: {selectedPlatforms.map(pid => {
                        const l = PLATFORM_FILE_LIMITS[pid];
                        return l ? `${l.label} ≤${formatFileSize(l.imageMax)} img / ${formatFileSize(l.videoMax)} vid` : null;
                      }).filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : activePanel === "media" ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFileSelect(e.dataTransfer.files); }}
              className="rounded-2xl border-2 border-dashed border-border/50 p-3 sm:p-5 flex flex-col sm:flex-row items-center gap-2 sm:gap-3 cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-all mb-16 lg:mb-0"
            >
              <div className="flex h-9 sm:h-10 w-9 sm:w-10 shrink-0 items-center justify-center rounded-lg bg-muted/40">
                <Upload className="h-4 sm:h-5 w-4 sm:w-5 text-muted-foreground" />
              </div>
              <div className="text-center sm:text-left flex-1">
                <p className="text-xs sm:text-sm font-medium text-foreground">Add photos or videos</p>
                <p className="text-[11px] sm:text-xs text-muted-foreground">Click to select · JPG, PNG, GIF, WebP, MP4, MOV, WebM</p>
                {selectedPlatforms.length > 0 && (
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                    {selectedPlatforms.map(pid => {
                      const l = PLATFORM_FILE_LIMITS[pid];
                      return l ? `${l.label}: ≤${formatFileSize(l.imageMax)} img, ${formatFileSize(l.videoMax)} vid` : null;
                    }).filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
            </div>
          ) : null}

          {/* ── AI Panel ── */}
          {activePanel === "ai" && (
            <div className="rounded-2xl border border-border/50 dark:border-slate-700 bg-gradient-to-br from-slate-50 dark:from-slate-900 to-transparent p-4 space-y-4 mb-16 lg:mb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800">
                    <Sparkles className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">AI Caption Generator</p>
                </div>
                <button onClick={() => setActivePanel("none")} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
              </div>

              {/* Generate new caption */}
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">What&apos;s your post about?</label>
                  <input
                    value={aiTopic}
                    onChange={e => setAiTopic(e.target.value)}
                    placeholder="e.g. Launching our new product, Tips for growing on social media…"
                    className="w-full h-9 rounded-lg border border-border/60 bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Keywords (optional)</label>
                  <input
                    value={aiKeywords}
                    onChange={e => setAiKeywords(e.target.value)}
                    placeholder="e.g. SaaS, productivity, free trial…"
                    className="w-full h-9 rounded-lg border border-border/60 bg-background/60 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tone</label>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_TONES.map(t => (
                      <button key={t.id} onClick={() => setAiTone(t.id)}
                        className={cn("flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-all",
                          aiTone === t.id
                            ? "border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 text-foreground dark:text-white"
                            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                        )}>
                        <span>{t.emoji}</span> {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleGenerateCaptions}
                  disabled={isGeneratingCaptions}
                  className="w-full h-9 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-foreground text-sm font-medium gap-2"
                >
                  {isGeneratingCaptions
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating…</>
                    : <><Wand2 className="h-3.5 w-3.5" /> Generate Captions</>
                  }
                </Button>
              </div>

              {/* Generated captions */}
              {aiCaptions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Pick a caption — applies to all platforms</p>
                    {youtubeSelected && <span className="text-[10px] text-red-400 flex items-center gap-0.5"><Youtube className="h-3 w-3" /> + auto title</span>}
                  </div>
                  {aiCaptions.map((caption, i) => (
                    <button key={i} onClick={() => applyCaption(caption)}
                      className="group w-full text-left rounded-lg border border-border/40 bg-card/60 hover:border-slate-300 dark:hover:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-800 px-3 py-2.5 text-sm text-foreground transition-all relative">
                      <p className="pr-8">{caption}</p>
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-slate-200 dark:bg-slate-700 text-muted-foreground/70 dark:text-muted-foreground/40">
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                      {/* Per-platform char fit indicators */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {selectedPlatforms.map(pid => {
                          const p = PLATFORMS.find(pl => pl.id === pid)!;
                          const fits = caption.length <= p.limit;
                          return (
                            <span key={pid} className={cn("inline-flex items-center gap-0.5 text-[10px] font-mono", fits ? "text-green-500" : "text-red-500")}>
                              <p.icon className="h-2.5 w-2.5" />
                              {fits ? <Check className="h-2.5 w-2.5" /> : <X className="h-2.5 w-2.5" />}
                              {caption.length}/{p.limit}
                            </span>
                          );
                        })}
                      </div>
                    </button>
                  ))}
                  <div className="flex items-center gap-3">
                    <button onClick={handleGenerateCaptions} disabled={isGeneratingCaptions}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
                      <RefreshCw className={cn("h-3 w-3", isGeneratingCaptions && "animate-spin")} /> Regenerate
                    </button>
                    <p className="text-[10px] text-muted-foreground/50">You can always edit the caption after selecting</p>
                  </div>
                </div>
              )}

              {/* Rewrite existing content */}
              {currentEditContent.trim().length > 0 && (
                <div className="border-t border-border/40 pt-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold text-foreground">Rewrite Current Content</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {AI_TONES.map(t => (
                      <button key={t.id} onClick={() => setRewriteTone(t.id)}
                        className={cn("flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-all",
                          rewriteTone === t.id
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border/60 text-muted-foreground hover:border-border hover:text-foreground"
                        )}>
                        {t.emoji} {t.label}
                      </button>
                    ))}
                  </div>
                  <Button
                    onClick={handleRewriteContent}
                    disabled={isRewriting}
                    variant="outline"
                    className="w-full h-8 text-xs gap-2"
                  >
                    {isRewriting
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Rewriting…</>
                      : <><RefreshCw className="h-3 w-3" /> Rewrite as {AI_TONES.find(t => t.id === rewriteTone)?.label}</>
                    }
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Hashtag Panel ── */}
          {activePanel === "hashtags" && (
            <div className="rounded-2xl border border-border/50 dark:border-slate-700 bg-gradient-to-br from-slate-50 dark:from-slate-900 to-transparent p-4 space-y-3 mb-16 lg:mb-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-800">
                    <Hash className="h-4 w-4 text-muted-foreground/70 dark:text-muted-foreground/40" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">AI Hashtags</p>
                </div>
                <button onClick={() => setActivePanel("none")} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
              </div>

              {/* Platform optimal counts info */}
              <div className="flex flex-wrap gap-1.5">
                {selectedPlatforms.map(pid => {
                  const p = PLATFORMS.find(pl => pl.id === pid)!;
                  const counts: Record<string, number> = { twitter: 1, linkedin: 3, instagram: 15, tiktok: 4, facebook: 2, youtube: 5 };
                  return (
                    <span key={pid} className="inline-flex items-center gap-1 rounded-full bg-muted/30 border border-border/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      <p.icon className={cn("h-2.5 w-2.5", p.color)} />
                      {counts[pid] ?? 5} tags
                    </span>
                  );
                })}
              </div>

              {/* Generate button */}
              <Button
                onClick={handleGenerateHashtags}
                disabled={isGeneratingHashtags || !content.trim()}
                className="w-full h-9 bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-foreground text-sm font-medium gap-2"
              >
                {isGeneratingHashtags
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generating for {selectedPlatforms.length} platform{selectedPlatforms.length > 1 ? "s" : ""}…</>
                  : <><Sparkles className="h-3.5 w-3.5" /> Generate Hashtags for All Platforms</>
                }
              </Button>

              {!content.trim() && (
                <p className="text-xs text-muted-foreground/60 italic">Write your caption first — hashtags are generated from your content.</p>
              )}

              {/* Generated hashtags — per platform tabs */}
              {Object.keys(aiHashtagsByPlatform).length > 0 && (
                <div className="space-y-2.5">
                  {/* Platform tabs */}
                  <div className="flex items-center gap-1 overflow-x-auto border-b border-border/30 pb-1">
                    {Object.keys(aiHashtagsByPlatform).map(pid => {
                      const p = PLATFORMS.find(pl => pl.id === pid);
                      if (!p) return null;
                      const count = aiHashtagsByPlatform[pid]?.length ?? 0;
                      const htLimit = p.hashtagLimit;
                      return (
                        <button key={pid} onClick={() => setHashtagViewPlatform(pid as PlatformId)}
                          className={cn("flex items-center gap-1.5 px-2.5 py-1.5 rounded-t-lg text-xs font-medium shrink-0 transition-all border-b-2 -mb-px",
                            hashtagViewPlatform === pid
                              ? "border-slate-900 dark:border-white text-foreground bg-slate-100 dark:bg-slate-800"
                              : "border-transparent text-muted-foreground hover:text-foreground"
                          )}>
                          <p.icon className={cn("h-3 w-3", p.color)} />
                          {p.label.split(" ")[0]}
                          <span className={cn("text-[10px]", count > htLimit ? "text-red-500 font-bold" : "opacity-60")}>{count}/{htLimit}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Hashtags for selected platform */}
                  {(() => {
                    const tags = aiHashtagsByPlatform[hashtagViewPlatform] ?? [];
                    return tags.length > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Click to add individually</p>
                          <button onClick={() => insertHashtagsForPlatform(hashtagViewPlatform)}
                            className="flex items-center gap-1 rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 px-2.5 py-1 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors">
                            <Plus className="h-3 w-3" /> Add {tags.length} Tags
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {tags.map(tag => (
                            <button key={tag} onClick={() => addHashtag(tag)}
                              className="rounded-full border border-slate-300 dark:border-slate-600 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 hover:border-slate-400 dark:hover:border-slate-500 px-3 py-1.5 text-xs font-medium text-foreground transition-all">
                              {tag}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">No hashtags for this platform</p>
                    );
                  })()}

                  {/* Actions */}
                  <div className="flex items-center gap-3 border-t border-border/30 pt-2">
                    {perChannelMode && Object.keys(aiHashtagsByPlatform).length > 1 && (
                      <button onClick={insertAllPlatformHashtags}
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium">
                        <Plus className="h-3 w-3" /> Add All to Each Channel
                      </button>
                    )}
                    <button onClick={handleGenerateHashtags} disabled={isGeneratingHashtags}
                      className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium ml-auto">
                      <RefreshCw className={cn("h-3 w-3", isGeneratingHashtags && "animate-spin")} /> Regenerate
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Emoji Panel ── */}
          {activePanel === "emojis" && (
            <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 mb-16 lg:mb-0">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-foreground">Emojis</p>
                <button onClick={() => setActivePanel("none")} className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"><X className="h-4 w-4" /></button>
              </div>
              <div className="space-y-3">
                {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
                  <div key={group}>
                    <p className="text-xs font-medium text-muted-foreground mb-1.5">{group}</p>
                    <div className="flex flex-wrap gap-0.5">
                      {emojis.map(emoji => (
                        <button key={emoji} onClick={() => addEmoji(emoji)}
                          className="h-8 w-8 flex items-center justify-center rounded-lg text-base hover:bg-muted/60">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── YouTube sections (Title, Settings, Thumbnail) ── */}
          {needsYoutubeTitle && (
            <div className="space-y-4 mb-16 lg:mb-0">
              {/* YouTube title card */}
              <div className={cn(
                "rounded-2xl border bg-card p-4 shadow-sm",
                titleError && !youtubeTitle.trim()
                  ? "border-destructive/40 bg-destructive/5"
                  : "border-border/50 bg-card"
              )}>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <Youtube className="h-4 w-4 text-foreground/70 shrink-0" />
                    <span className="text-sm font-semibold text-foreground">YouTube Title</span>
                    <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/70 uppercase tracking-wide">
                      Required
                    </span>
                    {youtubeFormat.id === "short" && (
                      <span className="rounded-full bg-foreground/5 border border-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/60">
                        Shorts
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xs font-mono",
                    youtubeTitle.length > 90 ? "text-foreground/60" : youtubeTitle.length > 70 ? "text-foreground/50" : "text-muted-foreground"
                  )}>
                    {youtubeTitle.length}/100
                  </span>
                </div>

                <div className="relative">
                  <input
                    type="text"
                    maxLength={100}
                    value={youtubeTitle}
                    onChange={e => { setYoutubeTitle(e.target.value); if (e.target.value.trim()) setTitleError(false); }}
                    placeholder="e.g. How I Built a Million-Dollar Brand in 60 Seconds"
                    className={cn(
                      "w-full h-10 rounded-lg border bg-background/80 px-3 pr-28 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 hover:border-border/70 transition-all",
                      titleError && !youtubeTitle.trim()
                        ? "border-destructive/60 ring-1 ring-destructive/30"
                        : "border-border/50"
                    )}
                  />
                  <button
                    type="button"
                    onClick={handleGenerateTitle}
                    disabled={isGeneratingTitle}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5 rounded-md bg-foreground/10 hover:bg-foreground/15 disabled:opacity-60 px-2.5 py-1 text-xs font-medium text-foreground/70 transition-colors"
                  >
                    {isGeneratingTitle
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Generating…</>
                      : <><Sparkles className="h-3 w-3" /> AI Generate</>
                    }
                  </button>
                </div>

                {titleError && !youtubeTitle.trim() && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-rose-500">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    A title is required for YouTube. Click &ldquo;AI Generate&rdquo; or type one above.
                  </p>
                )}
                {!titleError && youtubeTitle.trim() && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-green-500">
                    <Check className="h-3 w-3 shrink-0" />
                    Title looks good!
                  </p>
                )}
                {!youtubeTitle.trim() && !titleError && (
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Leave blank and click &ldquo;AI Generate&rdquo; — we&apos;ll create one from your content automatically.
                  </p>
                )}
              </div>

              {/* YouTube settings panel */}
              <div className="rounded-2xl border border-border/50 bg-card p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4 text-foreground/70 shrink-0" />
                  <span className="text-sm font-semibold text-foreground">YouTube Settings</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-foreground/80 mb-2 block">Privacy</label>
                    <select
                      value={ytPrivacy}
                      onChange={e => setYtPrivacy(e.target.value as "public" | "private" | "unlisted")}
                      className="w-full h-10 rounded-lg border border-border/50 bg-background/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 hover:border-border/70 transition-colors"
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-foreground/80 mb-2 block">Category</label>
                    <select
                      value={ytCategory}
                      onChange={e => setYtCategory(e.target.value)}
                      className="w-full h-10 rounded-lg border border-border/50 bg-background/80 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-foreground/10 hover:border-border/70 transition-colors"
                    >
                      <option value="1">Film & Animation</option>
                      <option value="2">Autos & Vehicles</option>
                      <option value="10">Music</option>
                      <option value="15">Pets & Animals</option>
                      <option value="17">Sports</option>
                      <option value="19">Travel & Events</option>
                      <option value="20">Gaming</option>
                      <option value="22">People & Blogs</option>
                      <option value="23">Comedy</option>
                      <option value="24">Entertainment</option>
                      <option value="25">News & Politics</option>
                      <option value="26">Howto & Style</option>
                      <option value="27">Education</option>
                      <option value="28">Science & Technology</option>
                      <option value="29">Nonprofits & Activism</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground/80 mb-2 block">Tags (comma-separated)</label>
                  <input
                    type="text"
                    value={ytTags}
                    onChange={e => setYtTags(e.target.value)}
                    placeholder="e.g. tutorial, tech, vlog"
                    className="w-full h-10 rounded-lg border border-border/50 bg-background/80 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-foreground/10 hover:border-border/70 transition-colors"
                  />
                </div>

                <label className="flex items-center gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={ytMadeForKids}
                    onChange={e => setYtMadeForKids(e.target.checked)}
                    className="h-4 w-4 rounded border-border/50 accent-foreground/60 cursor-pointer"
                  />
                  <span className="text-xs text-foreground/70 group-hover:text-foreground/80 transition-colors">Made for kids (COPPA compliance)</span>
                </label>
              </div>

              {/* YouTube Thumbnail picker (internal to YouTube section) */}
              {showThumbnailPicker && (
                <ThumbnailPicker
                  videoSrc={videoFile!.blobUrl}
                  videoDuration={videoFile!.videoDuration}
                  platforms={allSelectedPlatforms}
                  value={thumbnail}
                  onChange={setThumbnail}
                  aspectRatio={activePreviewFormat.aspect}
                />
              )}
            </div>
          )}

          {/* ── TikTok Settings ── */}
          {allSelectedPlatforms.includes("tiktok") && (
            <button
              onClick={() => setIsTikTokModalOpen(true)}
              className="w-full rounded-2xl border border-border/50 bg-card shadow-sm p-4 hover:bg-card/80 hover:border-primary/30 transition-all mb-4 text-left group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-2xl">📱</div>
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">TikTok Settings</p>
                    <p className="text-xs text-muted-foreground">Configure privacy, interactions & commercial disclosure</p>
                  </div>
                </div>
                <div className="text-muted-foreground group-hover:text-foreground transition-colors">→</div>
              </div>
              {tiktokData && (
                <div className="mt-3 pt-3 border-t border-border/30 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-1 text-xs text-primary font-medium">
                    ✓ Title: {tiktokData.title.slice(0, 20)}{tiktokData.title.length > 20 ? "..." : ""}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-1 text-xs text-primary font-medium">
                    ✓ Privacy: {tiktokData.privacyStatus === "SELF_ONLY" ? "Private" : tiktokData.privacyStatus === "FRIEND_ONLY" ? "Friends" : "Public"}
                  </span>
                </div>
              )}
            </button>
          )}

          {/* ── Schedule ── */}
          <div className="rounded-2xl border border-border/50 bg-card shadow-sm p-4 mb-16 lg:mb-0">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">When to publish</p>
            <div className="grid grid-cols-3 gap-1 bg-muted p-1 rounded-xl mb-3">
              {(["now", "schedule", "draft"] as const).map(mode => (
                <button key={mode} onClick={() => setScheduleMode(mode)}
                  className={cn("flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition-all",
                    scheduleMode === mode ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}>
                  {mode === "now" && <Send className="h-3 w-3" />}
                  {mode === "schedule" && <Clock className="h-3 w-3" />}
                  {mode === "draft" && <FileText className="h-3 w-3" />}
                  {mode === "now" ? "Publish now" : mode === "schedule" ? "Schedule" : "Save draft"}
                </button>
              ))}
            </div>
            {scheduleMode === "schedule" && (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-2.5">
                  <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="flex-1 h-9 rounded-lg border border-border/60 bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                  <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                    className="sm:w-28 h-9 rounded-lg border border-border/60 bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30" />
                </div>
                <div className="flex items-center gap-2">
                  <Globe className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <select value={timezone} onChange={e => setTimezone(e.target.value)}
                    className="flex-1 h-9 rounded-lg border border-border/60 bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                    {Object.entries(TIMEZONES).map(([tz, label]) => (
                      <option key={tz} value={tz}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* ── Submit ── */}
          <Button onClick={handleSubmit} disabled={isSubmitting || !selectedAccountIds.length || accounts.length === 0}
            className="w-full h-12 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg hover:scale-[1.01] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed gap-2 text-sm sm:text-base">
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {scheduleMode === "draft" ? "Saving…" : scheduleMode === "schedule" ? "Scheduling…" : "Publishing…"}
              </span>
            ) : (
              <>
                {scheduleMode === "now"      && <><Send     className="h-4 w-4" /> Publish Now</>}
                {scheduleMode === "schedule" && <><Clock    className="h-4 w-4" /> Schedule Post</>}
                {scheduleMode === "draft"    && <><FileText className="h-4 w-4" /> Save Draft</>}
              </>
            )}
          </Button>

          {/* Auto-save indicator */}
          {autoSaveStatus !== "idle" && (
            <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground mt-1.5">
              {autoSaveStatus === "saving" && (
                <><Loader2 className="h-3 w-3 animate-spin" /> Auto-saving draft…</>
              )}
              {autoSaveStatus === "saved" && (
                <><Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" /> Draft auto-saved</>
              )}
            </div>
          )}
        </div>

        {/* ══════ RIGHT: Preview ══════ */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-3 sm:p-4 sticky top-6 max-h-[calc(100vh-5rem)] overflow-y-auto">
            <button
              onClick={() => setLivePreviewExpanded(!livePreviewExpanded)}
              className="w-full flex items-center justify-between group hover:opacity-80 transition-opacity lg:hidden"
            >
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Live Preview</p>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", livePreviewExpanded ? "rotate-180" : "")} />
            </button>
            <p className="hidden lg:block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 text-left">Live Preview</p>

            <div className={cn("space-y-3 sm:space-y-4 transition-all duration-200", !livePreviewExpanded ? "hidden lg:block" : "block mt-3")}>

            {/* Platform preview tabs */}
            {selectedPlatforms.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
                {selectedPlatforms.map(id => {
                  const p = PLATFORMS.find(pl => pl.id === id)!;
                  const accountCount = selectedAccountIds.filter(aid =>
                    accounts.find(a => a.id === aid)?.platform === id
                  ).length;
                  return (
                    <button key={id} onClick={() => setPreviewPlatform(id)}
                      className={cn("shrink-0 flex items-center gap-1 sm:gap-1.5 rounded-full px-2 sm:px-3 py-1.5 sm:py-2 text-xs font-medium transition-all whitespace-nowrap border",
                        previewPlatform === id ? "bg-primary/10 text-primary border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-muted/40 border-border/50"
                      )}>
                      <p.icon className="h-3 w-3" />
                      {p.label.split(" ")[0]}
                      {accountCount > 1 && (
                        <span className="rounded-full bg-current/20 px-1 text-[9px] font-bold opacity-70">{accountCount}</span>
                      )}
                      {(() => {
                        const fmt = getFormat(id, platformFormats[id]);
                        return <span className="text-[10px] opacity-60">{fmt.label}</span>;
                      })()}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/60 italic">Select accounts above to preview</p>
            )}

            {/* Format badge in preview */}
            {(() => {
              const fmt = getFormat(previewPlatform, platformFormats[previewPlatform]);
              return (
                <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/50 px-3 py-1.5">
                  <FormatIcon type={fmt.icon} className="h-3.5 w-3.5 text-foreground" />
                  <span className="text-xs font-medium text-foreground">{fmt.label}</span>
                  <span className="text-muted-foreground">•</span>
                  <span className="text-xs text-muted-foreground font-mono">{fmt.size}</span>
                  {fmt.isVertical && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-xs text-muted-foreground">9:16</span>
                    </>
                  )}
                </div>
              );
            })()}

            {/* Preview content — cleaned up for a professional look */}
            {(() => {
              const fmt = getFormat(previewPlatform, platformFormats[previewPlatform]);
              const isVertical = fmt.isVertical;
              const previewAccount = accounts.find(a => a.platform === previewPlatform && selectedAccountIds.includes(a.id)) ?? null;
              return (
                <div className={cn("relative mx-auto w-full py-1 transition-all", isVertical ? "max-w-[230px]" : "max-w-[420px]")}>
                  <div className="rounded-2xl overflow-hidden shadow-md border border-border/60 bg-background transition-all">
                    <div className="w-full">
                    <>
                      {previewPlatform === "twitter"   && <TwitterPreview   content={getChannelContent("twitter")}   media={mediaFiles} format={getFormat("twitter",   platformFormats["twitter"])}   account={previewAccount} />}
                      {previewPlatform === "linkedin"  && <LinkedInPreview  content={getChannelContent("linkedin")}  media={mediaFiles} format={getFormat("linkedin",  platformFormats["linkedin"])}  account={previewAccount} />}
                      {previewPlatform === "instagram" && <InstagramPreview content={getChannelContent("instagram")} media={mediaFiles} format={getFormat("instagram", platformFormats["instagram"])} account={previewAccount} />}
                      {previewPlatform === "facebook"  && <FacebookPreview  content={getChannelContent("facebook")}  media={mediaFiles} format={getFormat("facebook",  platformFormats["facebook"])}  account={previewAccount} />}
                      {previewPlatform === "tiktok"    && <TikTokPreview    content={getChannelContent("tiktok")}    media={mediaFiles} format={getFormat("tiktok",    platformFormats["tiktok"])}    account={previewAccount} />}
                      {previewPlatform === "youtube"   && <YoutubePreview   content={getChannelContent("youtube")}   media={mediaFiles} format={getFormat("youtube",   platformFormats["youtube"])}   title={youtubeTitle} account={previewAccount} thumbnailPreview={thumbnail.type !== "none" ? thumbnail.previewUrl : undefined} />}
                    </>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Char & hashtag limit bars */}
            {(() => {
              const { length, limit, isOver, isNear } = charInfo(previewPlatform);
              const ht = hashtagInfo(previewPlatform);
              const pct = Math.min(100, (length / limit) * 100);
              const htPct = ht.limit > 0 ? Math.min(100, (ht.count / ht.limit) * 100) : 0;
              return (
                <div className="space-y-2.5">
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="text-muted-foreground">Characters</span>
                      <span className={cn("font-mono font-medium", isOver ? "text-red-500" : isNear ? "text-yellow-500" : "text-muted-foreground")}>
                        {length} / {limit.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", isOver ? "bg-red-500" : isNear ? "bg-yellow-500" : "bg-violet-500")}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1.5 text-xs">
                      <span className="text-muted-foreground">Hashtags</span>
                      <span className={cn("font-mono font-medium", ht.isOver ? "text-red-500" : "text-muted-foreground")}>
                        {ht.count} / {ht.limit}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all duration-300", ht.isOver ? "bg-red-500" : ht.count > 0 ? "bg-violet-400" : "bg-transparent")}
                        style={{ width: `${htPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  // Get TikTok account for modal - find any TikTok account (not just selected ones for modal purposes)
  const tiktokAccount = accounts.find(a => a.platform === "tiktok");

  // Render modal or regular page - RETURN ONLY ONE
  const pageContent = (
    <>
      {innerContent}

      {/* TikTok Share Modal - shown when user tries to publish to TikTok */}
      {tiktokAccount && (() => {
        const tiktokFormat = getFormat("tiktok", platformFormats.tiktok);
        const tiktokMediaType: 'photo' | 'video' = tiktokFormat.id === "post" ? "photo" : "video";
        return (
          <TikTokShareModal
            isOpen={isTikTokModalOpen}
            onClose={() => {
              setIsTikTokModalOpen(false);
              setPendingTiktokSubmit(false);
              setTiktokData(null);
              setIsSubmitting(false);
            }}
            onSubmit={async (data) => {
              setTiktokData(data);
              setIsTikTokModalOpen(false);
              setIsSubmitting(true);
              await handleSubmit(data);
            }}
            accountId={tiktokAccount.outstand_account_id || tiktokAccount.id}
            accessToken="" // Creator info fetch handles auth, modal doesn't need token
            videoDurationSec={videoFile?.videoDuration || 0}
            contentPreview={content}
            isLoading={isSubmitting}
            mediaType={tiktokMediaType}
          />
        );
      })()}
    </>
  );

  if (isModal) {
    return <ComposeModal>{pageContent}</ComposeModal>;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="px-3 py-4 sm:p-6 max-w-7xl mx-auto space-y-3 sm:space-y-4 md:space-y-6 page-enter">
        {pageContent}
      </div>
    </div>
  );
}
