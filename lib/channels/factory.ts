// ════════════════════════════════════════════════════════════
// CHANNEL ADAPTER FACTORY
// Creates and manages adapter instances for different platforms
// ════════════════════════════════════════════════════════════

import { Platform } from "@/types";
import { IChannelAdapter } from "./types";
import { FacebookAdapter } from "./FacebookAdapter";
import { InstagramAdapter } from "./InstagramAdapter";
import { YouTubeAdapter } from "./YouTubeAdapter";
// import { TwitterAdapter } from "./TwitterAdapter";

/**
 * Get adapter instance for a given platform
 * Caches adapters to avoid recreating them
 */
export class ChannelAdapterFactory {
  private static adapters: Map<Platform, IChannelAdapter> = new Map();

  /**
   * Get or create adapter for platform
   */
  static getAdapter(platform: Platform): IChannelAdapter {
    // Return cached adapter if available
    if (this.adapters.has(platform)) {
      return this.adapters.get(platform)!;
    }

    // Create new adapter based on platform
    let adapter: IChannelAdapter;

    switch (platform) {
      case Platform.Facebook:
        adapter = new FacebookAdapter();
        break;

      case Platform.Instagram:
        adapter = new InstagramAdapter();
        break;

      case Platform.YouTube:
        adapter = new YouTubeAdapter();
        break;

      // case Platform.Twitter:
      //   adapter = new TwitterAdapter();
      //   break;

      default:
        throw new Error(
          `No adapter implementation for platform: ${platform}`
        );
    }

    // Cache and return
    this.adapters.set(platform, adapter);
    return adapter;
  }

  /**
   * Clear all cached adapters
   * Useful for testing or when auth tokens change
   */
  static clearCache(): void {
    this.adapters.clear();
  }

  /**
   * Get all supported platforms
   */
  static getSupportedPlatforms(): Platform[] {
    return [Platform.Facebook, Platform.Instagram, Platform.YouTube];
    // Add more as they're implemented:
    // Platform.Twitter,
  }

  /**
   * Check if platform is supported
   */
  static isSupported(platform: Platform): boolean {
    return this.getSupportedPlatforms().includes(platform);
  }
}
