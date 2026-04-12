"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Zap, ArrowRight, CheckCircle2, Star, ChevronDown,
  Calendar, BarChart3, Sparkles, Users, Shield, Smartphone,
  Twitter, Linkedin, Instagram, Youtube, Facebook,
  Clock, Layers, Globe, PenTool, TrendingUp, Eye,
  Image as ImageIcon, Send, MoreHorizontal, Heart, MessageCircle,
  Repeat2, Bookmark, Play, Hash, AtSign, Bell, Settings2, X, Plus,
} from "lucide-react";
import { useState } from "react";
import { AnimatedSection, StaggerChildren } from "@/components/ui/animated-section";
import Image from "next/image";

/* ─── Platform icons ───────────────────────────────────────── */

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z" />
    </svg>
  );
}

function PinterestIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

function ThreadsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.29 3.276-1.06 1.316-2.572 2.013-4.5 2.072h-.031c-1.604-.05-2.907-.58-3.874-1.574-1.08-1.11-1.636-2.66-1.654-4.612l.003-.078c.072-2.027.734-3.573 1.97-4.6 1.148-.954 2.69-1.457 4.459-1.457l.14.001c1.845.03 3.386.608 4.58 1.716.554.515.994 1.118 1.322 1.8.352-.18.675-.38.968-.6l.257-.198 1.074 1.69-.264.204c-.554.427-1.167.784-1.828 1.065.088.376.148.763.178 1.16.076 1.002-.07 2.026-.434 3.048-.707 1.984-2.1 3.386-4.038 4.064-1.124.393-2.394.567-3.794.567l-.136-.001zm-.12-9.505c-.12 0-.238.004-.355.011-1.168.068-2.083.466-2.722 1.182-.632.71-.978 1.716-1.028 2.994.02 1.46.395 2.56 1.114 3.27.627.617 1.497.956 2.588.987h.018c1.352-.04 2.376-.489 3.043-1.336.55-.697.932-1.69 1.098-2.862-.592-.232-1.236-.385-1.932-.46a8.737 8.737 0 0 0-.961-.053c-.333 0-.662.025-.986.074l-.326-2.02c.44-.072.889-.108 1.337-.108.602 0 1.178.056 1.725.167-.077-.278-.185-.543-.323-.794-.72-1.312-2.07-1.997-3.892-2.04l-.398-.012z"/>
    </svg>
  );
}

function BlueskyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.785 2.627 3.601 3.497 6.225 3.165-.363.113-.72.26-1.08.42-2.614 1.18-2.083 3.5-.505 4.782 2.997 2.434 5.504.717 6.736-1.614.156-.296.3-.602.414-.872.115.27.258.576.414.872 1.232 2.331 3.739 4.048 6.736 1.614 1.578-1.282 2.109-3.602-.504-4.782a6.42 6.42 0 0 0-1.081-.42c2.624.332 5.44-.538 6.225-3.165C24.455 9.418 24.833 4.458 24.833 3.768c0-.69-.139-1.86-.902-2.203-.66-.299-1.664-.621-4.3 1.24C16.879 4.747 13.92 8.686 12.833 10.8h-.833z"/>
    </svg>
  );
}

const PLATFORMS = [
  { name: "X (Twitter)", icon: Twitter, color: "text-sky-400" },
  { name: "Instagram", icon: Instagram, color: "text-pink-400" },
  { name: "Facebook", icon: Facebook, color: "text-blue-400" },
  { name: "LinkedIn", icon: Linkedin, color: "text-blue-500" },
  { name: "YouTube", icon: Youtube, color: "text-red-400" },
  { name: "TikTok", icon: TikTokIcon, color: "text-teal-400" },
  { name: "Pinterest", icon: PinterestIcon, color: "text-rose-400" },
  { name: "Threads", icon: ThreadsIcon, color: "text-zinc-400" },
  { name: "Bluesky", icon: BlueskyIcon, color: "text-blue-400" },
] as const;

/* ─── Features ──────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Globe,
    title: "10+ Platforms, One Dashboard",
    description:
      "Manage X, Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky, and Google Business — all from a single interface.",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling & Publishing",
    description:
      "Schedule posts with images, videos, stories, and carousels. Set recurring schedules and let Onelinker publish automatically.",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    icon: Sparkles,
    title: "AI-Powered Content Creation",
    description:
      "Generate captions, hashtags, and content ideas with built-in AI. Write better posts in seconds, not hours.",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    icon: Layers,
    title: "Visual Planning & Collaboration",
    description:
      "Multi-brand workspaces, drag-and-drop content calendar, shared asset library, and team approval workflows.",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics & Insights",
    description:
      "Track engagement, reach, and growth across every platform. Exportable reports and performance comparisons.",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
  {
    icon: Shield,
    title: "Built for Comfort & Growth",
    description:
      "Dark mode, mobile-optimized, regular updates, and bank-grade security. Start free and scale to agency-level.",
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
] as const;

/* ─── Stats ─────────────────────────────────────────────────── */

