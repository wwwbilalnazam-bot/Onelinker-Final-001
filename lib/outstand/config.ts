// ════════════════════════════════════════════════════════════
// OUTSTAND.SO CONFIGURATION
//
// Manages API key retrieval and configuration for Outstand.so
// The API key is stored securely in the workspace table
// ════════════════════════════════════════════════════════════

import { createServiceClient } from "@/lib/supabase/server";

export async function getOutstandApiKey(workspaceId: string): Promise<string | null> {
  try {
    const service = createServiceClient();
    const { data: workspace, error } = await service
      .from("workspaces")
      .select("outstand_api_key")
      .eq("id", workspaceId)
      .single();

    if (error) {
      console.error("[outstand/config] Failed to fetch API key:", error);
      return null;
    }

    return workspace?.outstand_api_key ?? null;
  } catch (err) {
    console.error("[outstand/config] Error retrieving API key:", err);
    return null;
  }
}

export function validateOutstandApiKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  // Outstand API keys typically start with 'post_' and are at least 32 characters
  return key.startsWith("post_") && key.length >= 32;
}
