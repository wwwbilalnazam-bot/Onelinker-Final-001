"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Eye, EyeOff, Loader2, User, Mail, Lock, Check, ArrowRight,
  Sparkles, Calendar, BarChart3, CheckCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/ui/animated-section";
import toast from "react-hot-toast";

// ── Disposable email domain blocklist ────────────────────────

const BLOCKED_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "tempmail.com", "throwam.com",
  "yopmail.com", "sharklasers.com", "guerrillamailblock.com",
  "grr.la", "guerrillamail.info", "guerrillamail.biz", "guerrillamail.de",
  "guerrillamail.net", "guerrillamail.org", "spam4.me", "trashmail.com",
  "trashmail.me", "trashmail.net", "dispostable.com", "mailnull.com",
  "maildrop.cc", "spamgourmet.com", "10minutemail.com", "temp-mail.org",
  "fakeinbox.com", "discard.email", "spamex.com", "bccto.me",
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  return BLOCKED_DOMAINS.has(domain);
}

// ── Validation schema ─────────────────────────────────────────

const signupSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(60, "Name must be under 60 characters")
    .regex(/^[a-zA-Z\s'-]+$/, "Name can only contain letters, spaces, hyphens and apostrophes"),
  email: z
    .string()
    .email("Please enter a valid email address")
    .refine((email) => !isDisposableEmail(email), {
      message: "Disposable email addresses are not allowed",
    }),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Must contain at least one uppercase letter")
    .regex(/[0-9]/, "Must contain at least one number"),
  confirm_password: z.string(),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"],
});

type SignupFormValues = z.infer<typeof signupSchema>;

// ── Password strength ─────────────────────────────────────────

function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { score, label: "Weak", color: "bg-red-500" };
  if (score <= 2) return { score, label: "Fair", color: "bg-orange-400" };
  if (score <= 3) return { score, label: "Good", color: "bg-amber-400" };
  if (score <= 4) return { score, label: "Strong", color: "bg-emerald-400" };
  return { score, label: "Very strong", color: "bg-emerald-500" };
}

// ── Password requirements checklist ──────────────────────────

