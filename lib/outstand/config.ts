// ════════════════════════════════════════════════════════════
// OUTSTAND.SO CONFIGURATION
//
// Manages API key retrieval and configuration for Outstand.so
// The API key is stored securely in the workspace table
// ════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase/server";

export async function getOutstandApiKey(workspaceId: string): Promise<string | null> {
  try {
    // First, try to get from workspace database (per-workspace configuration)
    const service = createServiceClient();
    const { data: workspace, error } = await service
      .from("workspaces")
      .select("outstand_api_key")
      .eq("id", workspaceId)
      .single();

    if (!error && workspace?.outstand_api_key) {
      console.log("[outstand/config] Using Outstand API key from workspace config");
      return workspace.outstand_api_key;
    }

    // Fallback: check environment variable (global configuration)
    const envKey = process.env.OUTSTAND_API_KEY?.trim();
    if (envKey) {
      console.log("[outstand/config] Using Outstand API key from environment variable");
      return envKey;
    }

    return null;
  } catch (err) {
    console.error("[outstand/config] Error retrieving API key from workspace:", err);

    // Still try environment variable as fallback
    const envKey = process.env.OUTSTAND_API_KEY?.trim();
    if (envKey) {
      console.log("[outstand/config] Using Outstand API key from environment variable (error fallback)");
      return envKey;
    }

    return null;
  }
}

export function validateOutstandApiKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  // Outstand API keys start with 'ost_' or 'post_' and are at least 32 characters
  const validPrefix = key.startsWith("ost_") || key.startsWith("post_");
  return validPrefix && key.length >= 32;
}
