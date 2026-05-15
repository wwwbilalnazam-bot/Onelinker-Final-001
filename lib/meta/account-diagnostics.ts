/**
 * Account Discovery Diagnostics
 *
 * Provides detailed logging for Facebook/Instagram account discovery flow
 * to help identify why accounts might be missing.
 */

import type { MetaPage, MetaIGAccount } from "./accounts";

export function logAccountDiscoveryDiagnostics(
  pages: MetaPage[],
  igAccounts: MetaIGAccount[],
  userAccessToken: string,
  userId: string
) {
  const tokenPreview = userAccessToken.substring(0, 20) + "...";
  const tokenLength = userAccessToken.length;

  const diagnosticReport = `
╔════════════════════════════════════════════════════════════╗
║              ACCOUNT DISCOVERY DIAGNOSTICS                 ║
╚════════════════════════════════════════════════════════════╝

📊 SUMMARY:
  • User ID: ${userId}
  • Total Facebook Pages: ${pages.length}
  • Total Instagram Accounts: ${igAccounts.length}
  • Long-lived Access Token: ${tokenPreview} (${tokenLength} chars)

${pages.length === 0
  ? `
⚠️  NO FACEBOOK PAGES FOUND

  Possible causes:
  1. User is not admin of any Facebook pages
  2. Permission scope "pages_show_list" not granted
  3. All pages are restricted/unpublished
  4. App is in development mode (but you're Live)
  5. Test user in development app

  Next step: Have user check their page list at facebook.com/pages`
  : `
📄 FACEBOOK PAGES (${pages.length} total):
${pages.map((p, i) => {
  const hasToken = !!p.access_token;
  const tokenStatus = hasToken ? "✓" : "✗";
  const hasIg = p.instagram_business_account?.id || null;
  const igStatus = hasIg ? `✓ (${hasIg})` : "✗";

  return `
  [${i + 1}] "${p.name}" (ID: ${p.id}) ${tokenStatus}
      Category: ${p.category || "unknown"}
      Username: ${p.username || "N/A"}
      Followers: ${p.followers_count || 0}
      Access Token: ${tokenStatus} ${hasToken ? "(will be used for API calls)" : "⚠️ MISSING - user might be Viewer/Analyst only"}
      Linked IG Account: ${igStatus}
      Profile Picture: ${p.picture?.data?.url ? "✓" : "✗"}`;
}).join("\n")}
`}

${igAccounts.length === 0
  ? `
📱 INSTAGRAM ACCOUNTS: NONE FOUND

  Why this might happen:
  1. User has no Instagram accounts
  2. Instagram accounts are PERSONAL (not Business/Creator)
  3. Instagram accounts not LINKED to Facebook pages
  4. User is not admin of the pages with linked IG accounts
  5. Instagram accounts are restricted or archived

  Fix for users:
  • Go to Instagram → Settings → Account
  • Switch to "Business Account" or "Creator Account"
  • Go to Instagram → Settings → Linked Accounts
  • Link Instagram to the Facebook page you use in your app
  • Reconnect in the SaaS`
  : `
📱 INSTAGRAM ACCOUNTS (${igAccounts.length} total):
${igAccounts.map((ig, i) => {
  return `
  [${i + 1}] "${ig.name}" (@${ig.username})
      ID: ${ig.id}
      Followers: ${ig.followers_count}
      Parent Facebook Page: ${ig.pageId}
      Profile Picture: ${ig.profile_picture_url ? "✓" : "✗"}`;
}).join("\n")}
`}

🔍 DETAILED ANALYSIS:
${(() => {
  const issues: string[] = [];

  if (pages.length === 0) {
    issues.push("  ❌ CRITICAL: User has ZERO Facebook pages");
  }

  const pagesWithoutToken = pages.filter(p => !p.access_token);
  if (pagesWithoutToken.length > 0) {
    issues.push(`  ⚠️  ${pagesWithoutToken.length} page(s) have no access_token:`);
    pagesWithoutToken.forEach(p => {
      issues.push(`      - "${p.name}" (${p.id})`);
      issues.push(`      → User might be Viewer/Analyst only, not Admin/Editor/Moderator`);
    });
  }

  const pagesWithIg = pages.filter(p => p.instagram_business_account?.id);
  if (pagesWithIg.length > 0 && igAccounts.length === 0) {
    issues.push(`  ⚠️  ${pagesWithIg.length} page(s) have linked IG accounts, but 0 were fetched`);
    issues.push(`      → Some IG account fetches may have failed silently`);
  }

  if (pages.length > igAccounts.length && pagesWithIg.length > 0) {
    const failedIgCount = pagesWithIg.length - igAccounts.length;
    if (failedIgCount > 0) {
      issues.push(`  ⚠️  ${failedIgCount} Instagram account(s) failed to fetch`);
      issues.push(`      → Check logs for error details`);
    }
  }

  if (pages.length > 25 && igAccounts.length === 0) {
    issues.push(`  ℹ️  User has ${pages.length} pages (>25)`);
    issues.push(`      → Pagination is working (good!)`);
  }

  if (issues.length === 0) {
    issues.push("  ✅ No obvious issues detected");
    if (pages.length > 0 && igAccounts.length > 0) {
      issues.push("  ✅ Both Facebook and Instagram accounts were discovered successfully");
    }
  }

  return issues.join("\n");
})()}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Generated at: ${new Date().toISOString()}
`;

  console.log(diagnosticReport);
  return diagnosticReport;
}

/**
 * Log page-level diagnostic details
 */
export function logPageDiagnostic(
  page: MetaPage,
  index: number,
  totalPages: number
) {
  const status = page.access_token ? "✓" : "⚠️";
  const igStatus = page.instagram_business_account?.id ? "has IG" : "no IG";

  console.log(
    `[meta/accounts] Page [${index}/${totalPages}] ${status} "${page.name}" (${page.id}) - ${igStatus}`
  );

  if (!page.access_token) {
    console.warn(
      `[meta/accounts]   └─ ⚠️ No access_token for this page!` +
      ` User might be "Viewer" or "Analyst" only.` +
      ` Need "Admin", "Editor", or "Moderator" role.`
    );
  }
}

/**
 * Log Instagram account fetch attempt
 */
export function logIgFetchAttempt(
  page: MetaPage,
  success: boolean,
  error?: Error
) {
  if (!page.instagram_business_account?.id) {
    return; // Not applicable
  }

  if (success) {
    console.log(
      `[meta/accounts] ✓ Successfully fetched IG account for page "${page.name}" ` +
      `(IG ID: ${page.instagram_business_account.id})`
    );
  } else {
    console.error(
      `[meta/accounts] ✗ Failed to fetch IG account for page "${page.name}" ` +
      `(IG ID: ${page.instagram_business_account.id})`,
      error?.message
    );
  }
}

/**
 * Check for common issues that cause accounts to not appear
 */
export function checkForCommonIssues(
  pages: MetaPage[],
  igAccounts: MetaIGAccount[],
  userAccessToken: string
): {
  hasErrors: boolean;
  issues: string[];
  recommendations: string[];
} {
  const issues: string[] = [];
  const recommendations: string[] = [];

  // Issue 1: No pages at all
  if (pages.length === 0) {
    issues.push("User has no Facebook pages in their account");
    recommendations.push(
      "Ask user to verify they are admin of at least one Facebook page"
    );
    recommendations.push(
      "Ensure app has 'pages_show_list' permission (check app settings)"
    );
  }

  // Issue 2: Pages without access tokens
  const pagesWithoutToken = pages.filter(p => !p.access_token);
  if (pagesWithoutToken.length > 0) {
    issues.push(
      `${pagesWithoutToken.length} page(s) returned without access_token`
    );
    recommendations.push(
      "This happens when user is Viewer/Analyst, not Admin/Editor/Moderator"
    );
    recommendations.push(
      "Ask user to check their role on these pages in Page Settings"
    );
  }

  // Issue 3: Linked but unfetched IG accounts
  const linkedIgPages = pages.filter(p => p.instagram_business_account?.id);
  if (linkedIgPages.length > 0 && igAccounts.length === 0) {
    issues.push(
      `${linkedIgPages.length} page(s) have linked Instagram accounts, but none were fetched`
    );
    recommendations.push("Check server logs for Instagram API errors");
    recommendations.push(
      "Verify Instagram accounts are 'Business' or 'Creator' type"
    );
  }

  // Issue 4: Partial IG account fetch
  if (linkedIgPages.length > igAccounts.length && igAccounts.length > 0) {
    issues.push(
      `Only ${igAccounts.length} of ${linkedIgPages.length} linked Instagram accounts were fetched`
    );
    recommendations.push(
      "Some Instagram account fetches failed. Check logs for errors."
    );
  }

  // Issue 5: No access token
  if (!userAccessToken || userAccessToken.length === 0) {
    issues.push("User access token is missing or empty");
    recommendations.push("OAuth token exchange may have failed");
  }

  return {
    hasErrors: issues.length > 0,
    issues,
    recommendations,
  };
}
