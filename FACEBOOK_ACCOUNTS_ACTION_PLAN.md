# FACEBOOK/INSTAGRAM ACCOUNTS MISSING — EXECUTIVE ACTION PLAN

**Severity:** 🔴 High (Production issue affecting users)  
**Status:** Ready to implement  
**Time to fix:** 1-2 hours for core fixes + 4-6 hours for optional enhancements

---

## PROBLEM SUMMARY

**Issue:** Users connecting Facebook Pages/Instagram accounts see only a subset of their actual accounts.

**Root causes identified:**
1. ✅ **Pagination not fetching all pages** — Already fixed in commit `cc28ec7`
2. ⚠️ **Missing diagnostic logging** — Can't tell why accounts are missing
3. ⚠️ **No error handling for transient failures** — Rate limits cause silent failures
4. ⚠️ **Pages without access tokens not logged** — User role issues hidden

**Impact:**
- Users frustrated when "missing" pages don't appear
- No clear error messages about why
- Support team can't debug issues
- Users must manually reconnect pages

---

## SOLUTION COMPONENTS CREATED

I've created 4 comprehensive documents and 2 new production-grade modules:

### 📄 Documentation Created

1. **FACEBOOK_ACCOUNTS_MISSING_DIAGNOSTIC.md** (This file you referenced)
   - Root cause analysis (9 potential issues)
   - Debugging checklist
   - Testing strategy
   - Success criteria

2. **IMPLEMENTATION_GUIDE.md**
   - Step-by-step integration instructions
   - Code changes with exact line numbers
   - Testing procedures
   - Rollout strategy

3. **TOKEN_MANAGEMENT_STRATEGY.md**
   - Token security best practices
   - Expiration monitoring
   - Refresh logic
   - Incident response

### 💻 Code Modules Created

1. **lib/meta/account-diagnostics.ts** (NEW)
   - Enhanced logging functions
   - Issue detection
   - Formatted diagnostic reports

2. **lib/meta/account-sync-enhanced.ts** (NEW)
   - Production-grade sync with retry logic
   - Rate limit handling
   - Exponential backoff
   - Data validation

---

## ACTION PLAN

### 🟢 PHASE 1: CRITICAL FIXES (Do Today — 45 mins)

These fixes address the immediate issue:

#### Step 1a: Add Enhanced Sync Module (5 min)
```bash
✓ File created: lib/meta/account-sync-enhanced.ts
✓ File created: lib/meta/account-diagnostics.ts
# No action needed — files are ready
```

#### Step 1b: Update `lib/meta/accounts.ts` (10 min)
Modify `handleMetaOAuthCode()` function to use enhanced sync:
- Replace the pagination loop with `performEnhancedSync()`
- Add diagnostic logging
- Add issue detection

**See:** IMPLEMENTATION_GUIDE.md, Step 1

#### Step 1c: Update `lib/meta/client.ts` (5 min)
Add rate limit detection to error handling:
- Check for HTTP 429 status
- Check for Meta error code 17
- Log clearly when rate limited

**See:** IMPLEMENTATION_GUIDE.md, Step 2

#### Step 1d: Test Locally (15 min)
```bash
npm run dev
# Connect with a test user who has:
# - Multiple Facebook pages
# - Linked Instagram accounts
# Check console for diagnostic report
```

#### Step 1e: Deploy to Production (10 min)
```bash
git add lib/meta/
git commit -m "Feat: Enhanced account sync with diagnostics and retry logic"
git push origin main
# Deploy using your normal process
```

**Result:** ✅ Better diagnostics when accounts are missing

---

### 🟡 PHASE 2: MONITORING & ALERTS (Do This Week — 2 hours)

Add monitoring to catch issues before users report them:

#### Step 2a: Create Token Health Endpoint
```typescript
// app/api/admin/token-health/route.ts
// Shows which tokens are expiring soon
// See: TOKEN_MANAGEMENT_STRATEGY.md, Section 1.3
```

#### Step 2b: Add Expiration Notifications
```typescript
// lib/services/token-health-checker.ts
// Notify users 7 days before token expires
// See: TOKEN_MANAGEMENT_STRATEGY.md, Section 1.2
```

#### Step 2c: Create Dashboard Widget
- Display account sync health in admin dashboard
- Show accounts with expiring tokens
- Show failed syncs

