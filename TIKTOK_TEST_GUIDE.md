# TikTok Settings Modal - Quick Test Guide

## ✅ What's Fixed

Your TikTok integration now has a **prominent button** that appears when you select a TikTok account. Users can now:

1. ✅ See a "TikTok Settings" button in the compose form
2. ✅ Click it **anytime** (not just when publishing)
3. ✅ Configure all TikTok-specific settings in a modal
4. ✅ See their settings summary right on the button
5. ✅ Fill in all required fields before publishing

## 🎯 How It Works Now

### Step-by-Step Flow

```
1. Open compose form
   ↓
2. Select a TikTok account (in the channel selector)
   ↓
3. NEW: "TikTok Settings" button appears!
   ↓
4. Click the button anytime to open the TikTok modal
   ↓
5. Fill in all required fields:
   - Title (required)
   - Privacy Status (required)
   - Allow Comments/Duets/Stitches (optional)
   - Commercial Content (optional)
   ↓
6. Click "Publish to TikTok" in the modal
   ↓
7. Settings are saved and shown on the button
   ↓
8. When ready, click "Publish Now" or "Schedule" to post
```

## 📍 Where to Find It

1. **Open Create Page** - `/create`
2. **Select TikTok Account** - Check the TikTok account in the accounts list at the top
3. **Look for Button** - A new box appears below YouTube Settings that says:
   ```
   📱 TikTok Settings
   Configure privacy, interactions & commercial disclosure
   ```
4. **Click It** - Opens the full TikTok form in a modal

## ✨ Features

- ✅ Button shows **only when TikTok is selected**
- ✅ Displays settings summary once filled in
- ✅ All fields are **editable anytime**
- ✅ Modal prevents invalid combinations:
  - Can't set private + branded content
  - Must select privacy status
  - Must fill title
- ✅ Dynamic compliance text updates based on content type
- ✅ Full validation before allowing publish

## 🧪 Quick Test

1. **Navigate to**: http://localhost:3000/create
2. **Select TikTok**: Check a TikTok account
3. **Look below YouTube Settings** - You should see:
   ```
   📱 TikTok Settings
   Configure privacy, interactions & commercial disclosure
   ```
4. **Click the button** - Modal should open
5. **Fill out fields**:
   - Title: "My Awesome TikTok Video" (required)
   - Privacy: Select "Public" (required)
   - Allow Comments: Check it
   - Click "Publish to TikTok"
6. **Settings Summary**: Button shows:
   ```
   ✓ Title: My Awesome TikTok Video
   ✓ Privacy: Public
   ```
7. **Now Publish**: Click "Publish Now" or "Schedule"

## 🐛 Troubleshooting

**Button doesn't appear?**
- Make sure you have a TikTok account connected
- Make sure TikTok is selected (checkbox is checked)
- Refresh the page if needed

**Modal doesn't open?**
- Check browser console for errors (F12)
- Try clicking the button again
- Refresh the page

**Form validation errors?**
- Title is required (max 150 chars)
- Privacy status must be selected (no default)
- Commercial content requires at least one option if enabled

## 📋 What the Modal Contains

### Section 1: Creator Info (Auto-fetched)
- Your TikTok account nickname
- Posts remaining today (0-15)
- Max video duration (600s / 10 min)

### Section 2: Post Details
- **Title** (required, max 150 chars)
- **Privacy Status** (required, no default):
  - Private (Only Me)
  - Friends Only
  - Public

### Section 3: Interaction Settings (All unchecked by default)
- Allow Comments
- Allow Duets
- Allow Stitches

### Section 4: Commercial Disclosure (Optional)
- Toggle: "This is commercial content"
- When enabled:
  - ☑️ Your Brand
  - ☑️ Branded Content

### Section 5: Compliance Declaration
- Dynamic text based on your selections
- Shows what TikTok policy you're agreeing to

### Section 6: Actions
- Content preview
- "Publish to TikTok" button

## 🎓 Pro Tips

- Fill out TikTok settings **before** uploading media for best UX
- You can come back and edit settings anytime
- Settings persist if you close and reopen the modal
- Draft mode skips the TikTok modal (just saves as-is)
- Settings are included in the final publish request

## ✅ Verification Checklist

Before submitting to TikTok for approval:

- [ ] Button appears when TikTok is selected
- [ ] Modal opens when button is clicked
- [ ] Title field appears and validates
- [ ] Privacy dropdown shows all 3 options
- [ ] Interaction checkboxes all appear unchecked
- [ ] Commercial toggle shows/hides options
- [ ] Compliance text changes based on selections
- [ ] Form prevents invalid states (e.g., private + branded)
- [ ] Settings summary shows on button
- [ ] Can click "Publish to TikTok" and submit

## 🚀 Next Steps

1. **Test thoroughly** - Try all combinations
2. **Verify modal renders** - Check all fields appear
3. **Test validation** - Try to submit with missing fields
4. **Upload to TikTok** - Follow their approval process
5. **Share with TikTok** - Reference this guide in your submission

---

**Status**: ✅ Ready for user testing and TikTok submission
