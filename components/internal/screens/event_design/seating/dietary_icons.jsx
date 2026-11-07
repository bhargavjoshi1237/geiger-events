"use client";

import React from "react";
import { Accessibility, Crown, EggOff, FishOff, Leaf, MilkOff, NutOff, Salad, Vegan, WheatOff } from "lucide-react";

import { DIETARY_TAGS } from "@/lib/event_design";
import { cn } from "@/lib/utils";

// Small icon row for a guest: VIP, dietary tags (from Dietary & Accessibility data or the chart note) and accessibility needs.

const ICONS = {
  vegan: Vegan,
  vegetarian: Leaf,
  gluten_free: WheatOff,
  nut_allergy: NutOff,
  dairy_free: MilkOff,
  seafood: FishOff,
  egg: EggOff,
  other: Salad,
};
const LETTERS = { halal: "H", kosher: "K" };
const tagLabel = (key) => DIETARY_TAGS.find((d) => d.key === key)?.label || "Dietary note";

export function GuestBadges({ guest, className, showVip = true }) {
  if (!guest) return null;
  const tags = guest.dietaryTags || [];
  if (!tags.length && !guest.accessibility && !(showVip && guest.vip)) return null;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1 text-text-tertiary", className)}>
      {showVip && guest.vip ? (
        <Crown className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" aria-label="VIP">
          <title>VIP</title>
        </Crown>
      ) : null}
      {tags.map((tag) => {
        const title = tag === "other" ? guest.dietary : tagLabel(tag);
        if (LETTERS[tag]) {
          return (
            <span
              key={tag}
              title={title}
              className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-sm border border-current text-[8px] font-bold leading-none"
            >
              {LETTERS[tag]}
            </span>
          );
        }
        const Icon = ICONS[tag] || Salad;
        return (
          <Icon key={tag} className="h-3.5 w-3.5" aria-label={title}>
            <title>{title}</title>
          </Icon>
        );
      })}
      {guest.accessibility ? (
        <Accessibility className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" aria-label={guest.accessibility}>
          <title>{guest.accessibility}</title>
        </Accessibility>
      ) : null}
    </span>
  );
}

export default GuestBadges;
