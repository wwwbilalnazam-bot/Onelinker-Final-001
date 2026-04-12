"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Mail, Loader2, ArrowLeft, CheckCircle, KeyRound, ArrowRight, ExternalLink, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/ui/animated-section";
import toast from "react-hot-toast";

const forgotSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type ForgotFormValues = z.infer<typeof forgotSchema>;

export default function ForgotPasswordPage() {
  const [emailSent, setEmailSent] = useState(false);
  const [sentToEmail, setSentToEmail] = useState("");
  const supabase = createClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotFormValues>({
    resolver: zodResolver(forgotSchema),
  });

  async function onSubmit(values: ForgotFormValues) {
    const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setSentToEmail(values.email);
    setEmailSent(true);
  }

  // Get email provider for quick-open button
  const emailDomain = sentToEmail.split("@")[1]?.toLowerCase() ?? "";
  const emailProviders: Record<string, { name: string; url: string }> = {
    "gmail.com": { name: "Open Gmail", url: "https://mail.google.com" },
    "outlook.com": { name: "Open Outlook", url: "https://outlook.live.com" },
    "hotmail.com": { name: "Open Outlook", url: "https://outlook.live.com" },
    "yahoo.com": { name: "Open Yahoo Mail", url: "https://mail.yahoo.com" },
  };
  const emailProvider = emailProviders[emailDomain];

  // ── Success state ────────────────────────────────────────

  if (emailSent) {
    return (
      <AnimatedSection animation="fade-up" delay={100}>
        <div className="w-full max-w-[440px] space-y-8 bg-card/10 p-2 rounded-[2.5rem]">
          <div className="bg-background/40 backdrop-blur-2xl border border-border/10 rounded-[2.2rem] p-8 sm:p-10 shadow-2xl space-y-8">
            {/* Success icon */}
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                  <Mail className="h-9 w-9 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg border-2 border-background animate-scale-in">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-medium text-foreground tracking-tight font-heading">
                  Check your inbox
                </h1>
                <p className="text-base text-muted-foreground font-medium leading-relaxed">
                  We&apos;ve sent a password reset link to <br />
                  <span className="text-foreground font-bold break-all">{sentToEmail}</span>
                </p>
              </div>
            </div>

            {/* Tips card */}
            <div className="rounded-[1.5rem] bg-amber-500/[0.03] border border-amber-500/10 p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-sm font-bold text-foreground">Didn&apos;t receive it?</p>
              </div>
              <div className="space-y-3">
                {[
                  "Check your spam or junk folder",
                  "Verified correct email address",
                  "Wait a few minutes (up to 5m)",
                ].map((tip, i) => (
                  <div key={tip} className="flex items-center gap-3 text-xs font-semibold text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500/30" />
                    {tip}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4 pt-2">
              {emailProvider && (
                <a href={emailProvider.url} target="_blank" rel="noopener noreferrer" className="block">
                  <Button className="w-full h-13 rounded-2xl bg-foreground text-background hover:bg-foreground/90 font-bold text-base shadow-xl transition-all active:scale-[0.98]">
                    <ExternalLink className="h-5 w-5 mr-2" />
                    {emailProvider.name}
                  </Button>
                </a>
              )}
              <Button
                variant="outline"
                className="w-full h-13 rounded-2xl border-border/40 font-bold text-sm bg-accent/20 hover:bg-accent/40"
                onClick={() => setEmailSent(false)}
              >
                Try a different email
              </Button>
              <Link href="/login" className="block text-center">
                <button className="text-sm font-bold text-muted-foreground hover:text-foreground transition-all flex items-center gap-2 mx-auto">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>
    );
  }

  // ── Form state ───────────────────────────────────────────

  return (
    <AnimatedSection animation="fade-up" delay={100}>
      <div className="w-full max-w-[440px] space-y-8 bg-card/10 p-2 rounded-[2.5rem]">
        <div className="bg-background/40 backdrop-blur-2xl border border-border/10 rounded-[2.2rem] p-8 sm:p-10 shadow-2xl space-y-8">
          {/* Header */}
          <div className="space-y-5">
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/5 border border-primary/10 shadow-inner">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-medium text-foreground tracking-tight font-heading">
                Reset password
              </h1>
              <p className="text-base text-muted-foreground font-medium leading-relaxed">
                Enter your email address to receive a secure reset link.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="space-y-2.5">
              <Label htmlFor="email" className="text-sm font-bold text-foreground ml-1">
                Email Address
              </Label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="name@company.com"
                  className={cn(
                    "pl-11 h-13 rounded-2xl bg-muted/20 border-border/30 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/30 transition-all",
                    errors.email && "border-destructive/50 focus-visible:ring-destructive/10"
                  )}
                  {...register("email")}
                />
              </div>
              {errors.email && (
                <p className="text-xs font-semibold text-destructive/80 ml-1">{errors.email.message}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full h-13 bg-foreground text-background hover:bg-foreground/90 font-bold rounded-2xl text-base shadow-xl transition-all active:scale-[0.98] group"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <span className="flex items-center gap-2">
                  Send Reset Link <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>
          </form>

          <div className="relative">
            <Separator className="bg-border/20" />
          </div>

          <div className="text-center pt-2">
            <Link
              href="/login"
              className="group inline-flex items-center gap-2.5 text-sm font-bold text-muted-foreground hover:text-foreground transition-all"
            >
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to Sign In
            </Link>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}
