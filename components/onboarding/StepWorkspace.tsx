"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Upload, Loader2, ArrowRight, ImageIcon, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";

// ════════════════════════════════════════════════════════════
// STEP 1 — WORKSPACE SETUP
// User names their workspace and optionally uploads a logo.
// Updates the workspaces table in Supabase.
// ════════════════════════════════════════════════════════════

const workspaceSchema = z.object({
  name: z
    .string()
    .min(2, "Workspace name must be at least 2 characters")
    .max(50, "Workspace name must be under 50 characters"),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

interface StepWorkspaceProps {
  userId: string;
  workspaceId: string;
  initialName: string;
  onComplete: (name: string, logoUrl: string | null) => void;
  onSkip: () => void;
}

export function StepWorkspace({
  userId,
  workspaceId,
  initialName,
  onComplete,
  onSkip,
}: StepWorkspaceProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: { name: initialName },
  });

  // ── Logo upload handler ───────────────────────────────

  function handleLogoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo must be under 5MB");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function uploadLogo(): Promise<string | null> {
    if (!logoFile) return null;
    setIsUploadingLogo(true);

    try {
      const ext = logoFile.name.split(".").pop() ?? "png";
      const path = `${userId}/workspace-logo.${ext}`;

      const { error } = await supabase.storage
        .from("workspace-logos")
        .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from("workspace-logos")
        .getPublicUrl(path);

      return publicUrl;
    } catch {
      toast.error("Failed to upload logo. Continuing without it.");
      return null;
    } finally {
      setIsUploadingLogo(false);
    }
  }

  // ── Form submit ───────────────────────────────────────

  async function onSubmit(values: WorkspaceFormValues) {
    if (!workspaceId) {
      toast.error("Workspace initialization failed. Please refresh the page.");
      return;
    }

    let logoUrl: string | null = null;

    if (logoFile) {
      logoUrl = await uploadLogo();
    }

    // Use API route to update workspace
    try {
      const res = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name: values.name,
          logoUrl,
          userId,
        }),
      });

      if (!res.ok) {
        const json = await res.json() as { error?: string };
        toast.error(json.error ?? "Failed to save workspace. Please try again.");
        return;
      }

      onComplete(values.name, logoUrl);
    } catch (err) {
      console.error("[StepWorkspace] Error:", err);
      toast.error("Failed to save workspace. Please try again.");
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-8">
      {/* Step header */}
      <div className="mb-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 mb-4">
          <Building2 className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Name your workspace
        </h2>
        <p className="text-muted-foreground mt-1.5">
          This is where your team will manage all your social content.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Workspace name */}
        <div className="space-y-1.5">
          <Label htmlFor="name" className="text-sm font-medium">
            Workspace name
          </Label>
          <Input
            id="name"
            placeholder="Acme Corp, My Brand, Jane's Agency..."
            autoFocus
            className={cn(
              "h-11 bg-background/50 text-base",
              errors.name && "border-destructive"
            )}
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-destructive">{errors.name.message}</p>
          )}
          <p className="text-xs text-muted-foreground">
            You can change this anytime in workspace settings.
          </p>
        </div>

        {/* Logo upload */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">
            Workspace logo{" "}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>

          <div className="flex items-center gap-4">
            {/* Preview */}
            <div
              className={cn(
                "relative flex h-20 w-20 shrink-0 items-center justify-center rounded-xl border-2 border-dashed",
                logoPreview
                  ? "border-primary/50 bg-primary/5"
                  : "border-border hover:border-primary/50 cursor-pointer bg-muted/20 hover:bg-primary/5 transition-colors"
              )}
              onClick={() => !logoPreview && fileInputRef.current?.click()}
            >
              {logoPreview ? (
                <>
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="h-full w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow"
                    onClick={(e) => {
                      e.stopPropagation();
                      setLogoPreview(null);
                      setLogoFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </>
              ) : (
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
              )}
            </div>

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Upload logo
              </Button>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, WebP · Max 5MB · Square recommended
              </p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            className="hidden"
            onChange={handleLogoChange}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip this step
          </button>

          <Button
            type="submit"
            className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-6"
            disabled={isSubmitting || isUploadingLogo}
          >
            {isSubmitting || isUploadingLogo ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : null}
            Continue
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
