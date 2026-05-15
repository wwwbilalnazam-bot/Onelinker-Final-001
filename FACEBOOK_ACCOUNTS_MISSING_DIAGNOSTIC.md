# FACEBOOK/INSTAGRAM ACCOUNTS MISSING — COMPREHENSIVE DIAGNOSTIC & FIX GUIDE

**Status:** Production issue affecting real users  
**Symptom:** Only SOME Facebook Pages & Instagram accounts appear after OAuth  
**Your Setup:** Next.js + Supabase + Meta Direct API v21.0

---

## IMMEDIATE ACTION ITEMS (Next 30 Minutes)

### 1️⃣ Verify Your Fields Parameter

The **#1 most common cause** of missing accounts is incomplete `fields` parameter.

**Current code in `lib/meta/accounts.ts` line 160:**
```
fields: "id,name,access_token,category,picture,username,followers_count,instagram_business_account"
```

**Issue:** This might not return accounts if they're missing optional fields. Meta API behavior:
- If a field is requested but not available, the entire field set may be filtered
- Need explicit field inclusion for visibility

**Fix:** Add explicit `can_create_story` check and more robust field listing:

```typescript
// In lib/meta/accounts.ts, update the graphGet call for pages:
const fieldsArray = [
  "id",
  "name",
  "access_token",
  "category",
  "picture",
  "username",
  "followers_count",
  "instagram_business_account",
  "can_create_story",        // NEW: Verify page is usable
  "is_published",             // NEW: Check if page is published
  "owner_business",          // NEW: Business manager info
];

const pagesRes = await graphGet<{
  data: MetaPage[];
  paging?: { cursors?: { after?: string } };
}>(`/${user.id}/accounts`, {
  fields: fieldsArray.join(","),
  limit: 100,
  ...(after ? { after } : {}),
}, longToken);

// Log pages that might be filtered
if (batchPages.length > 0) {
  batchPages.forEach(p => {
    if (!p.access_token) {
      console.warn(`[meta/accounts] Page ${p.id} (${p.name}) has NO access_token - will be skipped`);
    }
    if (!p.instagram_business_account) {
      console.log(`[meta/accounts] Page ${p.id} (${p.name}) has no linked IG account`);
    }
  });
}
```

---

### 2️⃣ Check User Roles on Pages

**Root Cause:** User is not admin/editor/moderator of the page.

**Why this happens:**
- User is invited as "analyst" or "viewer" only
- Page permissions were revoked
- User is owner of WRONG account type

**Diagnostic:**
```javascript
// Add this to your Meta callback debugging:
// After fetching pages, check each one:

for (const page of pages) {
  console.log(`[CHECK] Page: ${page.name} (${page.id})`);
  console.log(`  - Has access_token: ${!!page.access_token}`);
  console.log(`  - Category: ${page.category}`);
  console.log(`  - Has IG account: ${!!page.instagram_business_account?.id}`);
  console.log(`  - Picture available: ${!!page.picture?.data?.url}`);
  
  // Try to fetch page roles to see if user has access
  try {
    const roles = await graphGet<{
      data: Array<{ role: string }>;
    }>(`/${page.id}/roles`, {}, longToken);
    console.log(`  - User roles on this page: ${roles.data.map(r => r.role).join(", ")}`);
  } catch (err) {
    console.error(`  - ERROR fetching roles: ${err}`);
  }
}
```

**Fix:** Document to users in UI:
- "You must be an Admin, Editor, or Moderator of the Facebook Page"
- "Check your page settings → Roles and Permissions"
- Show which pages failed to sync with reason

---

### 3️⃣ Check API Limit & Pagination

Your recent commit FIXED pagination, but verify it's working:

**Verification:**
1. In your browser console, check logs when user connects:
   - Look for: `"[meta/accounts] Fetched batch of X pages"`
   - You should see MULTIPLE batches, not just one
   - If always `batch of 25`, pagination might not be working

2. Add this test:
```bash
curl -X GET "https://graph.facebook.com/v21.0/me/accounts" \
  -d "fields=id,name,access_token&limit=100&after={cursor_from_previous_call}" \
  -d "access_token={USER_TOKEN}"
```

**Expected behavior:**
- First call returns UP TO 100 pages
- If more than 100 pages, `paging.cursors.after` is present
- Loop continues with `after` cursor
- Last batch has NO `after` cursor

---

### 4️⃣ Verify Instagram-Facebook Linking