const STATS = [
  { value: "10+", label: "Platforms supported", icon: Globe },
  { value: "50K+", label: "Posts scheduled", icon: Send },
  { value: "5,000+", label: "Happy creators", icon: Users },
  { value: "99.9%", label: "Uptime reliability", icon: Shield },
] as const;

/* ─── Testimonials ─────────────────────────────────────────── */

const TESTIMONIALS = [
  {
    name: "Sarah Chen",
    role: "Content Creator",
    followers: "125K followers",
    avatar: "SC",
    avatarBg: "bg-pink-500",
    quote: "Onelinker replaced 4 different tools for me. I schedule to Instagram, TikTok, LinkedIn, and YouTube all at once. Saves me at least 8 hours a week.",
    platform: Twitter,
    platformColor: "text-sky-400",
  },
  {
    name: "Marcus Williams",
    role: "Marketing Agency Owner",
    followers: "32 clients",
    avatar: "MW",
    avatarBg: "bg-violet-500",
    quote: "Managing social for 32 clients used to be chaos. With Onelinker's workspaces and approval flows, my team runs like clockwork. The AI captions are surprisingly good too.",
    platform: Linkedin,
    platformColor: "text-blue-500",
  },
  {
    name: "Priya Patel",
    role: "E-commerce Brand",
    followers: "85K followers",
    avatar: "PP",
    avatarBg: "bg-emerald-500",
    quote: "The analytics alone are worth it. I finally know which posts drive actual sales vs just likes. Our engagement went up 40% in the first month.",
    platform: Instagram,
    platformColor: "text-pink-400",
  },
] as const;

/* ─── FAQ ───────────────────────────────────────────────────── */

const FAQS = [
  {
    q: "Is there a free plan?",
    a: "Yes! Our free plan includes 3 social channels, 50 posts per month, and access to all supported platforms. No credit card required.",
  },
  {
    q: "Which social platforms are supported?",
    a: "We support X (Twitter), Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky, Telegram, and Google Business Profile — with more coming soon.",
  },
  {
    q: "Can I schedule posts with images and videos?",
    a: "Absolutely. You can schedule posts with images, videos, carousels, stories, and reels depending on the platform.",
  },
  {
    q: "How does the AI content creation work?",
    a: "Our AI generates captions, hashtags, and content suggestions based on your brand voice. Just describe what you want and the AI writes it for you.",
  },
  {
    q: "Can I collaborate with my team?",
    a: "Yes. Pro and Agency plans support team members with role-based permissions, approval workflows, and shared workspaces.",
  },
  {
    q: "How is this different from Buffer or Hootsuite?",
    a: "Onelinker offers more platforms, AI-powered content, and better pricing. Our free tier is more generous, and our Agency plan costs a fraction of competitors.",
  },
] as const;

/* ─── FAQ Accordion Item ────────────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-left gap-4"
      >
        <span className="text-sm font-semibold text-foreground">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300",
          open ? "max-h-40 pb-5" : "max-h-0"
        )}
      >
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ─── Marquee for platforms ─────────────────────────────────── */

