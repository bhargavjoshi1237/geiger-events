"use client";

import { Info } from "lucide-react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const SECTION_NOTE_TARGETS = {
  about: "About this event",
  expect: "What to expect",
  schedule: "Schedule",
  location: "Location",
  whosgoing: "Who's going",
  guests: "Guests",
  faq: "FAQ",
  infographics: "Infographics",
  register: "Tickets card",
  goodtoknow: "Good To Know card",
  atregistration: "At Registration card",
  guidelines: "Dietary & Accessibility card",
};

export function getSectionNote(event, target) {
  const notes = Array.isArray(event?.sectionNotes) ? event.sectionNotes : [];
  const hit = notes.find(
    (n) =>
      n &&
      n.target === target &&
      n.enabled !== false &&
      String(n.text || "").trim(),
  );
  return hit ? String(hit.text).trim() : null;
}

export function SectionNoteBadge({ text, align = "end" }) {
  if (!text) return null;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="More information"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
        >
          <Info className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-3">
        <p className="whitespace-pre-line text-xs leading-relaxed text-text-secondary">
          {text}
        </p>
      </PopoverContent>
    </Popover>
  );
}
