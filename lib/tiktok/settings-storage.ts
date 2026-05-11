// Persistent TikTok settings storage
// Saves user's TikTok preferences and loads them for next post

import { TikTokShareData } from "@/components/compose/TikTokShareForm";

const STORAGE_KEY = "tiktok_last_settings";

export function saveTikTokSettings(settings: Partial<TikTokShareData>) {
  try {
    if (typeof window !== "undefined") {
      // Only save non-title fields (title is specific to each post)
      const settingsToSave = {
        privacyStatus: settings.privacyStatus,
        allowComment: settings.allowComment,
        allowDuet: settings.allowDuet,
        allowStitch: settings.allowStitch,
        isCommercialContent: settings.isCommercialContent,
        yourBrand: settings.yourBrand,
        brandedContent: settings.brandedContent,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
    }
  } catch (err) {
    console.error("[TikTok Settings] Failed to save:", err);
  }
}

export function loadTikTokSettings(): Partial<TikTokShareData> {
  try {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<TikTokShareData>;

        // Migration: Convert old privacy enum values to new ones
        if (parsed.privacyStatus === "PUBLIC" as any) {
          parsed.privacyStatus = "PUBLIC_TO_EVERYONE";
        } else if (parsed.privacyStatus === "FRIEND_ONLY" as any) {
          parsed.privacyStatus = "MUTUAL_FOLLOW_FRIENDS";
        }

        return parsed;
      }
    }
  } catch (err) {
    console.error("[TikTok Settings] Failed to load:", err);
  }
  return {};
}

export function clearTikTokSettings() {
  try {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.error("[TikTok Settings] Failed to clear:", err);
  }
}
