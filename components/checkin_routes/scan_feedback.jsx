"use client";

import React from "react";
import { AlertTriangle, CheckCircle2, DoorOpen, ShieldAlert, Users, XCircle } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";

// Scan outcome states. Colour carries the result so staff don't have to read it.
export const FEEDBACK = {
  success: { icon: CheckCircle2, cls: "border-emerald-500/30 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200" },
  already: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-200" },
  capacity: { icon: Users, cls: "border-orange-500/40 bg-orange-500/15 text-orange-900 dark:text-orange-200" },
  exit: { icon: DoorOpen, cls: "border-sky-500/30 bg-sky-500/15 text-sky-800 dark:text-sky-200" },
  error: { icon: XCircle, cls: "border-red-500/30 bg-red-500/15 text-red-800 dark:text-red-200" },
};

const BUZZ = { success: 40, exit: 40, already: [80, 60, 80], capacity: [220, 80, 220], error: 220 };

// A short haptic per outcome where the device supports it.
export function buzz(kind) {
  try {
    navigator.vibrate?.(BUZZ[kind] || 0);
  } catch {
  }
}

export function ScanFeedback({ feedback, onOverride }) {
  if (!feedback) return null;
  const fb = FEEDBACK[feedback.kind] || FEEDBACK.error;
  return (
    <div role="status" aria-live="assertive" className={cn("flex items-start gap-3 rounded-xl border px-4 py-3.5", fb.cls)}>
      <fb.icon className="mt-0.5 h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold leading-snug">{feedback.title}</p>
        {feedback.detail ? <p className="mt-0.5 text-sm opacity-90">{feedback.detail}</p> : null}
      </div>
      {onOverride ? (
        <Button
          size="sm"
          variant="outline"
          onClick={onOverride}
          className="shrink-0 border-current/30 bg-transparent text-current hover:bg-black/5 dark:hover:bg-white/5"
        >
          <ShieldAlert className="h-4 w-4" /> Override
        </Button>
      ) : null}
    </div>
  );
}

// Live count for the capped area the scanner is working: "VIP 412 / 500".
export function OccupancyChip({ label, occupancy, cap, warnPct = 85 }) {
  if (cap === null || cap === undefined) return null;
  const pct = cap > 0 ? (occupancy / cap) * 100 : 100;
  const tone =
    pct >= 100
      ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
      : pct >= warnPct
        ? "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border bg-surface-card text-text-secondary";
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium tabular-nums", tone)}>
      <Users className="h-3.5 w-3.5" />
      {label || "Venue"} {Number(occupancy || 0).toLocaleString("en-US")} / {Number(cap).toLocaleString("en-US")}
    </span>
  );
}
