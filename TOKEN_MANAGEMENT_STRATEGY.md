# TOKEN MANAGEMENT STRATEGY — PRODUCTION GUIDE

**Status:** Essential for production security  
**Audience:** Backend engineers managing user tokens

---

## OVERVIEW

Your system currently:
- ✓ Encrypts tokens at rest in Supabase
- ✓ Uses long-lived tokens (~60 days)
- ✓ Stores tokens in `meta_tokens` and `social_accounts` tables
- ✓ Uses TokenVault for encryption/decryption

**Gaps to address:**
- ⚠️ No automatic token refresh before expiry
- ⚠️ No monitoring for token expiration
- ⚠️ No refresh token support
- ⚠️ No explicit revocation mechanism for user disconnect

---

## CURRENT ARCHITECTURE

### Token Storage

**Tables:**
1. `social_accounts` — Main account record with encrypted token
2. `meta_tokens` — Legacy/backup token storage (also encrypted)

**Token lifecycle:**
```
User clicks Connect → OAuth → Short-lived token (valid for 1 hour)
    ↓
Exchange for long-lived token (valid ~60 days)
    ↓
Store in social_accounts.encrypted_access_token
    ↓
Store in meta_tokens.access_token (backup)
    ↓
(After ~55 days) → Token expires, user must reconnect
```

### Encryption

Your `TokenVault` service:
```typescript
// lib/services/TokenVault.ts
export class TokenVault {
  static encrypt(plaintext: string): string {
    // Uses TOKEN_ENCRYPTION_KEY from .env
    // Encrypts at rest
  }

  static decrypt(ciphertext: string): string {
    // Decrypts when needed for API calls
  }
}
```

**Security:** ✓ Good (prevents accidental exposure if DB is breached)

---

## PRODUCTION REQUIREMENTS

### 1. Token Expiration Tracking

**Current:** `token_expires_at` is stored but not actively monitored

**Required:** Automated expiration detection and user notification

```typescript
// lib/services/token-health-checker.ts

export async function checkTokenHealth(workspaceId: string) {
  const serviceClient = createServiceClient();

  const now = new Date();
  const warningThreshold = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  // Find tokens expiring soon
  const { data: expiringSoon } = await serviceClient
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .lt("token_expires_at", warningThreshold.toISOString())
    .gt("token_expires_at", now.toISOString());

  // Find expired tokens
  const { data: expired } = await serviceClient
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .lt("token_expires_at", now.toISOString());

  return {
    healthy: [],
    expiringSoon: expiringSoon ?? [],
    expired: expired ?? [],
  };
}
```

### 2. User Notifications

When tokens are expiring, notify users:

```typescript
// lib/services/token-notifications.ts

export async function notifyExpiringTokens() {
  const serviceClient = createServiceClient();

  // Find all accounts expiring in next 7 days
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const { data: expiringAccounts } = await serviceClient
    .from("social_accounts")
    .select("*")
    .lt("token_expires_at", sevenDaysFromNow.toISOString())
    .gt("token_expires_at", new Date().toISOString());

  if (!expiringAccounts || expiringAccounts.length === 0) return;

  // Group by workspace to send one email per workspace
  const byWorkspace = new Map<string, typeof expiringAccounts>();
  for (const account of expiringAccounts) {
    if (!byWorkspace.has(account.workspace_id)) {
      byWorkspace.set(account.workspace_id, []);
    }
    byWorkspace.get(account.workspace_id)!.push(account);
  }

  // Send notification per workspace
  for (const [workspaceId, accounts] of byWorkspace) {
    await sendTokenExpirationNotification(workspaceId, accounts);
  }
}

async function sendTokenExpirationNotification(
  workspaceId: string,
  accounts: any[]
) {
  // Use your email service (e.g., Resend)
  const subject = `Your social media tokens are expiring in 7 days`;
  const html = `
    <h2>Action Required: Reconnect Your Accounts</h2>
    <p>The following accounts' access tokens will expire in 7 days:</p>
    <ul>
      ${accounts.map(a => `<li>${a.display_name} (${a.platform})</li>`).join("")}
    </ul>
    <p>To keep posting without interruption, please reconnect them:</p>
    <a href="https://yourapp.com/settings/accounts">Reconnect Accounts</a>
  `;

  // Send email (example with Resend)
  // await resend.emails.send({...})
}
```

