// ════════════════════════════════════════════════════════════
// PROVIDER REGISTRY — Routes platforms to their providers
//
// This is the ONLY file API routes should import.
// It resolves which provider handles each platform.
//
// Usage:
//   import { getProviderForPlatform } from "@/lib/providers";
//
//   const provider = getProviderForPlatform("instagram");
//   await provider.createPost({ ... });
//
// To add a new platform:
//   1. Create the provider class (implements SocialProvider)
//   2. Register it in PROVIDERS below
//   3. Update PLATFORM_PROVIDER_MAP to point the platform to it
//   4. Done — no API route changes needed
// ════════════════════════════════════════════════════════════

import type { SocialProvider } from "./types";
import { MetaDirectProvider } from "./meta-direct";
import { MetaHybridProvider } from "./meta-hybrid";
import { YouTubeDirectProvider } from "./youtube-direct";
import { YouTubeHybridProvider } from "./youtube-hybrid";
import { LinkedInDirectProvider } from "./linkedin-direct";
import { LinkedInHybridProvider } from "./linkedin-hybrid";
import { TikTokDirectProvider } from "./tiktok-direct";
import { TikTokHybridProvider } from "./tiktok-hybrid";
import { TwitterDirectProvider } from "./twitter-direct";
import { ThreadsDirectProvider } from "./threads-direct";
import { BlueskyDirectProvider } from "./bluesky-direct";
import { PinterestDirectProvider } from "./pinterest-direct";
import { GoogleBusinessDirectProvider } from "./google-business-direct";

// ── Register all available providers ────────────────────────

const PROVIDERS: Record<string, SocialProvider> = {
  "meta-direct": new MetaDirectProvider(),
  "meta-hybrid": new MetaHybridProvider(),
  "youtube-direct": new YouTubeDirectProvider(),
  "youtube-hybrid": new YouTubeHybridProvider(),
  "linkedin-direct": new LinkedInDirectProvider(),
  "linkedin-hybrid": new LinkedInHybridProvider(),
  "tiktok-direct": new TikTokDirectProvider(),
  "tiktok-hybrid": new TikTokHybridProvider(),
  "twitter-direct": new TwitterDirectProvider(),
  "threads-direct": new ThreadsDirectProvider(),
  "bluesky-direct": new BlueskyDirectProvider(),
  "pinterest-direct": new PinterestDirectProvider(),
  "google-business-direct": new GoogleBusinessDirectProvider(),
};

// ── Map each platform → provider name ───────────────────────
// Platforms without a provider are not yet supported.
// They'll show "coming soon" in the UI.

const PLATFORM_PROVIDER_MAP: Record<string, string> = {
  instagram:        "meta-hybrid",
  facebook:         "meta-hybrid",
  linkedin:         "linkedin-hybrid",
  youtube:          "youtube-hybrid",
  tiktok:           "tiktok-hybrid",
  twitter:          "twitter-direct",
  threads:          "threads-direct",
  bluesky:          "bluesky-direct",
  pinterest:        "pinterest-direct",
  google_business:  "google-business-direct",
};

// ── Public API ──────────────────────────────────────────────

/** Get a provider by name */
export function getProvider(name: string): SocialProvider {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw new Error(
      `Unknown provider: "${name}". Available: ${Object.keys(PROVIDERS).join(", ")}`
    );
  }
  return provider;
}

/** Get the provider that handles a specific platform */
export function getProviderForPlatform(platform: string): SocialProvider {
  const providerName = PLATFORM_PROVIDER_MAP[platform];
  if (!providerName) {
    throw new Error(
      `"${platform}" is not yet supported. Coming soon!`
    );
  }
  return getProvider(providerName);
}

/** Get the provider name for a platform (for logging/debugging) */
export function getProviderNameForPlatform(platform: string): string {
  return PLATFORM_PROVIDER_MAP[platform] ?? "unsupported";
}

/** Get all registered providers */
export function getAllProviders(): SocialProvider[] {
  return Object.values(PROVIDERS);
}

/** Check if a platform has a provider configured */
export function isPlatformSupported(platform: string): boolean {
  const providerName = PLATFORM_PROVIDER_MAP[platform];
  return !!providerName && !!PROVIDERS[providerName];
}

/** Get all platforms handled by a specific provider */
export function getPlatformsForProvider(providerName: string): string[] {
  return Object.entries(PLATFORM_PROVIDER_MAP)
    .filter(([, name]) => name === providerName)
    .map(([platform]) => platform);
}

// ── Re-exports ──────────────────────────────────────────────

export type {
  SocialProvider,
  OAuthStartResult,
  OAuthCallbackResult,
  ProviderAccount,
  CreatePostPayload,
  CreatePostResult,
  PostStatusResult,
  PostAnalytics,
  WebhookEvent,
} from "./types";
