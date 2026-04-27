# 🚀 Vercel Deployment Guide

Your code is now on GitHub! Follow these steps to deploy on Vercel.

## Option 1: Deploy via Vercel Web UI (Easiest)

### 1. Go to Vercel Dashboard
- Visit https://vercel.com/dashboard
- Sign in with your GitHub account

### 2. Import GitHub Repository
- Click **"New Project"**
- Select **"Import Git Repository"**
- Search for: `Onelinker-Final-001`
- Click **"Import"**

### 3. Configure Project
- **Framework**: Next.js (auto-detected)
- **Build Command**: `next build` (already set in vercel.json)
- **Install Command**: `npm install --legacy-peer-deps` (already set)

### 4. Set Environment Variables
Before deploying, add these required variables in Vercel dashboard:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

**To get these:**
1. Go to your Supabase project
2. Settings → API → Copy the keys

### 5. Deploy
- Click **"Deploy"**
- Wait for deployment to complete
- You'll get a live URL! 🎉

---

## Option 2: Deploy via Vercel CLI

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login to Vercel
vercel login

# 3. Deploy
vercel --prod

# 4. Add environment variables when prompted
```

---

## Deployment Configuration

Your `vercel.json` is already configured:
```json
{
  "framework": "nextjs",
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "next build"
}
```

✅ This is correct and ready to deploy.

---

## GitHub Integration (Auto-Deploy)

Once your project is linked in Vercel:
- ✅ Every push to `master` branch = automatic deployment
- ✅ Pull requests get preview deployments
- ✅ Automatic rollback on failed builds

---

## Custom Domain (Optional)

After deployment:
1. Go to **Settings** → **Domains**
2. Add your custom domain
3. Follow DNS instructions

---

## Environment Variables for Production

Make sure these are set in Vercel:
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Public anon key
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key (keep secret!)
- `NEXT_PUBLIC_APP_URL` - Your deployed URL (for OAuth redirects)

---

## Monitoring Deployment

After deployment:
- Check Vercel Analytics: https://vercel.com/dashboard
- View logs: Click on your project → Deployments
- Monitor real-time activity

---

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Verify all environment variables are set
- Run `npm install --legacy-peer-deps` locally first

### Environment Variables Not Loading
- Ensure variables are set in Vercel dashboard (not in .env)
- For public variables, use `NEXT_PUBLIC_` prefix
- Redeploy after adding/changing variables

### Database Connection Issues
- Verify Supabase credentials are correct
- Check network access settings in Supabase
- Test connection locally with same credentials

---

## Your GitHub Repo

Repository: https://github.com/wwwbilalnazam-bot/Onelinker-Final-001

✅ All code is pushed and ready to deploy!

---

**Next Steps:**
1. Go to https://vercel.com/dashboard
2. Click "New Project"
3. Import your GitHub repository
4. Add environment variables
5. Click Deploy
6. Your app will be live in ~2-3 minutes! 🎉
