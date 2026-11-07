"use client";

import React, { useState } from "react";
import { Ban, Loader2, ShieldCheck } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
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
import { cn } from "@/lib/utils";

// Shared bits for the Discussion Boards dashboard screen.

export const TOPIC_STATUS_MAP = {
  published: { label: "Published", variant: "success", dotClass: "bg-emerald-400" },
  pending: { label: "Awaiting approval", variant: "warning", dotClass: "bg-amber-400" },
  hidden: { label: "Hidden", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const REPORT_STATUS_MAP = {
  open: { label: "Open", variant: "warning", dotClass: "bg-amber-400" },
  actioned: { label: "Actioned", variant: "success", dotClass: "bg-emerald-400" },
  dismissed: { label: "Dismissed", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const BAN_DURATIONS = [
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "forever", label: "Until lifted" },
];

export function monogram(name = "") {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export function AuthorAvatar({ name, organiser = false, small = false }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        small ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-[11px]",
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

export function formatDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Ban a member from posting, reacting and reporting across this project's boards.
export function BanDialog({ target, onOpenChange, onConfirm }) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("30");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const expiresAt =
      duration === "forever" ? null : new Date(Date.now() + Number(duration) * 864e5).toISOString();
    const ok = await onConfirm({ reason: reason.trim(), expiresAt });
    setBusy(false);
    if (ok !== false) {
      setReason("");
      setDuration("30");
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={Boolean(target)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Ban {target?.name || "member"}</DialogTitle>
          <DialogDescription>
            They can still read boards, but can&apos;t post, react or report across this project until the ban ends.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Duration">
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BAN_DURATIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Reason" hint="Optional — for your team's records.">
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Repeated spam"
              className="bg-surface-card"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={busy} className="bg-red-500/90 text-white hover:bg-red-500">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            Ban member
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

// Pick a destination board for a topic.
export function MoveTopicDialog({ topic, boards, onOpenChange, onMove }) {
  const [boardId, setBoardId] = useState("");
  const options = (boards || []).filter((b) => b.id !== topic?.boardId && !b.archived);
  return (
    <Dialog open={Boolean(topic)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Move topic</DialogTitle>
          <DialogDescription>Move “{topic?.title}” and all its replies to another board.</DialogDescription>
        </DialogHeader>
        <Field label="Board">
          <Select value={boardId} onValueChange={setBoardId}>
            <SelectTrigger className="bg-surface-card">
              <SelectValue placeholder={options.length ? "Choose a board…" : "No other boards"} />
            </SelectTrigger>
            <SelectContent>
              {options.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!boardId}
            onClick={() => {
              onMove(topic, boardId);
              setBoardId("");
              onOpenChange(false);
            }}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Move topic
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