### 3. Monitoring Dashboard

Create a simple dashboard to track token health:

```typescript
// app/api/admin/token-health/route.ts

export async function GET(request: NextRequest) {
  const serviceClient = createServiceClient();

  const { data: allAccounts } = await serviceClient
    .from("social_accounts")
    .select("*")
    .in("platform", ["facebook", "instagram"]);

  const now = new Date();
  const healthy = allAccounts?.filter(a => {
    const expiresAt = new Date(a.token_expires_at || 0);
    return expiresAt > now;
  }) ?? [];

  const expiring = allAccounts?.filter(a => {
    const expiresAt = new Date(a.token_expires_at || 0);
    const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return daysUntilExpiry > 0 && daysUntilExpiry <= 7;
  }) ?? [];

  const expired = allAccounts?.filter(a => {
    const expiresAt = new Date(a.token_expires_at || 0);
    return expiresAt <= now;
  }) ?? [];

  return NextResponse.json({
    summary: {
      total: allAccounts?.length ?? 0,
      healthy: healthy.length,
      expiring: expiring.length,
      expired: expired.length,
    },
    expiringAccounts: expiring.map(a => ({
      display_name: a.display_name,
      platform: a.platform,
      expires_at: a.token_expires_at,
      daysRemaining: Math.ceil(
        (new Date(a.token_expires_at || 0).getTime() - now.getTime()) /
        (1000 * 60 * 60 * 24)
      ),
    })),
    expiredAccounts: expired.map(a => ({
      display_name: a.display_name,
      platform: a.platform,
      expired_at: a.token_expires_at,
    })),
  });
}
```

---

## TOKEN REVOCATION (When User Disconnects)

Currently, you have `disconnectMetaAccount()` but need to fully revoke tokens:

```typescript
// lib/meta/accounts.ts (update existing function)

export async function disconnectMetaAccount(
  workspaceId: string,
  accountId: string
) {
  const serviceClient = createServiceClient();

  try {
    // Step 1: Get the account details to find the token
    const { data: account } = await serviceClient
      .from("social_accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("outstand_account_id", accountId)
      .single();

    if (!account) {
      console.warn(`[disconnectMetaAccount] Account not found: ${accountId}`);
      return;
    }

    // Step 2: If we have an access token, revoke it with Meta API
    if (account.encrypted_access_token) {
      try {
        const { TokenVault } = await import("@/lib/services/TokenVault");
        const token = TokenVault.decrypt(account.encrypted_access_token);

        // Revoke token with Meta API
        // This tells Meta to invalidate the token
        await graphPost(
          "/me/permissions",
          {},
          token
        );

        console.log(`[disconnectMetaAccount] Token revoked with Meta API: ${accountId}`);
      } catch (err) {
        // Token revocation failed, but continue with DB deletion
        console.warn(
          `[disconnectMetaAccount] Failed to revoke token with Meta: ${err}`
        );
      }
    }

    // Step 3: Delete from social_accounts
    const { error: deleteError } = await serviceClient
      .from("social_accounts")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("outstand_account_id", accountId);

    if (deleteError) {
      throw deleteError;
    }

    // Step 4: Delete from meta_tokens (if exists)
    await serviceClient
      .from("meta_tokens")
      .delete()
      .eq("workspace_id", workspaceId)
      .eq("account_id", accountId);

    console.log(`[disconnectMetaAccount] Account deleted: ${accountId}`);
  } catch (err) {
    console.error(`[disconnectMetaAccount] Error:`, err);
    throw err;
  }
}
```

---

## SECURE TOKEN HANDLING BEST PRACTICES

### 🔴 DO NOT

