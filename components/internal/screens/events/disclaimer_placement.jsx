"use client";

import React from "react";
import { CreditCard, MonitorSmartphone } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { DISCLAIMER_POSITIONS } from "./public_page/disclaimer";

// Placement is a plain checklist — one readable row per slot. Each row carries a
// short hint (what "under the pay button" actually means) and a position glyph:
// a page-shaped outline with the line drawn at the height the disclaimer lands.
// The glyph is the spatial cue; the label is what you read.

const SLOTS = {
  top: { at: 8, hint: "Before everything, above the hero" },
  hero: { at: 32, hint: "Straight after the hero" },
  content: { at: 58, hint: "After the page body — standard layouts only" },
  "above-footer": { at: 76, hint: "Just before the footer" },
  "below-footer": { at: 90, hint: "The last thing on the page" },
  "checkout-top": { at: 8, hint: "On every step of checkout" },
  "checkout-summary": { at: 48, hint: "Just above the order total" },
  "checkout-pay": { at: 76, hint: "Under the pay button" },
  "checkout-done": { at: 90, hint: "On the confirmation screen" },
};

const PAGE_SLOTS = ["top", "hero", "content", "above-footer", "below-footer"];
const CHECKOUT_SLOTS = [
  "checkout-top",
  "checkout-summary",
  "checkout-pay",
  "checkout-done",
];

function PositionGlyph({ at, on }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative h-8 w-6 shrink-0 rounded-[3px] border transition-colors",
        on ? "border-primary/40 bg-primary/5" : "border-foreground/20 bg-foreground/[0.04]",
      )}
    >
      <span
        style={{ top: `${at}%` }}
        className={cn(
          "absolute inset-x-1 h-[3px] -translate-y-1/2 rounded-full transition-colors",
          on ? "bg-primary" : "bg-foreground/30",
        )}
      />
    </span>
  );
}

function SlotRow({ slot, on, onToggle }) {
  const { at, hint } = SLOTS[slot] || {};
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors",
        on
          ? "border-primary bg-primary/10"
          : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-active",
      )}
    >
      <Checkbox checked={on} onCheckedChange={() => onToggle(slot)} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block text-sm leading-tight",
            on ? "font-medium text-foreground" : "text-muted-foreground",
          )}
        >
          {DISCLAIMER_POSITIONS[slot] || slot}
        </span>
        <span className="mt-0.5 block text-xs leading-tight text-text-tertiary">
          {hint}
        </span>
      </span>
      <PositionGlyph at={at} on={on} />
    </label>
  );
}

function Surface({ icon: Icon, title, slots, placements, onToggle }) {
  const count = slots.filter((s) => placements.includes(s)).length;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-text-tertiary" />
        <span className="text-sm font-medium text-foreground">{title}</span>
        {count ? (
          <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
            {count} placed
          </span>
        ) : null}
      </div>
      <div className="space-y-1.5">
        {slots.map((slot) => (
          <SlotRow
            key={slot}
            slot={slot}
            on={placements.includes(slot)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  );
}

export function DisclaimerPlacementPicker({ placements = [], onToggle }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <Surface
        icon={MonitorSmartphone}
        title="Event page"
        slots={PAGE_SLOTS}
        placements={placements}
        onToggle={onToggle}
      />
      <Surface
        icon={CreditCard}
        title="Checkout"
        slots={CHECKOUT_SLOTS}
        placements={placements}
        onToggle={onToggle}
      />
    </div>
  );
}

export default DisclaimerPlacementPicker;
