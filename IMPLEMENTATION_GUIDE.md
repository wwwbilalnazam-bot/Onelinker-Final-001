# IMPLEMENTATION GUIDE: Enhanced Account Sync

**Status:** Ready to implement  
**Time to implement:** 30-45 minutes  
**Difficulty:** Medium (mostly copy-paste with small modifications)

---

## FILES CREATED

1. **FACEBOOK_ACCOUNTS_MISSING_DIAGNOSTIC.md** — Comprehensive diagnostic guide
2. **lib/meta/account-diagnostics.ts** — Enhanced logging and diagnostics
3. **lib/meta/account-sync-enhanced.ts** — Production-grade sync with retry logic
4. **IMPLEMENTATION_GUIDE.md** — This file

---

## INTEGRATION STEPS

### Step 1: Update `lib/meta/accounts.ts` to Use Enhanced Sync

**File:** `lib/meta/accounts.ts`  
**Change location:** Around line 135 (function `handleMetaOAuthCode`)

**Current code:**
```typescript
export async function handleMetaOAuthCode(
  code: string,
  redirectUri: string
): Promise<MetaOAuthResult> {
  // Exchange code for short-lived token
  const { accessToken: shortToken } = await exchangeCodeForToken(code, redirectUri);

  // Upgrade to long-lived token (~60 days)
  const { accessToken: longToken } = await getLongLivedToken(shortToken);

  // Get user info
  const user = await graphGet<{ id: string; name: string }>("/me", {
    fields: "id,name",
  }, longToken);

  // Fetch all Facebook Pages the user manages (with pagination)
  let pages: MetaPage[] = [];
  let after: string | undefined;
  let pagesFetched = 0;

  do {
    const pagesRes = await graphGet<{
      data: MetaPage[];
      paging?: { cursors?: { after?: string } };
    }>(`/${user.id}/accounts`, {
      fields: "id,name,access_token,category,picture,username,followers_count,instagram_business_account",
      limit: 100,
      ...(after ? { after } : {}),
    }, longToken);

    const batchPages = pagesRes.data ?? [];
    pages = pages.concat(batchPages);
    pagesFetched += batchPages.length;
    after = pagesRes.paging?.cursors?.after;

    console.log(`[meta/accounts] Fetched batch of ${batchPages.length} pages (total so far: ${pagesFetched})`);
  } while (after);

  console.log(`[meta/accounts] Fetched ${pages.length} total pages from Graph API:`, pages.map(p => ({ id: p.id, name: p.name, hasToken: !!p.access_token })));

  // For each page with an IG business account, fetch IG details
  const igAccounts: MetaIGAccount[] = [];

  for (const page of pages) {
    if (page.instagram_business_account?.id) {
      try {
        const ig = await graphGet<{
          id: string;
          name: string;
          username: string;
          profile_picture_url: string;
          followers_count: number;
        }>(`/${page.instagram_business_account.id}`, {
          fields: "id,name,username,profile_picture_url,followers_count",
        }, page.access_token);

        igAccounts.push({
          id: ig.id,
          name: ig.name,
          username: ig.username,
          profile_picture_url: ig.profile_picture_url ?? null,
          followers_count: ig.followers_count ?? 0,
          pageId: page.id,
          pageAccessToken: page.access_token,
        });
      } catch (err) {
        console.error(`[meta/accounts] Failed to fetch IG account for page ${page.id}:`, err);
      }
    }
  }

  return {
    pages,
    igAccounts,
    userAccessToken: longToken,
    userId: user.id,
  };
}
```

**Replace with:**
```typescript
export async function handleMetaOAuthCode(
  code: string,
  redirectUri: string
): Promise<MetaOAuthResult> {
  // Exchange code for short-lived token
  const { accessToken: shortToken } = await exchangeCodeForToken(code, redirectUri);

  // Upgrade to long-lived token (~60 days)
  const { accessToken: longToken } = await getLongLivedToken(shortToken);

  // Get user info
  const user = await graphGet<{ id: string; name: string }>("/me", {
    fields: "id,name",
  }, longToken);

  // Use enhanced sync with retry logic and diagnostics
  const { performEnhancedSync } = await import("./account-sync-enhanced");
  const syncResult = await performEnhancedSync(user.id, longToken);

  // Log the diagnostic report
  console.log(syncResult.diagnostics);

  // If there are issues, log them for support/debugging
  if (syncResult.issues.hasErrors) {
    console.warn("[meta/accounts] Issues detected during sync:");
    syncResult.issues.issues.forEach(issue => {
      console.warn(`  - ${issue}`);
    });
    syncResult.issues.recommendations.forEach(rec => {
      console.warn(`  → ${rec}`);
    });
  }

  return {
    pages: syncResult.pages,
    igAccounts: syncResult.igAccounts,
    userAccessToken: longToken,
    userId: user.id,
  };
}
```

---

