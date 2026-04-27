"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { AnimatedSection, StaggerChildren } from "@/components/ui/animated-section";
import {
  CheckCircle2, ArrowRight, Star, X, Info,
  Shield, Building2, CreditCard, ChevronDown,
} from "lucide-react";

/* ─── Plans ─────────────────────────────────────────────────── */

const PLANS = [
  {
    name: "Free",
    badge: null,
    bestFor: "Testing the waters",
    monthlyPrice: 0,
    yearlyPrice: 0,
    cta: "Get Started Free",
    ctaHref: "/signup",
    highlighted: false,
    color: "emerald",
    features: [
      { text: "3 Social Channels", detail: "Connect Instagram, Twitter, LinkedIn" },
      { text: "50 Posts/Month", detail: "Manual scheduling" },
      { text: "Basic Scheduler", detail: "Calendar view" },
    ],
    excluded: [
      { text: "No Team Access", detail: "Single user only" },
      { text: "No Bulk Upload", detail: "CSV/Excel" },
      { text: "No Analytics", detail: "Basic post status only" },
      { text: "No Unified Comments", detail: null },
    ],
    addOn: null,
  },
  {
    name: "Individual",
    badge: "Most Popular",
    bestFor: "Freelancers & Creators",
    monthlyPrice: 29,
    yearlyPrice: 290,
    cta: "Upgrade to Individual",
    ctaHref: "/signup",
    highlighted: true,
    color: "blue",
    features: [
      { text: "1 User Account", detail: null },
      { text: "6 Social Channels", detail: null },
      { text: "1,000 Posts/Month", detail: null },
      { text: "Bulk Scheduling", detail: "Upload CSV & auto-post" },
      { text: "Unified Comments", detail: "Reply to all platforms in one inbox" },
      { text: "Analytics Dashboard", detail: "Engagement, growth, best time to post" },
      { text: "Priority Support", detail: null },
    ],
    excluded: [],
    addOn: "Need more posts? +$10 per 1,000 extra posts",
  },
  {
    name: "Agency",
    badge: "Best Value",
    bestFor: "Agencies & Multi-Brand Owners",
    monthlyPrice: 89,
    yearlyPrice: 890,
    cta: "Upgrade to Agency",
    ctaHref: "/signup",
    highlighted: false,
    color: "purple",
    features: [
      { text: "Unlimited Users", detail: "Invite your whole team" },
      { text: "5 Workspaces Included", detail: "Manage multiple clients/brands" },
      { text: "50 Social Channels", detail: "+$3/mo per extra channel" },
      { text: "5,000 Posts/month", detail: "+$10 per 1,000 extra posts" },
      { text: "Bulk Scheduling & AI Assistant", detail: null },
      { text: "Unified Comments", detail: "Assign comments to team members" },
      { text: "Advanced Analytics", detail: "White-label reports for clients" },
      { text: "Approval Workflows", detail: "Draft \u2192 Review \u2192 Publish" },
    ],
    excluded: [],
    addOn: "Need more clients? +$15 per extra workspace",
  },
] as const;

/* ─── Comparison Table ──────────────────────────────────────── */

const COMPARISON_ROWS: {
  feature: string;
  free: string | boolean;
  individual: string | boolean;
  agency: string | boolean;
}[] = [
  { feature: "Price", free: "$0", individual: "$29/mo", agency: "$89/mo" },
  { feature: "Social Channels", free: "3", individual: "6", agency: "50 (10 per workspace)" },
  { feature: "Posts per Month", free: "50", individual: "1,000", agency: "Unlimited" },
  { feature: "Workspaces", free: "1", individual: "1", agency: "5 Included" },
  { feature: "Team Members", free: "1", individual: "1", agency: "Unlimited" },
  { feature: "Bulk Upload", free: false, individual: true, agency: true },
  { feature: "Unified Inbox", free: false, individual: true, agency: true },
  { feature: "Analytics", free: false, individual: "Basic", agency: "Advanced + White-label" },
  { feature: "Approval Workflow", free: false, individual: false, agency: true },
  { feature: "Support", free: "Community", individual: "Priority", agency: "Dedicated Manager" },
];

/* ─── FAQ ────────────────────────────────────────────────────── */

