"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Ban,
  CalendarPlus,
  Copy,
  Eye,
  Infinity as InfinityIcon,
  Link2,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
} from "lucide-react";

import {
  ActionMenu,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  LogoLoading,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { getUser } from "@/lib/supabase/user";
import {
  createPlanShare,
  deletePlanShare,
  reissuePlanShare,
  updatePlanShare,
} from "@/lib/supabase/floor_plan_sharing";
import {
  SHARE_EXPIRY_OPTIONS,
  SHARE_PERMISSIONS,
  expiryFromOption,
  extendExpiry,
  formatAgo,
  formatExpiry,
  shareState,
} from "@/lib/event_design";
import { copyText, forgetToken, recallToken, rememberToken, shareLinkFor, useNow } from "./client_utils";

// Share links: the create form, the per-link actions (copy, new address, extend, revoke) and the editor's Share dialog.

export const SHARE_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  expired: { label: "Expired", variant: "warning", dotClass: "bg-amber-400" },
  revoked: { label: "Revoked", variant: "neutral", dotClass: "bg-zinc-400" },
};

export function PermissionBadge({ permission }) {
  return permission === "comment" ? (
    <Badge variant="info">
      <MessageSquare /> Can comment
    </Badge>
  ) : (
    <Badge variant="neutral">
      <Eye /> Can view
    </Badge>
  );
}

export function ShareStatus({ share, now }) {
  return <StatusPill status={shareState(share, now || undefined)} map={SHARE_STATUS_MAP} />;
}