Instagram accounts ONLY appear if:
1. Instagram account is "Business" or "Creator" type
2. Linked to a Facebook Page that user has admin access to
3. Page has `instagram_business_account` field returned

**Diagnostic:**
```javascript
// In your logs, check if ANY Instagram accounts are found:

console.log(`[DIAGNOSTIC] Total pages fetched: ${pages.length}`);
console.log(`[DIAGNOSTIC] Pages with IG account: ${pages.filter(p => p.instagram_business_account?.id).length}`);
console.log(`[DIAGNOSTIC] Total IG accounts discovered: ${igAccounts.length}`);

if (pages.length > 0 && igAccounts.length === 0) {
  console.warn(`[CRITICAL] User has ${pages.length} pages but 0 IG accounts. Possible causes:`);
  console.warn(`  1. IG accounts are Personal, not Business/Creator`);
  console.warn(`  2. IG accounts not linked to these pages`);
  console.warn(`  3. User not admin of pages with IG accounts`);
}
```

**Fix for users:**
1. Go to Instagram Settings → Account Type
2. Switch to "Business" or "Creator" (required)
3. Go to Instagram Settings → Linked Accounts
4. Link to the Facebook Page you want to use
5. Reconnect in your SaaS

---

## ROOT CAUSE ANALYSIS (Most to Least Likely)

### 🔴 CRITICAL — Very Likely Issues

#### 1. **Access Token Mismatch in IG Fetch**
```typescript
// WRONG (current line 189):
}, page.access_token);  // ← Using page token to fetch IG account

// CORRECT:
}, page.access_token);  // Actually this IS correct
```
You're using the page access token, which is correct. ✓

#### 2. **User Role on Pages**
- If user is "Viewer" or "Analyst", `access_token` won't be returned
- API silently omits the token instead of throwing error
- Page appears in API response but with no token = can't be used

**Check in Supabase:**
```sql
SELECT 
  outstand_account_id,
  platform,
  display_name,
  encrypted_access_token,
  is_active
FROM social_accounts
WHERE workspace_id = 'YOUR_WORKSPACE_ID'
ORDER BY platform, display_name;
```

Look for rows where `encrypted_access_token` is NULL or empty.

---

#### 3. **Pagination Not Fully Implemented Before**
Your commit `cc28ec7` fixed this! ✓
But verify users with >25 pages now see all of them.

#### 4. **Permission Scope Issues**

Your approved scopes:
- ✓ pages_show_list
- ✓ pages_read_engagement
- ✓ pages_manage_posts
- ✓ pages_read_user_content
- ✓ instagram_content_publish
- ✓ instagram_basic

**Missing scopes that could affect visibility:**
- ❌ `pages_read_user_content` — needed to read page analytics
- ✓ `instagram_basic` — you have this

One potential issue: If user is only invited to page AFTER your app was approved, they might not have granted all scopes. Solution:
- Re-prompt for permissions after page invitation
- Use "incremental auth" if supported

---

### 🟡 LIKELY — Probable Issues

#### 5. **App Mode = Development**
You said app is in LIVE mode ✓, but check:
```
Go to https://developers.facebook.com/apps/YOUR_APP_ID/settings/basic/
Look for "App Mode" — should show "Live" not "Development"
```

If LIVE mode + app is newly approved:
- New page invitations might take 24-48 hours to sync
- Test users have limitations

#### 6. **State Parameter & OAuth State Validation**
In `buildMetaOAuthUrl()`, you encode workspace + platform in state:
```typescript
const statePayload = JSON.stringify({
  workspaceId: params.workspaceId,
  platform: params.platform,
  nonce: crypto.randomUUID(),
});
const state = Buffer.from(statePayload).toString("base64url");
```

**Potential issue:** If state validation fails in callback, sync might be skipped silently.

Check in callback route (`auth/meta/callback/route.ts` line 113):
```typescript
const { workspaceId, platform: connectedPlatform, allParams } = params;
```

Verify `connectedPlatform` matches what user clicked (should be "facebook" or "instagram").

---

#### 7. **targetPlatform Filter in Sync**

In `syncMetaAccountsToSupabase()` line 225:
```typescript
/** Which platform was requested: "facebook" or "instagram". Only sync that one. */
targetPlatform?: string
```

**Potential bug:** If `targetPlatform` is wrong value, pages might be silently skipped.

