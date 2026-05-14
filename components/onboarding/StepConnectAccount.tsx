"use client";

import { useState, useEffect } from "react";
import {
  ArrowRight, ArrowLeft, Loader2, CheckCircle2,
  Link2, ExternalLink, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Platform } from "@/types";
import toast from "react-hot-toast";
import { getCallbackPath } from "@/lib/oauth/platform-routes";

// ════════════════════════════════════════════════════════════
// STEP 2 — CONNECT YOUR FIRST SOCIAL ACCOUNT
// Shows all supported platforms. Clicking one triggers
// Outstand OAuth via our /api/accounts/connect endpoint.
// Polls for connection success every 3 seconds.
// ════════════════════════════════════════════════════════════

interface PlatformOption {
  platform: Platform;
  name: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
  popular?: boolean;
}

const PLATFORMS: PlatformOption[] = [
  {
    platform: Platform.Instagram,
    name: "Instagram",
    icon: <InstagramIcon />,
    color: "#E1306C",
    bg: "bg-gradient-to-br from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]",
    popular: true,
  },
  {
    platform: Platform.Twitter,
    name: "X (Twitter)",
    icon: <XIcon />,
    color: "#000000",
    bg: "bg-[#000000]",
    popular: true,
  },
  {
    platform: Platform.LinkedIn,
    name: "LinkedIn",
    icon: <LinkedInIcon />,
    color: "#0A66C2",
    bg: "bg-[#0A66C2]",
    popular: true,
  },
  {
    platform: Platform.TikTok,
    name: "TikTok",
    icon: <TikTokIcon />,
    color: "#010101",
    bg: "bg-[#010101]",
    popular: true,
  },
  {
    platform: Platform.Facebook,
    name: "Facebook",
    icon: <FacebookIcon />,
    color: "#1877F2",
    bg: "bg-[#1877F2]",
  },
  {
    platform: Platform.YouTube,
    name: "YouTube",
    icon: <YouTubeIcon />,
    color: "#FF0000",
    bg: "bg-[#FF0000]",
  },
  {
    platform: Platform.Threads,
    name: "Threads",
    icon: <ThreadsIcon />,
    color: "#000000",
    bg: "bg-[#000000]",
  },
  {
    platform: Platform.Pinterest,
    name: "Pinterest",
    icon: <PinterestIcon />,
    color: "#E60023",
    bg: "bg-[#E60023]",
  },
  {
    platform: Platform.Bluesky,
    name: "Bluesky",
    icon: <BlueskyIcon />,
    color: "#0085FF",
    bg: "bg-[#0085FF]",
  },
  {
    platform: Platform.GoogleBusiness,
    name: "Google Business",
    icon: <GoogleIcon />,
    color: "#4285F4",
    bg: "bg-white",
  },
];

