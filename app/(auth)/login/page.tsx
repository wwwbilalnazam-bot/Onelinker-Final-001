"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Mail, Lock, ArrowRight, Zap, Shield, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/ui/animated-section";
import toast from "react-hot-toast";

// ── Validation schema ─────────────────────────────────────────

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

// ── Component ─────────────────────────────────────────────────

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextUrl = searchParams.get("next") ?? "/home";

  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const supabase = createClient();

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
  });

  // ── Email + password sign in ────────────────────────────────

  async function onSubmit(values: LoginFormValues) {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        toast.error("Incorrect email or password. Please try again.");
      } else if (error.message.includes("Email not confirmed")) {
        toast.error("Please verify your email address before signing in.");
      } else {
        toast.error(error.message);
      }
      return;
    }

    // Set redirecting state to prevent re-submission and show loading
    setIsRedirecting(true);
    toast.success("Welcome back!");

    // Redirect after a brief delay to let toast show
    setTimeout(() => {
      router.push(nextUrl);
      router.refresh();
    }, 300);
  }

  // ── Google OAuth ────────────────────────────────────────────

  async function signInWithGoogle() {
    setIsGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextUrl)}`,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });

    if (error) {
      toast.error("Failed to sign in with Google. Please try again.");
      setIsGoogleLoading(false);
    }
  }



  return (
    <AnimatedSection animation="fade-up" delay={100}>
      <div className="w-full max-w-[440px] space-y-8 bg-card/10 p-2 rounded-[2.5rem]">
        <div className="bg-background/40 backdrop-blur-2xl border border-border/10 rounded-[2.2rem] p-8 sm:p-10 shadow-2xl space-y-8">
          {/* Logo/Branding */}
          <div className="flex items-center justify-center mb-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-primary/70">
              <span className="text-xl font-black text-white">O</span>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-3 text-center">
            <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
              Welcome back
            </h1>
            <p className="text-base text-muted-foreground font-medium">
              Sign in to your account
            </p>
          </div>

          {/* Social Auth Grid */}
          <div className="w-full">
            <Button
              type="button"
              variant="outline"
              className="w-full h-12 gap-3 text-sm font-bold border-border/40 hover:bg-accent/40 rounded-2xl transition-all hover:shadow-lg hover:shadow-primary/5 active:scale-[0.98]"
              onClick={signInWithGoogle}
              disabled={isGoogleLoading || isSubmitting || isRedirecting}
            >
              {isGoogleLoading || isRedirecting ? (
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
              or continue with
            </span>
            <Separator className="flex-1 bg-border/20" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
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
                  placeholder="name@company.com"
                  disabled={isRedirecting}
                  className={cn(
                    "pl-11 h-13 rounded-2xl bg-muted/20 border-border/30 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/30 transition-all",
                    errors.email && "border-destructive/50 focus-visible:ring-destructive/10",
                    isRedirecting && "opacity-50 cursor-not-allowed"
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
              <div className="flex items-center justify-between ml-1">
                <Label htmlFor="password" className="text-sm font-bold text-foreground">
                  Password
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary font-bold hover:underline underline-offset-4 transition-all"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  disabled={isRedirecting}
                  className={cn(
                    "pl-11 pr-12 h-13 rounded-2xl bg-muted/20 border-border/30 text-sm font-medium focus-visible:ring-4 focus-visible:ring-primary/10 focus-visible:border-primary/30 transition-all",
                    errors.password && "border-destructive/50 focus-visible:ring-destructive/10",
                    isRedirecting && "opacity-50 cursor-not-allowed"
                  )}
                  {...register("password")}
                />
                <button
                  type="button"
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-semibold text-destructive/80 ml-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              className="w-full h-13 bg-primary text-white hover:bg-primary/90 font-bold rounded-2xl text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.98] group"
              disabled={isSubmitting || isGoogleLoading || isRedirecting}
            >
              {isSubmitting || isRedirecting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <span className="flex items-center gap-2">
                  Sign In <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>

          </form>

          {/* Footer link */}
          <div className="text-center pt-2">
            <p className="text-sm font-medium text-muted-foreground">
              New to Onelinker?{" "}
              <Link
                href="/signup"
                className="font-bold text-primary hover:underline underline-offset-4"
              >
                Create free account
              </Link>
            </p>
          </div>

          {/* Trust indicators */}
          <div className="flex items-center justify-center gap-6 pt-2">
            {[
              { icon: Shield, text: "Secure" },
              { icon: Zap, text: "Fast" },
            ].map((item) => (
              <span key={item.text} className="flex items-center gap-2 text-[10px] font-black text-muted-foreground/30 uppercase tracking-[0.2em]">
                <item.icon className="h-3 w-3" />
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </AnimatedSection>
  );
}

function LoginSkeleton() {
  return (
    <div className="w-full max-w-[440px] space-y-8 animate-pulse p-10">
      <div className="space-y-4">
        <div className="h-8 w-40 bg-muted/40 rounded-xl" />
        <div className="h-4 w-60 bg-muted/20 rounded-lg" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-12 bg-muted/30 rounded-2xl" />
        <div className="h-12 bg-muted/30 rounded-2xl" />
      </div>
      <div className="h-13 bg-muted/10 rounded-2xl border border-border/10" />
      <div className="h-13 bg-muted/10 rounded-2xl border border-border/10" />
      <div className="h-13 bg-foreground/10 rounded-2xl shadow-xl" />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginSkeleton />}>
      <LoginContent />
    </Suspense>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