function PasswordChecklist({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
  ];

  return (
    <div className="flex items-center gap-3">
      {checks.map((check) => (
        <div key={check.label} className="flex items-center gap-1.5">
          <div className={cn(
            "h-3.5 w-3.5 rounded-full flex items-center justify-center transition-all duration-200",
            check.met
              ? "bg-emerald-500 scale-100"
              : "bg-muted scale-90 border border-border/60"
          )}>
            {check.met && <Check className="h-2 w-2 text-white" />}
          </div>
          <span className={cn(
            "text-[11px] transition-colors",
            check.met ? "text-emerald-600 font-medium" : "text-muted-foreground"
          )}>
            {check.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────

function SignupContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/onboarding";
  const referralCode = searchParams.get("ref");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const supabase = createClient();
  const passwordStrength = getPasswordStrength(passwordValue);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormValues>({
    resolver: zodResolver(signupSchema),
  });

  // ── Email + password sign up ────────────────────────────────

  async function onSubmit(values: SignupFormValues) {
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          referral_code: referralCode ?? null,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
      },
    });

    if (error) {
      if (error.message.includes("already registered")) {
        toast.error(
          "An account with this email already exists. Try signing in.",
          { duration: 5000 }
        );
      } else {
        toast.error(error.message);
      }
      return;
    }

    if (data.user && !data.session) {
      // Send welcome email (non-blocking)
      if (data.user.id) {
        fetch("/api/auth/welcome-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: data.user.id,
            email: values.email,
            fullName: values.full_name,
          }),
        }).catch((err) => console.error("[Welcome Email]", err));
      }
      router.push(`/signup/verify?email=${encodeURIComponent(values.email)}`);
      return;
    }

    // Send welcome email (non-blocking)
    if (data.user?.id) {
      fetch("/api/auth/welcome-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: data.user.id,
          email: values.email,
          fullName: values.full_name,
        }),
      }).catch((err) => console.error("[Welcome Email]", err));
    }

    toast.success("Account created! Welcome to Onelinker.");
    router.push(nextUrl);
    router.refresh();
  }

  // ── Google OAuth ────────────────────────────────────────────

  async function signUpWithGoogle() {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) {
      toast.error("Failed to sign up with Google. Please try again.");
      setIsGoogleLoading(false);
    }
  }


  return (
    <AnimatedSection animation="fade-up" delay={100}>
      <div className="w-full max-w-[460px] space-y-8 bg-card/10 p-2 rounded-[2.5rem]">
        <div className="bg-background/40 backdrop-blur-2xl border border-border/10 rounded-[2.2rem] p-8 sm:p-10 shadow-2xl space-y-8">
          {/* Header */}
          <div className="space-y-3">
            <h1 className="text-3xl sm:text-4xl font-medium text-foreground tracking-tight font-heading">
              Get Started
            </h1>
            <p className="text-base text-muted-foreground font-medium">
              Create your free account in seconds
            </p>
          </div>

          <div className="w-full">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-3 text-sm font-medium border-border/80 hover:bg-accent/60 rounded-xl transition-all hover:shadow-sm"
              onClick={signUpWithGoogle}
              disabled={isGoogleLoading || isSubmitting}
            >
              {isGoogleLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              Continue with Google
            </Button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4">
            <Separator className="flex-1 bg-border/20" />
            <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-[0.2em]">
              or use email
            </span>
            <Separator className="flex-1 bg-border/20" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
            {/* Full Name */}
            <div className="space-y-2.5">
              <Label htmlFor="full_name" className="text-sm font-bold text-foreground ml-1">
                Full Name
              </Label>
              <div className="relative group">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input
                  id="full_name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  className={cn(
                    "pl-11 h-13 rounded-2xl bg-muted/20 border-border/30 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/30 transition-all",
                    errors.full_name && "border-destructive/50 focus-visible:ring-destructive/10"
                  )}
                  {...register("full_name")}
                />
              </div>
              {errors.full_name && (
                <p className="text-xs font-semibold text-destructive/80 ml-1">{errors.full_name.message}</p>
              )}
            </div>

            {/* Email */}
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
                  placeholder="you@example.com"
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

            {/* Password */}
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-sm font-bold text-foreground ml-1">
                Create Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  className={cn(
                    "pl-11 pr-12 h-13 rounded-2xl bg-muted/20 border-border/30 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/30 transition-all",
                    errors.password && "border-destructive/50 focus-visible:ring-destructive/10"
                  )}
                  {...register("password", {
                    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                      setPasswordValue(e.target.value),
                  })}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              {/* Password strength */}
              {passwordValue && (
                <div className="px-1 space-y-3 pt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1.5 flex-1">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-1 flex-1 rounded-full transition-all duration-500",
                            i <= passwordStrength.score
                              ? passwordStrength.color
                              : "bg-muted/30"
                          )}
                        />
                      ))}
                    </div>
                    <span className={cn(
                      "text-[10px] font-black uppercase tracking-wider",
                      passwordStrength.score <= 2
                        ? "text-red-400"
                        : passwordStrength.score <= 3
                        ? "text-amber-400"
                        : "text-emerald-400"
                    )}>
                      {passwordStrength.label}
                    </span>
                  </div>
                  <PasswordChecklist password={passwordValue} />
                </div>
              )}

              {errors.password && (
                <p className="text-xs font-semibold text-destructive/80 ml-1">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm Password */}
            <div className="space-y-2.5">
              <Label htmlFor="confirm_password" className="text-sm font-bold text-foreground ml-1">
                Confirm Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input
                  id="confirm_password"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  className={cn(
                    "pl-11 pr-12 h-13 rounded-2xl bg-muted/20 border-border/30 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/30 transition-all",
                    errors.confirm_password && "border-destructive/50 focus-visible:ring-destructive/10"
                  )}
                  {...register("confirm_password")}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                  onClick={() => setShowConfirm(!showConfirm)}
                >
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirm_password && (
                <p className="text-xs font-semibold text-destructive/80 ml-1">
                  {errors.confirm_password.message}
                </p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-13 bg-foreground text-background hover:bg-foreground/90 font-bold rounded-2xl text-base shadow-xl transition-all active:scale-[0.98] group"
              disabled={isSubmitting || isGoogleLoading}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <span className="flex items-center gap-2">
                  Create Account <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>
          </form>

          {/* Footer link */}
          <div className="text-center pt-2">
            <p className="text-sm font-medium text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-bold text-primary hover:underline underline-offset-4"
              >
                Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}


function SignupSkeleton() {
  return (
    <div className="w-full max-w-[460px] space-y-8 animate-pulse p-10">
      <div className="h-10 w-48 bg-muted/40 rounded-xl mb-4" />
      <div className="h-4 w-64 bg-muted/20 rounded-lg mb-8" />
      <div className="grid grid-cols-2 gap-4">
        <div className="h-12 bg-muted/30 rounded-2xl" />
        <div className="h-12 bg-muted/30 rounded-2xl" />
      </div>
      <div className="space-y-4 pt-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-13 bg-muted/10 rounded-2xl border border-border/10" />
        ))}
        <div className="h-13 bg-foreground/10 rounded-2xl shadow-xl mt-4" />
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<SignupSkeleton />}>
      <SignupContent />
    </Suspense>
  );
}
