# TikTok Direct Post API Compliance Implementation

This document outlines the complete implementation of TikTok's UX Guidelines for the Direct Post API to ensure app approval.

## ✅ Implemented Features

### 1. Creator Information Display
**File**: `components/compose/TikTokShareForm.tsx`

- ✅ Displays creator's nickname on the share form
- ✅ Shows posting capacity (posts remaining today: 0-15)
- ✅ Validates video duration against max_video_post_duration_sec (600s / 10min)
- ✅ Prevents posting if creator cannot make more posts today
- ✅ Real-time status checks via `/api/tiktok/creator-info` endpoint

### 2. Post Metadata (Title & Privacy Status)
**File**: `components/compose/TikTokShareForm.tsx`

- ✅ **Title Input Field** (required)
  - Max 150 characters
  - User must enter title before publishing
  - Real-time character counter

- ✅ **Privacy Status Dropdown** (required, no default value)
  - Options: "Private (Only Me)" | "Friends Only" | "Public"
  - User must manually select (no defaults)
  - Conditional messaging for each option
  - Smart validation: Cannot select "Only Me" if Branded Content is enabled

### 3. Interaction Settings
**File**: `components/compose/TikTokShareForm.tsx`

- ✅ **Allow Comments** - Unchecked by default
- ✅ **Allow Duets** - Unchecked by default  
- ✅ **Allow Stitches** - Unchecked by default
- ✅ All checkboxes disabled and greyed out if creator's app settings disable them
- ✅ Smart logic: Duets and Stitches hidden for photo posts (only Comments shown)
- ✅ Each toggle includes explanation of what creators can do with the video

### 4. Commercial Content Disclosure
**File**: `components/compose/TikTokShareForm.tsx`

- ✅ **Commercial Content Toggle** (Disabled by default)
  - Clearly states: "I'm promoting a brand, product, or service"

- ✅ **Conditional Options** (Shown only when toggle is ON)
  - ☑️ **Your Brand**: "You are promoting yourself or your own business"
    - Result: Labeled as "Promotional content"
  - ☑️ **Branded Content**: "You are promoting another brand or third party"
    - Result: Labeled as "Paid partnership"

- ✅ **Commercial Content Validation**
  - At least one option must be selected if toggle is ON
  - Branded content cannot be private (auto-validation)
  - Hover notifications: "Branded content visibility cannot be set to private"
  - Smart UX: Disables "Only Me" option when Branded Content is enabled

### 5. Compliance Declarations
**File**: `components/compose/TikTokShareForm.tsx`

Displays context-aware declarations based on content type:

- **Non-commercial**: "By posting, you agree to TikTok's Music Usage Confirmation"
- **Brand Organic**: "By posting, you agree to TikTok's Music Usage Confirmation"
- **Paid Partnership**: "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation"
- **Both Selected**: "By posting, you agree to TikTok's Branded Content Policy and Music Usage Confirmation"

### 6. User Awareness & Content Control
**File**: `components/compose/TikTokShareForm.tsx`

- ✅ **Content Preview**: Shows preview of content being posted
- ✅ **Edit Control**: All metadata is editable before submission
- ✅ **No Watermarks**: Application never adds watermarks to content
- ✅ **Explicit Consent**: Requires user to click "Publish to TikTok" button
- ✅ **Processing Notification**: "Your content may take a few minutes to appear on your profile after publishing"

## 📋 API & Data Flow

### API Endpoints

1. **POST /api/tiktok/creator-info**
   - Fetches creator info from TikTok API
   - Returns: nickname, posting capacity, max video duration
   - Used to populate form and validate constraints

2. **POST /api/posts**
   - Updated to accept `tiktokConfig` in payload
   - Routes TikTok metadata to provider
   - Handles all platforms with platform-specific configs

### Payload Structure

```typescript
{
  // ... standard fields
  tiktokConfig?: {
    title: string;
    privacyStatus: "SELF_ONLY" | "FRIEND_ONLY" | "PUBLIC";
    allowComment: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
    isCommercialContent: boolean;
    yourBrand: boolean;
    brandedContent: boolean;
  }
}
```

## 🔧 Implementation Files

### New Components
- `components/compose/TikTokShareForm.tsx` - Main form with all UX elements
- `components/compose/TikTokShareModal.tsx` - Modal wrapper for the form

### New API Routes
- `app/api/tiktok/creator-info/route.ts` - Fetches creator information

### Modified Files
- `app/api/posts/route.ts` - Added tiktokConfig to payloads
- `lib/providers/types.ts` - Added tiktokConfig type definition
- `lib/providers/tiktok-direct.ts` - Pass tiktokConfig to publish function
- `lib/tiktok/posts.ts` - Updated publishTikTokVideo to use config
- `app/(dashboard)/create/page.tsx` - Integrated TikTok modal

## ⚠️ Validation Rules

### Form-Level Validation
- ✅ Title is required (max 150 chars)
- ✅ Privacy status must be selected (no default)
- ✅ Video duration checked against creator limits
- ✅ Posting capacity validated (must be able to post today)
- ✅ Commercial content requires at least one option if enabled
- ✅ Branded content prevents "Only Me" privacy selection

### Creator Capacity Checks
- ✅ Maximum 15 posts per 24 hours per creator (TikTok default)
- ✅ Maximum 600 seconds (10 minutes) video duration
- ✅ Account must be in posting mode (not restricted)

## 🎯 User Experience Flow

1. **Compose Post** - User creates content normally
2. **Select TikTok Account** - User selects TikTok in account list
3. **Click "Publish Now"** - Form validates basic requirements
4. **TikTok Form Modal Opens** - User sees all TikTok-specific fields:
   - Creator info (verification)
   - Title (required input)
   - Privacy status (required dropdown)
   - Interaction settings (optional toggles)
   - Commercial content (optional disclosure)
   - Compliance declaration (dynamic text)
5. **User Reviews & Confirms** - All fields visible, editable, validated
6. **Submit to TikTok** - Post published with full metadata

## 📊 Compliance Checklist for TikTok Audit

- ✅ Creator nickname displayed before posting
- ✅ Title field required for all posts
- ✅ Privacy status dropdown with no default value
- ✅ Interaction settings fully configurable
- ✅ Commercial content disclosure with detailed options
- ✅ Dynamic compliance declarations based on content type
- ✅ Content preview shown before submission
- ✅ No promotional watermarks or auto-modifications
- ✅ Explicit user consent required
- ✅ Processing time notification displayed
- ✅ Full creator awareness and control

## 🚀 Next Steps for Approval

1. **Test the form thoroughly**:
   - Try all privacy options
   - Enable/disable each interaction setting
   - Test commercial content scenarios
   - Verify validation messages appear correctly

2. **Verify with TikTok**:
   - Take screenshots of the form showing all required fields
   - Document that the form matches all 5 points of their guidelines
   - Submit to TikTok's app approval team

3. **Monitor publishing**:
   - Ensure posts publish with correct metadata
   - Verify privacy settings are applied on TikTok
   - Check that interaction settings take effect
   - Confirm commercial content labels appear correctly

## 📝 Notes

- The TikTok form appears only when posting to TikTok accounts
- For drafts, the TikTok form is skipped (saved as-is)
- All validation happens client-side for instant feedback
- Server-side validation is also implemented for safety
- Future updates: Consider webhook status polling to track post status

---

**Status**: ✅ Ready for TikTok API Approval  
**Last Updated**: 2026-04-28  
**TikTok Guideline Version**: Direct Post API v1.0
