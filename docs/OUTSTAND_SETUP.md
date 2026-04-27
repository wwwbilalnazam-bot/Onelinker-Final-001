# Outstand.so API Setup Guide

This guide explains how to set up the Outstand.so API for posting to TikTok and other social media platforms.

## What is Outstand.so?

Outstand.so is a social media API aggregator that provides a unified interface for posting to multiple platforms. In Onelinker, we use it as a **fallback** when direct platform APIs are unavailable or as a **primary method** for TikTok posting.

## Setup Steps

### 1. Get Your Outstand API Key

1. Visit [Outstand.so](https://outstand.so)
2. Sign up or log in to your account
3. Go to Settings → API Keys
4. Create a new API key (it will start with `post_`)
5. Copy the full key (it looks like: `post_itexzDgFSyeEccRcjHqADgjnISABCCJXQAYKcUtUidJVvpRvWRzKxVbpcEHLpvzL`)

### 2. Add the API Key to Your Workspace

#### Via the UI (Recommended)
1. Go to **Settings** → **Workspace**
2. Scroll down to "Outstand API Key"
3. Paste your API key into the field
4. Click "Test Connection" to verify it works
5. Click "Save Changes"

#### Via API (For Automation)
```bash
curl -X PATCH https://yourapp.com/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-uuid",
    "outstandApiKey": "post_xxxxxxxxxxxxx"
  }'
```

### 3. Test the Integration

Once you've added the API key:

1. Go to the **Create** page
2. Select **TikTok** as your platform
3. Create a post and publish it
4. The system will try to post via Outstand.so first
5. If Outstand succeeds, you'll see a post ID prefixed with `os_`

## How It Works

### TikTok Posting Flow

```
User creates post
    ↓
System retrieves Outstand API key from workspace
    ↓
Attempt to publish via Outstand.so API
    ↓
    ├─ Success → Post published (marked with os_ prefix)
    │
    └─ Failure → Fall back to official TikTok API
                  ↓
                  Success/Failure
```

### Features Enabled by Outstand

With the Outstand API key configured:

- ✅ **Immediate posting** to TikTok
- ✅ **Scheduled posts** to TikTok
- ✅ **Analytics** from published posts
- ✅ **Fallback** to official TikTok API if needed
- ✅ **Multi-account support** via single API key

## Security Notes

- **Never commit API keys** to version control
- **Don't share** your API key with anyone
- API keys are **encrypted at rest** in the database
- **Revoke immediately** if compromised
- Use **environment variables** for local development

### For Development

Set up a `.env.local` file with a test workspace:
```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

Then test the API key via the settings UI.

## Troubleshooting

### "API key rejected by Outstand"
- Check that the key starts with `post_`
- Verify the key hasn't expired
- Ensure it hasn't been revoked in Outstand dashboard

### "Outstand API is unavailable"
- Outstand.so might be down
- Check [status.outstand.so](https://status.outstand.so)
- Try again in a few minutes

### "Invalid API key format"
- API keys must start with `post_`
- Keys must be at least 32 characters long
- Copy the entire key from Outstand dashboard

### Post fails even with valid key
- Check the post content meets platform requirements
- Verify video file is properly encoded
- Check workspace has sufficient quota

## API Endpoints

### Validate Key
```bash
GET /api/outstand/validate-key?workspaceId=xxx
```

Response (valid):
```json
{
  "valid": true,
  "message": "API key is valid and connected to Outstand"
}
```

Response (invalid):
```json
{
  "valid": false,
  "error": "API key rejected by Outstand (invalid or revoked)"
}
```

## Environment Variables

Optional configuration:

```env
# Override the Outstand API base URL (defaults to https://api.outstand.so/v1)
OUTSTAND_API_BASE_URL=https://api.outstand.so/v1
```

## Support

For issues with Outstand.so itself:
- Visit [Outstand.so Support](https://support.outstand.so)
- Email: support@outstand.so

For issues with Onelinker integration:
- Check GitHub issues
- Email: support@onelinker.ai