### Step 2: Update `lib/meta/client.ts` to Add Rate Limit Handling

**File:** `lib/meta/client.ts`  
**Change location:** Around line 72 (error handling in `graphGet`)

**Current code:**
```typescript
if (!res.ok) {
  const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
  const err = body.error;
  throw new MetaApiError(
    err?.message ?? `Graph API error: ${res.status}`,
    res.status,
    err?.code,
    err?.error_subcode,
    err?.fbtrace_id
  );
}
```

**Replace with:**
```typescript
if (!res.ok) {
  const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
  const err = body.error;

  // Detect rate limiting
  const isRateLimit = err?.code === 17 || res.status === 429;
  if (isRateLimit) {
    const retryAfter = res.headers.get("x-business-use-case-usage") || "unknown";
    console.error(
      `[GraphAPI] RATE LIMITED on ${path} - retry after ${retryAfter}`
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
```

---

### Step 3: Update Sync Result Handling (Optional)

**File:** `lib/meta/accounts.ts`  
**Change location:** In `syncMetaAccountsToSupabase()` (around line 275)

Add additional diagnostics to help track down issues:

```typescript
console.log(`[meta/accounts] Starting sync: syncFacebook=${syncFacebook}, syncInstagram=${syncInstagram}, totalPages=${oauthResult.pages.length}, totalIGAccounts=${oauthResult.igAccounts.length}, targetPlatform=${targetPlatform}`);

// Add this after logging the start:
if (oauthResult.pages.length === 0) {
  console.warn(
    `[meta/accounts] ⚠️ WARNING: User has ZERO Facebook pages. ` +
    `This is unusual. Check if user is admin of any pages.`
  );
}

const pagesWithoutToken = oauthResult.pages.filter(p => !p.access_token);
if (pagesWithoutToken.length > 0) {
  console.warn(
    `[meta/accounts] ⚠️ WARNING: ${pagesWithoutToken.length} page(s) have no access_token. ` +
    `User might be Viewer/Analyst only, not Admin/Editor/Moderator. ` +
    `Pages: ${pagesWithoutToken.map(p => `"${p.name}"(${p.id})`).join(", ")}`
  );
}
```

---

## TESTING THE IMPLEMENTATION

### Test 1: Local Testing with curl

```bash
# Get a valid user token (from your app)
USER_TOKEN="your_long_lived_token_here"

# Test 1: Fetch pages
curl -X GET "https://graph.facebook.com/v21.0/me/accounts" \
  -G \
  -d "fields=id,name,access_token,instagram_business_account" \
  -d "limit=100" \
  -d "access_token=${USER_TOKEN}"

# Test 2: If you get pages, test pagination
AFTER_CURSOR="cursor_from_first_response"
curl -X GET "https://graph.facebook.com/v21.0/me/accounts" \
  -G \
  -d "fields=id,name,access_token,instagram_business_account" \
  -d "limit=100" \
  -d "after=${AFTER_CURSOR}" \
  -d "access_token=${USER_TOKEN}"

# Test 3: Fetch Instagram account details
IG_ID="instagram_business_account_id"
FB_PAGE_TOKEN="page_access_token_from_step_1"
curl -X GET "https://graph.facebook.com/v21.0/${IG_ID}" \
  -G \
  -d "fields=id,name,username,profile_picture_url,followers_count" \
  -d "access_token=${FB_PAGE_TOKEN}"
```

### Test 2: In Your App

1. **Create a test workspace**
   - Go to your app dashboard
   - Create a new workspace (or use existing one)

2. **Connect Facebook**
   - Click "Connect Facebook" with a test user who has:
     - Admin access to 1 page
     - Admin access to 5+ pages (if available)
     - Linked Instagram accounts

3. **Check Browser Console**
   - Open DevTools (F12)
   - Click "Connect"
   - Look for logs showing:
     - `[meta/accounts] Fetched batch of X pages (total so far: Y)`
     - Account discovery diagnostics
     - Any warnings about missing tokens

4. **Check Server Logs**
   - In your terminal where `npm run dev` is running
   - Look for the diagnostic report
   - Check for warnings about pages without tokens

### Test 3: Database Check

```sql
-- In Supabase SQL Editor
SELECT 
  outstand_account_id,
  platform,
  display_name,
  is_active,
  encrypted_access_token,
  connected_at
FROM social_accounts
WHERE workspace_id = 'YOUR_TEST_WORKSPACE_ID'
ORDER BY connected_at DESC;
```

Verify:
- ✓ All expected pages appear
- ✓ All expected IG accounts appear  
- ✓ `encrypted_access_token` is NOT null
- ✓ `is_active` is TRUE

---

## ROLLOUT STRATEGY

### Phase 1: Staging (Today)
1. [ ] Create feature branch: `git checkout -b feat/enhanced-account-sync`
2. [ ] Copy the 3 new files
3. [ ] Apply code changes to `lib/meta/accounts.ts`
4. [ ] Apply code changes to `lib/meta/client.ts`
5. [ ] Test with staging deployment
6. [ ] Test with real users if available

