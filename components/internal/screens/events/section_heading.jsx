"use client";

import React, { useRef, useState } from "react";
import { Pencil } from "lucide-react";

import { InlineTitleInput } from "@/components/internal/shared/screen_kit";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  SECTION_TITLE_DEFAULTS,
  SECTION_TITLE_MAX,
  withSectionTitle,
} from "@/lib/events/section_titles";
import { cn } from "@/lib/utils";

// Auto-sized heading input: Enter or blur hands back the draft, Escape hands back null.
export function HeadingInput({ initial, fallback, onDone, className }) {
  const [draft, setDraft] = useState(initial);
  const cancelled = useRef(false);

  return (
    <InlineTitleInput
      autoFocus
      value={draft}
      maxLength={SECTION_TITLE_MAX}
      placeholder={fallback}
      aria-label="Section heading"
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          e.preventDefault();
          cancelled.current = true;
          e.currentTarget.blur();
        }
      }}
      onBlur={() => onDone(cancelled.current ? null : draft)}
      className={className}
    />
  );
}

// Reads as plain text with a small pencil; click to rename in place.
export function HeadingRename({ value, fallback, onCommit, className }) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <HeadingInput
        initial={value}
        fallback={fallback}
        className={cn("font-medium text-foreground", className)}
        onDone={(next) => {
          setEditing(false);
          if (next !== null && next.trim() !== value) onCommit(next);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Rename"
      aria-label={`Rename heading: ${value}`}
      className={cn(
        "group inline-flex min-w-0 max-w-full items-center gap-1 rounded-sm font-medium text-text-secondary transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
        className,
      )}
    >
      <span className="truncate">{value}</span>
      <Pencil className="h-3 w-3 shrink-0 text-text-tertiary transition-colors group-hover:text-text-secondary" />
    </button>
  );
}

// Quiet line for an editor header's description: names the section's heading on the public page and lets it be renamed.
export function PageHeadingLine({ event, section, onPatch }) {
  const [titles, setTitles, saveTitles] = useEventConfig(
    event,
    "sectionTitles",
    {},
    onPatch,
  );
  const fallback = SECTION_TITLE_DEFAULTS[section];
  const custom = String(titles?.[section] || "").trim();

  const commit = async (value, successMsg) => {
    const prev = titles;
    const ok = await saveTitles(withSectionTitle(titles, section, value), {
      successMsg,
    });
    if (!ok) setTitles(prev);
  };

  return (
    <span className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-text-tertiary">
      Shown on your page as
      <HeadingRename
        value={custom || fallback}
        fallback={fallback}
        onCommit={(v) => commit(v, "Section heading saved.")}
      />
      {custom ? (
        <>
          <span aria-hidden>·</span>
          <button
            type="button"
            onClick={() => commit("", "Section heading reset.")}
            className="rounded-sm transition-colors hover:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          >
            Reset to “{fallback}”
          </button>
        </>
      ) : null}
    </span>
  );
}
