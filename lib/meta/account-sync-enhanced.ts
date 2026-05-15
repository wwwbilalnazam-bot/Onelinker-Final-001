/**
 * Enhanced Account Sync with Retry Logic & Comprehensive Error Handling
 *
 * This module provides production-grade account synchronization with:
 * - Exponential backoff retry on rate limits
 * - Detailed error reporting
 * - Role verification
 * - Safety checks before DB writes
 */

import { graphGet, GRAPH_API_BASE, MetaApiError } from "./client";
import type { MetaPage, MetaIGAccount } from "./accounts";
import {
  logAccountDiscoveryDiagnostics,
  logPageDiagnostic,
  logIgFetchAttempt,
  checkForCommonIssues,
} from "./account-diagnostics";

// ── Configuration ──────────────────────────────────────

const PAGINATION_CONFIG = {
  limit: 100, // Fetch up to 100 pages per request
  maxPages: 1000, // Safety limit — fail if user somehow has >1000 pages
  timeout: 30000, // 30s per request
};

const RETRY_CONFIG = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  backoffMultiplier: 2,
};

// ── Types ──────────────────────────────────────────────

export interface EnhancedSyncResult {
  success: boolean;
  pagesCount: number;
  igAccountsCount: number;
  errors: string[];
  warnings: string[];
  issues: {
    hasErrors: boolean;
    issues: string[];
    recommendations: string[];
  };
  diagnostics: string; // The full diagnostic report
}

// ── Helper Functions ───────────────────────────────────

/**
 * Fetch all Facebook pages with retry logic
 */
