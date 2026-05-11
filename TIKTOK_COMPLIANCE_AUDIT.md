# TikTok Direct Post API Compliance Audit
**Date**: 2026-05-11  
**Status**: ⚠️ **PARTIALLY COMPLIANT** - Several critical guidelines require implementation

---

## 📋 Executive Summary

Your app has a good foundation for TikTok integration but **is missing several compliance requirements** that TikTok enforcement will catch. The most critical issues are:

1. **Creator info not being fetched in real-time** - You return hardcoded defaults instead of querying TikTok's API
2. **Photo posts not handled separately** - Duet/Stitch should be hidden for photos
3. **Privacy level mapping incorrect** - Using `FRIEND_ONLY` instead of `MUTUAL_FOLLOW_FRIENDS`
4. **Missing API credential protection** - No clear documentation on keeping `client_secret` safe
5. **Incomplete interaction defaults** - No validation that disabled interactions are not being sent

---

## ✅ COMPLIANT GUIDELINES

### 1. **Watermark Guidelines** ✓
- [x] No watermarks, logos, or promotional branding added to content
- [x] No brand name overlays on videos
- [x] Users can freely edit title and hashtags before posting

**Evidence**: No watermark-adding code found in `/lib/tiktok/posts.ts` or media handling components.

---

### 2. **Intended Use** ✓
- [x] App is public-facing (not internal-only)
- [x] Designed for authentic creators to share original content
- [x] Not a content-copying tool

**Evidence**: Onelinker is a multi-platform posting tool for creators, not a content aggregator.

---

### 3. **Required UX: Display Creator Info** ✓
- [x] Creator's nickname displayed before publishing
- [x] Creator's profile picture shown
- [x] Account name (@username) visible

**Status**: `TikTokShareForm.tsx` (lines 209-289) displays:
```tsx
<h3 className="text-sm font-semibold text-foreground">{creatorInfo.nickname}</h3>
{creatorInfo.username && (
  <p className="text-xs text-muted-foreground">@{creatorInfo.username}</p>
)}
```

---

### 4. **Required UX: No Default Privacy Status** ✓
- [x] Privacy status dropdown has NO default value
- [x] User must manually select from options
- [x] Error message shown if not selected: "Privacy status is required - please select one"

**Status**: `TikTokShareForm.tsx` (lines 375-417)
```tsx
<option value="">Select privacy status...</option> {/* No default */}
```

---

### 5. **Required UX: Interaction Settings (No Defaults)** ✓
- [x] Allow Comment checkbox - unchecked by default
- [x] Allow Duet checkbox - unchecked by default
- [x] Allow Stitch checkbox - unchecked by default
- [x] Info message: "None of these options are selected by default"

**Status**: Properly implemented with validation (lines 449-506).

---

### 6. **Required UX: Commercial Content Disclosure** ✓
- [x] Toggle to indicate commercial content
- [x] "Your Brand" option with label: "Your photo/video will be labeled as 'Promotional content'"
- [x] "Branded Content" option with label: "Your photo/video will be labeled as 'Paid partnership'"
- [x] Validation: At least one option required when toggle is enabled
- [x] Hover notification for disabled publish button

**Status**: Lines 512-627 fully implement commercial disclosure.

---

### 7. **Required UX: Privacy Management for Branded Content** ✓
- [x] Validation: Branded content cannot be private
- [x] Error message shown when trying to set branded content to SELF_ONLY
- [x] Warning: "Branded content visibility cannot be set to private"

**Status**: Lines 114-116 and 608-615 implement this validation.

---

### 8. **Required UX: Content Preview** ✓
- [x] Preview of content shown before publishing
- [x] Users can see exactly what will be posted

**Status**: Lines 650-655 display content preview.

---

### 9. **Required UX: Processing Time Notification** ✓
- [x] Users informed: "Your content may take a few minutes to appear on your profile after publishing"

**Status**: Line 641 includes this notification.

---

### 10. **Compliance Declaration** ✓
- [x] Declaration shown before publishing
- [x] Changes based on commercial content selection
- [x] Correct declaration text for different scenarios

**Status**: Lines 631-645 implement dynamic declaration.

---

## ❌ NON-COMPLIANT / INCOMPLETE GUIDELINES

### 1. **CRITICAL: Creator Info Must Be Fetched in Real-Time** ❌

**Guideline**: 
> "API Clients must retrieve the latest creator info when rendering the Post to TikTok page."
> "When the creator_info API returns that the creator can not make more posts at this moment, API Clients must stop the current publishing attempt and prompt users to try again later."

**Current Implementation** (`app/api/tiktok/creator-info/route.ts`, lines 64-66):
```typescript
canPost: true, // In production, could check real status via TikTok API
remainingPostsToday: 15, // Default limit per TikTok (0-15 posts per 24h)
maxVideoDurationSec: 600, // 10 minutes max per TikTok guidelines
```

**Issues**:
- ❌ `canPost` is hardcoded to `true` - should be fetched from TikTok API
- ❌ `remainingPostsToday` is hardcoded to `15` - should query actual remaining count
- ❌ No call to TikTok's `/post/publish/creator_info/query/` endpoint before allowing submission