const FAQS = [
  {
    q: "Can I upgrade or downgrade later?",
    a: "Yes! You can change plans instantly from your dashboard. Prorated credits are applied automatically when upgrading; downgrades take effect at the next billing cycle.",
  },
  {
    q: "How do the Workspace Add-ons work?",
    a: "The Agency plan includes 5 workspaces. If you have 7 clients, you simply add 2 extra workspaces at $15/mo each. You only pay for what you need.",
  },
  {
    q: "What happens if I exceed my post limit on Individual?",
    a: "We\u2019ll notify you when you reach 80%. You can purchase a 1,000 post add-on for $10 instantly without changing your plan.",
  },
  {
    q: "Is the Annual discount automatic?",
    a: "Yes, select \u201cAnnual\u201d at checkout to get 2 months free automatically applied.",
  },
  {
    q: "Do I need a credit card for the Free plan?",
    a: "No. Sign up with just your email and start scheduling immediately.",
  },
];

/* ─── Tooltip Component ──────────────────────────────────────── */

function Tooltip({ text }: { text: string }) {
  return (
    <span className="group/tip relative inline-flex ml-1 cursor-help">
      <Info className="h-3.5 w-3.5 text-muted-foreground/50 hover:text-muted-foreground transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 rounded-lg bg-foreground text-background text-[11px] leading-relaxed px-3 py-2 opacity-0 group-hover/tip:opacity-100 transition-opacity shadow-lg z-50">
        {text}
      </span>
    </span>
  );
}

/* ─── FAQ Item Component ─────────────────────────────────────── */

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border/30 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-5 text-left group"
      >
        <span className="text-sm font-semibold text-foreground pr-4">{q}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-200",
          open ? "max-h-40 pb-5" : "max-h-0"
        )}
      >
        <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
      </div>
    </div>
  );
}