export async function fetchAllPagesWithRetry(
  userId: string,
  accessToken: string
): Promise<MetaPage[]> {
  const pages: MetaPage[] = [];
  let after: string | undefined;
  let pagesFetched = 0;
  let batchCount = 0;

  do {
    batchCount++;
    let success = false;
    let attempts = 0;

    while (attempts < RETRY_CONFIG.maxAttempts && !success) {
      attempts++;
      try {
        console.log(
          `[fetchAllPagesWithRetry] Batch ${batchCount}, attempt ${attempts}/${RETRY_CONFIG.maxAttempts}`
        );

        const pagesRes = await graphGet<{
          data: MetaPage[];
          paging?: { cursors?: { after?: string } };
        }>(`/${userId}/accounts`, {
          fields: [
            "id",
            "name",
            "access_token",
            "category",
            "picture",
            "username",
            "followers_count",
            "instagram_business_account",
          ].join(","),
          limit: PAGINATION_CONFIG.limit,
          ...(after ? { after } : {}),
        }, accessToken);

        const batchPages = pagesRes.data ?? [];
        pages.push(...batchPages);
        pagesFetched += batchPages.length;
        after = pagesRes.paging?.cursors?.after;
        success = true;

        console.log(
          `[fetchAllPagesWithRetry] ✓ Batch ${batchCount}: ${batchPages.length} pages ` +
          `(total: ${pagesFetched}, hasMore: ${!!after})`
        );

        if (pagesFetched > PAGINATION_CONFIG.maxPages) {
          console.warn(
            `[fetchAllPagesWithRetry] Safety limit reached — user has >1000 pages. ` +
            `Stopping pagination.`
          );
          after = undefined;
        }
      } catch (err) {
        const isRateLimit = err instanceof MetaApiError && err.status === 429;
        const isRetryable =
          isRateLimit || (err instanceof Error && err.message.includes("timeout"));

        if (isRetryable && attempts < RETRY_CONFIG.maxAttempts) {
          const delay = RETRY_CONFIG.baseDelayMs *
            Math.pow(RETRY_CONFIG.backoffMultiplier, attempts - 1);
          console.warn(
            `[fetchAllPagesWithRetry] ${isRateLimit ? "Rate limited" : "Transient error"} ` +
            `— retrying in ${delay}ms`
          );
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        throw err;
      }
    }

    if (!success) {
      throw new Error(
        `Failed to fetch page batch ${batchCount} after ${RETRY_CONFIG.maxAttempts} attempts`
      );
    }
  } while (after);

  console.log(`[fetchAllPagesWithRetry] ✓ Complete: ${pages.length} pages total`);
  return pages;
}

/**
 * Fetch Instagram account details with error handling
 */
export async function fetchInstagramAccountDetails(
  page: MetaPage,
  accessToken: string
): Promise<MetaIGAccount | null> {
  if (!page.instagram_business_account?.id) {
    console.log(
      `[fetchIGDetails] Page "${page.name}" (${page.id}) has NO linked Instagram account`
    );
    return null; // Page has no linked IG account
  }

  try {
    console.log(
      `[fetchIGDetails] Fetching IG account ${page.instagram_business_account.id} ` +
      `from page "${page.name}" (${page.id})`
    );

    const ig = await graphGet<{
      id: string;
      name: string;
      username: string;
      profile_picture_url: string;
      followers_count: number;
    }>(`/${page.instagram_business_account.id}`, {
      fields: "id,name,username,profile_picture_url,followers_count",
    }, accessToken);

    console.log(
      `[fetchIGDetails] ✅ Successfully fetched IG account: @${ig.username} ` +
      `(${ig.name}) from page "${page.name}"`
    );

    logIgFetchAttempt(page, true);

    return {
      id: ig.id,
      name: ig.name,
      username: ig.username,
      profile_picture_url: ig.profile_picture_url ?? null,
      followers_count: ig.followers_count ?? 0,
      pageId: page.id,
      pageAccessToken: accessToken,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const errorCode = (err as any)?.code;
    const errorType = (err as any)?.type;

    console.error(
      `[fetchIGDetails] ❌ FAILED to fetch IG account ${page.instagram_business_account?.id} ` +
      `from page "${page.name}" (${page.id}):`,
      {
        error: errorMsg,
        code: errorCode,
        type: errorType,
      }
    );

    // Provide helpful context
    if (errorCode === 100) {
      console.error(
        `  → Possible cause: IG account is PERSONAL (not Business/Creator) ` +
        `or not properly linked to this page`
      );
    } else if (errorCode === 200) {
      console.error(
        `  → Possible cause: Insufficient permissions on this page ` +
        `(user might not be admin/editor)`
      );
    } else if (errorCode === 190) {
      console.error(
        `  → Possible cause: Page access token expired`
      );
    }

    logIgFetchAttempt(page, false, err instanceof Error ? err : new Error(String(err)));
    return null; // Skip this IG account, but continue with others
  }
}

/**
 * Validate page data before returning
 */
export function validatePageData(
  pages: MetaPage[]
): { valid: MetaPage[]; invalid: Array<{ page: MetaPage; reason: string }> } {
  const valid: MetaPage[] = [];
  const invalid: Array<{ page: MetaPage; reason: string }> = [];

  for (const page of pages) {
    // Must have ID and name
    if (!page.id || !page.name) {
      invalid.push({ page, reason: "Missing id or name" });
      continue;
    }

    // If access_token is missing, user might not have permission
    if (!page.access_token) {
      invalid.push({
        page,
        reason: "No access_token — user might be Viewer/Analyst only",
      });
      continue;
    }

    valid.push(page);
  }

  return { valid, invalid };
}

/**
 * Validate Instagram account data
 */
export function validateInstagramAccountData(
  accounts: MetaIGAccount[]
): {
  valid: MetaIGAccount[];
  invalid: Array<{ account: MetaIGAccount; reason: string }>;
} {
  const valid: MetaIGAccount[] = [];
  const invalid: Array<{ account: MetaIGAccount; reason: string }> = [];

  for (const account of accounts) {
    if (!account.id || !account.username) {
      invalid.push({
        account,
        reason: "Missing id or username",
      });
      continue;
    }

    if (!account.pageAccessToken) {
      invalid.push({
        account,
        reason: "Missing page access token",
      });
      continue;
    }

    valid.push(account);
  }

  return { valid, invalid };
}

/**
 * Perform enhanced sync with full diagnostic reporting
 */
export async function performEnhancedSync(
  userId: string,
  userAccessToken: string
): Promise<{
  pages: MetaPage[];
  igAccounts: MetaIGAccount[];
  diagnostics: string;
  issues: {
    hasErrors: boolean;
    issues: string[];
    recommendations: string[];
  };
}> {
  console.log(`[performEnhancedSync] Starting for user ${userId}`);

  let pages: MetaPage[] = [];
  let igAccounts: MetaIGAccount[] = [];

  try {
    // Step 1: Fetch all Facebook pages with retry
    console.log(`[performEnhancedSync] Fetching Facebook pages...`);
    pages = await fetchAllPagesWithRetry(userId, userAccessToken);

    // Step 2: Validate page data
    const { valid: validPages, invalid: invalidPages } = validatePageData(pages);
    if (invalidPages.length > 0) {
      console.warn(
        `[performEnhancedSync] ${invalidPages.length} invalid page(s):`,
        invalidPages
      );
    }
    pages = validPages;

    // Step 3: Fetch Instagram accounts
    console.log(`[performEnhancedSync] Fetching Instagram accounts...`);
    const igAccountsFetch: MetaIGAccount[] = [];
    for (const page of pages) {
      logPageDiagnostic(page, pages.indexOf(page) + 1, pages.length);
      const ig = await fetchInstagramAccountDetails(page, page.access_token);
      if (ig) {
        igAccountsFetch.push(ig);
      }
    }

    // Step 4: Validate IG account data
    const { valid: validIgAccounts } = validateInstagramAccountData(igAccountsFetch);
    igAccounts = validIgAccounts;

    // Step 5: Generate diagnostics
    const diagnostics = logAccountDiscoveryDiagnostics(
      pages,
      igAccounts,
      userAccessToken,
      userId
    );

    const issues = checkForCommonIssues(pages, igAccounts, userAccessToken);

    return {
      pages,
      igAccounts,
      diagnostics,
      issues,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`[performEnhancedSync] Fatal error:`, errorMsg);

    const diagnostics = `
╔════════════════════════════════════════════════════════════╗
║                     SYNC FAILED                            ║
╚════════════════════════════════════════════════════════════╝

❌ Error: ${errorMsg}

Partial results:
  • Pages fetched: ${pages.length}
  • IG accounts fetched: ${igAccounts.length}

Check logs above for error details.
`;

    const issues = {
      hasErrors: true,
      issues: [errorMsg],
      recommendations: [
        "Check server logs for detailed error information",
        "Verify access token is valid and not expired",
        "Ensure Meta API is accessible from your server",
      ],
    };

    return {
      pages,
      igAccounts,
      diagnostics,
      issues,
    };
  }
}
