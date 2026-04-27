"use client";

import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ForceLightTheme } from "@/components/providers/ForceLightTheme";
import { ArrowLeft, Shield, Zap } from "lucide-react";

export function AuthLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <ForceLightTheme />
      <div className="min-h-screen bg-gradient-to-br from-white via-slate-50 to-slate-100 flex flex-col lg:flex-row">
        {/* ── Left sidebar (desktop only) — Premium gradient background ── */}
        <div className="hidden lg:flex lg:w-[45%] shrink-0 relative overflow-hidden flex-col justify-between p-12">
          {/* Gradient background using primary color */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />

          {/* Animated background elements with primary color */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl opacity-20" style={{background: 'var(--color-primary)'}} />
            <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-15" style={{background: 'var(--color-primary)'}} />
            <div className="absolute top-1/2 left-1/3 w-80 h-80 rounded-full blur-3xl opacity-10" style={{background: 'var(--color-primary)'}} />
          </div>

          {/* Content */}
          <div className="relative z-10 space-y-8">
            {/* Logo */}
            <Link href="/" className="inline-flex items-center gap-3 group">
              <div className="h-12 w-12 relative">
                <Image src="/logo.png" alt="Onelinker" fill className="rounded-xl shadow-xl transition-transform group-hover:scale-110 duration-500" />
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">Onelinker</span>
            </Link>

            {/* Headline */}
            <div className="space-y-4">
              <h1 className="text-4xl xl:text-5xl font-bold text-white leading-tight">
                Post Everywhere.
                <br />
                <span className="bg-gradient-to-r from-yellow-200 via-purple-200 to-blue-200 bg-clip-text text-transparent">
                  Automate Everything.
                </span>
              </h1>
              <p className="text-lg text-white/70 leading-relaxed max-w-md">
                Schedule posts, create content with AI, and track analytics across 10+ platforms—all from one unified dashboard.
              </p>
            </div>
          </div>

          {/* Bottom stats */}
          <div className="relative z-10 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm p-4 hover:bg-white/10 transition-all">
                <div className="text-2xl font-bold text-white mb-1">10K+</div>
                <p className="text-sm text-white/60">Active creators</p>
              </div>
              <div className="rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm p-4 hover:bg-white/10 transition-all">
                <div className="text-2xl font-bold text-white mb-1">99.9%</div>
                <p className="text-sm text-white/60">Uptime</p>
              </div>
            </div>

            {/* Trust badges */}
            <div className="flex items-center gap-4 pt-4 border-t border-white/10">
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Shield className="h-4 w-4" style={{color: 'hsl(var(--color-primary) / 0.8)'}} />
                SOC 2 Certified
              </div>
              <div className="w-px h-4 bg-white/10" />
              <div className="flex items-center gap-2 text-sm text-white/70">
                <Zap className="h-4 w-4" style={{color: 'hsl(var(--color-primary) / 0.8)'}} />
                Always protected
              </div>
            </div>
          </div>
        </div>

        {/* ── Right panel (form area) ── */}
        <div className="flex-1 flex flex-col relative overflow-y-auto lg:overflow-auto">
          {/* Mobile header — Minimal and clean */}
          <header className="lg:hidden sticky top-0 flex items-center justify-between px-4 py-5 border-b border-slate-200 bg-white/80 backdrop-blur-sm z-40">
            <Link href="/" className="flex items-center gap-2 group shrink-0">
              <Image src="/logo.png" alt="Onelinker" width={32} height={32} className="rounded-lg shadow-md" />
              <span className="text-xl font-bold text-slate-900 hidden sm:inline">Onelinker</span>
            </Link>
            <Link
              href="/"
              className="ml-auto flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
            </Link>
          </header>

          {/* Desktop top nav */}
          <div className="hidden lg:flex items-center justify-between px-12 py-8 border-b border-slate-200">
            <div className="h-0" />
            <Link
              href="/"
              className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>

          {/* Form content — scrollable on mobile, centered on desktop */}
          <main className="flex-1 flex flex-col items-center justify-center px-4 py-8 sm:px-6 sm:py-12 lg:py-0 relative z-10 w-full min-h-0">
            <div className="w-full max-w-md flex-shrink-0">
              {children}
            </div>
          </main>

          {/* Footer */}
          <footer className="px-4 py-6 sm:px-6 sm:py-8 text-center border-t border-slate-200 bg-slate-50/50 text-slate-600 relative z-10">
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 mb-3 text-xs sm:text-sm">
              <Link href="/terms" className="hover:text-slate-900 transition-colors font-medium">
                Terms
              </Link>
              <span className="hidden sm:inline text-slate-300">•</span>
              <Link href="/privacy" className="hover:text-slate-900 transition-colors font-medium">
                Privacy
              </Link>
              <span className="hidden sm:inline text-slate-300">•</span>
              <Link href="/contact" className="hover:text-slate-900 transition-colors font-medium">
                Support
              </Link>
            </div>
            <p className="text-[11px] text-slate-400">&copy; 2026 Onelinker. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