Debug check:
```typescript
console.log(`[SYNC] targetPlatform=${targetPlatform}, syncFacebook=${syncFacebook}, syncInstagram=${syncInstagram}`);

// If sync is skipped:
if (!syncFacebook) {
  console.warn(`[SYNC] SKIPPED Facebook pages sync because targetPlatform="${targetPlatform}" !== "facebook"`);
}
```

---

#### 8. **Database Constraint Violations**

The upsert on lines 290-307 uses:
```typescript
{ onConflict: "workspace_id,outstand_account_id" }
```

**Potential issue:** If there's a unique constraint violation on other columns (e.g., `profile_picture`, `followers_count`), upsert might fail silently.

Check Supabase logs:
```sql
-- In Supabase SQL Editor:
SELECT id, created_at, error_message
FROM storage.audit_log
WHERE table_name = 'social_accounts'
  AND action = 'INSERT'
ORDER BY created_at DESC
LIMIT 20;
```

---

### 🟢 POSSIBLE — Less Likely But Check

#### 9. **Rate Limiting**

Meta has rate limits:
- 200 calls per hour per token (app-level)
- Could hit if syncing many pages/accounts

Check for error code `429` or `1` in your logs.

---

#### 10. **Test vs. Real Users**

If connecting with a test user account:
- Test user can only see pages owned by their test app
- Real users might see different results
- Test pages have limitations

---

## PRODUCTION-READY FIX (Implement in This Order)

### Step 1: Enhanced Logging (5 min)

Create `lib/meta/account-diagnostics.ts`:

```typescript
import { MetaPage, MetaIGAccount } from "./accounts";

export function logAccountDiscoveryDiagnostics(
  pages: MetaPage[],
  igAccounts: MetaIGAccount[],
  userAccessToken: string,
  userId: string
) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║              ACCOUNT DISCOVERY DIAGNOSTICS                 ║
╚════════════════════════════════════════════════════════════╝

📊 SUMMARY:
  • User ID: ${userId}
  • Total Facebook Pages: ${pages.length}
  • Total Instagram Accounts: ${igAccounts.length}
  • Access Token: ${userAccessToken.substring(0, 20)}... (${userAccessToken.length} chars)

📄 FACEBOOK PAGES:
${pages.map((p, i) => `
  [${i + 1}] ${p.name} (ID: ${p.id})
      • Has access_token: ${!!p.access_token}
      • Category: ${p.category || "N/A"}
      • Username: ${p.username || "N/A"}
      • Followers: ${p.followers_count || 0}
      • Linked IG Account: ${p.instagram_business_account?.id || "NONE"}
      • Picture: ${!!p.picture?.data?.url}
`).join("")}

📱 INSTAGRAM ACCOUNTS:
${igAccounts.length > 0
  ? igAccounts.map((ig, i) => `
  [${i + 1}] ${ig.name} (@${ig.username})
      • ID: ${ig.id}
      • Followers: ${ig.followers_count}
      • Parent Page: ${ig.pageId}
      • Profile Picture: ${!!ig.profile_picture_url}
`).join("")
  : "  (NONE FOUND)"}

⚠️  POTENTIAL ISSUES:
${pages.length === 0 ? "  ❌ User has NO Facebook pages — check permissions or page ownership\n" : ""}
${pages.some(p => !p.access_token) ? "  ❌ Some pages have no access_token — user might be Viewer/Analyst only\n" : ""}
${pages.length > 0 && igAccounts.length === 0 ? "  ⚠️  Pages found but NO Instagram accounts — verify IG linking\n" : ""}
${pages.filter(p => p.instagram_business_account?.id).length > igAccounts.length ? "  ⚠️  Some linked IG accounts failed to fetch\n" : ""}

  `);
}
```

Add to `handleMetaOAuthCode()` before return:
```typescript
const { logAccountDiscoveryDiagnostics } = await import("./account-diagnostics");
logAccountDiscoveryDiagnostics(pages, igAccounts, longToken, user.id);
```

---

### Step 2: Verify Role Access (10 min)

Add role checking before sync:

```typescript
// In lib/meta/accounts.ts, add new function:

export async function verifyPageAccess(
  pageId: string,
  accessToken: string,
  pageName: string
): Promise<boolean> {
  try {
    const roles = await graphGet<{
      data: Array<{ role: string }>;
    }>(`/${pageId}/roles`, {}, accessToken);
    
    const userRoles = roles.data.map(r => r.role);
    const hasAccess = userRoles.some(r => 
      ["ADMIN", "EDITOR", "MODERATOR"].includes(r.toUpperCase())
    );
    
    if (!hasAccess) {
      console.warn(`[meta/accounts] User has insufficient role on "${pageName}" - roles: ${userRoles.join(", ")}`);
    }
    
    return hasAccess;
  } catch (err) {
    console.error(`[meta/accounts] Failed to verify access for page ${pageId}:`, err);
    return false; // Deny access if we can't verify
  }
}
```

Use it before syncing:
```typescript
for (const page of oauthResult.pages) {
  const hasAccess = await verifyPageAccess(page.id, page.access_token, page.name);
  if (!hasAccess) {
    console.log(`[meta/accounts] Skipping page ${page.id} - insufficient access`);
    continue;
  }
  // ... rest of sync
}
```

---

### Step 3: Fix targetPlatform Logic (5 min)

In `syncMetaAccountsToSupabase()`, add validation:

```typescript
// Line 225 - validate targetPlatform
if (targetPlatform && !["facebook", "instagram"].includes(targetPlatform)) {
  console.error(`[meta/accounts] Invalid targetPlatform: "${targetPlatform}". Must be "facebook" or "instagram".`);
  throw new Error(`Invalid platform: ${targetPlatform}`);
}

// Log the intent clearly
const syncFacebook = !targetPlatform || targetPlatform === "facebook";
const syncInstagram = !targetPlatform || targetPlatform === "instagram";

console.log(`[meta/accounts] Sync intent: syncFacebook=${syncFacebook}, syncInstagram=${syncInstagram}, targetPlatform="${targetPlatform}"`);
```

---

### Step 4: Add Rate Limit Detection (5 min)

```typescript
// In lib/meta/client.ts, update graphGet error handling:

export async function graphGet<T>(
  path: string,
  params?: Record<string, string | number | boolean | undefined>,
  accessToken?: string
): Promise<T> {
  const url = new URL(`${GRAPH_API_BASE}${path}`);
  // ... existing code ...

  const res = await fetch(url.toString(), { cache: "no-store" });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as GraphErrorBody;
    const err = body.error;
    
    // Rate limit detection
    if (err?.code === 17 || res.status === 429) {
      const retryAfter = res.headers.get("x-business-use-case-usage");
      console.error(`[GraphAPI] RATE LIMITED - will retry after ${retryAfter}`);
      throw new MetaApiError(
        `Rate limited. Please try again in a moment.`,
        429,
        err?.code,
        err?.error_subcode,
        err?.fbtrace_id
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
```

---

### Step 5: Add Retry Logic for Pagination (10 min)

```typescript
// In lib/meta/accounts.ts, wrap pagination in retry:

async function fetchAllPagesWithRetry(
  userId: string,
  accessToken: string,
  maxRetries = 3
): Promise<MetaPage[]> {
  let pages: MetaPage[] = [];
  let after: string | undefined;
  let pagesFetched = 0;
  let retryCount = 0;

  do {
    try {
      const pagesRes = await graphGet<{
        data: MetaPage[];
        paging?: { cursors?: { after?: string } };
      }>(`/${userId}/accounts`, {
        fields: "id,name,access_token,category,picture,username,followers_count,instagram_business_account",
        limit: 100,
        ...(after ? { after } : {}),
      }, accessToken);

      const batchPages = pagesRes.data ?? [];
      pages = pages.concat(batchPages);
      pagesFetched += batchPages.length;
      after = pagesRes.paging?.cursors?.after;
      retryCount = 0; // Reset retry counter on success

      console.log(`[meta/accounts] Fetched batch of ${batchPages.length} pages (total: ${pagesFetched})`);
    } catch (err: any) {
      if (err.status === 429 && retryCount < maxRetries) {
        retryCount++;
        const delay = Math.pow(2, retryCount) * 1000; // exponential backoff
        console.warn(`[meta/accounts] Rate limited, retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  } while (after);

  return pages;
}
```

---

## DEBUGGING CHECKLIST

Use this when a user reports missing accounts:

### 1. Check Supabase Database
```sql
-- Find the workspace
SELECT id, name FROM workspaces WHERE slug = 'USER_SLUG';

-- Check synced accounts
SELECT outstand_account_id, platform, display_name, is_active, encrypted_access_token
FROM social_accounts
WHERE workspace_id = 'WORKSPACE_ID'
ORDER BY platform, display_name;

-- Check meta_tokens table
SELECT account_id, platform, page_id, ig_user_id, expires_at
FROM meta_tokens
WHERE workspace_id = 'WORKSPACE_ID'
ORDER BY updated_at DESC;
```

### 2. Check Browser Console
When user clicks "Connect Facebook":
1. Look for `[meta/accounts] Fetched batch of X pages` messages
2. Count total pages
3. Look for warnings about missing `access_token`
4. Check IG account fetch errors

### 3. Check for Token Encryption Issues
```typescript
// In your terminal, test TokenVault:
node -e "
const { TokenVault } = require('./lib/services/TokenVault');
const token = 'test_token_12345';
const encrypted = TokenVault.encrypt(token);
const decrypted = TokenVault.decrypt(encrypted);
console.log('Encrypt/decrypt works:', decrypted === token);
"
```

### 4. Test with Graph API Explorer
1. Go to https://developers.facebook.com/tools/explorer/
2. Select your app
3. Enter path: `me/accounts`
4. Add fields: `id,name,access_token,instagram_business_account`
5. Check response — do you see all your pages?

### 5. Check Page Settings
For user reporting missing pages:
1. Ask: "How many Facebook pages do you manage?" (verify with them)
2. Ask: "Are you admin/editor of all of them?"
3. Have them check: Facebook Settings → Pages & Accounts → Role for each page

---

## MONITORING & ALERTING

Add to your dashboard:

```typescript
// Create a sync health check function
export async function checkAccountSyncHealth(
  workspaceId: string
): Promise<{
  facebookAccounts: number;
  instagramAccounts: number;
  accountsWithExpiredTokens: number;
  lastSyncTime: Date | null;
  tokenRefreshNeeded: boolean;
}> {
  const serviceClient = createServiceClient();

  const { data: accounts } = await serviceClient
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .in("platform", ["facebook", "instagram"]);

  const facebookAccounts = accounts?.filter(a => a.platform === "facebook").length ?? 0;
  const instagramAccounts = accounts?.filter(a => a.platform === "instagram").length ?? 0;

  const now = new Date();
  const expiredTokens = accounts?.filter(a => {
    const expiresAt = new Date(a.token_expires_at || 0);
    return expiresAt < now;
  }).length ?? 0;

  const lastSync = accounts
    ?.map(a => new Date(a.last_synced || 0))
    .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    facebookAccounts,
    instagramAccounts,
    accountsWithExpiredTokens: expiredTokens,
    lastSyncTime: lastSync,
    tokenRefreshNeeded: expiredTokens > 0,
  };
}
```

Alert when:
- No accounts synced but user clicked "Connect"
- Account count drops between syncs
- All tokens expiring soon

---

## TESTING STRATEGY

### 1. Test with Different User Types
- [ ] Admin of 1 page
- [ ] Admin of 5+ pages
- [ ] Admin of 50+ pages
- [ ] Admin of pages with different categories (business, media, brand, etc.)
- [ ] Admin of pages with IG accounts linked
- [ ] Admin of pages WITHOUT IG accounts
- [ ] Viewer/Analyst (should fail gracefully)

### 2. Test Different IG Account Types
- [ ] Business account (linked)
- [ ] Creator account (linked)
- [ ] Personal account (should not sync)
- [ ] Unlinked business account (should not appear)

### 3. Test Edge Cases
- [ ] User with 0 pages → should show error
- [ ] User with pages but no IG accounts → should show pages only
- [ ] User with IG accounts but can't access them → should skip
- [ ] Rapid clicks on "Connect" → should dedupe
- [ ] User's token expires mid-sync → should retry or fail gracefully

---

## REFERENCES

- [Meta Graph API v21.0 Docs](https://developers.facebook.com/docs/graph-api/reference/user/accounts)
- [Page Access Tokens](https://developers.facebook.com/docs/facebook-login/access-tokens#pagetokens)
- [Instagram Business Account](https://developers.facebook.com/docs/instagram-api/reference/ig-user)
- [Rate Limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting)
- [Pagination](https://developers.facebook.com/docs/graph-api/using-graph-api/pagination)

---

## SUCCESS CRITERIA

After implementing these fixes, verify:

✅ Users with 1-100 pages see ALL pages  
✅ Pages without access_token are logged and skipped  
✅ Instagram accounts appear when linked to pages  
✅ Logs clearly show what's happening at each step  
✅ Errors don't cause silent failures  
✅ Retry logic handles transient issues  
✅ Users understand why accounts might be missing  