```typescript
// ❌ NEVER log tokens
console.log("Token:", accessToken);  // DON'T DO THIS

// ❌ NEVER store tokens in plain text
localStorage.setItem("token", accessToken);  // DON'T DO THIS

// ❌ NEVER send tokens in URLs
`https://api.example.com/post?token=${accessToken}`  // DON'T DO THIS

// ❌ NEVER use tokens in error messages
throw new Error(`API error with token ${token}`);  // DON'T DO THIS

// ❌ NEVER commit tokens to git
// .env files should NEVER be committed
// Use .env.local (in .gitignore) for local development
```

### ✅ DO

```typescript
// ✓ Always encrypt tokens before storage
const encrypted = TokenVault.encrypt(plainToken);
await saveToDatabase(encrypted);

// ✓ Only decrypt when making API calls
const decrypted = TokenVault.decrypt(encrypted);
const response = await graphGet("/me", {}, decrypted);
// Token is only in memory for the duration of the API call

// ✓ Use environment variables for sensitive keys
const encryptionKey = process.env.TOKEN_ENCRYPTION_KEY;
// Should be set in .env.local (dev) or hosting platform (prod)

// ✓ Log token metadata, not the token itself
console.log("Token length:", token.length);  // OK
console.log("Token expires:", expiresAt);     // OK

// ✓ Use HTTPS everywhere
// All token transmission should be over HTTPS

// ✓ Implement token rotation
// Refresh tokens periodically (see section below)

// ✓ Add audit logging
console.log({
  timestamp: new Date(),
  action: "token_used",
  accountId: account.id,
  endpoint: "/me/accounts",
  // NOT the actual token
});
```

---

## TOKEN ROTATION (Future Implementation)

Meta's long-lived tokens last ~60 days. After ~55 days, implement refresh:

```typescript
// lib/meta/token-refresh.ts (create this file)

