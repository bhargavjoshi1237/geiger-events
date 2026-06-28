"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { REGISTRATION_STATUS_MAP } from "./constants";

// The Registrations section's signature element. A registration's lifecycle —
// confirmed seats filling toward capacity, with pending / waitlisted alongside —
// rendered as one legible bar + chips, reused on event cards, the per-event
// detail header, and the capacity monitor so the whole area reads as one system.

// Tally a set of registrations once; every screen derives from this.
export function countRegs(regs) {
  const c = {
    total: regs.length,
    Confirmed: 0,
    Pending: 0,
    Waitlisted: 0,
    "Checked-in": 0,
    Declined: 0,
    Cancelled: 0,
    seats: 0, // party-size-weighted seats taken by confirmed + checked-in
  };
  for (const r of regs) {
    if (c[r.status] !== undefined) c[r.status] += 1;
    if (r.status === "Confirmed" || r.status === "Checked-in") {
      c.seats += Number(r.partySize) || 1;
    }
  }
  return c;
}

// The seat-fill bar: checked-in (sky) then confirmed (emerald) against capacity.
// Pending/waitlisted live in the chips, not the bar, so "filled" always means
// "seats actually committed".
export function PipelineBar({ counts, capacity, className, size = "md" }) {
  const cap = Number(capacity) || 0;
  const taken = counts.seats;
  const pctOf = (n) => (cap ? Math.min(100, (n / cap) * 100) : taken ? 100 : 0);
  const checkedPct = pctOf(counts["Checked-in"]);
  const confirmedPct = pctOf(counts.Confirmed);
  const over = cap > 0 && taken > cap;
  const height = size === "lg" ? "h-2.5" : size === "sm" ? "h-1.5" : "h-2";

  return (
    <div
      className={cn(
        "flex w-full overflow-hidden rounded-full bg-surface-hover",
        height,
        className,
      )}
      role="img"
      aria-label={`${taken} of ${cap || "∞"} seats filled`}
    >
      <div className="h-full bg-sky-400/90" style={{ width: `${checkedPct}%` }} />
      <div
        className={cn("h-full", over ? "bg-red-400" : "bg-emerald-400")}
        style={{ width: `${confirmedPct}%` }}
      />
    </div>
  );
}

// A small status count, shown only when it carries information.
export function CountChip({ status, value, className }) {
  const meta = REGISTRATION_STATUS_MAP[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", meta?.dotClass)} />
      <span className="tabular-nums text-foreground">{value}</span>
      {meta?.label || status}
    </span>
  );
}

// The full chip row used under the bar — confirmed always shows; the rest only
// when non-zero, so a quiet event stays quiet.
export function PipelineChips({ counts, className }) {
  const items = [
    ["Confirmed", counts.Confirmed, true],
    ["Pending", counts.Pending, false],
    ["Waitlisted", counts.Waitlisted, false],
    ["Checked-in", counts["Checked-in"], false],
  ].filter(([, value, always]) => always || value > 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {items.map(([status, value]) => (
        <CountChip key={status} status={status} value={value} />
      ))}
    </div>
  );
}
