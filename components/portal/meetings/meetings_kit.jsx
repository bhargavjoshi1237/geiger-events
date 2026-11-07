"use client";

import React, { useMemo, useState } from "react";
import { X } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@geiger/ui/avatar";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { cn } from "@/lib/utils";
import { portalFetch } from "@/lib/portal/portal_fetch";
import { groupSlotsByDate } from "@/lib/meetings/slots";
import { fmtDayLabel, fmtTime } from "@/lib/meetings/time";
import { MAX_TAGS } from "@/lib/meetings/settings";
import { initials } from "../portal_kit";

// basePath-aware JSON helpers that keep the server's error message.
export async function getJson(path) {
  try {
    const res = await portalFetch(path);
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Couldn't reach the server." } };
  }
}

export async function postJson(path, body) {
  try {
    const res = await portalFetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: "Couldn't reach the server." } };
  }
}

export const REQUEST_STATUS = {
  pending: { label: "Waiting", dotClass: "bg-amber-400" },
  accepted: { label: "Accepted", dotClass: "bg-emerald-400" },
  declined: { label: "Declined", dotClass: "bg-red-400" },
  cancelled: { label: "Withdrawn", dotClass: "bg-[#737373]" },
  expired: { label: "Expired", dotClass: "bg-[#737373]" },
};

export const MEETING_STATUS = {
  scheduled: { label: "Confirmed", dotClass: "bg-emerald-400" },
  completed: { label: "Completed", dotClass: "bg-sky-400" },
  no_show: { label: "Missed", dotClass: "bg-amber-400" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
};

export function PersonAvatar({ person, className }) {
  return (
    <Avatar className={cn("h-10 w-10 shrink-0", className)}>
      {person?.avatarUrl ? <AvatarImage src={person.avatarUrl} alt="" /> : null}
      <AvatarFallback className="bg-surface-strong text-xs font-semibold text-foreground">
        {initials(person?.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export const roleLine = (p) => [p?.title, p?.company].filter(Boolean).join(" at ");

export function TagList({ tags, max = 99, className }) {
  if (!tags?.length) return null;
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {tags.slice(0, max).map((t) => (
        <Badge key={t} variant="neutral">
          {t}
        </Badge>
      ))}
      {tags.length > max ? <span className="text-xs text-text-tertiary">+{tags.length - max}</span> : null}
    </div>
  );
}

// Free-text tags: Enter or comma adds one, the × removes it.
export function TagInput({ value = [], onChange, placeholder }) {
  const [text, setText] = useState("");
  const add = () => {
    const tag = text.trim().replace(/,$/, "").slice(0, 40);
    setText("");
    if (!tag || value.some((t) => t.toLowerCase() === tag.toLowerCase()) || value.length >= MAX_TAGS) return;
    onChange([...value, tag]);
  };
  return (
    <div className="space-y-2">
      {value.length ? (
        <div className="flex flex-wrap gap-1.5">
          {value.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-card py-0.5 pl-2.5 pr-1 text-xs text-foreground"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove ${t}`}
                onClick={() => onChange(value.filter((x) => x !== t))}
                className="rounded-full p-0.5 text-text-tertiary hover:bg-surface-hover hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <Input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
        placeholder={value.length >= MAX_TAGS ? `Up to ${MAX_TAGS}` : placeholder}
        disabled={value.length >= MAX_TAGS}
      />
    </div>
  );
}

// Slots grouped by day as toggle chips. `selected` is a Set of slot starts; `marked` tags suggested ones.
export function SlotChips({ slots, tz, selected, onToggle, marked, tone = "primary", emptyText }) {
  const groups = useMemo(() => groupSlotsByDate(slots), [slots]);
  if (!groups.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-tertiary">
        {emptyText || "No times available."}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.date} className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">{fmtDayLabel(g.date, { long: true })}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.slots.map((s) => {
              const on = selected?.has(s.start);
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onToggle(s)}
                  aria-pressed={on}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors",
                    on
                      ? tone === "danger"
                        ? "border-red-500/40 bg-red-500/10 text-red-700 line-through dark:text-red-400"
                        : "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-surface-card text-text-secondary hover:text-foreground",
                  )}
                >
                  {marked?.has(s.start) ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
                  {fmtTime(s.start, tz)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function CountPill({ children }) {
  if (!children) return null;
  return (
    <span className="ml-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
      {children}
    </span>
  );
}
