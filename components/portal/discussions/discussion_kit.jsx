"use client";

import React, { useState } from "react";
import { ArrowBigUp, Heart, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { portalFetch } from "@/lib/portal/portal_fetch";
import { LIMITS, REPORT_REASONS, normalizeTags, relTime } from "@/lib/boards/constants";

// Small building blocks shared by the members-portal Discussions views.

export const MARKDOWN_HINT = "Supports **bold**, *italic*, `code`, lists, > quotes and links.";

// JSON request through the basePath-aware portal fetch; never throws.
export async function boardRequest(path, { method = "GET", body } = {}) {
  try {
    const res = await portalFetch(path, {
      method,
      headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "You appear to be offline." } };
  }
}

export function monogram(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function Avatar({ name, organiser = false, size = "md" }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[11px]",
        organiser ? "bg-primary/15 text-primary" : "bg-surface-strong text-foreground",
      )}
    >
      {monogram(name)}
    </span>
  );
}

export function OrganiserBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
      <ShieldCheck className="h-2.5 w-2.5" /> Organiser
    </span>
  );
}

export function AuthorLine({ author, createdAt, editedAt, size = "md" }) {
  const organiser = author?.kind === "organiser";
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Avatar name={author?.name} organiser={organiser} size={size} />
      <span className="truncate text-xs font-medium text-foreground">
        {author?.isMe ? "You" : author?.name}
      </span>
      {organiser ? <OrganiserBadge /> : null}
      <span className="shrink-0 text-[11px] text-text-tertiary">
        {relTime(createdAt)}
        {editedAt ? " · edited" : ""}
      </span>
    </div>
  );
}

export function TagChip({ tag, active = false, onClick }) {
  const Comp = onClick ? "button" : "span";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-surface-card text-text-secondary",
        onClick && "transition-colors hover:border-border-strong hover:text-foreground",
      )}
    >
      #{tag}
    </Comp>
  );
}

export function StatusTag({ children, tone = "neutral", icon: Icon }) {
  const tones = {
    neutral: "border-border bg-surface-card text-text-secondary",
    success: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    info: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
        tones[tone] || tones.neutral,
      )}
    >
      {Icon ? <Icon className="h-2.5 w-2.5" /> : null}
      {children}
    </span>
  );
}

// Upvote (Q&A boards) or like (discussion boards) toggle with its count.
export function ReactionButton({ kind = "like", count = 0, active = false, disabled = false, onToggle }) {
  const Icon = kind === "upvote" ? ArrowBigUp : Heart;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onToggle}
      aria-pressed={active}
      aria-label={kind === "upvote" ? "Upvote" : "Like"}
      className={cn(
        "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors disabled:opacity-50",
        active
          ? "bg-primary/10 text-primary"
          : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
      )}
    >
      <Icon className={cn("h-3.5 w-3.5", active && kind === "like" && "fill-current")} />
      <span className="tabular-nums">{count}</span>
    </button>
  );
}

export function reactionCount(reactions, kind) {
  return Number(reactions?.[kind] || 0);
}

// Create or edit a topic: title, markdown body and up to five tags.
export function TopicDialog({ open, onOpenChange, initial, suggestedTags = [], busy, onSubmit, title, submitLabel }) {
  const [draft, setDraft] = useState(() => ({
    title: initial?.title || "",
    body: initial?.body || "",
    tags: (initial?.tags || []).join(", "),
  }));
  const tags = normalizeTags(draft.tags);
  const addTag = (t) => setDraft((d) => ({ ...d, tags: normalizeTags([...normalizeTags(d.tags), t]).join(", ") }));

  const submit = () => {
    if (draft.title.trim().length < 3) {
      toast.error("Give your topic a title.");
      return;
    }
    if (!draft.body.trim()) {
      toast.error("Write something to start the conversation.");
      return;
    }
    onSubmit({ title: draft.title.trim(), body: draft.body.trim(), tags });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Keep it specific so others can find and answer it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Title">
            <Input
              value={draft.title}
              maxLength={LIMITS.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="e.g. Best way to get to the venue from the airport?"
              className="bg-surface-card"
            />
          </Field>
          <Field label="Message" hint={MARKDOWN_HINT}>
            <Textarea
              rows={7}
              value={draft.body}
              maxLength={LIMITS.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              placeholder="Add the details…"
              className="resize-y bg-surface-card"
            />
          </Field>
          <Field label="Tags" hint="Optional — up to five, separated by commas.">
            <Input
              value={draft.tags}
              onChange={(e) => setDraft((d) => ({ ...d, tags: e.target.value }))}
              placeholder="e.g. travel, hotels"
              className="bg-surface-card"
            />
          </Field>
          {suggestedTags.filter((t) => !tags.includes(t)).length ? (
            <div className="flex flex-wrap gap-1.5">
              {suggestedTags
                .filter((t) => !tags.includes(t))
                .slice(0, 12)
                .map((t) => (
                  <TagChip key={t} tag={t} onClick={() => addTag(t)} />
                ))}
            </div>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReportDialog({ target, onOpenChange, onSubmit }) {
  const [reason, setReason] = useState("spam");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const ok = await onSubmit({ reason, details: details.trim() });
    setBusy(false);
    if (ok) {
      setReason("spam");
      setDetails("");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Report {target?.postId ? "reply" : "topic"}</DialogTitle>
          <DialogDescription>The organiser reviews every report. The author isn&apos;t told who reported it.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Reason">
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Details" hint="Optional.">
            <Textarea
              rows={3}
              value={details}
              maxLength={LIMITS.reportDetails}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Anything the organiser should know"
              className="resize-none bg-surface-card"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDialog({ open, onOpenChange, title, description, confirmLabel = "Delete", onConfirm }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-red-500/90 text-white hover:bg-red-500"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
