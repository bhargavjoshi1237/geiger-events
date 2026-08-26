"use client";

import React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

export const DISCLAIMER_SLOT_GROUPS = [
  {
    group: "Event page",
    slots: {
      top: "Top of page",
      hero: "Below the hero",
      content: "End of page content",
      "above-footer": "Above the footer",
      "below-footer": "Below the footer",
    },
  },
  {
    group: "Checkout",
    slots: {
      "checkout-top": "Top of every step",
      "checkout-summary": "Above the order summary",
      "checkout-pay": "Under the pay button",
      "checkout-done": "On the confirmation",
    },
  },
];

export const DISCLAIMER_POSITIONS = Object.fromEntries(
  DISCLAIMER_SLOT_GROUPS.flatMap((g) => Object.entries(g.slots)),
);

export const DEFAULT_DISCLAIMER_POSITION = "above-footer";

export const LAYOUT_ONLY_SLOTS = new Set(["content"]);

export function disclaimerPlacements(cfg) {
  if (!cfg) return [];
  if (Array.isArray(cfg.placements)) return cfg.placements.filter(Boolean);
  return [cfg.position || DEFAULT_DISCLAIMER_POSITION];
}

export function activeDisclaimer(event) {
  const cfg = event?.disclaimer;
  if (!cfg?.enabled) return null;
  return String(cfg.text || "").trim() ? cfg : null;
}

export function makeDisclaimerSlot(event, { className: base } = {}) {
  const disclaimer = activeDisclaimer(event);
  const placements = disclaimerPlacements(disclaimer);

  function slot(position, className, style) {
    if (!disclaimer || !placements.includes(position)) return null;
    return (
      <div className={cn(base, className)} style={style}>
        <EventDisclaimer text={disclaimer.text} />
      </div>
    );
  }

  return slot;
}

export function EventDisclaimer({ text, className }) {
  const paragraphs = String(text || "")
    .split("\n")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!paragraphs.length) return null;
  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-xl border border-border bg-surface-subtle px-4 py-3",
        className,
      )}
    >
      <Info
        aria-hidden="true"
        className="mt-[3px] h-3.5 w-3.5 shrink-0 text-text-secondary"
      />
      <div className="space-y-1.5">
        {paragraphs.map((p, i) => (
          <p key={i} className="text-xs leading-relaxed text-text-secondary">
            {p}
          </p>
        ))}
      </div>
    </div>
  );
}