**Fix Required**:
```typescript
// Before rendering the form, call:
const creatorInfo = await queryCreatorInfo(accessToken);

// Then check:
if (!creatorInfo.data) {
  throw new Error("Could not retrieve creator information");
}

// Return actual values:
return {
  nickname: creatorInfo.creator_nickname,
  username: creatorInfo.creator_username,
  profilePicture: creatorInfo.creator_avatar_url,
  canPost: true, // TikTok API will tell us if they've hit limits
  remainingPostsToday: calculateRemaining(creatorInfo),
  maxVideoDurationSec: creatorInfo.max_video_post_duration_sec,
};
```

**Impact**: 🔴 **CRITICAL** - TikTok will reject apps that don't properly check creator capacity before posting.

---

### 2. **CRITICAL: Photo Posts Must Hide Duet/Stitch Options** ❌

**Guideline**:
> "Duet and Stitch features are not applicable to photo posts. So, for Photo Posts, only 'Allow Comment' can be displayed in the UX."

**Current Implementation**: `TikTokShareForm.tsx` shows all three options (Comment, Duet, Stitch) regardless of media type.

**Issue**: There's no check for `isPhotoPost` or similar to conditionally hide Duet/Stitch.

**Fix Required**:
1. Add `mediaType?: 'photo' | 'video'` to `TikTokShareFormProps`
2. Conditionally render Duet/Stitch:
```tsx
{/* Allow Duets - ONLY for videos */}
{mediaType !== 'photo' && (
  <label className="flex items-center gap-3 p-2 rounded-lg...">
    {/* Duet checkbox */}
  </label>
)}

{/* Allow Stitches - ONLY for videos */}
{mediaType !== 'photo' && (
  <label className="flex items-center gap-3 p-2 rounded-lg...">
    {/* Stitch checkbox */}
  </label>
)}
```

**Impact**: 🔴 **CRITICAL** - Violates TikTok UX requirements for compliance.

---

### 3. **CRITICAL: Privacy Level Mapping Incorrect** ❌

**Current Code** (`lib/tiktok/posts.ts`, lines 87, 328-331):
```typescript
privacy_level: "PUBLIC_TO_EVERYONE" | "MUTUAL_FOLLOW_FRIENDS" | "SELF_ONLY";

// Form uses: "SELF_ONLY" | "FRIEND_ONLY" | "PUBLIC"
```

**Issue**: Form uses `FRIEND_ONLY` but API expects `MUTUAL_FOLLOW_FRIENDS`. This will cause API errors.

**Current Mapping in Form** (`TikTokShareForm.tsx`, line 391-393):
```tsx
<option value="SELF_ONLY">🔒 Private (Only Me)</option>
<option value="FRIEND_ONLY">👥 Friends Only</option>  {/* WRONG */}
<option value="PUBLIC">🌍 Public</option>
```

**Fix Required**:
```tsx
<option value="SELF_ONLY">🔒 Private (Only Me)</option>
<option value="MUTUAL_FOLLOW_FRIENDS">👥 Friends Only</option>
<option value="PUBLIC_TO_EVERYONE">🌍 Public</option>
```

And update the interface:
```typescript
export interface TikTokShareData {
  privacyStatus: "" | "SELF_ONLY" | "MUTUAL_FOLLOW_FRIENDS" | "PUBLIC_TO_EVERYONE";
}
```

**Impact**: 🔴 **CRITICAL** - API will reject posts with invalid privacy levels.

---

### 4. **HIGH: Video Duration Validation** ⚠️ 

**Guideline**:
> "When posting a video, API clients must check if the duration of the to-be-posted video follows the max_video_post_duration_sec returned in the creator_info API."

**Current Implementation**: Validation exists in form (lines 119-123):
```typescript
if (videoDurationSec && creatorInfo?.maxVideoDurationSec) {
  if (videoDurationSec > creatorInfo.maxVideoDurationSec) {
    newErrors.duration = `Video duration...`;
  }
}
```

**Issue**: ⚠️ The validation is only in the form. Need to verify:
- Is `videoDurationSec` actually being calculated from the video file?
- Is this checked AGAIN before calling `publishTikTokVideo()`?

**Status**: Needs verification in the compose flow.

---

### 5. **HIGH: Privacy Options Must Come from TikTok API** ⚠️

**Guideline**:
> "The options listed in the UX must follow the privacy_level_options returned in the creator_info API."

**Current Implementation**: Hardcoded dropdown (lines 390-394):
```tsx
<option value="SELF_ONLY">🔒 Private (Only Me)</option>
<option value="FRIEND_ONLY">👥 Friends Only</option>
<option value="PUBLIC">🌍 Public</option>
```

**Issue**: These should come from `creatorInfo.privacy_level_options` instead of being hardcoded.

**Fix Required**:
```tsx
{creatorInfo?.privacy_level_options?.map(option => (
  <option key={option} value={option}>
    {formatPrivacyLabel(option)}
  </option>
))}
```

