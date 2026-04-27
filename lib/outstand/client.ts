// ════════════════════════════════════════════════════════════
// OUTSTAND.SO API — BASE CLIENT
//
// HTTP client for Outstand.so social media API.
// Used as fallback when direct platform APIs fail.
//
// Required: workspace.outstand_api_key (API key provided by Outstand)
// Optional env var: OUTSTAND_API_BASE_URL (defaults to https://api.outstand.so/v1)
// ════════════════════════════════════════════════════════════

export class OutstandApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly errorCode?: string,
  ) {
    super(message);
    this.name = "OutstandApiError";
  }
}

export interface OutstandPostResult {
  postId: string;
  status: "published" | "scheduled" | "pending";
}

// ── Environment helpers ─────────────────────────────────────

export function getOutstandBaseUrl(): string {
  const baseUrl = process.env.OUTSTAND_API_BASE_URL?.trim();
  if (baseUrl) return baseUrl;
  return "https://api.outstand.so/v1";
}

// ── Core fetch wrapper ──────────────────────────────────────

interface OutstandErrorBody {
  error?: {
    code?: string;
    message?: string;
  };
  message?: string;
}

export async function outstandGet<T>(
  endpoint: string,
  params?: Record<string, string | number | boolean | undefined>,
  apiKey?: string
): Promise<T> {
  if (!apiKey) {
    throw new OutstandApiError("Outstand API key is required", 401);
  }

  const url = new URL(`${getOutstandBaseUrl()}${endpoint}`);

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  console.log(`[outstand/client] GET ${endpoint}`);

  const res = await fetch(url.toString(), { headers, cache: "no-store" });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as OutstandErrorBody;
    throw new OutstandApiError(
      body.error?.message ?? body.message ?? `Outstand API error: ${res.status}`,
      res.status,
      body.error?.code
    );
  }

  return res.json() as Promise<T>;
}

export async function outstandPost<T>(
  endpoint: string,
  body?: Record<string, unknown>,
  apiKey?: string
): Promise<T> {
  if (!apiKey) {
    throw new OutstandApiError("Outstand API key is required", 401);
  }

  const url = new URL(`${getOutstandBaseUrl()}${endpoint}`);

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  console.log(`[outstand/client] POST ${endpoint}`);
  if (body) {
    console.log(`[outstand/client] Request body:`, JSON.stringify(body, null, 2));
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  let rawText = "";
  try {
    rawText = await res.text();
    console.log(`[outstand/client] Response status: ${res.status}`);
    if (rawText) {
      console.log(`[outstand/client] Response body:`, rawText.substring(0, 500));
    }
  } catch (e) {
    console.error(`[outstand/client] Error reading response:`, e);
  }

  if (!res.ok) {
    let errBody: OutstandErrorBody = {};
    try {
      errBody = JSON.parse(rawText);
    } catch {
      // Response isn't JSON
    }
    throw new OutstandApiError(
      errBody.error?.message ?? errBody.message ?? `Outstand API error: ${res.status}`,
      res.status,
      errBody.error?.code
    );
  }

  try {
    return rawText ? (JSON.parse(rawText) as T) : ({} as T);
  } catch {
    throw new OutstandApiError(
      `Invalid JSON response from Outstand: ${rawText}`,
      res.status
    );
  }
}
