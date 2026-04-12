"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Menu, X, ChevronRight, Twitter, Linkedin, Instagram, Youtube,
  Facebook, ArrowUpRight, Mail, ArrowRight, Globe, Sparkles, Shield,
  ChevronDown, Play
} from "lucide-react";

const NAV_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "How it Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      // Focus trap - focus first menu item when modal opens
      setTimeout(() => {
        const firstLink = document.querySelector('[data-mobile-nav-link]') as HTMLAnchorElement;
        firstLink?.focus();
      }, 100);
    } else {
      document.body.style.overflow = "unset";
    }
  }, [mobileOpen]);

  useEffect(() => setMobileOpen(false), [pathname]);

  // Handle ESC key to close menu
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && mobileOpen) {
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-[100] transition-all duration-300 border-b",
        scrolled
          ? "bg-white/80 dark:bg-black/80 backdrop-blur-xl border-border/50 py-2 sm:py-3 shadow-lg shadow-black/[0.03]"
          : "bg-transparent border-transparent py-3 sm:py-5"
      )}
    >
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 sm:px-6 lg:px-10 gap-2 sm:gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-1.5 sm:gap-2.5 z-[110] transition-opacity hover:opacity-80 shrink-0">
          <Image
            src="/logo.png"
            alt="Onelinker"
            width={32}
            height={32}
            className="rounded-md h-8 w-8 sm:h-10 sm:w-10"
            priority
          />
          <span className="hidden sm:inline text-base sm:text-lg font-bold text-foreground tracking-tight">
            Onelinker
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-1 p-1 bg-muted/30 backdrop-blur-md rounded-full border border-border/40">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                "px-4 py-2 text-sm font-medium rounded-full transition-all relative group",
                pathname === l.href 
                  ? "text-primary bg-white shadow-sm" 
                  : "text-muted-foreground hover:text-foreground hover:bg-white/50"
              )}
            >
              {l.label}
              {pathname === l.href && (
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
              )}
            </Link>
          ))}
        </div>

        {/* Desktop CTA - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-3 relative z-[110] ml-auto">
          <Link
            href="/login"
            className="text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors px-3 py-2"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className="group relative inline-flex items-center justify-center gap-2 overflow-hidden rounded-full bg-foreground px-6 py-2.5 text-sm font-bold text-background transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-primary/25"
          >
            <span className="relative z-10 flex items-center gap-1.5">
              Get Started <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        </div>

        {/* Mobile hamburger - Hidden on md and up since we show CTA buttons */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="relative z-[110] flex sm:hidden h-9 w-9 items-center justify-center rounded-full bg-muted/40 backdrop-blur-md border border-border/40 text-foreground transition-all hover:bg-muted/60 active:scale-90 shrink-0"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-menu"
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </nav>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div
          id="mobile-nav-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          onClick={(e) => {
            // Close menu if clicking directly on overlay (not the content)
            if (e.target === e.currentTarget) {
              setMobileOpen(false);
            }
          }}
          className="fixed inset-0 z-[105] md:hidden"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />

          {/* Content Container */}
          <div className="relative flex flex-col h-screen w-full bg-background overflow-hidden">
            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto px-6 pt-20">
              {/* Navigation Links */}
              <nav className="space-y-1 mb-8">
                {NAV_LINKS.map((l, i) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    data-mobile-nav-link=""
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "block min-h-[48px] px-4 py-3 text-2xl sm:text-3xl font-medium font-heading text-foreground",
                      "rounded-lg transition-all duration-200 outline-none",
                      "hover:text-primary hover:bg-muted/40",
                      "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      "border-b border-border/10 last:border-b-0"
                    )}
                    style={{ transitionDelay: `${i * 50}ms` }}
                  >
                    {l.label}
                  </Link>
                ))}
              </nav>
            </div>

            {/* CTA Section - Sticky Footer */}
            <div className="shrink-0 border-t border-border/10 bg-background px-6 py-4 pb-safe space-y-3">
              <Link
                href="/signup"
                className={cn(
                  "flex items-center justify-center gap-2 min-h-[48px] rounded-full bg-foreground w-full px-6 py-4",
                  "text-base font-bold text-background shadow-xl",
                  "transition-all duration-200 outline-none",
                  "hover:shadow-primary/25 hover:scale-[1.02] active:scale-[0.98]",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                Get Started <ArrowRight className="h-5 w-5" />
              </Link>
              <Link
                href="/login"
                className={cn(
                  "flex items-center justify-center min-h-[48px] w-full px-4 py-3",
                  "text-sm font-semibold text-muted-foreground",
                  "transition-colors duration-200 outline-none rounded-lg",
                  "hover:text-foreground hover:bg-muted/40",
                  "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                )}
              >
                Already have an account? Log in
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

const FOOTER_COLS = [
  {
    title: "Product",
    links: [
      { label: "How it Works", href: "/how-it-works" },
      { label: "Pricing", href: "/pricing" },
      { label: "Changelog", href: "/changelog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Blog", href: "/blog" },
      { label: "Quick Start", href: "/signup" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
    ],
  },
] as const;

const SOCIALS = [
  { icon: Twitter, href: "https://x.com/onelinker_ai", label: "X (Twitter)" },
  { icon: Linkedin, href: "https://linkedin.com/company/onelinker", label: "LinkedIn" },
  { icon: Instagram, href: "https://instagram.com/onelinker_ai", label: "Instagram" },
  { icon: Youtube, href: "https://youtube.com/@onelinker", label: "YouTube" },
  { icon: Facebook, href: "https://facebook.com/onelinker", label: "Facebook" },
] as const;

export function Footer() {
  return (
    <footer className="relative overflow-hidden">
      {/* CTA banner */}
      <div className="border-t border-border/30 bg-muted/10">
        <div className="max-w-6xl mx-auto px-5 py-12">
          <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-8 sm:p-10 relative overflow-hidden">
            {/* Glow */}
            <div className="absolute top-0 right-0 w-[300px] h-[200px] bg-primary/8 rounded-full blur-[80px] pointer-events-none" />

            <div className="relative flex flex-col lg:flex-row items-center justify-between gap-6">
              <div className="text-center lg:text-left">
                <h3 className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight">
                  Ready to grow your social presence?
                </h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md">
                  Join thousands of creators and agencies scheduling smarter. Free forever, no credit card required.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Link
                  href="/signup"
                  className="inline-flex items-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-white hover:bg-primary/90 transition-all shadow-glow-sm hover:shadow-glow"
                >
                  Get started free <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main footer */}
      <div className="border-t border-border/30 bg-background">
        <div className="max-w-6xl mx-auto px-5 pt-14 pb-8">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-8 lg:gap-10">
            {/* Brand */}
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2.5 mb-4 transition-opacity hover:opacity-80">
                <Image src="/logo.png" alt="Onelinker" width={36} height={36} className="rounded-lg" />
                <span className="text-lg font-bold text-foreground tracking-tight">
                  Onelinker
                </span>
              </Link>
              <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mb-6">
                The AI-powered social media scheduling platform. Schedule across 10+ channels, create with AI, and grow your audience — all in one place.
              </p>

              {/* Social icons */}
              <div className="flex items-center gap-1.5">
                {SOCIALS.map((s) => (
                  <a
                    key={s.label}
                    href={s.href}
                    aria-label={s.label}
                    className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground/60 hover:text-foreground hover:bg-muted/40 transition-all duration-200"
                  >
                    <s.icon className="h-4 w-4" />
                  </a>
                ))}
              </div>
            </div>

            {/* Link columns */}
            {FOOTER_COLS.map((col) => (
              <div key={col.title}>
                <p className="text-[11px] font-bold text-foreground uppercase tracking-widest mb-4">
                  {col.title}
                </p>
                <ul className="space-y-2.5">
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1 group/link"
                      >
                        {l.label}
                        <ArrowUpRight className="h-3 w-3 opacity-0 -translate-y-0.5 group-hover/link:opacity-50 group-hover/link:translate-y-0 transition-all" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Highlights strip */}
          <div className="mt-10 pt-8 border-t border-border/30">
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mb-8">
              {[
                { icon: Globe, text: "10+ platforms supported" },
                { icon: Sparkles, text: "AI-powered content" },
                { icon: Shield, text: "256-bit encryption" },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-2 text-xs text-muted-foreground/60">
                  <item.icon className="h-3.5 w-3.5" />
                  <span>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div className="flex flex-col items-center gap-4 pt-6 border-t border-border/20 sm:flex-row sm:justify-between">
            <p className="text-xs text-muted-foreground/50">
              &copy; {new Date().getFullYear()} Onelinker. All rights reserved.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              <Link href="/privacy" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                Terms
              </Link>
              <a href="mailto:support@onelinker.ai" className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                <Mail className="h-3 w-3" />
                support@onelinker.ai
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