### Phase 2: Production (Tomorrow)
1. [ ] Deploy to production
2. [ ] Monitor logs for first 24 hours
3. [ ] Have support reach out to users with "missing accounts"
4. [ ] Ask them to reconnect — should see better diagnostics in logs

### Phase 3: User Communication
Send message to affected users:

> **We've improved our Facebook/Instagram connection!**
>
> We've just deployed an update to better handle cases where your Facebook Pages or Instagram accounts weren't showing up.
>
> If you had issues before, please try reconnecting:
> 1. Go to Account Settings → Connected Accounts
> 2. Click "Reconnect Facebook"
> 3. Log in and approve
>
> If you still don't see all your pages/accounts, please reply with:
> - How many pages do you manage? (confirm with user)
> - Are you admin of all of them?
> - Any of your IG accounts linked?
>
> This helps us debug faster!

---

## MONITORING & METRICS

After deployment, track these metrics:

```typescript
// Add to your analytics/logging:

export async function trackAccountSyncMetrics(
  workspaceId: string,
  result: MetaOAuthResult
) {
  // Example with your analytics platform
  analytics.track({
    event: "account_sync_completed",
    properties: {
      workspace_id: workspaceId,
      facebook_pages_synced: result.pages.length,
      instagram_accounts_synced: result.igAccounts.length,
      pages_without_token: result.pages.filter(p => !p.access_token).length,
      has_instagram: result.igAccounts.length > 0,
      timestamp: new Date().toISOString(),
    },
  });
}
```

**Key metrics to watch:**
- Average pages synced per user
- Average IG accounts synced per user
- Users with 0 pages (potential issue)
- Users with pages but no IG accounts (normal or problematic?)
- Error rate on account sync

---

## ROLLBACK PLAN

If something goes wrong:

```bash
# Quick rollback (revert to previous code)
git revert HEAD

# OR manually undo:
# 1. Delete lib/meta/account-diagnostics.ts
# 2. Delete lib/meta/account-sync-enhanced.ts
# 3. Restore lib/meta/accounts.ts to previous version
# 4. Restore lib/meta/client.ts to previous version
```

---

## FUTURE IMPROVEMENTS

After this is deployed and stable, consider:

1. **Token Refresh Before Expiry**
   - Currently tokens are ~60 days
   - Implement auto-refresh at day 50
   - Reduces need for manual reconnection

2. **Page Role Verification**
   - Before syncing, verify user has Admin/Editor/Moderator role
   - Provide clear feedback for pages they can't access
   - Improve UX for multi-admin pages

3. **IG Account Type Validation**
   - Check if IG account is Business/Creator vs Personal
   - Show helpful message if Personal account found
   - Link to Meta docs for conversion

4. **Webhook Subscriptions**
   - Subscribe to page updates
   - Auto-resync when pages are added/removed
   - Reduces manual reconnection needs

5. **Advanced Diagnostics UI**
   - Show sync status in dashboard
   - Display which pages have tokens
   - Show IG account linking status
   - One-click troubleshooting guide

---

## SUPPORT GUIDE

When users report missing accounts, use this checklist:

**Question 1: How many pages should they have?**
- Have them count on Facebook.com/pages
- Ask: "How many pages are you admin of?"

**Question 2: Check their connection**
- Ask them to share their workspace ID
- In Supabase, run: `SELECT * FROM social_accounts WHERE workspace_id = 'X'`
- Count rows — is it less than their page count?

**Question 3: Check server logs**
- Find the connection timestamp in Supabase
- Look in server logs around that time
- Search for diagnostic report
- Share recommendations from the report

**Question 4: Have them reconnect**
- This is the nuclear option but usually works
- Explain: "This will re-authenticate you with Meta"
- Re-fetch and re-sync all accounts

---

## FAQ

**Q: Will this break existing connections?**  
A: No. The new code is backwards-compatible. Existing accounts will continue to work.

**Q: Do users need to reconnect?**  
A: No, unless they want to see if newly added pages appear.

**Q: How long does sync take?**  
A: ~1-2 seconds for users with <25 pages. Longer for users with many pages due to pagination.

**Q: What if a user's token expires?**  
A: They'll get an API error (190). Implement token refresh (in future improvements) or have them reconnect.

**Q: Can we sync IG accounts without Facebook?**  
A: Not directly. IG Business accounts are always linked to a Facebook Page. You need the page token to access the IG account.

---

## NEXT STEPS

1. **Today:** Implement the code changes (30-45 min)
2. **Today:** Test in staging (30 min)
3. **Tomorrow:** Deploy to production
4. **Tomorrow:** Monitor logs for 24 hours
5. **This week:** Follow up with users who had issues
6. **Next week:** Implement token refresh (future improvements)

Good luck! 🚀
