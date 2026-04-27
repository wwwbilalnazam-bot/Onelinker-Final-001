import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  ArrowRight, Rocket, Sparkles, Globe, Zap, Shield,
  BarChart3, Calendar, Bug, Wrench, Star,
} from "lucide-react";

const RELEASES = [
  {
    version: "1.4.0",
    date: "March 15, 2026",
    title: "AI Captions & Bluesky Support",
    badge: "Latest",
    badgeColor: "bg-emerald-500/10 text-emerald-400",
    description: "Our biggest release yet — AI-powered caption generation, Bluesky integration, and bulk scheduling.",
    changes: [
      { type: "feature", icon: Sparkles, text: "AI caption generator — write better posts in seconds with built-in AI" },
      { type: "feature", icon: Globe, text: "Bluesky integration — schedule and publish to Bluesky directly" },
      { type: "feature", icon: Calendar, text: "Bulk scheduling — schedule up to 50 posts at once with CSV import" },
      { type: "feature", icon: BarChart3, text: "Exportable analytics reports in PDF and CSV formats" },
      { type: "improvement", icon: Zap, text: "50% faster post scheduling with optimized API calls" },
      { type: "improvement", icon: Shield, text: "Improved token refresh — fewer re-authentication prompts" },
      { type: "fix", icon: Bug, text: "Fixed Instagram carousel uploads failing for images over 5MB" },
      { type: "fix", icon: Bug, text: "Fixed timezone issues in scheduled posts for UTC+12 and beyond" },
    ],
  },
  {
    version: "1.3.0",
    date: "February 20, 2026",
    title: "Team Collaboration & Workspaces",
    badge: null,
    badgeColor: "",
    description: "Multi-brand workspaces, team members, and approval workflows for agencies and teams.",
    changes: [
      { type: "feature", icon: Rocket, text: "Multi-brand workspaces — manage multiple clients from one account" },
      { type: "feature", icon: Rocket, text: "Team members with role-based permissions (admin, editor, viewer)" },
      { type: "feature", icon: Rocket, text: "Post approval workflows — require approval before publishing" },
      { type: "feature", icon: Rocket, text: "Shared media library across workspace members" },
      { type: "improvement", icon: Zap, text: "Redesigned settings page with workspace management" },
      { type: "improvement", icon: Zap, text: "Better notification system for team activity" },
      { type: "fix", icon: Bug, text: "Fixed LinkedIn article scheduling not preserving formatting" },
    ],
  },
  {
    version: "1.2.0",
    date: "January 30, 2026",
    title: "Pinterest, Google Business & Analytics",
    badge: null,
    badgeColor: "",
    description: "Three new platform integrations and a completely rebuilt analytics dashboard.",
    changes: [
      { type: "feature", icon: Globe, text: "Pinterest integration — schedule pins and idea pins" },
      { type: "feature", icon: Globe, text: "Google Business Profile — publish to your Maps & Search listing" },
      { type: "feature", icon: Globe, text: "Telegram channel support — schedule posts to Telegram channels" },
      { type: "feature", icon: BarChart3, text: "Rebuilt analytics dashboard with cross-platform comparisons" },
      { type: "feature", icon: BarChart3, text: "Best time to post suggestions based on audience data" },
      { type: "improvement", icon: Zap, text: "Improved media upload with drag-and-drop support" },
      { type: "fix", icon: Bug, text: "Fixed Facebook page posting permissions check" },
      { type: "fix", icon: Bug, text: "Fixed calendar view not showing posts on the last day of month" },
    ],
  },
  {
    version: "1.1.0",
    date: "December 15, 2025",
    title: "TikTok, YouTube & Visual Calendar",
    badge: null,
    badgeColor: "",
    description: "Video platform support and a beautiful visual content calendar.",
    changes: [
      { type: "feature", icon: Globe, text: "TikTok integration — schedule and publish short-form videos" },
      { type: "feature", icon: Globe, text: "YouTube support — schedule videos, Shorts, and community posts" },
      { type: "feature", icon: Globe, text: "Threads integration — schedule text posts and replies" },
      { type: "feature", icon: Calendar, text: "Visual drag-and-drop content calendar" },
      { type: "feature", icon: Rocket, text: "Media library for managing images and videos" },
      { type: "improvement", icon: Zap, text: "Dark mode support throughout the application" },
      { type: "improvement", icon: Zap, text: "Mobile-responsive design for all pages" },
      { type: "fix", icon: Bug, text: "Fixed Instagram story scheduling timezone inconsistency" },
    ],
  },
  {
    version: "1.0.0",
    date: "November 1, 2025",
    title: "Initial Launch",
    badge: null,
    badgeColor: "",
    description: "The first public release of Onelinker with core scheduling features.",
    changes: [
      { type: "feature", icon: Star, text: "X (Twitter) integration with thread support" },
      { type: "feature", icon: Star, text: "Instagram feed post and Reels scheduling" },
      { type: "feature", icon: Star, text: "Facebook page and group posting" },
      { type: "feature", icon: Star, text: "LinkedIn post and article scheduling" },
      { type: "feature", icon: Star, text: "Post composer with rich text editor" },
      { type: "feature", icon: Star, text: "Basic analytics dashboard" },
      { type: "feature", icon: Star, text: "Free tier with 10 accounts and 50 posts/month" },
    ],
  },
] as const;

