"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnimatedSection, StaggerChildren } from "@/components/ui/animated-section";
import {
  ArrowRight, CheckCircle2, Zap, Users, PenTool, TrendingUp,
  Calendar, BarChart3, Sparkles, Shield, Globe, Clock,
  Twitter, Linkedin, Instagram, Youtube, Facebook,
  MousePointerClick, Send, Eye, Layers, Bell, RefreshCw,
} from "lucide-react";

/* ─── Steps ─────────────────────────────────────────────────── */

const STEPS = [
  {
    number: "01",
    title: "Connect your social accounts",
    subtitle: "One-click OAuth — no passwords stored",
    description:
      "Link all your social platforms in seconds. We support 10+ channels including X, Instagram, Facebook, LinkedIn, TikTok, YouTube, Pinterest, Threads, Bluesky, and Google Business.",
    details: [
      "Secure OAuth authentication for every platform",
      "Connect up to 500 accounts on the Agency plan",
      "Auto-sync profile data and follower counts",
      "Re-connect reminders before tokens expire",
    ],
    icon: Globe,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    borderColor: "border-sky-500/20",
    visual: "connect",
  },
  {
    number: "02",
    title: "Create content with AI",
    subtitle: "Write better posts in seconds",
    description:
      "Use our built-in AI to generate captions, hashtags, and content ideas. Upload images and videos, then customize each post per platform.",
    details: [
      "AI caption & hashtag generator",
      "Per-platform content customization",
      "Image, video, carousel & story support",
      "Media library with drag-and-drop uploads",
    ],
    icon: PenTool,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    borderColor: "border-violet-500/20",
    visual: "create",
  },
  {
    number: "03",
    title: "Schedule & publish",
    subtitle: "Set it and forget it",
    description:
      "Pick the perfect date and time, or let our AI suggest the best times based on your audience. Schedule to multiple platforms simultaneously.",
    details: [
      "Visual drag-and-drop content calendar",
      "Bulk scheduling for multiple posts",
      "Recurring post schedules",
      "Optimal time suggestions per platform",
    ],
    icon: Calendar,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    borderColor: "border-emerald-500/20",
    visual: "schedule",
  },
  {
    number: "04",
    title: "Analyze & grow",
    subtitle: "Data-driven decisions",
    description:
      "Track engagement, reach, and follower growth across every platform. See what works and double down on your best-performing content.",
    details: [
      "Cross-platform analytics dashboard",
      "Engagement, reach & growth metrics",
      "Top-performing posts breakdown",
      "Exportable PDF & CSV reports",
    ],
    icon: BarChart3,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    borderColor: "border-rose-500/20",
    visual: "analyze",
  },
] as const;

/* ─── Platform icons ────────────────────────────────────────── */

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.27 8.27 0 0 0 4.84 1.55V6.79a4.85 4.85 0 0 1-1.07-.1z" />
    </svg>
  );
}

const PLATFORM_ICONS = [
  { icon: Twitter, color: "text-sky-400", name: "X" },
  { icon: Instagram, color: "text-pink-400", name: "Instagram" },
  { icon: Facebook, color: "text-blue-400", name: "Facebook" },
  { icon: Linkedin, color: "text-blue-500", name: "LinkedIn" },
  { icon: Youtube, color: "text-red-400", name: "YouTube" },
  { icon: TikTokIcon, color: "text-zinc-300", name: "TikTok" },
] as const;

/* ─── Step visual mockups ───────────────────────────────────── */