export function ShareLinkForm({ onCreate, compact }) {
  const [label, setLabel] = useState("");
  const [permission, setPermission] = useState("view");
  const [expiry, setExpiry] = useState("30");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const ok = await onCreate({ label: label.trim(), permission, expiresAt: expiryFromOption(expiry) });
    setBusy(false);
    if (ok) setLabel("");
  };

  return (
    <div className={compact ? "grid gap-3" : "grid gap-3 sm:grid-cols-[minmax(0,1fr)_150px_150px]"}>
      <Field label="Who's it for?">
        <Input
          value={label}
          maxLength={80}
          placeholder="e.g. Caterer, venue, client"
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
        />
      </Field>
      <Field label="Access">
        <Select value={permission} onValueChange={setPermission}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHARE_PERMISSIONS.map((p) => (
              <SelectItem key={p.value} value={p.value}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Expires">
        <Select value={expiry} onValueChange={setExpiry}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SHARE_EXPIRY_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className={compact ? "flex justify-end" : "flex justify-end sm:col-span-3"}>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Create link
        </Button>
      </div>
    </div>
  );
}

// A freshly minted link — the one moment its address is shown.
export function FreshLink({ link }) {
  const url = link?.url;
  if (!url) return null;
  return (
    <div className="space-y-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-3">
      <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">{link.copied ? "Link ready — copied to your clipboard." : "Link ready — copy it now."}</p>
      <div className="flex items-center gap-2">
        <Input readOnly value={url} onFocus={(e) => e.target.select()} className="min-w-0 flex-1 font-mono text-xs" />
        <Button
          variant="outline"
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={async () => {
            if (await copyText(url)) toast.success("Link copied.");
            else toast.error("Couldn't copy — select the address and copy it.");
          }}
        >
          <Copy className="h-4 w-4" /> Copy
        </Button>
      </div>
    </div>
  );
}

// Link actions with their toasts; `onChanged(share)` / `onRemoved(id)` keep the caller's list in sync.
export function useShareActions({ onChanged, onRemoved }) {
  const [reissueTarget, setReissueTarget] = useState(null);
  const [busy, setBusy] = useState(false);

  const create = async (planId, input) => {
    const res = await createPlanShare({ planId, ...input });
    if (!res) {
      toast.error("Couldn't create the link.");
      return null;
    }
    rememberToken(res.share.id, res.token);
    const url = shareLinkFor(res.token);
    const copied = await copyText(url);
    onChanged?.(res.share);
    return { ...res, url, copied };
  };

  const copy = async (share) => {
    const token = recallToken(share.id);
    if (!token) {
      setReissueTarget(share);
      return;
    }
    if (await copyText(shareLinkFor(token))) toast.success("Link copied.");
    else toast.error("Couldn't copy the link.");
  };

  const reissue = async (share) => {
    setBusy(true);
    const res = await reissuePlanShare(share.id);
    setBusy(false);
    if (!res) {
      toast.error("Couldn't create a new address.");
      return false;
    }
    rememberToken(res.share.id, res.token);
    const copied = await copyText(shareLinkFor(res.token));
    onChanged?.(res.share);
    toast.success(copied ? "New link copied — the old address no longer works." : "New address created.");
    setReissueTarget(null);
    return true;
  };

  const patch = async (share, change, message) => {
    const saved = await updatePlanShare(share.id, change);
    if (!saved) {
      toast.error("Couldn't update the link.");
      return;
    }
    onChanged?.(saved);
    toast.success(message);
  };

  const revoke = async (share) => {
    const user = await getUser();
    await patch(share, { revokedAt: new Date().toISOString(), revokedBy: user?.id ?? null }, "Link revoked — it stops working right away.");
  };

  const remove = async (share) => {
    const ok = await deletePlanShare(share.id);
    if (!ok) {
      toast.error("Couldn't delete the link.");
      return;
    }
    forgetToken(share.id);
    onRemoved?.(share.id);
    toast.success("Link deleted.");
  };

  const menuItems = (share) => {
    const state = shareState(share);
    return [
      state !== "revoked" && { icon: Copy, label: "Copy link", onSelect: () => copy(share) },
      state !== "revoked" && { icon: RefreshCw, label: "New link address", onSelect: () => setReissueTarget(share) },
      { separator: true },
      { icon: CalendarPlus, label: "Extend 7 days", onSelect: () => patch(share, { expiresAt: extendExpiry(share.expiresAt, 7) }, "Expiry extended.") },
      { icon: CalendarPlus, label: "Extend 30 days", onSelect: () => patch(share, { expiresAt: extendExpiry(share.expiresAt, 30) }, "Expiry extended.") },
      share.expiresAt && { icon: InfinityIcon, label: "Never expire", onSelect: () => patch(share, { expiresAt: null }, "This link no longer expires.") },
      { separator: true },
      share.permission === "comment"
        ? { icon: Eye, label: "Make view-only", onSelect: () => patch(share, { permission: "view" }, "Now view-only.") }
        : { icon: MessageSquare, label: "Allow comments", onSelect: () => patch(share, { permission: "comment" }, "Guests can comment now.") },
      { separator: true },
      state === "revoked"
        ? { icon: RotateCcw, label: "Restore access", onSelect: () => patch(share, { revokedAt: null, revokedBy: null }, "Access restored.") }
        : { icon: Ban, label: "Revoke", destructive: true, onSelect: () => revoke(share) },
      { icon: Trash2, label: "Delete", destructive: true, onSelect: () => remove(share) },
    ];
  };

  const dialog = (
    <Dialog open={Boolean(reissueTarget)} onOpenChange={(o) => !o && setReissueTarget(null)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Get a new link address?</DialogTitle>
          <DialogDescription>
            For security a link&apos;s address is only shown when it&apos;s created, and this browser doesn&apos;t have a copy.
            A new address replaces it — the old one stops working, so send the new one to{" "}
            {reissueTarget?.label ? <span className="font-medium text-foreground">{reissueTarget.label}</span> : "whoever had it"}.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setReissueTarget(null)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy}
            onClick={() => reissue(reissueTarget)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            New address
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { create, copy, menuItems, dialog };
}

export function ShareRow({ share, now, actions, subtitle }) {
  const state = shareState(share, now || undefined);
  const meta = [
    `${share.viewCount} view${share.viewCount === 1 ? "" : "s"}`,
    share.lastViewedAt ? `last opened ${formatAgo(share.lastViewedAt, now || undefined)}` : "not opened yet",
    state === "revoked" ? "revoked" : share.expiresAt ? `${state === "expired" ? "expired" : "expires"} ${formatExpiry(share.expiresAt)}` : "never expires",
  ];
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">{share.label || "Untitled link"}</span>
          <PermissionBadge permission={share.permission} />
          <ShareStatus share={share} now={now} />
        </div>
        {subtitle ? <p className="mt-0.5 truncate text-xs text-text-secondary">{subtitle}</p> : null}
        <p className="mt-0.5 text-xs text-text-tertiary" suppressHydrationWarning>
          {meta.join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {state !== "revoked" ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => actions.copy(share)}
          >
            <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Copy</span>
          </Button>
        ) : null}
        <ActionMenu label={`Actions for ${share.label || "link"}`} items={actions.menuItems(share)} />
      </div>
    </div>
  );
}

// The editor's Share dialog: create a link for this plan, then manage its existing links.
export function ShareDialog({ open, onOpenChange, plan, dirty, shares, onSharesChange }) {
  const now = useNow();
  const [fresh, setFresh] = useState(null);
  const actions = useShareActions({
    onChanged: (share) =>
      onSharesChange((list) => {
        const rows = list || [];
        return rows.some((s) => s.id === share.id) ? rows.map((s) => (s.id === share.id ? share : s)) : [share, ...rows];
      }),
    onRemoved: (id) => onSharesChange((list) => (list || []).filter((s) => s.id !== id)),
  });

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => {
          if (!o) setFresh(null);
          onOpenChange(o);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Share &ldquo;{plan?.name || "Untitled plan"}&rdquo;</DialogTitle>
            <DialogDescription>
              Anyone with a link can open this plan in a browser — no account needed. Links show the last saved
              version, in 2D and 3D.
            </DialogDescription>
          </DialogHeader>

          {dirty ? (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              You have unsaved changes — save the plan so guests see them.
            </div>
          ) : null}

          <ShareLinkForm
            onCreate={async (input) => {
              const res = await actions.create(plan.id, input);
              if (res) setFresh({ url: res.url, copied: res.copied });
              return Boolean(res);
            }}
          />
          <FreshLink link={fresh} />

          <div className="border-t border-border pt-3">
            <p className="text-xs font-medium text-text-tertiary">
              Links{shares?.length ? ` (${shares.length})` : ""}
            </p>
            {shares === null ? (
              <div className="flex justify-center py-8">
                <LogoLoading size={36} aria-label="Loading links" />
              </div>
            ) : shares.length ? (
              <div className="divide-y divide-border">
                {shares.map((s) => (
                  <ShareRow key={s.id} share={s} now={now} actions={actions} />
                ))}
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-text-secondary">No links yet — create one above.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {actions.dialog}
    </>
  );
}
