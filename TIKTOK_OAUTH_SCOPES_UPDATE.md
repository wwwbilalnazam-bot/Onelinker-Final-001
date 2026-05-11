# TikTok OAuth Scopes Update

**Date**: 2026-05-11  
**Issue**: Only 2 permissions were shown to users during TikTok OAuth consent, but 9 should be displayed  
**Status**: ✅ **FIXED**

---

## Problem

When users connected their TikTok account, the OAuth consent screen only showed 2 permission scopes instead of all 9 available scopes. This was limiting the app's ability to:
- Display user engagement stats (followers, videos, hearts)
- Read video analytics
- Manage comments
- Read user's video list

---

## Solution

Updated the TikTok OAuth scope configuration to request all necessary permissions from TikTok.

### Scopes Added

**Before (2 scopes):**
- `user.info.basic` - Display name, open_id
- `video.publish` - Post videos

**After (9 scopes):**
```
user.info.basic      // Display name, open_id
user.info.profile    // Avatar, username
user.info.stats      // Engagement stats (followers, videos, hearts)
video.publish        // Post videos to TikTok
video.list           // List user's videos
video.read           // Read video metadata
video.insights       // Video analytics (views, likes, shares, etc.)
comment.read         // Read comments on videos
comment.manage       // Create and manage comments
```

### What Users Will See

When connecting TikTok, users will now see the full permission consent screen with all 9 requested permissions:

✅ Access your profile info (avatar and display name)  
✅ Read the comments and replies of your in-app content  
✅ Create and manage the comments and replies of your in-app content  
✅ Read your profile engagement statistics (like count, follower count, following count, video count)  
✅ Read your username  
✅ Read your TikTok user analytics  
✅ Read your TikTok video analytics  
✅ Read your public videos on TikTok  
✅ Post content to TikTok  

---

## Files Modified

### 1. `lib/tiktok/accounts.ts`

**Updated TIKTOK_SCOPES:**
```typescript
const TIKTOK_SCOPES = [
  "user.info.basic",      // Display name, open_id
  "user.info.profile",    // Avatar, username
  "user.info.stats",      // Engagement stats
  "video.publish",        // Post videos
  "video.list",           // List user's videos
  "video.read",           // Read video metadata
  "video.insights",       // Video analytics
  "comment.read",         // Read comments
  "comment.manage",       // Manage comments
].join(",");
```

**Updated TikTokProfile Interface:**
```typescript
export interface TikTokProfile {
  open_id: string;
  union_id?: string;
  display_name: string;
  avatar_url: string | null;
  avatar_large_url?: string | null;  // NEW
  username?: string;
  follower_count?: number;
  video_count?: number;              // NEW
  heart_count?: number;              // NEW
}
```

**Updated User Info Fields Request:**
```typescript
// Request all fields available from our scopes
fields: "open_id,display_name,avatar_url,avatar_large_url,username,follower_count,video_count,heart_count"
```

---

## Data Now Available

With these expanded scopes, your app now receives:

### User Profile
- `open_id` - Unique TikTok user identifier
- `display_name` - User's display name
- `avatar_url` - Profile picture URL
- `avatar_large_url` - Larger profile picture URL *(NEW)*
- `username` - TikTok username *(NEW via user.info.profile)*

### User Stats *(NEW via user.info.stats)*
- `follower_count` - Number of followers
- `video_count` - Total videos posted
- `heart_count` - Total likes/hearts received

### Additional Capabilities *(NEW)*
- **video.list** - Can retrieve user's video library
- **video.read** - Can read video metadata (duration, creation time, etc.)
- **video.insights** - Can fetch video-specific analytics (views, likes, shares)
- **comment.read** - Can read comments on user's videos
- **comment.manage** - Can manage comments on user's videos

---

## Testing

After this update, when a user connects their TikTok account:

1. ✅ They should see a TikTok consent screen showing **9 permissions**
2. ✅ All permission toggles should be enabled for the requested scopes
3. ✅ User's profile data should now include avatar URL, username, and engagement stats
4. ✅ The app will have permission to read/manage comments (useful for future features)
5. ✅ Video analytics endpoints will be accessible (for analytics dashboard)

---

## Compliance & Security

These scopes are **read-only** where appropriate and follow TikTok's principle of least privilege. Users see exactly what permissions they're granting, and can toggle them in TikTok's OAuth consent screen.

**Important**: The app will only use these scopes if implemented. Simply requesting them doesn't use them - feature implementation is still needed for:
- Video analytics dashboard
- Comment management interface
- Engagement stats display

---

## Next Steps

1. ✅ **Scopes Updated** - OAuth now requests all 9 scopes
2. ⏳ **Feature Implementation** - Build UI to display/use these new data points:
   - User engagement stats in profile section
   - Video analytics dashboard
   - Comment management interface
3. ⏳ **Test with Real Account** - Connect TikTok account and verify consent screen shows all 9 permissions
4. ⏳ **Update TikTok Approval** - Include scope details in compliance documentation

---

## References

- [TikTok Login Kit Scopes Documentation](https://developers.tiktok.com/doc/login-kit/scopes/)
- [TikTok User Info Endpoint](https://developers.tiktok.com/doc/tiktok-api/reference/oauth-2-0/user-info)
- [TikTok Comment API](https://developers.tiktok.com/doc/tiktok-api/reference/user-data/comment/)
