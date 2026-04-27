# 🚀 Outstand.so API — Quick Start

Your TikTok API integration is now ready! Here's how to use it.

## Your API Key

You provided: `post_itexzDgFSyeEccRcjHqADgjnISABCCJXQAYKcUtUidJVvpRvWRzKxVbpcEHLpvzL`

## Setup (3 Steps)

### 1. Add the API Key to Your Workspace

1. Go to **Settings** → **Workspace** tab
2. Scroll down to "Outstand API Key"
3. Paste your API key: `post_itexzDgFSyeEccRcjHqADgjnISABCCJXQAYKcUtUidJVvpRvWRzKxVbpcEHLpvzL`
4. Click **"Test Connection"** to verify it works
5. Click **"Save Changes"**

### 2. Start Posting to TikTok

1. Go to **Create** → Select **TikTok**
2. Upload a video and add a caption
3. Click **Publish Now** or **Schedule**
4. Your post will be published via Outstand.so! 🎉

### 3. Check Analytics

Published posts will show analytics like:
- Likes
- Comments
- Shares
- Views

## What This Enables

✅ **Direct TikTok Posting** — No need for TikTok's OAuth flow  
✅ **Scheduled Posts** — Schedule TikTok videos for later  
✅ **Multiple Accounts** — Post to multiple TikTok accounts with one API key  
✅ **Fallback Support** — Falls back to official TikTok API if Outstand fails  
✅ **Analytics Tracking** — Monitor post performance  

## How It Works

```
You create a post
      ↓
System uses Outstand.so API
      ↓
Publishes to TikTok immediately (or scheduled)
      ↓
If Outstand fails → Falls back to official TikTok API
```

## API Key Format

Your key format: `post_[40+ random characters]`

- ✅ Starts with `post_`
- ✅ At least 32 characters long
- ✅ Alphanumeric

## Security

- 🔒 Your API key is **encrypted** in the database
- 🔒 Only workspace owners can see/modify it
- 🔒 Never shared with third parties
- 🔒 Can be revoked anytime in Outstand dashboard

## Troubleshooting

### ❌ "API key rejected by Outstand"
→ Check that your key is correct (copy directly from Outstand dashboard)  
→ Verify it hasn't expired or been revoked  

### ❌ "Connection failed"
→ Check your internet connection  
→ Verify Outstand.so is online (status.outstand.so)  

### ❌ "Post failed even with valid key"
→ Check your video format (MP4, MOV recommended)  
→ Verify video duration meets TikTok requirements  
→ Check workspace quota limits  

## Need Help?

📖 Full setup guide: `docs/OUTSTAND_SETUP.md`  
🔗 Outstand.so support: https://support.outstand.so  
💬 GitHub issues: Report bugs and feature requests  

---

**You're all set!** Start posting to TikTok via Outstand.so. 🎬
