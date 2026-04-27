"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnimatedSection, StaggerChildren } from "@/components/ui/animated-section";
import {
  ArrowRight, Clock, Calendar, Sparkles, BarChart3,
  TrendingUp, Users, Lightbulb, Target, Layers,
  Megaphone, BookOpen, Rocket, Zap,
} from "lucide-react";

/* ─── Categories ────────────────────────────────────────────── */

const CATEGORIES = [
  { label: "All", value: "all" },
  { label: "Getting Started", value: "getting-started" },
  { label: "Social Media Tips", value: "tips" },
  { label: "Product Updates", value: "updates" },
  { label: "Case Studies", value: "case-studies" },
  { label: "AI & Automation", value: "ai" },
] as const;

/* ─── Blog posts ────────────────────────────────────────────── */

const FEATURED_POST = {
  slug: "ultimate-guide-social-media-scheduling-2026",
  title: "The Ultimate Guide to Social Media Scheduling in 2026",
  excerpt:
    "Everything you need to know about scheduling content across multiple platforms, from choosing the right times to leveraging AI for better captions.",
  category: "Getting Started",
  readTime: "12 min read",
  date: "Mar 15, 2026",
  icon: BookOpen,
  color: "text-primary",
  bg: "bg-primary/10",
  gradient: "from-primary/20 via-violet-500/10 to-sky-500/10",
};

const POSTS = [
  {
    slug: "best-time-post-every-platform",
    title: "Best Times to Post on Every Social Platform",
    excerpt:
      "We analyzed millions of posts to find the optimal posting times for X, Instagram, LinkedIn, TikTok, and more.",
    category: "Social Media Tips",
    readTime: "8 min read",
    date: "Mar 12, 2026",
    icon: Clock,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
  },
  {
    slug: "ai-captions-that-convert",
    title: "How to Use AI Captions That Actually Convert",
    excerpt:
      "Stop writing generic captions. Learn how to use AI-powered tools to create engaging, brand-aligned content in seconds.",
    category: "AI & Automation",
    readTime: "6 min read",
    date: "Mar 10, 2026",
    icon: Sparkles,
    color: "text-violet-400",
    bg: "bg-violet-500/10",
  },
  {
    slug: "instagram-reels-strategy-guide",
    title: "Instagram Reels Strategy: From Zero to Viral",
    excerpt:
      "A step-by-step guide to creating Reels that get discovered, boost engagement, and grow your following organically.",
    category: "Social Media Tips",
    readTime: "10 min read",
    date: "Mar 8, 2026",
    icon: TrendingUp,
    color: "text-pink-400",
    bg: "bg-pink-500/10",
  },
  {
    slug: "onelinker-march-product-update",
    title: "March Product Update: Bluesky Support, Bulk Scheduling & More",
    excerpt:
      "This month we shipped Bluesky integration, bulk post scheduling, improved analytics exports, and 15+ quality-of-life improvements.",
    category: "Product Updates",
    readTime: "4 min read",
    date: "Mar 5, 2026",
    icon: Rocket,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
  },
  {
    slug: "linkedin-content-strategy-b2b",
    title: "LinkedIn Content Strategy for B2B Brands in 2026",
    excerpt:
      "How to build authority, generate leads, and grow your company page with a consistent LinkedIn publishing strategy.",
    category: "Social Media Tips",
    readTime: "9 min read",
    date: "Mar 2, 2026",
    icon: Target,
    color: "text-blue-400",
    bg: "bg-blue-500/10",
  },
  {
    slug: "agency-scaled-10x-with-onelinker",
    title: "How a 3-Person Agency Manages 50 Clients with Onelinker",
    excerpt:
      "Case study: Learn how Social Spark Agency uses workspaces, team approvals, and AI captions to manage 200+ social accounts.",
    category: "Case Studies",
    readTime: "7 min read",
    date: "Feb 28, 2026",
    icon: Users,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
  },
  {
    slug: "content-calendar-template-free",
    title: "The Perfect Content Calendar Template (Free Download)",
    excerpt:
      "Plan a month of content in under an hour. Our free template works for solopreneurs, teams, and agencies.",
    category: "Getting Started",
    readTime: "5 min read",
    date: "Feb 25, 2026",
    icon: Calendar,
    color: "text-teal-400",
    bg: "bg-teal-500/10",
  },
  {
    slug: "automate-social-media-workflows",
    title: "5 Social Media Workflows You Should Automate Today",
    excerpt:
      "Stop doing repetitive tasks manually. Here are the automations that save creators and agencies hours every week.",
    category: "AI & Automation",
    readTime: "6 min read",
    date: "Feb 22, 2026",
    icon: Layers,
    color: "text-orange-400",
    bg: "bg-orange-500/10",
  },
  {
    slug: "tiktok-vs-reels-vs-shorts",
    title: "TikTok vs Reels vs Shorts: Where Should You Post Short-Form Video?",
    excerpt:
      "Each platform has different algorithms, audiences, and best practices. Here's how to decide where to invest your time.",
    category: "Social Media Tips",
    readTime: "8 min read",
    date: "Feb 18, 2026",
    icon: Megaphone,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
  },
] as const;

