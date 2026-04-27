"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  Building2, Users, Shield, Settings, Key,
  Trash2, Plus, Crown, LogOut, Upload,
  AlertTriangle, Loader2, Clock, Mail, X, Eye, EyeOff, Copy, Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Plan } from "@/types";

type SettingsTab = "profile" | "workspace" | "members" | "api" | "danger";

const TAB_CONFIG = [
  { id: "profile"   as const, label: "Profile",     icon: Users },
  { id: "workspace" as const, label: "Workspace",   icon: Building2 },
  { id: "members"   as const, label: "Members",     icon: Users },
  { id: "api"       as const, label: "API Keys",    icon: Key },
  { id: "danger"    as const, label: "Danger Zone", icon: Shield },
];

const ROLE_COLORS: Record<string, string> = {
  owner:   "bg-muted/80 text-foreground",
  manager: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  editor:  "bg-green-500/15 text-green-600 dark:text-green-400",
  viewer:  "bg-muted/50 text-muted-foreground",
};

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  name: string;
  email: string;
  avatar: string;
  joined: string;
  deactivated: boolean;
}

interface PendingInvite {
  id: string;
  email: string;
  role: string;
  created_at: string;
  expires_at: string;
}

export default function SettingsPage() {
  const supabase = createClient();
  const router   = useRouter();
  const { workspace, workspaces, member: currentMember, isLoading: workspaceLoading, refreshWorkspace, switchWorkspace } = useWorkspace();

  const [tab, setTab]               = useState<SettingsTab>("profile");
  const [workspaceName, setWorkspaceName] = useState("");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [saving, setSaving]         = useState(false);
  const [members, setMembers]       = useState<MemberRow[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [inviteEmail, setInviteEmail]   = useState("");
  const inviteRole = "manager";
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);

  // Danger zone state
  const [deleteConfirm, setDeleteConfirm]       = useState("");
  const [isDeleting, setIsDeleting]             = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transferEmail, setTransferEmail]       = useState("");
  const [isTransferring, setIsTransferring]     = useState(false);
  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [isLeaving, setIsLeaving]               = useState(false);

  // ── Profile name state ───────────────────────────────────────
  const [fullName, setFullName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [savingName, setSavingName] = useState(false);

  // ── Logo state ─────────────────────────────────────────────
  const fileInputRef   = useRef<HTMLInputElement>(null);
  const [logoPreview, setLogoPreview]   = useState<string | null>(null);
  const [logoFile, setLogoFile]         = useState<File | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);

  // ── API Keys state ──────────────────────────────────────────
  const [outstandApiKey, setOutstandApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState(false);

  // ── Load workspace data ────────────────────────────────────
  useEffect(() => {
    if (!workspace) return;
    setWorkspaceName(workspace.name ?? "");
    setWorkspaceSlug(workspace.slug ?? "");
    if (workspace.logo_url) setLogoPreview(workspace.logo_url);
    if (workspace.outstand_api_key) setOutstandApiKey(workspace.outstand_api_key);
  }, [workspace]);

  // ── Load user profile data ──────────────────────────────────
  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/profile/update-name");
        if (!res.ok) return;
        const data = await res.json();
        setFullName(data.fullName ?? "");
        setUserEmail(data.email ?? "");
      } catch (err) {
        console.error("[Settings] Load profile error:", err);
      }
    }
    if (tab === "profile") {
      loadProfile();
    }
  }, [tab]);

  // ── Load members + pending invites via server API ──────────
  const fetchMembersAndInvites = useCallback(async () => {
    if (!workspace?.id) return;
    setLoadingMembers(true);

    try {
      const res = await fetch(`/api/workspaces/members?workspaceId=${workspace.id}`);
      if (!res.ok) {
        console.error("[Settings] fetchMembers failed:", res.status);
        setLoadingMembers(false);
        return;
      }

      const { members: rawMembers, invitations, currentUserId, currentUserEmail } = await res.json();

      const rows: MemberRow[] = (rawMembers ?? []).map((m: any) => {
        const profile = m.profiles as { full_name: string | null; avatar_url: string | null } | null;
        const name = profile?.full_name ?? m.user_id.slice(0, 8);
        return {
          id:      m.id,
          user_id: m.user_id,
          role:    m.role,
          name,
          email:   m.email ?? "",
          avatar:  name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase(),
          joined:  new Date(m.invited_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
          deactivated: !!m.deactivated_at,
        };
      });

      setMembers(rows);
      setPendingInvites(invitations ?? []);
    } catch (err) {
      console.error("[Settings] fetchMembers error:", err);
    } finally {
      setLoadingMembers(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (tab === "members") {
      fetchMembersAndInvites();
    }
  }, [tab, fetchMembersAndInvites]);

  // ── Logo select ────────────────────────────────────────────
  const handleLogoSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { toast.error("Only PNG, JPG, or WebP images are allowed"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Image must be under 5MB"); return; }
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(URL.createObjectURL(file));
    setLogoFile(file);
  }, [logoPreview]);

  function clearLogo() {
    if (logoPreview?.startsWith("blob:")) URL.revokeObjectURL(logoPreview);
    setLogoPreview(null);
    setLogoFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }


  // ── Save name ───────────────────────────────────────────────
  async function saveName() {
    if (!fullName.trim()) {
      toast.error("Name cannot be empty");
      return;
    }

    setSavingName(true);

    try {
      const res = await fetch("/api/profile/update-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: fullName.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to update name");
        return;
      }

      toast.success("Name updated successfully");
      setFullName(data.fullName);
      router.refresh();
    } catch (err) {
      toast.error("Failed to update name");
    } finally {
      setSavingName(false);
    }
  }

  // ── Save workspace ─────────────────────────────────────────
  async function saveWorkspace() {
    if (!workspace?.id) return;
    setSaving(true);
    try {
      let logoUrl = workspace.logo_url;

      if (logoFile) {
        setLogoUploading(true);
        const ext  = logoFile.name.split(".").pop() ?? "jpg";
        const path = `${workspace.id}/logo.${ext}`;

        const { error } = await supabase.storage
          .from("workspace-logos")
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });

        if (error) { toast.error(`Logo upload failed: ${error.message}`); setLogoUploading(false); setSaving(false); return; }

        const { data: urlData } = supabase.storage.from("workspace-logos").getPublicUrl(path);
        logoUrl = urlData.publicUrl;
        setLogoPreview(logoUrl);
        setLogoFile(null);
        setLogoUploading(false);
      }

      const body = {
        workspaceId: workspace.id,
        name: workspaceName,
        logoUrl,
        ...(outstandApiKey && { outstandApiKey }),
      };

      const updateRes = await fetch("/api/workspaces", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!updateRes.ok) {
        const errData = await updateRes.json();
        toast.error(errData.error ?? "Failed to update workspace");
        return;
      }

      if (outstandApiKey) {
        toast.success("API key saved successfully!");
      } else {
        toast.success("Workspace updated");
      }
      if (outstandApiKey) setOutstandApiKey("");
      await refreshWorkspace();
      router.refresh();
    } finally {
      setSaving(false);
      setLogoUploading(false);
    }
  }

  const [inviting, setInviting] = useState(false);

  async function handleInvite() {
    if (!inviteEmail.trim()) { toast.error("Enter an email address"); return; }
    if (!workspace?.id) return;
    setInviting(true);

    try {
      const res = await fetch("/api/invitations/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          role: inviteRole,
          workspace_id: workspace.id,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Invite failed");
        return;
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setInviteEmail("");

      // Add the new invite to the list immediately
      if (data.invitation) {
        setPendingInvites((prev) => [data.invitation, ...prev]);
      }
    } catch {
      toast.error("Failed to send invitation");
    } finally {
      setInviting(false);
    }
  }

  async function manageAction(body: Record<string, string>) {
    const res = await fetch("/api/workspaces/members/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, workspace_id: workspace?.id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Action failed");
    return data;
  }

  async function cancelInvite(id: string) {
    try {
      await manageAction({ action: "cancel_invite", invitation_id: id });
      setPendingInvites((prev) => prev.filter((i) => i.id !== id));
      toast.success("Invitation cancelled");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  async function toggleMemberActive(id: string, currentlyDeactivated: boolean) {
    const action = currentlyDeactivated ? "reactivate_member" : "deactivate_member";
    try {
      await manageAction({ action, member_id: id });
      setMembers((prev) => prev.map((m) => m.id === id ? { ...m, deactivated: !currentlyDeactivated } : m));
      toast.success(currentlyDeactivated ? "Member reactivated" : "Member deactivated");
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  const currentPlan = workspace?.plan ?? Plan.Free;
  const isOwner = currentMember?.role === "owner";
  const canManageMembers = currentMember?.role === "owner" || currentMember?.role === "manager";

  // ── Delete workspace ──────────────────────────────────────
  async function handleDeleteWorkspace() {
    if (!workspace?.id || !isOwner) return;
    if (deleteConfirm !== workspace.name) {
      toast.error("Workspace name doesn't match");
      return;
    }
    setIsDeleting(true);
    try {
      // Delete all related data in order
      // 1. Posts
      await supabase.from("posts").delete().eq("workspace_id", workspace.id);
      // 2. Social accounts
      await supabase.from("social_accounts").delete().eq("workspace_id", workspace.id);
      // 3. Invitations
      await supabase.from("invitations").delete().eq("workspace_id", workspace.id);
      // 4. Post usage
      await supabase.from("post_usage").delete().eq("workspace_id", workspace.id);
      // 5. Subscriptions
      await supabase.from("subscriptions").delete().eq("workspace_id", workspace.id);
      // 6. Workspace members
      await supabase.from("workspace_members").delete().eq("workspace_id", workspace.id);
      // 7. Workspace itself
      const { error } = await supabase.from("workspaces").delete().eq("id", workspace.id);

      if (error) {
        toast.error(`Delete failed: ${error.message}`);
        return;
      }

      toast.success("Workspace deleted");
      // Switch to another workspace or redirect to create new
      const remaining = workspaces.filter(w => w.id !== workspace.id);
      if (remaining.length > 0) {
        await switchWorkspace(remaining[0]!.id);
        router.push("/home");
      } else {
        router.push("/workspace/new");
      }
    } catch (err) {
      toast.error("Failed to delete workspace");
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  // ── Transfer ownership ────────────────────────────────────
  async function handleTransferOwnership() {
    if (!workspace?.id || !isOwner || !transferEmail.trim()) return;

    setIsTransferring(true);
    try {
      // Find the member by email from the loaded members list
      const targetMember = members.find(m => m.email.toLowerCase() === transferEmail.trim().toLowerCase());
      if (!targetMember) {
        toast.error("Member not found — they must be a member of this workspace");
        return;
      }
      if (targetMember.role === "owner") {
        toast.error("This person is already the owner");
        return;
      }

      // Use API endpoint to transfer ownership (bypasses RLS)
      const res = await fetch("/api/workspaces/transfer-ownership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: workspace.id,
          target_user_id: targetMember.user_id,
        }),
      });

      const apiData = await res.json();

      if (!res.ok) {
        throw new Error(apiData.error || "Transfer failed");
      }

      toast.success(`Ownership transferred to ${targetMember.name}`);
      setShowTransferDialog(false);
      setTransferEmail("");
      await refreshWorkspace();
      await fetchMembersAndInvites();
      router.refresh();
    } catch (err) {
      console.error("[Transfer] Error:", err);
      const errorMsg = err instanceof Error ? err.message : "Transfer failed";
      toast.error(errorMsg);
    } finally {
      setIsTransferring(false);
    }
  }

  // ── Leave workspace ───────────────────────────────────────
  async function validateOutstandKey() {
    if (!outstandApiKey.trim()) {
      toast.error("Please enter an API key first");
      return;
    }

    if (!workspace?.id) return;

    setValidatingKey(true);
    try {
      const res = await fetch(
        `/api/outstand/validate-key?workspaceId=${workspace.id}`
      );
      const data = await res.json();

      if (data.valid) {
        toast.success(data.message);
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("Failed to validate API key");
    } finally {
      setValidatingKey(false);
    }
  }

  async function handleLeaveWorkspace() {
    if (!workspace?.id || isOwner) return;

    setIsLeaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("workspace_members")
        .delete()
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id);

      if (error) {
        toast.error(`Failed to leave: ${error.message}`);
        return;
      }

      toast.success("You left the workspace");
      const remaining = workspaces.filter(w => w.id !== workspace.id);
      if (remaining.length > 0) {
        await switchWorkspace(remaining[0]!.id);
        router.push("/home");
      } else {
        router.push("/workspace/new");
      }
    } catch {
      toast.error("Failed to leave workspace");
    } finally {
      setIsLeaving(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 sm:space-y-6 page-enter">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2.5">
          <Settings className="h-6 w-6 text-primary hidden sm:block" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your workspace, team, and billing.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 sm:gap-6">
        {/* ── Tab nav ── */}
        <nav className="lg:col-span-1 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar pb-2 lg:pb-0 border-b lg:border-b-0 border-border/40">
          {TAB_CONFIG.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "relative flex items-center gap-2 lg:gap-2.5 rounded-lg px-3 py-2 lg:py-2.5 text-sm font-medium text-left transition-all whitespace-nowrap shrink-0 lg:w-full",
                tab === t.id
                  ? "bg-primary/10 text-foreground"
                  : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
              )}
            >
              {tab === t.id && (
                <span className="hidden lg:block absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-r-full bg-primary" />
              )}
              <t.icon className={cn("h-4 w-4 shrink-0", tab === t.id ? "text-primary" : "")} />
              {t.label}
              {t.id === "danger" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500" />}
            </button>
          ))}
        </nav>

        {/* ── Tab content ── */}
        <div className="lg:col-span-3 space-y-6">

          {/* PROFILE */}
          {tab === "profile" && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-6 space-y-5">
              <h2 className="text-base font-semibold text-foreground">Profile Information</h2>

              {/* Email */}
              <div>
                <Label htmlFor="email" className="text-sm font-medium mb-2 block">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  value={userEmail}
                  disabled
                  className="h-10 bg-muted/50"
                />
                <p className="text-xs text-muted-foreground mt-2">Your email cannot be changed. Contact support if you need to update it.</p>
              </div>

              {/* Full Name */}
              <div className="border-t border-border/40 pt-5">
                <Label htmlFor="fullname" className="text-sm font-medium mb-2 block">Full Name</Label>
                <div className="space-y-2">
                  <Input
                    id="fullname"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    disabled={savingName}
                    maxLength={100}
                    className="h-10"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{fullName.length}/100 characters</p>
                    <Button
                      onClick={saveName}
                      disabled={savingName || !fullName.trim()}
                      size="sm"
                      className="gap-2"
                    >
                      {savingName ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        "Save Changes"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* WORKSPACE */}
          {tab === "workspace" && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-6 space-y-5">
              <h2 className="text-base font-semibold text-foreground">Workspace Settings</h2>

              {/* Logo */}
              <div>
                <Label className="text-sm font-medium mb-2 block">Workspace Logo</Label>
                <div className="flex items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0">
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Workspace logo" className="h-16 w-16 rounded-xl object-cover border border-border/60" />
                        <button type="button" onClick={clearLogo} className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-white shadow-sm hover:bg-destructive/80 transition-colors">
                          <X className="h-3 w-3" />
                        </button>
                      </>
                    ) : (
                      <div
                        className="h-16 w-16 rounded-xl border-2 border-dashed border-border/60 bg-muted/20 flex items-center justify-center text-xl font-bold text-primary cursor-pointer hover:border-primary/40 transition-colors"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {workspaceName.slice(0, 2).toUpperCase() || "WS"}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={logoUploading}
                    >
                      {logoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                      {logoPreview ? "Change logo" : "Upload logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground">PNG, JPG, WebP · Max 5MB · Square recommended</p>
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoSelect} />
                </div>
              </div>

              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="wsname">Workspace name</Label>
                <Input
                  id="wsname"
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  className="bg-background/50"
                />
              </div>

              {/* Slug */}
              <div className="space-y-1.5">
                <Label htmlFor="wsslug">Workspace URL</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">onelinker.ai/</span>
                  <Input
                    id="wsslug"
                    value={workspaceSlug}
                    onChange={(e) => setWorkspaceSlug(e.target.value)}
                    className="bg-background/50 flex-1"
                  />
                </div>
              </div>

              {/* Outstand API Key */}
              <div className="border-t border-border/40 pt-5 space-y-3">
                <div>
                  <Label htmlFor="outstand-api-key" className="text-sm font-medium mb-2 block">Outstand API Key</Label>
                  <p className="text-xs text-muted-foreground mb-3">Enable social media posting via Outstand.so's hybrid API</p>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="outstand-api-key"
                    type={showApiKey ? "text" : "password"}
                    placeholder="post_xxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    value={outstandApiKey}
                    onChange={(e) => setOutstandApiKey(e.target.value)}
                    disabled={saving}
                    className="bg-background/50 flex-1 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={validateOutstandKey}
                    disabled={validatingKey || !outstandApiKey.trim()}
                    variant="outline"
                    size="sm"
                    className="gap-2"
                  >
                    {validatingKey ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Validating...
                      </>
                    ) : (
                      "Test Connection"
                    )}
                  </Button>
                </div>
              </div>

              <Button onClick={saveWorkspace} disabled={saving} className="gap-2 bg-primary text-white">
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {logoUploading ? "Uploading logo…" : saving ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          )}

          {/* MEMBERS */}
          {tab === "members" && workspaceLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {tab === "members" && !workspaceLoading && (
            <div className="space-y-4">
              {/* Invite — only owners & managers */}
              {canManageMembers && (
                <div className="rounded-xl border border-border/60 bg-card/60 p-5">
                  <h2 className="text-base font-semibold text-foreground mb-4">Invite Team Member</h2>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="colleague@company.com"
                      type="email"
                      className="flex-1 bg-background/50"
                      onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                    />
                    <Button onClick={handleInvite} disabled={inviting} className="gap-1.5 bg-primary text-white shrink-0">
                      {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      {inviting ? "Sending…" : "Invite"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Pending invitations */}
              {canManageMembers && pendingInvites.length > 0 && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5 divide-y divide-amber-200/40 dark:divide-amber-500/20 overflow-hidden">
                  <div className="px-5 py-3 flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <p className="text-sm font-semibold text-foreground">
                      {pendingInvites.length} pending invitation{pendingInvites.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                  {pendingInvites.map((inv) => {
                    const isExpired = new Date(inv.expires_at) < new Date();
                    return (
                      <div key={inv.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="h-9 w-9 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/10 flex items-center justify-center">
                          <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{inv.email}</p>
                          <p className="text-xs text-muted-foreground">
                            Invited {new Date(inv.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            {isExpired && <span className="text-red-500 ml-1">(expired)</span>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={cn("text-xs font-medium rounded-full px-2.5 py-0.5 capitalize", ROLE_COLORS[inv.role] ?? "")}>
                            {inv.role}
                          </span>
                          <button
                            onClick={() => cancelInvite(inv.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                            title="Cancel invitation"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Members list */}
              <div className="rounded-xl border border-border/60 bg-card/60 divide-y divide-border/40 overflow-hidden">
                <div className="px-5 py-3 flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">
                    {loadingMembers ? "Loading…" : `${members.length} member${members.length !== 1 ? "s" : ""}`}
                  </p>
                </div>
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : members.map((m) => {
                  const isSelf = m.user_id === currentMember?.user_id;
                  const canToggle = isOwner && !isSelf && m.role !== "owner";

                  return (
                    <div key={m.id} className={cn("flex items-center gap-3 px-5 py-3", m.deactivated && "opacity-50")}>
                      <div className={cn("h-9 w-9 shrink-0 rounded-full flex items-center justify-center text-xs font-bold text-foreground", m.deactivated ? "bg-red-100 dark:bg-red-500/10" : "bg-muted/60")}>
                        {m.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          {m.name}
                          {isSelf && <span className="text-xs text-muted-foreground ml-1.5">(you)</span>}
                          {m.deactivated && <span className="text-xs text-red-500 ml-1.5">Deactivated</span>}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.email ? `${m.email} · ` : ""}Joined {m.joined}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={cn("text-xs font-medium rounded-full px-2.5 py-0.5 capitalize flex items-center gap-1", ROLE_COLORS[m.role] ?? "")}>
                          {m.role === "owner" && <Crown className="h-3 w-3 inline" />}
                          {m.role}
                        </span>
                        {canToggle && (
                          <button
                            onClick={() => toggleMemberActive(m.id, m.deactivated)}
                            className={cn(
                              "text-xs font-medium rounded-lg px-3 py-1.5 transition-colors",
                              m.deactivated
                                ? "bg-green-500/10 text-green-600 hover:bg-green-500/20 dark:text-green-400"
                                : "bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:text-red-400"
                            )}
                          >
                            {m.deactivated ? "Activate" : "Deactivate"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Non-manager info box */}
              {!canManageMembers && (
                <div className="rounded-lg bg-muted/20 border border-border/40 p-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Only workspace owners and managers can invite or remove team members.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* API KEYS */}
          {tab === "api" && (
            <div className="rounded-xl border border-border/60 bg-card/60 p-6 space-y-5">
              <div>
                <h2 className="text-base font-semibold text-foreground">API Integrations</h2>
                <p className="text-sm text-muted-foreground mt-1">Configure external API keys for advanced posting features.</p>
              </div>

              {/* Outstand API Key */}
              <div className="border-t border-border/40 pt-5 space-y-3">
                <div>
                  <Label htmlFor="outstand-api-key" className="text-sm font-medium mb-2 block flex items-center gap-2">
                    <Key className="h-4 w-4" />
                    Outstand API Key
                  </Label>
                  <p className="text-xs text-muted-foreground mb-3">
                    Your Outstand.so API key enables direct posting to Facebook, Instagram, YouTube, and LinkedIn.
                    <a href="https://outstand.so" target="_blank" rel="noopener" className="text-primary hover:underline ml-1">Get your key →</a>
                  </p>
                  <div className="relative">
                    <Input
                      id="outstand-api-key"
                      type={showApiKey ? "text" : "password"}
                      placeholder="ost_..."
                      value={outstandApiKey}
                      onChange={(e) => {
                        setOutstandApiKey(e.target.value);
                        setCopiedApiKey(false);
                      }}
                      disabled={savingApiKey}
                      className="h-10 pr-20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowApiKey(!showApiKey)}
                      className="absolute right-10 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                      aria-label={showApiKey ? "Hide" : "Show"}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                    {outstandApiKey && (
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(outstandApiKey);
                          setCopiedApiKey(true);
                          setTimeout(() => setCopiedApiKey(false), 2000);
                        }}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                        aria-label="Copy"
                      >
                        {copiedApiKey ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">Keys starting with "ost_" are recognized. Never share your API key.</p>
                </div>

                {/* Status indicator */}
                {outstandApiKey && outstandApiKey.startsWith("ost_") && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                    <p className="text-sm text-green-700 dark:text-green-400">Valid API key format detected</p>
                  </div>
                )}

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={saveWorkspace}
                    disabled={savingApiKey || saving}
                    className="gap-2 bg-primary text-white"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      "Save API Key"
                    )}
                  </Button>
                  {outstandApiKey && (
                    <Button
                      onClick={() => {
                        setOutstandApiKey("");
                        setShowApiKey(false);
                        setCopiedApiKey(false);
                      }}
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </Button>
                  )}
                </div>
              </div>

              {/* Info section */}
              <div className="border-t border-border/40 pt-5 space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-foreground mb-2">How it works</h3>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">1.</span>
                      <span>Add your Outstand API key above</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">2.</span>
                      <span>Connect your social accounts (same as before)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-primary font-bold mt-0.5">3.</span>
                      <span>Posts will automatically use Outstand API with fallback to direct APIs</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* DANGER ZONE */}
          {tab === "danger" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border/60 bg-card/60 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">Workspace Management</h2>
                </div>

                {/* Workspace status */}
                <div className="rounded-lg bg-muted/20 border border-border/40 p-4 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {workspace?.logo_url ? (
                        <img src={workspace.logo_url} alt="" className="h-10 w-10 rounded-lg object-cover border border-border/40" />
                      ) : (
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                          {workspace?.name?.slice(0, 2).toUpperCase() ?? "WS"}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-semibold text-foreground">{workspace?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {isOwner ? "You are the owner" : `Your role: ${currentMember?.role ?? "member"}`}
                          {" · "}Plan: <span className="capitalize">{currentPlan}</span>
                          {" · "}{members.length} member{members.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="flex items-center gap-1.5 text-xs font-medium text-green-600 dark:text-green-500">
                      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Active
                    </span>
                  </div>
                </div>

                {/* Leave workspace — non-owners only */}
                {!isOwner && (
                  <>
                    <div className="flex items-start justify-between gap-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">Leave workspace</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Remove yourself from this workspace. You&apos;ll lose access to all its data.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-border/60 text-foreground hover:bg-muted/60"
                        disabled={isLeaving}
                        onClick={handleLeaveWorkspace}
                      >
                        {isLeaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <LogOut className="h-3.5 w-3.5 mr-1.5" />}
                        Leave
                      </Button>
                    </div>
                    <div className="border-t border-border/40" />
                  </>
                )}
              </div>

              {/* Owner-only actions */}
              {isOwner && (
                <div className="rounded-xl border border-red-500/20 dark:border-red-500/30 bg-red-50 dark:bg-red-500/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <h2 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h2>
                    <span className="text-[10px] font-medium text-red-500/60 dark:text-red-400/60 ml-auto uppercase tracking-wider">Owner only</span>
                  </div>

                  {/* Transfer ownership */}
                  <div className="space-y-3 pb-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Transfer ownership</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Transfer this workspace to another team member. You&apos;ll become a manager.
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0 border-border/60"
                        onClick={() => { setShowTransferDialog(p => !p); setShowDeleteDialog(false); }}
                      >
                        Transfer
                      </Button>
                    </div>

                    {showTransferDialog && (
                      <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/5 p-4 space-y-3">
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          This will make them the owner and demote you to manager.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-2">
                          <select
                            value={transferEmail}
                            onChange={(e) => setTransferEmail(e.target.value)}
                            className="flex-1 h-9 rounded-lg border border-border/60 bg-background/50 px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                          >
                            <option value="">Select a member…</option>
                            {members.filter(m => m.role !== "owner" && m.email).map(m => (
                              <option key={m.id} value={m.email}>{m.name} ({m.email})</option>
                            ))}
                          </select>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-border/60"
                              onClick={() => { setShowTransferDialog(false); setTransferEmail(""); }}
                            >
                              Cancel
                            </Button>
                            <Button
                              size="sm"
                              className="bg-amber-600 hover:bg-amber-700 text-white"
                              disabled={!transferEmail || isTransferring}
                              onClick={handleTransferOwnership}
                            >
                              {isTransferring ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                              Confirm Transfer
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-red-200 dark:border-red-500/20" />

                  {/* Delete workspace */}
                  <div className="space-y-3 pt-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">Delete workspace</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Permanently delete this workspace and all its data — posts, accounts, media, team members. This action cannot be undone.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        className="shrink-0 bg-red-600 hover:bg-red-700 text-white"
                        onClick={() => { setShowDeleteDialog(p => !p); setShowTransferDialog(false); }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Delete
                      </Button>
                    </div>

                    {showDeleteDialog && (
                      <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 p-4 space-y-3">
                        <p className="text-xs text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          This will permanently delete everything. Type the workspace name to confirm.
                        </p>
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground shrink-0">Type</span>
                            <code className="text-xs font-mono text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10 px-2 py-0.5 rounded">{workspace?.name}</code>
                            <span className="text-xs text-muted-foreground">to confirm</span>
                          </div>
                          <Input
                            value={deleteConfirm}
                            onChange={(e) => setDeleteConfirm(e.target.value)}
                            placeholder={workspace?.name ?? "workspace name"}
                            className="bg-background/50 border-red-200 dark:border-red-500/30 focus-visible:ring-red-500/30"
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-border/60"
                            onClick={() => { setShowDeleteDialog(false); setDeleteConfirm(""); }}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="bg-red-600 hover:bg-red-700 text-white"
                            disabled={deleteConfirm !== workspace?.name || isDeleting}
                            onClick={handleDeleteWorkspace}
                          >
                            {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                            {isDeleting ? "Deleting…" : "Permanently Delete Workspace"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Non-owner info */}
              {!isOwner && (
                <div className="rounded-lg bg-muted/20 border border-border/40 p-3 flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground shrink-0" />
                  <p className="text-xs text-muted-foreground">
                    Only the workspace owner can transfer ownership or delete the workspace. Contact the owner to request these changes.
                  </p>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
