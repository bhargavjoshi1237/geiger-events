"use client";

import React, { useMemo, useState } from "react";
import { Check, Search, Users } from "lucide-react";

import { IconInput } from "@/components/internal/shared/icon_input";
import { cn } from "@/lib/utils";
import { searchRoster } from "@/lib/smart_badges/roster";
import { badgeTitle } from "./constants";

// Searchable list over the event's pass roster (attendees, guests, speakers, sponsors, exhibitors, team).
// Shows who already holds a live badge so desk staff don't double-issue by accident.
export function AttendeePicker({
  roster,
  liveByHolder,
  selectedKey,
  onSelect,
  limit = 8,
  autoFocus = false,
  placeholder = "Search name, email, company or ticket code…",
  className,
}) {
  const [query, setQuery] = useState("");
  const results = useMemo(() => searchRoster(roster, query, limit), [roster, query, limit]);

  return (
    <div className={cn("space-y-2", className)}>
      <IconInput
        icon={Search}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="bg-surface-card"
      />
      {results.length ? (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface-card">
          {results.map((p) => {
            const live = liveByHolder?.get(p.key) || [];
            const selected = p.key === selectedKey;
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => onSelect(p)}
                className={cn(
                  "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover",
                  selected && "bg-surface-active",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {[p.role !== "Attendee" ? p.role : null, p.tier, p.email, p.code].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {live.length ? (
                  <span className="shrink-0 rounded-md border border-border bg-surface-subtle px-1.5 py-0.5 font-mono text-[11px] text-text-secondary">
                    {badgeTitle(live[0])}
                  </span>
                ) : null}
                {selected ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-subtle px-3 py-4 text-sm text-text-secondary">
          <Users className="h-4 w-4 shrink-0 text-text-tertiary" />
          {roster?.length ? "Nobody matches that search." : "No attendees on this event yet."}
        </div>
      )}
    </div>
  );
}

export default AttendeePicker;
