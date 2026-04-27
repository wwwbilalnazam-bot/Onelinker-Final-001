"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff, Loader2, Lock, CheckCircle, AlertCircle, ShieldCheck, Check, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { AnimatedSection } from "@/components/ui/animated-section";
import toast from "react-hot-toast";
import Link from "next/link";

const resetSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Must contain at least one uppercase letter")
      .regex(/[0-9]/, "Must contain at least one number"),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords don't match",
    path: ["confirm_password"],
  });

type ResetFormValues = z.infer<typeof resetSchema>;

// ── Interactive password checklist ────────────────────────────

function PasswordRequirements({ password }: { password: string }) {
  const checks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "Uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Number", met: /[0-9]/.test(password) },
  ];

  const allMet = checks.every((c) => c.met);

  return (
    <div className={cn(
      "rounded-2xl border p-4 space-y-3 transition-all duration-500",
      allMet
        ? "bg-emerald-500/[0.03] border-emerald-500/20 shadow-inner"
        : "bg-muted/10 border-border/10"
    )}>
      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground/60 ml-1">
        Password must have:
      </p>
      <div className="grid grid-cols-1 gap-2">
        {checks.map((check) => (
          <div key={check.label} className="flex items-center gap-3">
            <div className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center transition-all duration-300 shadow-sm",
              check.met
                ? "bg-emerald-500 scale-100"
                : "bg-muted/40 border border-border/10 scale-90"
            )}>
              {check.met ? (
                <Check className="h-3 w-3 text-white" />
              ) : (
                <div className="h-1 w-1 rounded-full bg-muted-foreground/40" />
              )}
            </div>
            <span className={cn(
              "text-xs font-semibold transition-all duration-300",
              check.met
                ? "text-emerald-500 line-through decoration-emerald-500/20"
                : "text-muted-foreground/70"
            )}>
              {check.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [sessionError, setSessionError] = useState(false);
  const [passwordValue, setPasswordValue] = useState("");
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionError(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setTimeout(() => {
          supabase.auth.getSession().then(({ data: { session: s } }) => {
            if (!s) setSessionError(true);
          });
        }, 1500);
      }
    });

    return () => listener.subscription.unsubscribe();
  }, [supabase]);

  // Countdown for redirect after success
  useEffect(() => {
    if (!isSuccess) return;
    if (countdown <= 0) {
      router.push("/home");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [isSuccess, countdown, router]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
  });

  async function onSubmit(values: ResetFormValues) {
    const { error } = await supabase.auth.updateUser({
      password: values.password,
    });

    if (error) {
      toast.error(error.message);
      return;
    }

    setIsSuccess(true);
  }

  // ── Invalid / expired link ────────────────────────────────

  if (sessionError) {
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

            <div className="flex flex-col items-center text-center space-y-5">
              <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-destructive/10 border border-destructive/20 shadow-inner">
                <AlertCircle className="h-9 w-9 text-destructive" />
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-medium text-foreground tracking-tight font-heading">
                  Link expired
                </h1>
                <p className="text-base text-muted-foreground font-medium leading-relaxed px-2">
                  This reset link is no longer valid. Password reset links expire after 1 hour for security.
                </p>
              </div>
            </div>

            <div className="rounded-[1.5rem] bg-muted/10 border border-border/10 p-5">
              <p className="text-xs font-medium text-muted-foreground leading-relaxed text-center">
                Don&apos;t worry — you can easily request a new reset link.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <Link href="/forgot-password" size="lg" className="block w-full">
                <Button className="w-full h-13 rounded-2xl bg-primary text-white hover:bg-primary/90 font-bold text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.98]">
                  Request new link
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
              <Link href="/login" className="block text-center pt-2">
                <button className="text-sm font-bold text-muted-foreground hover:text-foreground transition-all">
                  Back to Sign In
                </button>
              </Link>
            </div>
          </div>
        </div>
      </AnimatedSection>
    );
  }

  // ── Success state ────────────────────────────────────────

  if (isSuccess) {
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

            <div className="flex flex-col items-center text-center space-y-5">
              <div className="relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 shadow-inner">
                  <ShieldCheck className="h-9 w-9 text-emerald-500" />
                </div>
                <div className="absolute -top-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg border-2 border-background animate-scale-in">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
              </div>

              <div className="space-y-3">
                <h1 className="text-3xl font-medium text-foreground tracking-tight font-heading">
                  Password updated!
                </h1>
                <p className="text-base text-muted-foreground font-medium leading-relaxed px-2">
                  Your password has been changed successfully. Redirecting you in <span className="font-bold text-foreground">{countdown}s</span>...
                </p>
              </div>
            </div>

            <div className="h-1.5 rounded-full bg-muted/20 overflow-hidden shadow-inner">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-1000 ease-linear shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                style={{ width: `${((3 - countdown) / 3) * 100}%` }}
              />
            </div>

            <Link href="/home" className="block w-full pt-2">
              <Button className="w-full h-13 rounded-2xl bg-primary text-white hover:bg-primary/90 font-bold text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.98] group">
                Dashboard Now
                <ArrowRight className="h-5 w-5 ml-2 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        </div>
      </AnimatedSection>
    );
  }

  // ── Reset form ───────────────────────────────────────────

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
            <div className="flex h-16 w-16 items-center justify-center rounded-[1.5rem] bg-primary/5 border border-primary/10 shadow-inner mx-auto">
              <ShieldCheck className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-3">
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground tracking-tight">
                Set new password
              </h1>
              <p className="text-base text-muted-foreground font-medium leading-relaxed">
                Choose a strong password to secure your account.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            {/* New password */}
            <div className="space-y-2.5">
              <Label htmlFor="password" className="text-sm font-bold text-foreground ml-1">
                New Password
              </Label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 group-focus-within:text-primary transition-colors" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  autoFocus
                  placeholder="Create a strong password"
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
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs font-semibold text-destructive/80 ml-1">{errors.password.message}</p>
              )}
            </div>

            {/* Confirm password */}
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
                  tabIndex={-1}
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

            {/* Interactive password requirements */}
            <PasswordRequirements password={passwordValue} />

            <Button
              type="submit"
              className="w-full h-13 bg-primary text-white hover:bg-primary/90 font-bold rounded-2xl text-base shadow-lg shadow-primary/25 transition-all active:scale-[0.98] group"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
              ) : (
                <span className="flex items-center gap-2">
                  Update Password <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </AnimatedSection>
  );
}