export async function refreshTokenIfNeeded(
  workspaceId: string,
  accountId: string
): Promise<{ refreshed: boolean; newExpiresAt: Date | null }> {
  const serviceClient = createServiceClient();

  // Get current token
  const { data: account } = await serviceClient
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("outstand_account_id", accountId)
    .single();

  if (!account) {
    throw new Error(`Account not found: ${accountId}`);
  }

  const expiresAt = new Date(account.token_expires_at || 0);
  const now = new Date();
  const daysUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

  // Only refresh if expiring within 10 days
  if (daysUntilExpiry > 10) {
    return { refreshed: false, newExpiresAt: null };
  }

  try {
    const { TokenVault } = await import("@/lib/services/TokenVault");
    const shortToken = TokenVault.decrypt(account.encrypted_access_token);

    // Exchange for new long-lived token
    const { getLongLivedToken } = await import("./client");
    const { accessToken: newToken } = await getLongLivedToken(shortToken);

    // Update in database
    const newExpiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const encrypted = TokenVault.encrypt(newToken);

    await serviceClient
      .from("social_accounts")
      .update({
        encrypted_access_token: encrypted,
        token_expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("workspace_id", workspaceId)
      .eq("outstand_account_id", accountId);

    console.log(
      `[token-refresh] Refreshed token for account ${accountId}, ` +
      `expires ${newExpiresAt.toISOString()}`
    );

    return { refreshed: true, newExpiresAt };
  } catch (err) {
    console.error(`[token-refresh] Failed to refresh token:`, err);
    return { refreshed: false, newExpiresAt: null };
  }
}

/**
 * Run this periodically (e.g., daily) to refresh tokens expiring soon
 */
export async function refreshAllExpiringTokens() {
  const serviceClient = createServiceClient();

  const tenDaysFromNow = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

  const { data: accountsToRefresh } = await serviceClient
    .from("social_accounts")
    .select("*")
    .lt("token_expires_at", tenDaysFromNow.toISOString())
    .gt("token_expires_at", new Date().toISOString());

  if (!accountsToRefresh || accountsToRefresh.length === 0) {
    console.log("[token-refresh] No tokens need refreshing");
    return;
  }

  console.log(
    `[token-refresh] Refreshing ${accountsToRefresh.length} tokens expiring soon`
  );

  let refreshed = 0;
  let failed = 0;

  for (const account of accountsToRefresh) {
    try {
      const result = await refreshTokenIfNeeded(
        account.workspace_id,
        account.outstand_account_id
      );
      if (result.refreshed) {
        refreshed++;
      }
    } catch (err) {
      console.error(
        `[token-refresh] Failed for account ${account.outstand_account_id}:`,
        err
      );
      failed++;
    }
  }

  console.log(
    `[token-refresh] Complete: ${refreshed} refreshed, ${failed} failed`
  );
}
```

Then schedule this to run daily:

```typescript
// In a cron job or scheduled task
import { refreshAllExpiringTokens } from "@/lib/meta/token-refresh";

export async function scheduledTokenRefresh() {
  await refreshAllExpiringTokens();
}

// Run daily at 2 AM
// Using CronCreate or your hosting platform's scheduler
```

---

## SECURITY AUDIT CHECKLIST

Run this audit to verify security:

```
TOKEN STORAGE
☐ All tokens encrypted in database
☐ TOKEN_ENCRYPTION_KEY is strong (32+ bytes)
☐ TOKEN_ENCRYPTION_KEY never in git
☐ TOKEN_ENCRYPTION_KEY different per environment
☐ .env.local in .gitignore

TOKEN TRANSMISSION
☐ All API calls use HTTPS
☐ Tokens never in URLs
☐ Tokens only in Authorization headers or request body
☐ CORS properly configured
☐ CSP (Content-Security-Policy) headers set

TOKEN USAGE
☐ Tokens decrypted only when needed
☐ Tokens never logged
☐ Tokens not exposed in error messages
☐ API call logging doesn't include token
☐ Audit logs track token usage (not token itself)

TOKEN LIFECYCLE
☐ Expiration dates tracked
☐ Expired tokens detected
☐ Tokens refreshed before expiry (optional but recommended)
☐ Disconnection revokes tokens
☐ Old tokens securely deleted

MONITORING
☐ Alert on token expiration
☐ Alert on unauthorized API calls
☐ Alert on token refresh failures
☐ Dashboard shows token health
☐ Audit logs accessible for support

ACCESS CONTROL
☐ Only backend can read/decrypt tokens
☐ Frontend never has access to tokens
☐ Service accounts have minimal permissions
☐ Database backups encrypted
☐ Failed auth attempts logged
```

---

## INCIDENT RESPONSE

### If You Suspect Token Compromise

```typescript
// Immediate action:
1. Revoke all tokens immediately
2. Notify affected users
3. Force re-authentication
4. Audit access logs

export async function emergencyRevokeAllTokens(workspaceId: string) {
  const serviceClient = createServiceClient();

  const { data: accounts } = await serviceClient
    .from("social_accounts")
    .select("*")
    .eq("workspace_id", workspaceId);

  let revoked = 0;

  for (const account of accounts ?? []) {
    try {
      await disconnectMetaAccount(workspaceId, account.outstand_account_id);
      revoked++;
    } catch (err) {
      console.error(
        `[emergency] Failed to revoke ${account.outstand_account_id}:`,
        err
      );
    }
  }

  // Notify user
  const workspace = await serviceClient
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  // Send security alert email
  console.log(
    `[emergency] Revoked ${revoked} tokens for workspace ${workspaceId}`
  );
}
```

---

## REFERENCES

- [Meta Token Documentation](https://developers.facebook.com/docs/facebook-login/access-tokens)
- [API Error Codes](https://developers.facebook.com/docs/graph-api/using-graph-api/error-handling)
- [Secure Token Storage](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [OWASP: Sensitive Data Exposure](https://owasp.org/www-project-top-ten/)

---

## SUMMARY

Your current token management is **good** with encryption at rest. To make it **production-grade**, add:

1. ✅ Token expiration monitoring (required)
2. ✅ User notifications for expiring tokens (recommended)
3. ✅ Token refresh before expiry (recommended)
4. ✅ Proper token revocation on disconnect (required)
5. ✅ Audit logging for token usage (recommended)

**Priority:** Implement #1 and #4 immediately. #2 and #3 can be added next week.