function PlatformMarquee() {
  const doubled = [...PLATFORMS, ...PLATFORMS];
  return (
    <div className="relative overflow-hidden">
      {/* Fade edges */}
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      <div className="flex animate-marquee gap-8 sm:gap-12">
        {doubled.map((p, i) => (
          <div
            key={`${p.name}-${i}`}
            className="flex items-center gap-2.5 shrink-0 px-4 py-2.5 rounded-xl border border-border/30 bg-card/40 hover:bg-card/70 hover:border-border/60 transition-all duration-200"
          >
            <p.icon className={cn("h-5 w-5", p.color)} />
            <span className="text-sm font-medium text-foreground/70 whitespace-nowrap">{p.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Realistic Upload Mockup ───────────────────────────── */

function UploadMockup() {
  return (
    <div className="relative rounded-2xl border border-border/20 bg-white dark:bg-[#1C1C1E] shadow-2xl overflow-hidden w-full max-w-5xl text-foreground font-sans ring-1 ring-black/5 mx-auto">
      <div className="flex flex-col lg:flex-row min-h-[560px]">
        
        {/* Left Pane */}
        <div className="flex-1 lg:max-w-[60%] p-5 lg:p-6 space-y-4 bg-[#F8F9FB] dark:bg-[#121212]">
          
          {/* Publish To Card */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-border/40 rounded-xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
              <div className="flex items-center gap-3">
                <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80">Publish To</h3>
                <span className="text-[11px] font-bold text-primary cursor-pointer hover:underline">Deselect all</span>
              </div>
              <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-border/50 text-[11px] font-bold text-muted-foreground/90 hover:bg-muted/30 transition shadow-sm">
                <Settings2 className="h-3.5 w-3.5" /> Customize per channel
              </button>
            </div>
            
            <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
              
              {/* Channel 1 */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group snap-start">
                <div className="relative h-16 w-16 rounded-3xl border-2 border-primary/20 p-1 group-hover:border-primary transition-colors">
                  <div className="h-full w-full rounded-2xl bg-teal-500 text-white flex items-center justify-center text-2xl font-bold shadow-inner">O</div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white dark:bg-black border border-border flex items-center justify-center shadow-sm">
                    <Youtube className="h-2.5 w-2.5 text-[#FF0000]" />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-foreground/90">One</span>
              </div>

              {/* Channel 2 */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group snap-start">
                <div className="relative h-16 w-16 rounded-3xl border border-border/60 p-1 hover:border-violet-400 transition-colors">
                  <div className="h-full w-full rounded-2xl bg-violet-100 dark:bg-violet-900/40 text-violet-600 flex items-center justify-center text-2xl font-bold shadow-inner">L</div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white dark:bg-black border border-border flex items-center justify-center shadow-sm">
                    <TikTokIcon className="h-2.5 w-2.5 text-black dark:text-white" />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-foreground/90">Luxury</span>
              </div>

              {/* Channel 3 */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group snap-start">
                <div className="relative h-16 w-16 rounded-3xl border border-border/60 p-1 group-hover:border-blue-400 transition-colors">
                  <div className="h-full w-full rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 shadow-inner">
                    <div className="w-8 h-8 rounded-full border-[3px] border-blue-400 border-t-blue-200" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white dark:bg-black border border-border flex items-center justify-center shadow-sm">
                    <Facebook className="h-2.5 w-2.5 text-[#1877F2]" fill="currentColor" />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-foreground/90">Bahria</span>
              </div>

              {/* Channel 4 */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group snap-start">
                <div className="relative h-16 w-16 rounded-3xl border border-border/60 p-1 group-hover:border-blue-400 transition-colors">
                  <div className="h-full w-full rounded-2xl bg-gradient-to-br from-pink-500 via-purple-500 to-blue-500 flex items-center justify-center shadow-inner" />
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white dark:bg-black border border-border flex items-center justify-center shadow-sm">
                    <Facebook className="h-2.5 w-2.5 text-[#1877F2]" fill="currentColor" />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-foreground/90">Test</span>
              </div>

              {/* Channel 5 */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group snap-start">
                <div className="relative h-16 w-16 rounded-3xl border border-border/60 p-1 hover:border-pink-400 transition-colors">
                  <div className="h-full w-full rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shadow-inner">
                    <Clock className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white dark:bg-black border border-border flex items-center justify-center shadow-sm">
                    <Instagram className="h-2.5 w-2.5 text-[#E4405F]" />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-foreground/90">Test</span>
              </div>

              {/* Channel 6 */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group snap-start">
                <div className="relative h-16 w-16 rounded-3xl border border-border/60 p-1 hover:border-blue-400 transition-colors">
                  <div className="h-full w-full rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-inner">
                    <span className="text-[28px] font-sans font-bold -mt-1 tracking-tighter">O</span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-white dark:bg-black border border-border flex items-center justify-center shadow-sm">
                    <Facebook className="h-2.5 w-2.5 text-[#1877F2]" fill="currentColor" />
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-foreground/90">OneLinker</span>
              </div>

              {/* Add Button */}
              <div className="flex flex-col items-center gap-2 cursor-pointer group snap-start">
                <div className="h-16 w-16 rounded-full border-2 border-dashed border-border/40 hover:border-primary/40 bg-transparent flex items-center justify-center transition-all group-hover:scale-105 group-hover:bg-primary/5">
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                </div>
                <span className="text-[11px] font-semibold text-transparent select-none">Add</span>
              </div>
            </div>
          </div>

          {/* Post Format */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-border/40 rounded-xl p-4 shadow-sm flex items-center justify-between">
             <div className="flex items-center gap-4">
               <h3 className="text-[11px] font-black uppercase tracking-widest text-muted-foreground/80">Post Format</h3>
               <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 text-[11px] font-bold border border-violet-200 dark:border-violet-800/50">
                 <Sparkles className="h-3 w-3" /> Auto-detected
               </span>
             </div>
             <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
          </div>

          {/* Caption Area */}
          <div className="bg-white dark:bg-[#1C1C1E] border border-border/40 rounded-xl p-6 shadow-sm min-h-[220px] flex flex-col justify-between">
             <div className="text-[13px] text-foreground/90 font-medium leading-relaxed font-sans">
               Start your day the right way 🌞 <br/>
               Freshly brewed coffee, rich aroma, and the perfect moment of calm. <br/><br/>
               Made from premium beans, crafted for real coffee lovers. <br/>
               <span className="text-foreground/70">#CoffeeLovers #MorningVibes #FreshBrew #CafeLife #DailyRitual</span>
             </div>
             
             {/* Limit progress bars */}
             <div className="mt-8 space-y-4">
                <div className="flex items-center text-[10px] text-muted-foreground font-semibold">
                   <Instagram className="h-3.5 w-3.5 text-[#E4405F]" />
                   <div className="h-1 bg-muted/60 rounded-full w-24 mx-3 overflow-hidden">
                     <div className="h-full bg-[#E4405F] w-[40%]" />
                   </div>
                   <span className="w-8">1982</span>
                   <span className="text-muted-foreground/50 w-10">#5/30</span>
                   
                   <Facebook className="h-3.5 w-3.5 text-[#1877F2] ml-4" />
                   <div className="h-1 bg-muted/60 rounded-full w-24 mx-3 overflow-hidden">
                     <div className="h-full bg-[#1877F2] w-[60%]" />
                   </div>
                   <span className="w-8">1782</span>
                   <span className="text-[#E4405F] flex items-center gap-1 w-10">#5/3 <div className="h-2.5 w-2.5 rounded-full border border-current flex items-center justify-center text-[6px]">!</div></span>

                   <TikTokIcon className="h-3 w-3 text-foreground ml-3" />
                   <div className="h-1 bg-muted/60 rounded-full w-24 mx-3 overflow-hidden">
                     <div className="h-full bg-violet-600 w-[20%]" />
                   </div>
                   <span className="w-8">1982</span>
                   <span className="text-muted-foreground/50 w-10">#5/5</span>
                </div>
                
                <div className="flex items-center text-[10px] text-muted-foreground font-semibold">
                   <Youtube className="h-3.5 w-3.5 text-[#FF0000]" />
                   <div className="h-1 bg-muted/60 rounded-full w-24 mx-3 overflow-hidden">
                     <div className="h-full bg-[#FF0000] w-[30%]" />
                   </div>
                   <span className="w-8">4782</span>
                   <span className="text-muted-foreground/50 w-10">#5/15</span>
                </div>
             </div>
          </div>
        </div>

        {/* Right Pane (Preview) */}
        <div className="w-full lg:w-[420px] bg-background lg:border-l border-border/30 p-6 flex flex-col relative pt-12 lg:pt-6">
           <button className="absolute top-4 right-4 h-8 w-8 flex items-center justify-center rounded-full hover:bg-muted/80 transition-colors border border-border/20 text-muted-foreground bg-muted/20">
              <X className="h-4 w-4" />
           </button>

           <div className="bg-[#F8F9FB] dark:bg-[#121212] rounded-xl flex items-center justify-between p-3.5 mb-6 border border-border/40 shadow-sm mt-4 lg:mt-0">
             <div className="flex items-center gap-2 text-xs font-bold text-foreground/80 tracking-wide">
               <Eye className="h-4 w-4 text-muted-foreground/80" /> Video • 1920x1080
             </div>
           </div>

           {/* Mobile card preview inside */}
           <div className="border border-border/40 rounded-[24px] bg-white dark:bg-[#1C1C1E] shadow-[0_8px_30px_rgb(0,0,0,0.06)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] flex-1 flex flex-col overflow-hidden max-h-[400px]">
              {/* Thumbnail image */}
              <div className="relative h-[220px] bg-muted w-full shrink-0">
                <Image src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80" alt="Resort" className="object-cover w-full h-full" fill />
                {/* Play button */}
                <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                   <div className="h-14 w-14 rounded-full bg-black/50 backdrop-blur-md flex items-center justify-center hover:bg-black/70 transition-colors shadow-lg cursor-pointer">
                     <Play className="h-6 w-6 text-white ml-1" fill="white" />
                   </div>
                </div>
                {/* Duration */}
                <div className="absolute bottom-3 right-3 px-2 py-1 rounded-full bg-black/80 text-white text-[10px] font-bold tracking-wider backdrop-blur-md">
                  0:57
                </div>
                {/* Progress bar */}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-white/30 backdrop-blur-sm">
                  <div className="h-full bg-violet-500 rounded-r-full w-[25%]" />
                </div>
              </div>
              
              {/* Caption preview */}
              <div className="p-5 flex gap-3.5 flex-1 bg-white dark:bg-[#1C1C1E]">
                 <div className="h-10 w-10 rounded-full bg-teal-500 text-white font-bold flex items-center justify-center shrink-0 text-sm shadow-sm tracking-tighter">O</div>
                 <div className="min-w-0 pr-4">
                    <h4 className="text-[13px] text-foreground font-bold leading-snug line-clamp-2">
                       Made from premium beans, crafted for real coffee lovers. #CoffeeLovers #MorningVibes...
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-1.5 font-medium">One Linker</p>
                    <p className="text-[10px] text-muted-foreground/70 mt-0.5">0 views • Just now</p>
                 </div>
                 <MoreHorizontal className="h-5 w-5 text-muted-foreground/50 shrink-0 ml-auto" />
              </div>
           </div>
           
           {/* Stats below preview */}
           <div className="mt-8 space-y-5 px-2">
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold tracking-wide mb-2 uppercase">
                  <span className="text-muted-foreground/80">Characters</span>
                  <span className="text-foreground">218 <span className="text-muted-foreground/50 mx-1">/</span> 5,000</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-violet-500 w-[15%]" />
                </div>
              </div>
              
              <div>
                <div className="flex items-center justify-between text-[11px] font-bold tracking-wide mb-2 uppercase">
                  <span className="text-muted-foreground/80">Hashtags</span>
                  <span className="text-foreground">5 <span className="text-muted-foreground/50 mx-1">/</span> 15</span>
                </div>
                 <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-muted-foreground/30 w-[33%]" />
                </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Realistic Analytics Mockup ───────────────────────────── */

function AnalyticsMockup() {
  const barHeights = [35, 52, 45, 68, 58, 72, 65, 80, 75, 90, 82, 95, 88, 70, 78, 85, 92, 88, 95, 100, 92, 85, 90, 95];

  return (
    <div className="rounded-2xl border border-border/50 bg-card/60 p-5 space-y-4">
      {/* Chart header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Engagement Overview</p>
          <p className="text-xs text-muted-foreground">Last 30 days across all platforms</p>
        </div>
        <div className="flex gap-1.5">
          {["7d", "30d", "90d"].map((range) => (
            <button
              key={range}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                range === "30d"
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Platform filter pills */}
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {[
          { name: "All", active: true },
          { name: "Twitter", icon: Twitter, color: "text-sky-400" },
          { name: "Instagram", icon: Instagram, color: "text-pink-400" },
          { name: "LinkedIn", icon: Linkedin, color: "text-blue-500" },
        ].map((p) => (
          <div
            key={p.name}
            className={cn(
              "flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium shrink-0 border transition-colors",
              "active" in p && p.active
                ? "bg-primary/10 border-primary/30 text-primary"
                : "border-border/30 text-muted-foreground hover:border-border/60"
            )}
          >
            {"icon" in p && p.icon && <p.icon className={cn("h-2.5 w-2.5", p.color)} />}
            {p.name}
          </div>
        ))}
      </div>

      {/* Chart area with gradient bars */}
      <div className="relative">
        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-6 flex flex-col justify-between text-[9px] text-muted-foreground/40 pr-2">
          <span>10K</span>
          <span>5K</span>
          <span>0</span>
        </div>
        {/* Chart bars */}
        <div className="flex items-end gap-[3px] sm:gap-1.5 h-32 sm:h-44 pt-4 pl-7">
          {barHeights.map((h, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 rounded-t transition-all duration-300 relative group",
                i >= 18 && "hidden sm:block"
              )}
              style={{ height: `${h}%` }}
            >
              <div className="absolute inset-0 rounded-t bg-gradient-to-t from-primary/40 to-primary/15 group-hover:from-primary/60 group-hover:to-primary/30 transition-colors" />
              {/* Tooltip on hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-foreground text-background text-[9px] px-1.5 py-0.5 rounded whitespace-nowrap pointer-events-none">
                {Math.round(h * 100)}
              </div>
            </div>
          ))}
        </div>
        {/* X-axis */}
        <div className="flex justify-between pl-7 mt-1.5">
          <span className="text-[9px] text-muted-foreground/40">Mar 3</span>
          <span className="text-[9px] text-muted-foreground/40">Mar 17</span>
          <span className="text-[9px] text-muted-foreground/40">Apr 1</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[
          { label: "Total Reach", value: "124.5K", change: "+12.3%", icon: Eye },
          { label: "Engagement", value: "8.7K", change: "+24.1%", icon: Heart },
          { label: "New Followers", value: "1,203", change: "+8.5%", icon: Users },
        ].map((s) => (
          <div key={s.label} className="rounded-xl bg-muted/20 p-3 border border-border/20">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className="h-3 w-3 text-muted-foreground/50" />
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
            <p className="text-lg font-bold text-foreground">{s.value}</p>
            <p className="text-[10px] font-medium text-emerald-400 flex items-center gap-0.5">
              <TrendingUp className="h-2.5 w-2.5" /> {s.change}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function LandingPage() {
  return (
    <div className="overflow-hidden bg-background">
      {/* ════════ HERO ════════ */}
      <section className="relative pt-20 pb-24 lg:pt-32 lg:pb-40 overflow-hidden">
        {/* Animated Background Gradients */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] bg-violet-500/10 rounded-full blur-[100px] animate-pulse delay-700" />
          <div className="absolute bottom-[10%] left-[20%] w-[25%] h-[25%] bg-sky-500/10 rounded-full blur-[80px]" />
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/40 to-transparent" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-4xl mx-auto space-y-8">
            {/* Announcement Badge */}
            <AnimatedSection animation="fade-down" delay={100} className="flex justify-center">
              <Link
                href="/changelog"
                className="group inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-primary/5 hover:bg-primary/10 backdrop-blur-md px-4 py-2 text-xs font-bold text-primary transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <Image
                  src="/logo.png"
                  alt="Onelinker"
                  width={20}
                  height={20}
                  className="rounded-md"
                />
                <span>New: AI-powered content generation</span>
                <ChevronDown className="h-3.5 w-3.5 -rotate-90 text-primary/60 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </AnimatedSection>

            {/* Main Headline */}
            <AnimatedSection animation="fade-up" delay={200}>
              <h1 className="text-4xl sm:text-6xl lg:text-7xl font-medium text-foreground tracking-tight leading-[1.05]">
                Post Everywhere. <br />
                <span className="bg-gradient-to-r from-primary via-violet-500 to-sky-500 bg-clip-text text-transparent">
                  Automate Everything.
                </span>
              </h1>
            </AnimatedSection>

            {/* Subheading */}
            <AnimatedSection animation="fade-up" delay={300}>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-medium">
                The all-in-one platform for creators and agencies. Schedule, publish, and track 10+ social channels from one unified dashboard.
              </p>
            </AnimatedSection>

            {/* Hero CTAs */}
            <AnimatedSection animation="fade-up" delay={400} className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="/signup"
                className="group relative inline-flex items-center gap-2 rounded-full bg-foreground px-10 py-4 text-base font-bold text-background transition-all hover:scale-[1.03] active:scale-[0.97] shadow-xl hover:shadow-primary/25 w-full sm:w-auto overflow-hidden"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Start Free Now <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-white/50 dark:bg-black/50 backdrop-blur-md px-10 py-4 text-base font-bold text-foreground hover:bg-muted/80 transition-all w-full sm:w-auto justify-center"
              >
                <Play className="h-4 w-4 fill-foreground" /> See How it Works
              </Link>
            </AnimatedSection>

            {/* Social Proof Line */}
            <AnimatedSection animation="fade-up" delay={500} className="pt-8">
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6">
                <div className="flex -space-x-3">
                  {[
                    { initials: "SC", bg: "bg-pink-500" },
                    { initials: "MW", bg: "bg-violet-500" },
                    { initials: "PP", bg: "bg-emerald-500" },
                    { initials: "JL", bg: "bg-sky-500" },
                    { initials: "AR", bg: "bg-amber-500" },
                  ].map((a) => (
                    <div key={a.initials} className={cn("h-10 w-10 rounded-full border-4 border-background flex items-center justify-center text-[10px] font-black text-white shadow-sm", a.bg)}>
                      {a.initials}
                    </div>
                  ))}
                  <div className="h-10 w-10 rounded-full border-4 border-background bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                    +5K
                  </div>
                </div>
                <div className="text-left">
                  <div className="flex items-center gap-0.5 mb-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <p className="text-sm font-bold text-muted-foreground whitespace-nowrap">
                    Loved by <span className="text-foreground">5,000+</span> creators & agencies
                  </p>
                </div>
              </div>
            </AnimatedSection>
          </div>

          {/* Interactive Mockup Container */}
          <AnimatedSection animation="scale" delay={600} className="relative mt-20 lg:mt-32">
            <div className="relative group">
              {/* Floating Element 1 - Engagement Badge */}
              <div className="absolute -top-10 -left-10 z-20 hidden lg:block animate-bounce-slow">
                <div className="bg-white/80 dark:bg-black/80 backdrop-blur-xl border border-border/50 rounded-2xl p-4 shadow-2xl">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-muted-foreground uppercase">Engagement</p>
                      <p className="text-lg font-black text-foreground">+42.8%</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mockup */}
              <UploadMockup />

            </div>

            {/* Backdrop Glow */}
            <div className="absolute -inset-10 bg-primary/10 rounded-[40px] blur-[100px] -z-10 group-hover:bg-primary/15 transition-colors" />
          </AnimatedSection>
        </div>
      </section>

      {/* ════════ SOCIAL PROOF MARQUEE ════════ */}
      <section className="relative py-20 bg-muted/10 border-y border-border/40 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <p className="text-center text-[11px] font-black text-muted-foreground/60 uppercase tracking-[0.2em] mb-12">
            Publish To Every Major Channel
          </p>
          <PlatformMarquee />
        </div>
      </section>

      {/* ════════ CORE FEATURES ════════ */}
      <section id="features" className="relative py-24 sm:py-32 overflow-hidden scroll-mt-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="flex flex-col lg:flex-row items-end justify-between gap-10 mb-20">
            <AnimatedSection animation="fade-right" className="max-w-2xl text-left">
              <p className="text-xs font-black text-primary uppercase tracking-[0.2em] mb-4">Features</p>
              <h2 className="text-4xl sm:text-5xl font-medium text-foreground tracking-tight mb-6">
                Everything You Need to <br />
                <span className="text-muted-foreground/40">Grow Your Accounts.</span>
              </h2>
              <p className="text-lg text-muted-foreground font-medium leading-relaxed">
                Streamline your workflow with tools built specifically for modern social media management. One place for your entire team.
              </p>
            </AnimatedSection>
            
            <AnimatedSection animation="fade-left">
              <Link
                href="/#features"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full bg-muted font-bold text-foreground hover:bg-muted-foreground/10 transition-colors"
              >
                Explore All Features <ArrowRight className="h-4 w-4" />
              </Link>
            </AnimatedSection>
          </div>

          <StaggerChildren animation="blur" staggerMs={150} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group relative rounded-[2.5rem] border border-border/50 bg-card/60 p-8 hover:border-primary/20 hover:bg-card transition-all duration-300 hover:shadow-2xl hover:shadow-primary/5 hover:-translate-y-1 overflow-hidden"
              >
                {/* Decorative Background Icon */}
                <f.icon className="absolute -top-6 -right-6 h-32 w-32 text-foreground/[0.03] rotate-12 transition-transform group-hover:rotate-0" />
                
                <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl mb-8 shadow-inner", f.bg)}>
                  <f.icon className={cn("h-6 w-6", f.color)} />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-4">{f.title}</h3>
                <p className="text-muted-foreground leading-relaxed font-medium">
                  {f.description}
                </p>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ════════ INTERACTIVE STATS ════════ */}
      <section className="relative py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-16">
            {STATS.map((s, i) => (
              <AnimatedSection 
                key={s.label} 
                animation="fade-up" 
                delay={i * 100} 
                className="text-center space-y-4"
              >
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-[2rem] bg-muted/30 border border-border/40 text-primary mb-2 shadow-sm animate-float">
                  <s.icon className="h-7 w-7" />
                </div>
                <div>
                  <p className="text-4xl sm:text-5xl font-medium text-foreground tracking-tighter mb-1">{s.value}</p>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest leading-relaxed">
                    {s.label}
                  </p>
                </div>
              </AnimatedSection>
            ))}
          </div>
        </div>
      </section>

      {/* ════════ DATA & ANALYTICS SECTION ════════ */}
      <section className="relative py-24 sm:py-32 bg-foreground/5 border-y border-border/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="grid lg:grid-cols-2 gap-20 items-center">
            <div className="order-2 lg:order-1 relative">
              <AnalyticsMockup />
              <div className="absolute -inset-10 bg-primary/10 rounded-[30px] blur-[80px] -z-10" />
            </div>
            
            <div className="order-1 lg:order-2 space-y-10">
              <AnimatedSection animation="fade-left">
                <p className="text-sm font-black text-primary uppercase tracking-[0.2em] mb-4">Analytics</p>
                <h2 className="text-4xl sm:text-5xl font-medium text-foreground tracking-tight leading-[1.1]">
                  Data That Actually <br />
                  <span className="text-muted-foreground/40">Grows Your Brands.</span>
                </h2>
                <p className="text-lg text-muted-foreground font-medium mt-6 leading-relaxed">
                  Raw numbers are boring. That's why we transform your data into actionable insights that help you post better, smarter, and faster.
                </p>
              </AnimatedSection>

              <StaggerChildren animation="fade-left" className="space-y-6">
                {[
                  { title: "Smart Time Optimization", desc: "Know exactly when your followers are most active." },
                  { title: "Cross-Platform Benchmarks", desc: "Compare growth across all your channels in one chart." },
                  { title: "One-Click PDF Reports", desc: "Professional reports ready for your team or clients." }
                ].map((item) => (
                  <div key={item.title} className="flex gap-4">
                    <div className="flex-shrink-0 mt-1">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                    </div>
                    <div>
                      <p className="font-bold text-foreground">{item.title}</p>
                      <p className="text-sm text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </StaggerChildren>

              <AnimatedSection animation="fade-left" delay={500}>
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-sm font-bold text-white hover:scale-105 transition-transform shadow-xl shadow-primary/20"
                >
                  Explore Analytics <ArrowRight className="h-4 w-4" />
                </Link>
              </AnimatedSection>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ TESTIMONIALS ════════ */}
      <section className="relative py-24 sm:py-32 bg-background overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <div className="text-center max-w-2xl mx-auto mb-20 space-y-4">
            <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">Wall of Love</p>
            <h2 className="text-4xl sm:text-5xl font-medium text-foreground tracking-tight">
              Built for <span className="text-muted-foreground/40">the World's Best</span> Brands.
            </h2>
            <p className="text-base text-muted-foreground font-medium">
              Join 5,000+ creators and professional teams who trust Onelinker every single day.
            </p>
          </div>

          <StaggerChildren animation="blur" staggerMs={150} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-8">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="group relative rounded-[2.5rem] border border-border/50 bg-card/60 p-8 hover:bg-card transition-all duration-300"
              >
                <div className="flex items-center gap-1 mb-8">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400 shadow-sm" />
                  ))}
                </div>
                <p className="text-lg font-medium text-foreground leading-[1.6] mb-8">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="flex items-center gap-4 mt-auto pt-8 border-t border-border/30">
                  <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-xl rotate-3 group-hover:rotate-0 transition-transform", t.avatarBg)}>
                    {t.avatar}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-foreground">{t.name}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t.role}</p>
                  </div>
                  <t.platform className={cn("h-5 w-5 opacity-20 group-hover:opacity-100 transition-opacity", t.platformColor)} />
                </div>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ════════ HOW IT WORKS ════════ */}
      <section id="how-it-works" className="relative py-24 sm:py-32 bg-muted/10 border-y border-border/30">
        <div className="max-w-7xl mx-auto px-6 lg:px-10">
          <AnimatedSection animation="fade-up">
            <div className="text-center mb-16 space-y-4">
              <p className="text-xs font-black text-primary uppercase tracking-[0.2em]">Step by Step</p>
              <h2 className="text-4xl font-medium text-foreground">How it Works</h2>
              <p className="text-muted-foreground font-medium">Up and running in less than 2 minutes.</p>
            </div>
          </AnimatedSection>

          <StaggerChildren animation="fade-up" staggerMs={150} className="grid sm:grid-cols-3 gap-8 relative">
            {[
              {
                step: "01",
                icon: Users,
                title: "Connect your accounts",
                description: "Link all your social platforms in a few clicks via secure OAuth. No passwords stored.",
                color: "text-sky-400",
                bg: "bg-sky-500/10",
              },
              {
                step: "02",
                icon: PenTool,
                title: "Create & schedule",
                description: "Write posts with AI assistance, add media, and schedule to multiple platforms at once.",
                color: "text-violet-400",
                bg: "bg-violet-500/10",
              },
              {
                step: "03",
                icon: TrendingUp,
                title: "Analyze & grow",
                description: "Track what works, optimize your strategy, and watch your audience grow across every channel.",
                color: "text-emerald-400",
                bg: "bg-emerald-500/10",
              },
            ].map((item, i) => (
              <div key={item.step} className="relative text-center">
                {/* Connecting arrow (shown between steps on desktop) */}
                {i < 2 && (
                  <div className="hidden sm:block absolute top-7 -right-4 w-8 z-10">
                    <div className="border-t-2 border-dashed border-border/40 w-full" />
                  </div>
                )}
                <div className={cn("inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-border/40 mb-5", item.bg)}>
                  <item.icon className={cn("h-6 w-6", item.color)} />
                </div>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2">
                  Step {item.step}
                </p>
                <h3 className="text-base font-semibold text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ════════ FAQ SECTION ════════ */}
      <section id="faq" className="relative py-24 sm:py-32 bg-background border-t border-border/30">
        <div className="max-w-4xl mx-auto px-6">
          <div className="text-center mb-16 space-y-4">
            <h2 className="text-4xl font-medium text-foreground">Common Questions</h2>
            <p className="text-muted-foreground font-medium">Everything you need to know about getting started.</p>
          </div>
          <div className="rounded-[2.5rem] border border-border/50 bg-card/60 p-8 sm:p-12 divide-y divide-border/30 shadow-xl">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section id="waitlist" className="relative pt-32 pb-48">
        <div className="max-w-7xl mx-auto px-6">
          <AnimatedSection animation="scale" className="relative p-10 sm:p-20 rounded-[3rem] bg-foreground overflow-hidden shadow-2xl">
            {/* Background Texture */}
            <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_20%_30%,_rgba(255,255,255,0.1),_transparent)]" />
            <div className="absolute -bottom-20 -right-20 w-80 h-80 bg-primary rounded-full blur-[100px] opacity-20" />
            
            <div className="relative z-10 text-center space-y-10">
              <h2 className="text-4xl sm:text-6xl font-medium text-background tracking-tight leading-[1.1]">
                Ready to Grow Your <br />
                <span className="text-background/40">Social Presence?</span>
              </h2>
              <p className="text-lg sm:text-xl text-background/60 max-w-2xl mx-auto font-medium leading-relaxed">
                Join 5,000+ creators scheduling smarter. Free forever, no credit card required. Cancel anytime. 
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                <Link
                  href="/signup"
                  className="flex items-center justify-center gap-2 rounded-full bg-background px-12 py-5 text-lg font-black text-foreground hover:scale-105 active:scale-95 transition-all w-full sm:w-auto shadow-2xl shadow-black/40"
                >
                  Start for Free <ArrowRight className="h-6 w-6" />
                </Link>
                <Link
                  href="/contact"
                  className="text-lg font-black text-background/80 hover:text-background transition-colors px-6"
                >
                  Contact Sales
                </Link>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-4 pt-4 border-t border-background/10">
                {["3 social channels", "No credit card", "Cancel anytime", "Full analytics"].map((feat) => (
                  <div key={feat} className="flex items-center gap-2 text-xs font-bold text-background/50 uppercase tracking-widest">
                    <CheckCircle2 className="h-4 w-4" /> {feat}
                  </div>
                ))}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>
    </div>
  );
}