**Result:** ✅ Proactive monitoring prevents user issues

---

### 🔵 PHASE 3: OPTIONAL ENHANCEMENTS (Nice to Have — 4+ hours)

These improve the user experience but aren't critical:

#### Step 3a: Automatic Token Refresh (2 hours)
- Refresh tokens 10 days before expiry
- Eliminates need for users to reconnect
- See: TOKEN_MANAGEMENT_STRATEGY.md, Token Rotation

#### Step 3b: Role Verification (1 hour)
- Check user is Admin/Editor/Moderator before syncing
- Show which pages they can't access
- Provide helpful error messages

#### Step 3c: Advanced Diagnostics UI (2 hours)
- Show sync status in settings
- Display token expiration dates
- One-click troubleshooting guide

---

## IMPLEMENTATION CHECKLIST

### Pre-Implementation
- [ ] Create feature branch: `git checkout -b feat/enhanced-account-sync`
- [ ] Review IMPLEMENTATION_GUIDE.md entirely
- [ ] Set up test user with multiple pages

### Phase 1: Core Fixes (45 mins)
- [ ] Copy `lib/meta/account-diagnostics.ts`
- [ ] Copy `lib/meta/account-sync-enhanced.ts`
- [ ] Update `lib/meta/accounts.ts` (handleMetaOAuthCode function)
- [ ] Update `lib/meta/client.ts` (graphGet error handling)
- [ ] Test locally with test user
- [ ] Verify diagnostic logs appear
- [ ] Verify retry logic works (optional: throttle to trigger)
- [ ] Commit and push to staging
- [ ] Deploy to staging environment
- [ ] Final testing on staging
- [ ] Merge to main and deploy to production

### Phase 2: Monitoring (2 hours, this week)
- [ ] Create `lib/services/token-health-checker.ts`
- [ ] Create `lib/services/token-notifications.ts`
- [ ] Create `app/api/admin/token-health/route.ts`
- [ ] Set up daily cron job to check expiring tokens
- [ ] Test notification workflow
- [ ] Deploy

### Phase 3: Enhancements (Optional, next sprint)
- [ ] Implement token refresh logic
- [ ] Add role verification
- [ ] Create diagnostics UI component

---

## KEY FILES TO REVIEW

If you want to understand everything before implementing:

1. **Start here:** FACEBOOK_ACCOUNTS_MISSING_DIAGNOSTIC.md
   - Understand the problem
   - Learn the root causes
   - See debugging techniques

2. **Then here:** IMPLEMENTATION_GUIDE.md
   - See exact code changes needed
   - Understand testing strategy
   - Learn rollback procedure

3. **Reference:** TOKEN_MANAGEMENT_STRATEGY.md
   - Understand token security
   - See best practices
   - Plan token refresh (future)

4. **Code reference:** 
   - lib/meta/account-diagnostics.ts — See the logging functions
   - lib/meta/account-sync-enhanced.ts — See the enhanced sync logic

---

## EXPECTED OUTCOMES

### After Phase 1 (Today)
✅ Clearer diagnostic logs when connecting accounts  
✅ Retry logic handles transient API failures  
✅ Users with >25 pages see all pages (pagination working)  
✅ Issues are logged instead of failing silently  

### After Phase 2 (This Week)
✅ Token expiration monitored proactively  
✅ Users notified 7 days before token expires  
✅ Admin dashboard shows account sync health  

### After Phase 3 (Optional)
✅ Tokens auto-refresh before expiry  
✅ User roles verified before syncing  
✅ Diagnostics available in UI  

---

## SUPPORT COMMUNICATION

After Phase 1 deployment, send this to users with issues:

---

### 📢 Update: Improved Facebook/Instagram Connection

Hi there,

We've just deployed an update to improve how we handle Facebook Pages and Instagram account connections. This should solve issues where not all your accounts were showing up.

**What changed:**
- Better error detection when accounts are missing
- Automatic retry on temporary network issues
- Detailed logs to help our team debug faster

**What you should do:**
If you had issues before, please try reconnecting your Facebook account:
1. Go to **Settings → Connected Accounts**
2. Disconnect Facebook/Instagram (if connected)
3. Click **Connect Facebook** again
4. Log in and approve

**Still missing accounts?**
If you still don't see all your pages/accounts, please reply with:
- How many Facebook pages do you manage? (please verify on facebook.com/pages)
- Are you the admin of all of them?
- Do you have any Instagram accounts linked?

