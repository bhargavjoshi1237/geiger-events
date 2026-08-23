"use client";

import React from "react";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";

// Organizer-typed fine print, shown wherever it's been placed. Persists as
// `event.disclaimer` — { enabled, text, placements } — where each placement is a
// key below. The event page's slots are wired through page_content.jsx, the
// checkout's through use_checkout.js; both call the same slot helper, so a
// layout or a step only ever names the slot it offers.
//
// "content" only exists on standard (non-builder) pages. Everything else works
// everywhere.

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

// Flat key → label, for anywhere that just needs to name a slot.
export const DISCLAIMER_POSITIONS = Object.fromEntries(
  DISCLAIMER_SLOT_GROUPS.flatMap((g) => Object.entries(g.slots)),
);

export const DEFAULT_DISCLAIMER_POSITION = "above-footer";

// Slots that only render on standard layouts, flagged in the editor so nobody
// picks one and wonders why nothing appeared.
export const LAYOUT_ONLY_SLOTS = new Set(["content"]);

/**
 * Where a disclaimer should appear.
 *
 * Placement used to be a single `position`. Reading both shapes here means saved
 * events keep working and upgrade the first time they're saved, with no
 * migration — the config lives in the event's metadata bag.
 */
export function disclaimerPlacements(cfg) {
  if (!cfg) return [];
  if (Array.isArray(cfg.placements)) return cfg.placements.filter(Boolean);
  return [cfg.position || DEFAULT_DISCLAIMER_POSITION];
}

/** The disclaimer to render, or null when there's nothing to show. */
export function activeDisclaimer(event) {
  const cfg = event?.disclaimer;
  if (!cfg?.enabled) return null;
  return String(cfg.text || "").trim() ? cfg : null;
}

/**
 * Build the slot renderer a surface hands to its layouts or steps.
 *
 * `slot("above-footer", "mt-6")` renders the disclaimer there if it's been
 * placed there, and nothing otherwise.
 */
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
      {/* Marks the block as fine print at a glance, before the text is read. */}
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