const TYPE_STYLES = {
  feature: { label: "New", color: "bg-emerald-500/10 text-emerald-400" },
  improvement: { label: "Improved", color: "bg-sky-500/10 text-sky-400" },
  fix: { label: "Fixed", color: "bg-amber-500/10 text-amber-400" },
} as const;

export default function ChangelogPage() {
  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/6 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-16 sm:pt-24 pb-8">
          <div>
          <div className="text-center">
            <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
              Changelog
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
              What&apos;s new in Onelinker
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-xl mx-auto leading-relaxed">
              All the latest features, improvements, and bug fixes. We ship updates regularly to make your experience better.
            </p>
          </div>
          </div>
        </div>
      </section>

      {/* Releases */}
      <section className="max-w-3xl mx-auto px-5 pb-20">
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border/30 hidden sm:block" />

          <div className="space-y-12">
            {RELEASES.map((release, ri) => (
              <div key={release.version}>
              <div className="relative">
                {/* Timeline dot */}
                <div className="absolute left-0 top-0 hidden sm:flex">
                  <div className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 z-10",
                    ri === 0
                      ? "border-primary bg-primary/10"
                      : "border-border/50 bg-card"
                  )}>
                    <Rocket className={cn("h-4 w-4", ri === 0 ? "text-primary" : "text-muted-foreground/50")} />
                  </div>
                </div>

                {/* Content */}
                <div className="sm:pl-16">
                  <div className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
                    {/* Release header */}
                    <div className="px-6 py-5 border-b border-border/30">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-muted-foreground bg-muted/40 rounded-full px-2.5 py-0.5">
                          v{release.version}
                        </span>
                        <span className="text-xs text-muted-foreground">{release.date}</span>
                        {release.badge && (
                          <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5", release.badgeColor)}>
                            {release.badge}
                          </span>
                        )}
                      </div>
                      <h2 className="text-lg font-bold text-foreground">{release.title}</h2>
                      <p className="text-sm text-muted-foreground mt-1">{release.description}</p>
                    </div>

                    {/* Changes list */}
                    <div className="px-6 py-4 space-y-2.5">
                      {release.changes.map((change, ci) => {
                        const style = TYPE_STYLES[change.type];
                        return (
                          <div key={ci} className="flex items-start gap-3">
                            <span className={cn("text-[10px] font-bold rounded-full px-2 py-0.5 shrink-0 mt-0.5", style.color)}>
                              {style.label}
                            </span>
                            <div className="flex items-start gap-2 min-w-0">
                              <change.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                              <p className="text-sm text-foreground leading-relaxed">{change.text}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/30 bg-muted/10">
        <div className="max-w-3xl mx-auto px-5 py-16 text-center">
          <h2 className="text-xl font-extrabold text-foreground tracking-tight">
            Want to see these features in action?
          </h2>
          <p className="text-sm text-muted-foreground mt-2">
            Start for free and try every feature yourself.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm hover:shadow-glow mt-6"
          >
            Get started free <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
