// ════════════════════════════════════════════════════════════
// META GRAPH API — BASE CLIENT
//
// Direct Facebook Graph API integration for development/testing.
// Uses your own Meta app credentials instead of Outstand proxy.
//
// Required env vars:
//   META_APP_ID       — Facebook App ID
//   META_APP_SECRET   — Facebook App Secret
// ════════════════════════════════════════════════════════════

const GRAPH_API_VERSION = "v21.0";
export const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

export class MetaApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: number,
    public readonly subcode?: number,
    public readonly fbTraceId?: string
  ) {
    super(message);
    this.name = "MetaApiError";
  }
}

// ── Environment helpers ─────────────────────────────────────

export function getMetaAppId(): string {
  const id = process.env.META_APP_ID?.trim();
  if (!id) throw new MetaApiError("META_APP_ID is not configured", 500);
  return id;
}

export function getMetaAppSecret(): string {
  const secret = process.env.META_APP_SECRET?.trim();
  if (!secret) throw new MetaApiError("META_APP_SECRET is not configured", 500);
  return secret;
}

// ── Core fetch wrapper ──────────────────────────────────────

interface GraphErrorBody {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
}

export async function graphGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  accessToken?: string
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);

  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
    const err = body.error;

    // Detect rate limiting
    const isRateLimit = err?.code === 17 || res.status === 429;
    if (isRateLimit) {
      const retryAfter = res.headers.get("x-business-use-case-usage") || "unknown";
      console.error(
        `[GraphAPI] 🚨 RATE LIMITED on ${path} — retry after ${retryAfter}`
      );
    }

    throw new MetaApiError(
      err?.message ?? `Graph API error: ${res.status}`,
      res.status,
      err?.code,
      err?.error_subcode,
      err?.fbtrace_id
    );
  }

  return res.json() as Promise<T>;
}

export async function graphPost<T>(
  path: string,
  body?: Record<string, unknown>,
  accessToken?: string
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);

  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as GraphErrorBody;
    const err = errBody.error;

    // Detect rate limiting
    const isRateLimit = err?.code === 17 || res.status === 429;
    if (isRateLimit) {
      const retryAfter = res.headers.get("x-business-use-case-usage") || "unknown";
      console.error(
        `[GraphAPI] 🚨 RATE LIMITED on ${path} — retry after ${retryAfter}`
      );
    }

    throw new MetaApiError(
      err?.message ?? `Graph API error: ${res.status}`,
      res.status,
      err?.code,
      err?.error_subcode,
      err?.fbtrace_id
    );
  }

  return res.json() as Promise<T>;
}

export async function graphPostMultipart<T>(
  path: string,
  formData: FormData,
  accessToken?: string
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);

  if (accessToken) {
    url.searchParams.set("access_token", accessToken);
  }

  const res = await fetch(url.toString(), {
    method: "POST",
    body: formData,
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as GraphErrorBody;
    const err = errBody.error;
    throw new MetaApiError(
      err?.message ?? `Graph API multipart error: ${res.status}`,
      res.status,
      err?.code,
      err?.error_subcode,
      err?.fbtrace_id
    );
  }

  return res.json() as Promise<T>;
}

export async function graphPut<T>(
  path: string,
  body: BodyInit,
  contentType: string,
  accessToken?: string
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  if (accessToken) url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body,
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as GraphErrorBody;
    const err = errBody.error;
    throw new MetaApiError(
      err?.message ?? `Graph API PUT error: ${res.status}`,
      res.status,
      err?.code,
      err?.error_subcode,
      err?.fbtrace_id
    );
  }

  return res.json() as Promise<T>;
}

export async function graphDelete(
  path: string,
  accessToken: string
): Promise<void> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  url.searchParams.set("access_token", accessToken);

  const res = await fetch(url.toString(), {
    method: "DELETE",
    cache: "no-store",
  });

  if (!res.ok) {
    const errBody = (await res.json().catch(() => ({}))) as GraphErrorBody;
    const err = errBody.error;
    throw new MetaApiError(
      err?.message ?? `Graph API delete failed: ${res.status}`,
      res.status,
      err?.code
    );
  }
}

// ── OAuth helpers ───────────────────────────────────────────

/**
 * Exchange an authorization code for a short-lived user access token.
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const result = await graphGet<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>("/oauth/access_token", {
    client_id: getMetaAppId(),
    client_secret: getMetaAppSecret(),
    redirect_uri: redirectUri,
    code,
  });

  return { accessToken: result.access_token, expiresIn: result.expires_in };
}

/**
 * Exchange a short-lived token for a long-lived one (~60 days).
 */
export async function getLongLivedToken(
  shortLivedToken: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const result = await graphGet<{
    access_token: string;
    token_type: string;
    expires_in: number;
  }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: getMetaAppId(),
    client_secret: getMetaAppSecret(),
    fb_exchange_token: shortLivedToken,
  });

  return { accessToken: result.access_token, expiresIn: result.expires_in };
}
