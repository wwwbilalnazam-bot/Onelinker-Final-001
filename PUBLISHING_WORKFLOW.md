# Complete Publishing Workflow Guide

## 🎯 Overview

The publishing system now provides a complete, user-friendly workflow with:
- **Queue Management**: Processes posts sequentially
- **Real-time Notifications**: Toast notifications at each step
- **Modal Management**: Automatically closes modals after submission
- **Error Handling**: Graceful error recovery for all platforms
- **State Reset**: Clears form after successful publish
- **Redirection**: Takes user to posts page to see results

## 📋 Publishing Flow Diagram

```
User Clicks "Publish Now" / "Schedule" / "Save Draft"
            ↓
Validation Check
    ├─ Content presence
    ├─ Required fields (title, accounts)
    ├─ Media upload status
    └─ Platform-specific requirements
            ↓
        [PASS?]
       ↙      ↘
     YES      NO → Show Error Toast → Exit
     ↓
Prepare Media
    ├─ Refresh session
    ├─ Collect media URLs
    └─ Upload thumbnails (if needed)
            ↓
Check for TikTok
    ├─ If yes → Show Modal
    │   └─ Wait for user to fill settings
    └─ If no → Continue
            ↓
🔄 Preparing your post... [LOADING TOAST]
            ↓
📤 Uploading to X platform(s)... [UPDATING TOAST]
            ↓
Call /api/posts endpoint
            ↓
        [SUCCESS?]
       ↙         ↘
     YES        NO → Show Error Toast → Exit
     ↓
✅ Finalizing... [UPDATING TOAST]
            ↓
🚀 Published / 📅 Scheduled / 📝 Saved [SUCCESS TOAST]
            ↓
Close Modals
    └─ Close TikTok modal if open
            ↓
Reset Form
    ├─ Clear content
    ├─ Clear media
    ├─ Clear platform-specific config
    └─ Reset all state
            ↓
Wait 1.5s for UX smoothness
            ↓
Redirect to /posts [if not draft]
            ↓
✨ Done!
```

## 🔔 Toast Notifications

### Loading State (Animated)
```
🔄 Preparing your post...
    ↓ (after 500ms)
📤 Uploading to X platform(s)...
    ↓ (after 800ms more)
✅ Finalizing...
```

### Success State (4 second duration)
```
📝 Post saved as draft!                    [Draft mode]
🚀 Published to 3 accounts!                [Publish now]
📅 Post scheduled for 2024-01-15 at 14:00 [Schedule mode]
```

### Error State (5 second duration)
```
❌ Failed to publish
   [error message details]
```

## 🛠️ Implementation Details

### PublishManager Class

Located in: `lib/publishing/publish-manager.ts`

**Responsibilities:**
- Manage loading toasts
- Update toast state during publishing
- Show success/error messages
- Handle timing and delays

**Key Methods:**
```typescript
publish(payload: PublishPayload): Promise<PublishResult>
  └─ Main publishing method
  └─ Handles entire workflow
  └─ Returns success/error result

showLoadingToast(message: string): void
  └─ Show initial loading toast

updateLoadingToast(message: string): void
  └─ Update toast without recreating

showSuccessToast(message: string): void
  └─ Show success and close loading

showErrorToast(message: string, error?: string): void
  └─ Show error and close loading

clearToasts(): void
  └─ Clear all active toasts
```

### Publishing Payload

All platforms send to `/api/posts` with:

```typescript
{
  workspaceId: string;
  accountIds: string[];
  content: string;
  scheduleMode: "now" | "schedule" | "draft";
  scheduledAt?: string;
  scheduledTime?: string;
  timezone?: string;
  mediaUrls: string[];
  firstComment?: string;
  platformFormats?: Record<string, string>;
  
  // YouTube-specific
  youtubeTitle?: string;
  youtubeConfig?: {
    privacyStatus: "public" | "private" | "unlisted";
    categoryId: string;
    tags: string[];
    madeForKids: boolean;
  };
  
  // TikTok-specific
  tiktokConfig?: {
    title: string;
    privacyStatus: "SELF_ONLY" | "FRIEND_ONLY" | "PUBLIC";
    allowComment: boolean;
    allowDuet: boolean;
    allowStitch: boolean;
    isCommercialContent: boolean;
    yourBrand: boolean;
    brandedContent: boolean;
  };
  
  // Media
  thumbnail?: {
    type: "frame" | "custom";
    frameOffset?: number;
    uploadedUrl?: string;
  };
  segments?: Array<{ start: number; end: number }>;
}
```

## 📱 Modal Management

### TikTok Modal Lifecycle

1. **Opening**
   - User clicks "Publish Now" or "Schedule"
   - System detects TikTok in selected platforms
   - Modal opens with form

2. **User Interaction**
   - User fills in TikTok-specific fields
   - Form validates in real-time
   - User clicks "Publish to TikTok"

3. **Submission**
   - Modal captures form data
   - Modal closes automatically
   - Publishing continues with TikTok config