interface StepConnectAccountProps {
  workspaceId: string;
  onComplete: (accountIds: string[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepConnectAccount({
  workspaceId,
  onComplete,
  onSkip,
  onBack,
}: StepConnectAccountProps) {
  const [connecting, setConnecting] = useState<Platform | null>(null);
  const [connected, setConnected] = useState<Platform[]>([]);
  const [connectedIds, setConnectedIds] = useState<string[]>([]);
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null);

  // ── Poll for newly connected accounts ─────────────────

  function startPolling(platform: Platform) {
    // Clear any existing poll
    if (pollingInterval) clearInterval(pollingInterval);

    let pollCount = 0;
    const maxPolls = 40; // 2 minutes with 3s intervals

    const interval = setInterval(async () => {
      pollCount++;
      try {
        const res = await fetch(`/api/accounts?workspaceId=${workspaceId}`);
        if (!res.ok) {
          console.warn(`[Polling] Attempt ${pollCount}: API error ${res.status}`);
          return;
        }

        const { data } = await res.json() as { data: Array<{ platform: string; outstand_account_id: string; id: string; display_name?: string }> };

        // Debug: log all accounts and what we're looking for
        console.log(`[Polling] Attempt ${pollCount}/${maxPolls}: Looking for platform="${platform}" among ${data?.length ?? 0} accounts:`, data?.map(a => ({ platform: a.platform, display_name: a.display_name })));

        // Check both exact match and multiple accounts (in case more were added)
        const matches = data?.filter((a) => a.platform === platform) ?? [];
        console.log(`[Polling] Found ${matches.length} matches for platform="${platform}"`);

        if (matches.length > 0) {
          clearInterval(interval);
          setPollingInterval(null);
          setConnecting(null);

          // Add all matching accounts
          matches.forEach(match => {
            setConnected((prev) => [...new Set([...prev, platform])]);
            setConnectedIds((prev) => [...new Set([...prev, match.id])]);
          });

          console.log(`[Polling] ✓ Found ${matches.length} match(es):`, matches);
          toast.success(`${platform} account${matches.length > 1 ? 's' : ''} connected successfully!`);
        } else if (pollCount >= maxPolls) {
          // Only error after maxPolls attempts
          clearInterval(interval);
          setPollingInterval(null);
          setConnecting(null);
          toast.error("Connection timed out. The account may have been saved — refresh to check.");
          console.warn(`[Polling] Timeout after ${maxPolls} attempts`);
        }
      } catch (err) {
        console.error(`[Polling] Attempt ${pollCount} error:`, err);
      }
    }, 3000);

    setPollingInterval(interval);
  }

  useEffect(() => {
    return () => {
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [pollingInterval]);

  // ── Trigger OAuth via Outstand ────────────────────────

  async function connectPlatform(platform: Platform) {
    if (connecting) return;
    setConnecting(platform);

    try {
      const res = await fetch("/api/accounts/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform,
          workspaceId,
          redirect_uri: `${window.location.origin}/auth/${getCallbackPath(platform)}/callback`,
        }),
      });

      if (!res.ok) {
        const { message } = await res.json() as { message: string };
        toast.error(message ?? "Failed to start connection");
        setConnecting(null);
        return;
      }

      const { data } = await res.json() as { data: { oauth_url: string } };

      // Open OAuth in a popup
      const popup = window.open(
        data.oauth_url,
        `Connect ${platform}`,
        "width=600,height=700,scrollbars=yes"
      );

      if (!popup) {
        // Popup blocked — open in same tab
        window.location.href = data.oauth_url;
        return;
      }

      // Start polling for account connection
      startPolling(platform);
    } catch {
      toast.error("Failed to connect. Please try again.");
      setConnecting(null);
    }
  }

  return (
    <div className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-8">
      {/* Header */}
      <div className="mb-7">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 mb-4">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          Connect your accounts
        </h2>
        <p className="text-muted-foreground mt-1.5">
          Connect at least one social account to start scheduling.
          You can add more later.
        </p>
      </div>

      {/* Platform grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-6">
        {PLATFORMS.map((p) => {
          const isConnected = connected.includes(p.platform);
          const isConnecting = connecting === p.platform;

          return (
            <button
              key={p.platform}
              type="button"
              onClick={() => !isConnected && connectPlatform(p.platform)}
              disabled={!!connecting && !isConnecting}
              className={cn(
                "flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all",
                isConnected
                  ? "border-emerald-500/40 bg-emerald-500/8 cursor-default"
                  : isConnecting
                  ? "border-primary/50 bg-primary/8 cursor-wait"
                  : "border-border/60 hover:border-primary/40 hover:bg-accent/50 cursor-pointer",
                connecting && !isConnecting && "opacity-50"
              )}
            >
              {/* Platform icon */}
              <div
                className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white text-sm overflow-hidden",
                  p.bg
                )}
              >
                {p.icon}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-medium text-foreground truncate">
                    {p.name}
                  </span>
                  {p.popular && !isConnected && (
                    <span className="text-xs text-primary bg-primary/10 px-1 py-0.5 rounded font-medium shrink-0">
                      Popular
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {isConnected
                    ? "Connected ✓"
                    : isConnecting
                    ? "Connecting..."
                    : "Click to connect"}
                </span>
              </div>

              {/* Status icon */}
              <div className="shrink-0">
                {isConnected ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : isConnecting ? (
                  <Loader2 className="h-4 w-4 text-primary animate-spin" />
                ) : (
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Connected count */}
      {connected.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 mb-5">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400">
            <span className="font-semibold">{connected.length}</span>{" "}
            {connected.length === 1 ? "account" : "accounts"} connected
            {connected.length === 1 ? "" : " — great start!"}
          </p>
        </div>
      )}

      {/* Note about OAuth */}
      <p className="text-xs text-muted-foreground mb-6">
        All connections are secured via OAuth. We never store your passwords.
        You can disconnect any account at any time from Settings → Accounts.
      </p>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1.5 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>

          <button
            type="button"
            onClick={onSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip for now
          </button>
        </div>

        <Button
          type="button"
          className="gap-2 bg-primary hover:bg-primary/90 text-white font-semibold px-6"
          onClick={() => onComplete(connectedIds)}
          disabled={!!connecting}
        >
          {connected.length > 0 ? "Continue" : "Skip & Continue"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ── Platform SVG Icons ────────────────────────────────────────

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="white">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.16 8.16 0 0 0 4.77 1.52V6.75a4.85 4.85 0 0 1-1-.06z" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function YouTubeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function ThreadsIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 1.984-.013 3.608-.426 4.97-1.252 1.491-.921 2.501-2.243 3.006-3.966a8.56 8.56 0 0 0 .19-1.255c.015-.22.023-.441.024-.664v-.003c0-.147-.007-.29-.023-.43a.37.37 0 0 0-.003-.04c-.029-.205-.077-.398-.147-.576l-.003-.009c-.119-.3-.294-.56-.52-.77-.243-.225-.534-.387-.864-.48-.25-.073-.514-.11-.786-.11-.476 0-.936.116-1.33.332-.347.19-.645.462-.872.8-.196.293-.337.623-.414.97a4.45 4.45 0 0 0-.09.91c0 .254.02.503.06.747.08.488.254.937.512 1.332.293.443.686.808 1.153 1.066.433.24.912.367 1.405.377.43-.004.85-.088 1.246-.248l.57 1.956a5.85 5.85 0 0 1-1.97.344c-.834-.018-1.646-.24-2.374-.654-.786-.445-1.448-1.077-1.924-1.84a6.487 6.487 0 0 1-.881-2.247 7.374 7.374 0 0 1-.1-1.217c0-.406.033-.81.1-1.208a6.348 6.348 0 0 1 .703-1.987c.405-.704.967-1.315 1.646-1.773.706-.474 1.531-.726 2.366-.726.45 0 .895.066 1.325.197.62.185 1.19.517 1.666.979.44.427.782.952 1.002 1.532.168.441.27.901.3 1.368.017.194.025.39.025.585v.002c0 .29-.01.577-.03.862a10.64 10.64 0 0 1-.245 1.64c-.63 2.244-1.906 3.932-3.797 5.014-1.663.967-3.698 1.479-6.083 1.494z" />
    </svg>
  );
}

function PinterestIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

function BlueskyIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="white">
      <path d="M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.505 6.5.gasket649 3.75 3.396 5.5 2.147 6.4.6 4.89-1.2.87-2.5 4.8-3.6 0 0 1.65.5 3.5.4 4.45-.25 6.83-2.11 7.5-4.3.67 2.19 3.05 4.05 7.5 4.3 1.85.1 3.5-.4 3.5-.4-1.1 3.6-2.4 4.8-3.6 4.8s-.87-.87-1.2-6.4c-.75-.9-1.5-2.65 2.147-6.4C23.622 9.418 24 4.458 24 3.768c0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.747 13.087 8.686 12 10.8z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}
