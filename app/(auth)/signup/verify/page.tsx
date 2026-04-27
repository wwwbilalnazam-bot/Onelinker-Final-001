"use client";

import { useSearchParams } from "next/navigation";
import { Mail, CheckCircle, Loader2, ArrowLeft, Inbox, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AnimatedSection } from "@/components/ui/animated-section";
import { createClient } from "@/lib/supabase/client";
import { useState, useEffect, Suspense } from "react";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const supabase = createClient();

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function resendVerification() {
    if (!email || cooldown > 0) return;
    setIsResending(true);

    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });

    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Verification email resent!");
      setCooldown(60);
    }
    setIsResending(false);
  }

  // Get email provider domain for "open email" button
  const emailDomain = email.split("@")[1]?.toLowerCase() ?? "";
  const emailProviders: Record<string, { name: string; url: string }> = {
    "gmail.com": { name: "Open Gmail", url: "https://mail.google.com" },
    "outlook.com": { name: "Open Outlook", url: "https://outlook.live.com" },
    "hotmail.com": { name: "Open Outlook", url: "https://outlook.live.com" },
    "yahoo.com": { name: "Open Yahoo Mail", url: "https://mail.yahoo.com" },
  };
  const emailProvider = emailProviders[emailDomain];

  return (
    <AnimatedSection animation="fade-up" delay={100}>
    <div className="w-full max-w-[420px] space-y-8">
      {/* Logo/Branding */}
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70">
          <span className="text-lg font-black text-white">O</span>
        </div>
        <span className="text-lg font-bold text-foreground">Onelinker</span>
      </div>

      {/* Animated icon */}
      <div className="relative w-fit">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/5 border border-primary/10">
          <Mail className="h-7 w-7 text-primary" />
        </div>
        <div className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 shadow-md animate-scale-in">
          <CheckCircle className="h-4 w-4 text-white" />
        </div>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
          Verify your email
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed">
          We&apos;ve sent a verification link to{" "}
          {email && (
            <span className="font-semibold text-foreground break-all">{email}</span>
          )}
        </p>
      </div>

      {/* Steps timeline */}
      <div className="rounded-xl bg-muted/30 border border-border/40 p-4 space-y-0">
        {[
          { step: "Email sent", desc: "Check your inbox", done: true },
          { step: "Click the link", desc: "Confirm your email address", done: false },
          { step: "Start creating", desc: "Set up your first workspace", done: false },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3 relative">
            {/* Connector line */}
            {i < 2 && (
              <div className="absolute left-[11px] top-7 w-0.5 h-6 bg-border/40" />
            )}
            {/* Step indicator */}
            <div className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full shrink-0 mt-0.5 transition-all",
              item.done
                ? "bg-emerald-500 text-white"
                : "bg-muted border border-border/60 text-muted-foreground"
            )}>
              {item.done ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <span className="text-[10px] font-bold">{i + 1}</span>
              )}
            </div>
            <div className="pb-5">
              <p className={cn(
                "text-sm font-medium",
                item.done ? "text-foreground" : "text-muted-foreground"
              )}>
                {item.step}
              </p>
              <p className="text-xs text-muted-foreground/70">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="space-y-2.5">
        {/* Open email provider button */}
        {emailProvider && (
          <a href={emailProvider.url} target="_blank" rel="noopener noreferrer">
            <Button
              className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm shadow-lg shadow-primary/25 transition-all"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              {emailProvider.name}
            </Button>
          </a>
        )}

        <Button
          variant="outline"
          className="w-full h-11 rounded-xl"
          onClick={resendVerification}
          disabled={isResending || !email || cooldown > 0}
        >
          {isResending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : cooldown > 0 ? (
            <Clock className="h-4 w-4 mr-2" />
          ) : (
            <Mail className="h-4 w-4 mr-2" />
          )}
          {cooldown > 0
            ? `Resend in ${cooldown}s`
            : "Resend verification email"
          }
        </Button>

        <Link href="/login" className="block">
          <Button variant="ghost" className="w-full h-10 text-muted-foreground text-sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to sign in
          </Button>
        </Link>
      </div>

      {/* Help tip */}
      <div className="rounded-lg bg-muted/20 border border-border/30 px-3.5 py-2.5">
        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">
          Can&apos;t find the email? Check your spam folder, or make sure <span className="text-muted-foreground font-medium">{email}</span> is spelled correctly.
        </p>
      </div>
    </div>
    </AnimatedSection>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