**Impact**: 🟡 **HIGH** - If TikTok disables certain privacy options for a creator, your app should respect that.

---

### 6. **MEDIUM: Disabled Interaction Validation** ⚠️

**Guideline**:
> "If the creator_info API returns that one or more of these interactions have been disabled in their app settings, your UX must disable and grey out the checkbox for the interaction."

**Current Implementation**: Checkboxes shown but:
- No check for `comment_disabled`, `duet_disabled`, `stitch_disabled` from creator info
- No conditional disabling of checkboxes

**Fix Required**:
```tsx
{/* Allow Comments */}
<Checkbox
  checked={formData.allowComment}
  onCheckedChange={...}
  disabled={isSubmitting || creatorInfo?.commentDisabled} {/* ADD THIS */}
/>
```

**Status**: The form accepts these values from `creatorInfo` but they're not being used.

---

### 7. **MEDIUM: Interaction Settings API Payload** ⚠️

**Guideline**: Ensure that when interactions are disabled (false), they're properly sent to the API.

**Current Implementation** (`lib/tiktok/posts.ts`, lines 141-143):
```typescript
disable_comment: false,
disable_duet: false,
disable_stitch: false,
```

**Issue**: These are hardcoded to `false`. They should come from the form data:
```typescript
disable_comment: !formData.allowComment,
disable_duet: !formData.allowDuet,
disable_stitch: !formData.allowStitch,
```

**Impact**: 🟡 **MEDIUM** - Current implementation always allows all interactions.

---

### 8. **MEDIUM: API Status Polling Feedback** ⚠️

**Guideline**:
> "API clients should poll the publish/status/fetch API or handle status update webhooks, so users can understand the status of their posts."

**Current Implementation**: `pollPostStatus()` exists (lines 252-291) but:
- Returns boolean `true/false` 
- Doesn't track detailed status for UI updates
- Timeout returns "pending" but could be clearer

**Issue**: Need to ensure the UI displays real-time publishing status to the user during the polling process.

**Status**: Needs verification in the calling code to ensure user sees updates.

---

### 9. **MEDIUM: Client Secret Protection** ⚠️

**Guideline**:
> "You must not share your API Credentials with any other third-party or embed your client_secret in open source projects."
> "Maintain appropriate technical and administrative controls to ensure the security and confidentiality of client_secret."

**Current Implementation**: Environment variables used, but no documentation about:
- [ ] `TIKTOK_CLIENT_SECRET` never logged
- [ ] Never exposed in error messages
- [ ] Never sent to frontend
- [ ] Accessed only server-side

**Status**: Check if secrets are properly scoped to server-side code only.

---

### 10. **LOW: File Upload Method Documentation** ℹ️

**Guideline**:
> "FILE_UPLOAD should be used when the to-be-posted video is on the users' devices"
> "PULL_FROM_URL should be used when API Clients already have content on server-side storage"

**Current Implementation**: Using `FILE_UPLOAD` (line 94, 146):
```typescript
source: "FILE_UPLOAD",
```

**Status**: ✓ Correct - videos come from user's device/storage URL.

---

## 🔧 Implementation Priority

### 🔴 CRITICAL (Must fix before TikTok approval):
1. Fix privacy level mapping (`FRIEND_ONLY` → `MUTUAL_FOLLOW_FRIENDS`)
2. Implement real creator info fetching (not hardcoded values)
3. Hide Duet/Stitch options for photo posts
4. Fix interaction settings in API payload

### 🟡 HIGH (Should fix):
5. Dynamically populate privacy options from TikTok API response
6. Validate and disable interactions that creator has disabled
7. Verify video duration is being calculated correctly

### 🟠 MEDIUM (Nice to have):
8. Enhance status polling UI feedback
9. Document client secret protection practices
10. Add webhooks support for status updates

---

## 📝 Checklist for Approval

- [ ] Privacy level enum fixed: `FRIEND_ONLY` → `MUTUAL_FOLLOW_FRIENDS`
- [ ] Creator info fetched from TikTok API (not hardcoded)
- [ ] Photo posts hide Duet/Stitch options
- [ ] Interaction settings respected in API payload
- [ ] Privacy options dynamically populated from creator info
- [ ] Disabled interactions validated and greyed out
- [ ] Video duration properly validated before upload
- [ ] Status polling provides user feedback
- [ ] Client secret protection documented
- [ ] Tested with actual TikTok sandbox account

---

## 📞 TikTok Resources

- [Direct Post API Documentation](https://developers.tiktok.com/doc/content-posting-api/)
- [Creator Info Endpoint](https://developers.tiktok.com/doc/content-posting-api/#Query-Creator-Info)
- [Post Publish Endpoints](https://developers.tiktok.com/doc/content-posting-api/#Post-Publish-APIs)
- [Approval Process](https://developers.tiktok.com/doc/content-posting-api/#API-Access)

---

## 🚀 Next Steps

1. **Review & acknowledge** this audit
2. **Prioritize fixes** based on criticality
3. **Implement changes** to address critical issues
4. **Test thoroughly** with sandbox TikTok account
5. **Submit for TikTok approval** with documentation of compliance