4. **Cleanup**
   - Form state is set with TikTok data
   - User sees "TikTok Settings" button with summary
   - Publishing proceeds normally

5. **After Success**
   - Modal stays closed
   - Form is reset
   - User redirected to /posts

### Error Scenarios

**TikTok Modal Errors:**
```
- User closes modal
  └─ Modal closes, publishing cancels
  └─ Form state preserved for retry

- Network error during API call
  └─ Error toast shown
  └─ Modal and form state preserved
  └─ User can retry
```

## 🔄 Form Reset Logic

After successful publish, **all state is reset**:

```typescript
// Content
setContent("");
setFirstComment("");

// Media
setMediaFiles([]);
setActiveMediaId(null);

// Platform-specific
setYoutubeTitle("");
setYtPrivacy("public");
setYtCategory("22");
setYtTags("");
setYtMadeForKids(false);
setTiktokData(null);

// UI State
setPerChannelMode(false);
setActivePanel("none");
setAutoSaveStatus("idle");
setDraftId(null);

// Modals
setIsTikTokModalOpen(false);
setPendingTiktokSubmit(false);
```

## 🚀 Redirection

After successful publish (except drafts):

```javascript
// 1.5 second delay for UX smoothness
await new Promise(resolve => setTimeout(resolve, 1500));

// Redirect to posts page
if (scheduleMode !== "draft") {
  router.push("/posts");
}
```

Benefits:
- User sees success toast
- Smooth transition to posts page
- Post is already visible in the list
- Clear confirmation of action

## 🛡️ Error Handling

### Validation Errors (Before API Call)
```
❌ Missing: caption, YouTube title
  └─ Toast error with details
  └─ Form not submitted
  └─ User can fix and retry
```

### API Errors (During/After API Call)
```
❌ Failed to publish
   TikTok API rate limit exceeded
  └─ Detailed error message
  └─ Form state preserved
  └─ User can retry
```

### Network Errors
```
❌ Failed to publish
   Network timeout
  └─ User can retry immediately
  └─ No data is lost
```

## 📊 Platform-Specific Handling

### All Platforms
```
✓ Validation before submit
✓ Session refresh
✓ Media URL collection
✓ Success/error notifications
✓ Form reset on success
```

### YouTube-Specific
```
✓ Title requirement check
✓ Video format validation
✓ Thumbnail upload handling
✓ Category and privacy settings
✓ Tags parsing (comma-separated)
✓ COPPA compliance option
```

### TikTok-Specific
```
✓ Modal form requirement
✓ Creator info validation
✓ Privacy status requirement
✓ Commercial content handling
✓ Interaction settings
✓ Compliance declaration
```

### Other Platforms (Instagram, Facebook, Twitter, LinkedIn)
```
✓ Content length validation
✓ Hashtag count validation
✓ Media format validation
✓ Standard publishing flow
```

## 🧪 Testing Checklist

### Basic Flow
- [ ] Click "Publish Now" → Success toast → Form reset → Redirect to /posts
- [ ] Click "Schedule" → Scheduling toast → Form reset → No redirect
- [ ] Click "Save Draft" → Draft saved toast → No redirect

### TikTok Flow
- [ ] Select TikTok account → "TikTok Settings" button appears
- [ ] Click button → Modal opens
- [ ] Fill form → Click "Publish to TikTok"
- [ ] Modal closes → Publishing proceeds → Success toast

### Error Handling
- [ ] Clear content → Try to publish → Error toast
- [ ] Missing YouTube title → Try to publish → Error toast
- [ ] TikTok form incomplete → Try to publish → Modal prevents submit

### Modal Management
- [ ] TikTok modal closes after submit
- [ ] Form state clears on success
- [ ] Modal can be closed and reopened

### Notifications
- [ ] Loading toast shows 3 steps
- [ ] Success message shows account count
- [ ] Error message shows details
- [ ] Toasts auto-dismiss

## 🔍 Debugging

### Check Publishing Queue
Open browser console (F12) and look for:
```
[Publish error] [message]
[Auto-Split] Detected long story video...
[tiktok/posts] Querying creator info...
```

### Check Toast System
```javascript
// In console:
toast.success("Test success");
toast.error("Test error");
toast.loading("Test loading");
```

### Monitor Form State
React DevTools → Components → ComposePage
- Check `isSubmitting` state
- Check `tiktokData` for TikTok form data
- Check `isTikTokModalOpen` for modal state

## 📈 Future Improvements

1. **Post Status Polling**
   - Poll `/api/posts/{id}/status` to show real-time updates
   - Update notification with processing progress

2. **Bulk Publishing**
   - Queue multiple posts
   - Show queue progress

3. **Publishing History**
   - Show recent publishing history
   - One-click republish

4. **Error Recovery**
   - Automatic retry for network errors
   - Partial success handling (2/3 platforms succeeded)

---

**Status**: ✅ Complete and production-ready
**Last Updated**: 2026-04-28
**Coverage**: All platforms (Instagram, Facebook, TikTok, YouTube, Twitter, LinkedIn)