/* ─── Page ──────────────────────────────────────────────────── */

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  return (
    <div className="overflow-hidden">
      {/* ════════ HERO ════════ */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/6 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-6xl mx-auto px-5 pt-16 sm:pt-24 pb-4">
          <AnimatedSection animation="fade-up" delay={100}>
            <div className="text-center">
              <p className="text-xs font-semibold text-primary uppercase tracking-widest mb-3">
                Pricing
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-foreground tracking-tight">
                Simple Pricing for Powerful Social Growth
              </h1>
              <p className="text-base sm:text-lg text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
                From freelancers managing 6 accounts to agencies scaling 50+ workspaces.
                Start free, upgrade when you&apos;re ready.
              </p>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6">
                {[
                  { icon: Shield, text: "Free Forever Plan" },
                  { icon: CreditCard, text: "No Credit Card Required" },
                  { icon: ArrowRight, text: "Cancel Anytime" },
                ].map((b) => (
                  <span
                    key={b.text}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                  >
                    <b.icon className="h-3.5 w-3.5 text-primary/70" />
                    {b.text}
                  </span>
                ))}
              </div>

              {/* Billing toggle */}
              <div className="flex items-center justify-center gap-3 mt-8">
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    !yearly ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  Monthly
                </span>
                <button
                  onClick={() => setYearly(!yearly)}
                  className={cn(
                    "relative inline-flex h-7 w-12 items-center rounded-full transition-colors",
                    yearly ? "bg-primary" : "bg-muted/60"
                  )}
                >
                  <span
                    className={cn(
                      "inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform",
                      yearly ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
                <span
                  className={cn(
                    "text-sm font-medium transition-colors",
                    yearly ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  Annual
                </span>
                {yearly && (
                  <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 rounded-full px-2.5 py-0.5">
                    Save 2 Months
                  </span>
                )}
              </div>
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* ════════ PRICING CARDS ════════ */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <StaggerChildren animation="fade-up" staggerMs={120} className="grid md:grid-cols-3 gap-5">
          {PLANS.map((plan) => {
            const monthlyEquiv = yearly && plan.yearlyPrice > 0
              ? Math.round((plan.yearlyPrice / 12) * 100) / 100
              : plan.monthlyPrice;

            return (
              <div
                key={plan.name}
                className={cn(
                  "relative rounded-2xl border p-6 flex flex-col transition-all duration-200",
                  plan.highlighted
                    ? "border-primary/40 bg-card/80 shadow-lg shadow-primary/5 md:scale-[1.03] z-10"
                    : "border-border/50 bg-card/60 hover:border-border"
                )}
              >
                {/* Badge */}
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-3 py-1 text-[11px] font-semibold text-white shadow-glow-sm",
                        "bg-primary"
                      )}
                    >
                      <Star className="h-3 w-3 fill-white" /> {plan.badge}
                    </span>
                  </div>
                )}

                {/* Plan header */}
                <div className="mb-5">
                  <h3 className="text-lg font-bold text-foreground">{plan.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Best for: {plan.bestFor}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold text-foreground">
                      ${monthlyEquiv}
                    </span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  {yearly && plan.yearlyPrice > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ${plan.yearlyPrice}/year &mdash; 2 months free
                    </p>
                  )}
                  {!yearly && plan.monthlyPrice > 0 && plan.yearlyPrice > 0 && (
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      or ${plan.yearlyPrice}/year (save 2 months)
                    </p>
                  )}
                  {plan.monthlyPrice === 0 && (
                    <p className="text-xs text-emerald-400 font-medium mt-1">
                      Free forever &mdash; no credit card
                    </p>
                  )}
                </div>

                {/* CTA */}
                <Link
                  href={plan.ctaHref}
                  className={cn(
                    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold transition-all mb-6",
                    plan.highlighted
                      ? "bg-primary text-white hover:bg-primary/90 shadow-glow-sm hover:shadow-glow"
                      : plan.name === "Agency"
                      ? "bg-primary text-white hover:bg-primary/90 shadow-glow-sm hover:shadow-glow"
                      : "border border-border/60 bg-muted/20 text-foreground hover:bg-muted/40"
                  )}
                >
                  {plan.cta} <ArrowRight className="h-3.5 w-3.5" />
                </Link>

                {/* Features */}
                <div className="space-y-2.5 flex-1">
                  {plan.features.map((f) => (
                    <div key={f.text} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">
                        <span className="font-medium">{f.text}</span>
                        {f.detail && (
                          <span className="text-muted-foreground"> ({f.detail})</span>
                        )}
                      </span>
                    </div>
                  ))}
                  {plan.excluded.map((f) => (
                    <div key={f.text} className="flex items-start gap-2.5 opacity-40">
                      <X className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">
                        {f.text}
                        {f.detail && <span> ({f.detail})</span>}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Add-on */}
                {plan.addOn && (
                  <div className="mt-5 pt-4 border-t border-border/30">
                    <p className="text-xs text-muted-foreground/70">{plan.addOn}</p>
                  </div>
                )}
              </div>
            );
          })}
        </StaggerChildren>
      </section>

      {/* ════════ COMPARISON TABLE ════════ */}
      <section className="max-w-5xl mx-auto px-5 py-12">
        <AnimatedSection animation="fade-up">
          <h2 className="text-2xl font-extrabold text-foreground text-center mb-10">
            Compare plans in detail
          </h2>

          {/* Mobile: stacked cards per plan */}
          <div className="md:hidden space-y-6">
            {(["free", "individual", "agency"] as const).map((tier) => (
              <div
                key={tier}
                className="rounded-2xl border border-border/50 bg-card/60 overflow-hidden"
              >
                <div className="px-5 py-3 border-b border-border/40 bg-muted/10">
                  <p className="text-sm font-bold text-foreground capitalize">{tier}</p>
                </div>
                {COMPARISON_ROWS.map((row) => {
                  const val = row[tier];
                  return (
                    <div
                      key={row.feature}
                      className="flex items-center justify-between px-5 py-2.5 border-b border-border/10 last:border-0"
                    >
                      <p className="text-xs text-foreground flex items-center">
                        {row.feature}
                        {row.feature === "Workspaces" && (
                          <Tooltip text="A separate client/brand environment with isolated data, team, and billing." />
                        )}
                      </p>
                      <div>
                        {typeof val === "boolean" ? (
                          val ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <X className="h-4 w-4 text-muted-foreground/30" />
                          )
                        ) : (
                          <span className="text-xs font-semibold text-foreground">{val}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* Desktop: table grid */}
          <div className="hidden md:block rounded-2xl border border-border/50 bg-card/60 overflow-hidden">
            {/* Table header */}
            <div className="grid grid-cols-4 gap-4 px-6 py-4 border-b border-border/40 bg-muted/10">
              <div className="text-sm font-semibold text-muted-foreground">Feature</div>
              {["Free", "Individual", "Agency"].map((name) => (
                <div key={name} className="text-center">
                  <p className="text-sm font-semibold text-foreground">{name}</p>
                </div>
              ))}
            </div>

            {/* Rows */}
            {COMPARISON_ROWS.map((row) => (
              <div
                key={row.feature}
                className="grid grid-cols-4 gap-4 px-6 py-3 border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors"
              >
                <p className="text-sm text-foreground flex items-center">
                  {row.feature}
                  {row.feature === "Social Channels" && (
                    <Tooltip text="A connected social account (e.g., one Instagram profile)." />
                  )}
                  {row.feature === "Workspaces" && (
                    <Tooltip text="A separate client/brand environment with isolated data, team, and billing." />
                  )}
                </p>
                {(["free", "individual", "agency"] as const).map((tier) => {
                  const val = row[tier];
                  return (
                    <div key={tier} className="text-center flex items-center justify-center">
                      {typeof val === "boolean" ? (
                        val ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <X className="h-4 w-4 text-muted-foreground/30" />
                        )
                      ) : (
                        <span className="text-sm font-medium text-foreground">{val}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ════════ TRUST & PSYCHOLOGY ════════ */}
      <section className="max-w-5xl mx-auto px-5 py-16">
        <AnimatedSection animation="fade-up">
          <div className="grid md:grid-cols-3 gap-6">
            {/* Testimonial */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="h-5 w-5 text-primary/70" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Trusted by 50+ Agencies
                </p>
              </div>
              <blockquote className="text-sm text-foreground leading-relaxed italic">
                &ldquo;Onelinker saved us 20 hours a week managing client approvals.
                The workspace isolation is perfect for our agency.&rdquo;
              </blockquote>
              <p className="text-xs text-muted-foreground mt-3">
                &mdash; Sarah J., Digital Marketing Director
              </p>
            </div>

            {/* Security */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Shield className="h-5 w-5 text-primary/70" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Bank-Grade Security
                </p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your data is isolated per workspace. We use enterprise-grade encryption
                and Row Level Security to ensure client data never mixes.
              </p>
            </div>

            {/* Risk-free */}
            <div className="rounded-2xl border border-border/50 bg-card/60 p-6">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-5 w-5 text-primary/70" />
                <p className="text-xs font-semibold text-primary uppercase tracking-wider">
                  Risk-Free Upgrades
                </p>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Upgrade anytime from your dashboard. If a paid plan doesn&apos;t fit your
                needs, downgrade to Free instantly&mdash;no penalties.
              </p>
            </div>
          </div>
        </AnimatedSection>
      </section>

      {/* ════════ FAQ ════════ */}
      <section className="max-w-2xl mx-auto px-5 py-12">
        <AnimatedSection animation="fade-up">
          <h2 className="text-2xl font-extrabold text-foreground text-center mb-8">
            Frequently asked questions
          </h2>
          <div className="rounded-2xl border border-border/50 bg-card/60 px-6">
            {FAQS.map((faq) => (
              <FaqItem key={faq.q} q={faq.q} a={faq.a} />
            ))}
          </div>
        </AnimatedSection>
      </section>

      {/* ════════ FINAL CTA ════════ */}
      <section className="relative">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-primary/6 rounded-full blur-[100px]" />
        </div>

        <AnimatedSection animation="scale" className="relative max-w-3xl mx-auto px-5 py-20 text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-foreground tracking-tight">
            Ready to Streamline Your Social Media?
          </h2>
          <p className="text-base text-muted-foreground mt-3 max-w-lg mx-auto">
            Join 5,000+ creators and agencies saving time with Onelinker.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm hover:shadow-glow mt-8"
          >
            Get Started for Free <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="text-xs text-muted-foreground/60 mt-3">
            Free plan includes 3 channels and 50 posts/month. No credit card required.
          </p>
        </AnimatedSection>
      </section>
    </div>
  );
}