This helps our team debug your specific issue faster.

Thanks,  
The Onelinker Team

---

## ROLLBACK PLAN

If something breaks:

```bash
# Option 1: Revert the commit
git revert HEAD

# Option 2: Manually undo changes
# 1. Remove lib/meta/account-diagnostics.ts
# 2. Remove lib/meta/account-sync-enhanced.ts
# 3. Restore lib/meta/accounts.ts to previous version
# 4. Restore lib/meta/client.ts to previous version
# 5. Redeploy
```

**Rollback time:** < 5 minutes

---

## MONITORING METRICS

Track these after deployment:

```typescript
// In your analytics:
1. Account sync success rate
   - Expected: >95% for normal cases
   - Alert if drops below 90%

2. Average accounts per sync
   - Compare before/after
   - Should increase for users with many pages

3. Token expiration issues
   - Count of expired tokens
   - Should be near 0 (users re-auth before expiry)

4. API error rate
   - Count of 429 rate limits
   - Count of token errors
   - Count of permission errors
```

---

## LONG-TERM IMPROVEMENTS (Next Quarter)

These are nice-to-have improvements for later:

1. **Incremental OAuth**
   - Request new scopes if user adds page after connecting
   - Reduces re-auth needs

2. **Page Discovery API**
   - Let users manually select pages to connect
   - Fallback if API pagination fails

3. **Scheduled Re-sync**
   - Auto-resync pages every X hours
   - Detects newly added pages automatically

4. **Page Health Dashboard**
   - Show which pages can post
   - Show token expiration status
   - Show access level (Admin/Editor/Moderator)

5. **Business Manager Integration**
   - Support Business Manager owned pages
   - Better enterprise support

---

## QUESTIONS & ANSWERS

**Q: Will this break existing connections?**  
A: No, this is backward compatible. Existing accounts continue to work.

**Q: Do users need to reconnect?**  
A: No, but they should if they want to see newly added pages.

**Q: How long does the sync take?**  
A: Usually 1-3 seconds. Slower for users with 100+ pages (but all will be fetched).

**Q: What if a user's token expires?**  
A: They'll get an error when trying to post. They'll need to reconnect (for now). In Phase 3, tokens auto-refresh.

**Q: How do I monitor this in production?**  
A: See MONITORING METRICS section. Check logs for diagnostic reports.

**Q: What about Instagram-only users?**  
A: Instagram accounts need a Facebook Page parent. This is a Meta requirement, not our limitation.

**Q: Can I revert to the old code?**  
A: Yes, rollback time is <5 minutes. See ROLLBACK PLAN section.

---

## CONTACT & SUPPORT

If you have questions while implementing:

1. **Review the diagnostic guide:** FACEBOOK_ACCOUNTS_MISSING_DIAGNOSTIC.md
2. **Check implementation steps:** IMPLEMENTATION_GUIDE.md  
3. **Test thoroughly before deploying:** See testing section
4. **Monitor logs after deployment:** See monitoring section

---

## SUCCESS CRITERIA

After Phase 1, you'll know it's working when:

✅ Diagnostic report prints when user connects  
✅ Report shows all pages user should have  
✅ Pages with missing tokens are logged  
✅ IG accounts appear when linked  
✅ Logs show retry attempts if API fails  
✅ No silent failures (all errors logged)  

---

## NEXT STEPS

1. **NOW:** Read IMPLEMENTATION_GUIDE.md (5 min read)
2. **NEXT:** Create feature branch and copy new files (5 min)
3. **THEN:** Make code changes to 2 existing files (10 min)
4. **TEST:** Test locally with real user account (15 min)
5. **DEPLOY:** Merge and deploy to production (10 min)
6. **MONITOR:** Watch logs for 24 hours (ongoing)

**Total time to fix:** ~1 hour

---

## TLDR

**The Problem:** Facebook accounts missing after OAuth  
**The Cause:** Pagination fixed, but need better error handling & logging  
**The Solution:** Enhanced sync with diagnostics, retry logic, and validation  
**The Timeline:** 1 hour Phase 1, then 2 hours Phase 2 this week  
**The Impact:** Users see all their accounts + team can debug issues faster  

Ready to implement? Start with IMPLEMENTATION_GUIDE.md 👉