/* ─── Page ──────────────────────────────────────────────────── */

import { useState } from "react";

export default function BlogPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const filteredPosts =
    activeCategory === "all"
      ? POSTS
      : POSTS.filter(
          (p) =>
            p.category ===
            CATEGORIES.find((c) => c.value === activeCategory)?.label
        );

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
              Blog
            </p>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
              Insights & resources for{" "}
              <span className="bg-gradient-to-r from-primary via-violet-400 to-sky-400 bg-clip-text text-transparent">
                social media growth
              </span>
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
              Tips, strategies, product updates, and case studies to help you
              schedule smarter and grow faster.
            </p>
          </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════ CATEGORIES ════════ */}
      <section className="max-w-6xl mx-auto px-5 pb-8 overflow-x-auto">
        <div className="flex items-center gap-2 justify-center min-w-max sm:min-w-0 sm:flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setActiveCategory(cat.value)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-medium transition-all",
                activeCategory === cat.value
                  ? "bg-foreground text-background"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </section>

      {/* ════════ FEATURED POST ════════ */}
      {activeCategory === "all" && (
        <section className="max-w-6xl mx-auto px-5 pb-12">
          <AnimatedSection animation="fade-up">
          <div
            className={cn(
              "group rounded-2xl border border-border/50 bg-gradient-to-br p-6 sm:p-8 hover:border-border transition-all duration-200 hover:shadow-lg cursor-pointer",
              FEATURED_POST.gradient
            )}
          >
            <div className="grid lg:grid-cols-2 gap-6 items-center">
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    Featured
                  </span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span className="text-xs text-muted-foreground">
                    {FEATURED_POST.category}
                  </span>
                </div>
                <h2 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight leading-tight mb-3">
                  {FEATURED_POST.title}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5">
                  {FEATURED_POST.excerpt}
                </p>
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary group-hover:underline">
                    Read article <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" /> {FEATURED_POST.readTime}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {FEATURED_POST.date}
                  </span>
                </div>
              </div>

              {/* Decorative illustration */}
              <div className="hidden lg:flex items-center justify-center">
                <div className="relative">
                  <div className="h-48 w-48 rounded-3xl bg-card/60 border border-border/40 flex items-center justify-center">
                    <FEATURED_POST.icon className="h-16 w-16 text-primary/40" />
                  </div>
                  <div className="absolute -top-3 -right-3 h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-primary" />
                  </div>
                  <div className="absolute -bottom-3 -left-3 h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                    <TrendingUp className="h-4 w-4 text-emerald-400" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          </AnimatedSection>
        </section>
      )}

      {/* ════════ POSTS GRID ════════ */}
      <section className="max-w-6xl mx-auto px-5 pb-20">
        <AnimatedSection animation="fade-up">
        {filteredPosts.length === 0 ? (
          <div className="text-center py-16">
            <Lightbulb className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-base font-semibold text-foreground">
              No articles in this category yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Check back soon — we publish new content every week.
            </p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPosts.map((post) => (
              <article
                key={post.slug}
                className="group rounded-2xl border border-border/50 bg-card/60 overflow-hidden hover:border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer flex flex-col"
              >
                {/* Icon header */}
                <div className="px-6 pt-6 pb-4">
                  <div
                    className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl mb-4",
                      post.bg
                    )}
                  >
                    <post.icon className={cn("h-5 w-5", post.color)} />
                  </div>

                  <div className="flex items-center gap-2 mb-2.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {post.category}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-foreground leading-snug group-hover:text-primary transition-colors line-clamp-2">
                    {post.title}
                  </h3>
                </div>

                {/* Excerpt */}
                <div className="px-6 pb-5 flex-1">
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {post.excerpt}
                  </p>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-border/30 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {post.readTime}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {post.date}
                    </span>
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                </div>
              </article>
            ))}
          </div>
        )}
        </AnimatedSection>
      </section>

      {/* ════════ NEWSLETTER CTA ════════ */}
      <section className="border-t border-border/30 bg-muted/10">
        <AnimatedSection animation="fade-up" className="max-w-3xl mx-auto px-5 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 mx-auto mb-5">
            <Zap className="h-6 w-6 text-primary" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Stay ahead of the curve
          </h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Get weekly social media tips, product updates, and growth strategies
            delivered to your inbox.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-6 max-w-md mx-auto">
            <input
              type="email"
              placeholder="you@example.com"
              className="flex-1 w-full sm:w-auto rounded-full border border-border/60 bg-background/60 px-5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/40"
            />
            <button className="inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm w-full sm:w-auto justify-center">
              Subscribe
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground/50 mt-3">
            No spam. Unsubscribe anytime.
          </p>
        </AnimatedSection>
      </section>
    </div>
  );
}