function ConnectVisual() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground">Connected Accounts</p>
      {PLATFORM_ICONS.map((p, i) => (
        <div key={p.name} className="flex items-center gap-3 rounded-xl border border-border/30 bg-background/40 px-4 py-2.5">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-lg bg-muted/30")}>
            <p.icon className={cn("h-4 w-4", p.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground">{p.name}</p>
            <p className="text-[10px] text-muted-foreground">@onelinker</p>
          </div>
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function CreateVisual() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="h-4 w-4 text-violet-400" />
        <p className="text-xs font-semibold text-foreground">AI Content Studio</p>
      </div>
      <div className="rounded-xl border border-border/30 bg-background/40 p-3">
        <div className="h-2.5 w-3/4 rounded bg-muted/50 mb-2" />
        <div className="h-2.5 w-full rounded bg-muted/40 mb-2" />
        <div className="h-2.5 w-5/6 rounded bg-muted/40 mb-3" />
        <div className="flex gap-1.5">
          {["#marketing", "#growth", "#social"].map((tag) => (
            <span key={tag} className="text-[9px] font-medium text-violet-400 bg-violet-500/10 rounded-full px-2 py-0.5">
              {tag}
            </span>
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <div className="flex-1 h-20 rounded-lg bg-gradient-to-br from-pink-500/20 to-violet-500/20 border border-border/20" />
        <div className="flex-1 h-20 rounded-lg bg-gradient-to-br from-sky-500/20 to-emerald-500/20 border border-border/20" />
      </div>
      <button className="w-full rounded-lg bg-violet-500/15 py-2 text-xs font-semibold text-violet-400 flex items-center justify-center gap-1.5">
        <Sparkles className="h-3 w-3" /> Generate with AI
      </button>
    </div>
  );
}

function ScheduleVisual() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-foreground">March 2026</p>
        <div className="flex gap-1">
          <div className="h-5 w-5 rounded bg-muted/30" />
          <div className="h-5 w-5 rounded bg-muted/30" />
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {Array.from({ length: 28 }, (_, i) => {
          const hasPost = [3, 7, 10, 14, 17, 21, 24].includes(i);
          const isToday = i === 19;
          return (
            <div
              key={i}
              className={cn(
                "aspect-square rounded-md flex items-center justify-center text-[10px] font-medium relative",
                isToday
                  ? "bg-foreground text-background"
                  : hasPost
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {i + 1}
              {hasPost && !isToday && (
                <div className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-2 rounded-full bg-emerald-400" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AnalyzeVisual() {
  return (
    <div className="rounded-2xl border border-border/40 bg-card/60 p-5 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-semibold text-foreground">Performance</p>
        <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 rounded-full px-2 py-0.5">+24% this month</span>
      </div>
      <div className="flex items-end gap-1 h-24">
        {[30, 45, 35, 60, 50, 70, 55, 80, 72, 90, 85, 95].map((h, i) => (
          <div key={i} className="flex-1 rounded-t-sm bg-rose-500/20 hover:bg-rose-500/30 transition-colors" style={{ height: `${h}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Reach", value: "45.2K" },
          { label: "Likes", value: "3.8K" },
          { label: "Growth", value: "+12%" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg bg-muted/20 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className="text-sm font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

const VISUALS: Record<string, () => JSX.Element> = {
  connect: ConnectVisual,
  create: CreateVisual,
  schedule: ScheduleVisual,
  analyze: AnalyzeVisual,
};

/* ─── Why Onelinker ─────────────────────────────────────────── */

const BENEFITS = [
  { icon: Clock, title: "Save 10+ hours/week", description: "Schedule a week of content in minutes instead of posting manually every day." },
  { icon: Layers, title: "One tool, all platforms", description: "No more switching between 5 apps. Manage everything from one dashboard." },
  { icon: Sparkles, title: "AI does the heavy lifting", description: "Generate captions, hashtags, and ideas with a click. Focus on strategy, not writing." },
  { icon: Shield, title: "Enterprise-grade security", description: "OAuth-only connections, encrypted data, and SOC 2 compliant infrastructure." },
  { icon: Bell, title: "Never miss a beat", description: "Smart notifications for failed posts, expiring tokens, and engagement spikes." },
  { icon: RefreshCw, title: "Always improving", description: "New features and platform integrations shipped every month based on user feedback." },
] as const;

/* ─── Page ──────────────────────────────────────────────────── */

export default function HowItWorksPage() {
  return (
    <div className="overflow-hidden">
      {/* ════════ HERO ════════ */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/6 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-16 sm:pt-24 pb-8">
          <AnimatedSection animation="fade-up" delay={100}>
          <div className="text-center">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              How it works
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight leading-tight">
              From zero to publishing{" "}
              <span className="bg-gradient-to-r from-primary via-violet-400 to-sky-400 bg-clip-text text-transparent">
                in 4 simple steps
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
              Connect your accounts, create content with AI, schedule it, and
              watch your audience grow. It really is that simple.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm hover:shadow-glow mt-8"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════ STEPS ════════ */}
      <section className="max-w-6xl mx-auto px-5 py-16 space-y-20">
        {STEPS.map((step, idx) => {
          const Visual = VISUALS[step.visual]!;
          const isEven = idx % 2 === 1;

          return (
            <AnimatedSection
              key={step.number}
              animation={isEven ? "fade-right" : "fade-left"}
            >
            <div
              className={cn(
                "grid lg:grid-cols-2 gap-10 lg:gap-16 items-center"
              )}
            >
              {/* Text side */}
              <div className={cn(isEven && "lg:order-2")}>
                <div className="flex items-center gap-3 mb-4">
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", step.bg)}>
                    <step.icon className={cn("h-5 w-5", step.color)} />
                  </div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    Step {step.number}
                  </span>
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight leading-tight mb-2">
                  {step.title}
                </h2>
                <p className="text-sm font-medium text-muted-foreground mb-4">
                  {step.subtitle}
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed mb-6">
                  {step.description}
                </p>

                <ul className="space-y-2.5">
                  {step.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{detail}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Visual side */}
              <div className={cn(isEven && "lg:order-1")}>
                <Visual />
              </div>
            </div>
            </AnimatedSection>
          );
        })}
      </section>

      {/* ════════ WHY ONELINKER ════════ */}
      <section className="bg-muted/10 border-y border-border/30">
        <div className="max-w-6xl mx-auto px-5 py-20">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Why Onelinker
            </p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
              Built different, on purpose
            </h2>
            <p className="text-base text-muted-foreground mt-4 max-w-xl mx-auto">
              We&apos;re not just another scheduling tool. Here&apos;s what sets us apart.
            </p>
          </div>

          <StaggerChildren animation="fade-up" staggerMs={100} className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {BENEFITS.map((b) => (
              <div
                key={b.title}
                className="rounded-2xl border border-border/50 bg-card/60 p-6 hover:border-border hover:bg-card/80 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted/40 mb-4">
                  <b.icon className="h-5 w-5 text-foreground" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1.5">{b.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
              </div>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/6 rounded-full blur-[100px]" />
        </div>

        <AnimatedSection animation="scale" className="relative max-w-3xl mx-auto px-5 py-24 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Ready to get started?
          </h2>
          <p className="text-base text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
            Join thousands of creators and agencies scheduling smarter with Onelinker.
            Free forever — no credit card required.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-8">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm hover:shadow-glow w-full sm:w-auto justify-center"
            >
              Get started free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-8 py-3.5 text-sm font-semibold text-foreground hover:bg-muted/40 transition-all w-full sm:w-auto justify-center"
            >
              View pricing
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 mt-6">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Free forever plan
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> No credit card
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Cancel anytime
            </span>
          </div>
        </AnimatedSection>
      </section>
    </div>
  );
}
