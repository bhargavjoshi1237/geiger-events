"use client";

import React, { useMemo, useState } from "react";
import {
  Calendar,
  Check,
  DoorOpen,
  Loader2,
  Search,
  TicketPercent,
  Video,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ACCESS_MODES,
  DURATION_TYPES,
  DURATION_UNITS,
  EVENT_TYPE_CHOICES,
  MONTH_CHOICES,
  normalizeEntitlement,
} from "@/lib/memberships/entitlements";
import { formatDate } from "../events/sample_data";

// The editor for one attachable item type on a membership plan: how much of the
// catalogue members get (none / selected / full), which events that "selected"
// scope targets, any item-specific options, and how long members keep it.
// Everything is driven by the item descriptor in lib/memberships/entitlements.js
// — a new attachable type needs no new component.

const ICONS = { video: Video, doorOpen: DoorOpen, ticketPercent: TicketPercent };

// Underline-style tab strip, matching the editor's flat surfaces.
function Tabs({ options, value, onChange, ariaLabel }) {
  return (
    <div role="tablist" aria-label={ariaLabel} className="flex gap-6 border-b border-border">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 pb-2.5 text-sm transition-colors",
              active
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// Multi-select rendered as toggle chips — used for room kinds, perks, and every
// rich-match dimension.
function Chips({ choices, selected, onToggle, empty }) {
  if (!choices.length) {
    return <p className="text-xs text-text-secondary">{empty}</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {choices.map((c) => {
        const on = selected.includes(c.value);
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onToggle(c.value)}
            className={cn(
              "rounded-lg border px-2.5 py-1.5 text-xs transition-colors",
              on
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-surface-subtle/40 text-muted-foreground hover:bg-surface-hover hover:text-foreground",
            )}
          >
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

// Searchable checklist of the project's events — the core of the scope picker.
function EventPicker({ events, loading, selected, onToggle }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? events.filter((e) => (e.name || "").toLowerCase().includes(q)) : events;
  }, [events, query]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-3 text-xs text-text-secondary">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading Events…
      </div>
    );
  }

  if (!events.length) {
    return (
      <p className="py-3 text-xs text-text-secondary">
        No events in this project yet — create one to target it here.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search events…"
          className="h-9 pl-8"
        />
      </div>
      <div className="scrollbar-subtle max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
        {filtered.length ? (
          filtered.map((event) => {
            const on = selected.includes(event.id);
            return (
              <button
                key={event.id}
                type="button"
                onClick={() => onToggle(event.id)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-hover"
              >
                <span
                  className={cn(
                    "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong",
                  )}
                >
                  {on ? <Check className="h-3 w-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {event.name || "Untitled event"}
                </span>
                {event.date ? (
                  <span className="inline-flex shrink-0 items-center gap-1.5 text-xs text-text-tertiary">
                    <Calendar className="h-3 w-3" />
                    {formatDate(event.date)}
                  </span>
                ) : null}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-4 text-xs text-text-secondary">No events match that search.</p>
        )}
      </div>
    </div>
  );
}

// A labelled block inside the editor — the flat equivalent of a card.
function Block({ label, hint, children }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-text-secondary">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

// Rich targeting: pick events outright, and/or match whole groups of them.
// Rules are OR-ed — an event qualifies if it matches any dimension.
function RichTargeting({ entitlement, patch, events, loadingEvents, series }) {
  const match = entitlement.match;
  const setMatch = (key) => (value) =>
    patch({
      match: {
        ...match,
        [key]: match[key].includes(value)
          ? match[key].filter((v) => v !== value)
          : [...match[key], value],
      },
    });

  // Cities come from the project's own events — no point offering empty ones.
  const cityChoices = useMemo(() => {
    const set = new Set(events.map((e) => e.city).filter(Boolean));
    return [...set].sort().map((c) => ({ value: c, label: c }));
  }, [events]);

  const seriesChoices = useMemo(
    () => series.map((s) => ({ value: s.id, label: s.name || "Untitled series" })),
    [series],
  );

  return (
    <div className="space-y-5">
      <Block label="Specific events" hint="Target individual events by name.">
        <EventPicker
          events={events}
          loading={loadingEvents}
          selected={entitlement.eventIds}
          onToggle={(id) =>
            patch({
              eventIds: entitlement.eventIds.includes(id)
                ? entitlement.eventIds.filter((e) => e !== id)
                : [...entitlement.eventIds, id],
            })
          }
        />
      </Block>

      <Block
        label="Or match a group"
        hint="Any event matching one of these rules is covered, including events you create later."
      >
        <div className="space-y-4 rounded-lg border border-border p-3.5">
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Event type
            </p>
            <Chips
              choices={EVENT_TYPE_CHOICES}
              selected={match.types}
              onToggle={setMatch("types")}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Series
            </p>
            <Chips
              choices={seriesChoices}
              selected={match.seriesIds}
              onToggle={setMatch("seriesIds")}
              empty="No event series yet — create one under Event Series."
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              Month
            </p>
            <Chips
              choices={MONTH_CHOICES}
              selected={match.months}
              onToggle={setMatch("months")}
            />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-text-tertiary">
              City
            </p>
            <Chips
              choices={cityChoices}
              selected={match.cities}
              onToggle={setMatch("cities")}
              empty="None of your events have a city set yet."
            />
          </div>
        </div>
      </Block>
    </div>
  );
}

// One item-specific option, rendered from its descriptor.
function OptionControl({ option, value, onChange }) {
  if (option.type === "choice") {
    return (
      <Tabs
        options={option.choices}
        value={value}
        onChange={onChange}
        ariaLabel={option.label}
      />
    );
  }
  if (option.type === "multi") {
    return (
      <Chips
        choices={option.choices}
        selected={Array.isArray(value) ? value : []}
        onToggle={(v) =>
          onChange(
            (Array.isArray(value) ? value : []).includes(v)
              ? value.filter((x) => x !== v)
              : [...(value || []), v],
          )
        }
      />
    );
  }
  return (
    <div className="flex items-center gap-2">
      <Input
        type="number"
        min={option.min ?? 0}
        max={option.max}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="w-28 tabular-nums"
      />
      {option.unit ? (
        <span className="text-xs text-text-secondary">{option.unit}</span>
      ) : null}
    </div>
  );
}

export function EntitlementEditor({
  item,
  value,
  onChange,
  events = [],
  series = [],
  loadingEvents = false,
}) {
  const v = normalizeEntitlement(value, item);
  const Icon = ICONS[item.icon] || Video;

  const patch = (partial) => onChange({ ...v, ...partial });
  const setDuration = (partial) => patch({ duration: { ...v.duration, ...partial } });
  const setOption = (key) => (next) => patch({ options: { ...v.options, [key]: next } });

  const modeHint = ACCESS_MODES.find((m) => m.value === v.mode)?.hint;
  const durationHint = DURATION_TYPES.find((d) => d.value === v.duration.type)?.hint;
  const visibleOptions = (item.options || []).filter(
    (opt) => !opt.showIf || opt.showIf(v.options),
  );

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{item.label}</p>
          <p className="mt-0.5 text-xs text-text-secondary">{item.description}</p>
        </div>
      </div>

      <div className="space-y-3">
        <Tabs
          options={ACCESS_MODES}
          value={v.mode}
          onChange={(mode) => patch({ mode })}
          ariaLabel={`${item.label} access`}
        />
        {modeHint ? <p className="text-xs text-text-secondary">{modeHint}</p> : null}

        {v.mode === "selected" ? (
          item.targeting === "rich" ? (
            <RichTargeting
              entitlement={v}
              patch={patch}
              events={events}
              loadingEvents={loadingEvents}
              series={series}
            />
          ) : (
            <EventPicker
              events={events}
              loading={loadingEvents}
              selected={v.eventIds}
              onToggle={(id) =>
                patch({
                  eventIds: v.eventIds.includes(id)
                    ? v.eventIds.filter((e) => e !== id)
                    : [...v.eventIds, id],
                })
              }
            />
          )
        ) : null}
      </div>

      {/* Options and duration only matter once something is actually granted. */}
      {v.mode !== "none" ? (
        <>
          {visibleOptions.length ? (
            <div className="space-y-5 border-t border-border pt-5">
              {visibleOptions.map((opt) => (
                <Block key={opt.key} label={opt.label} hint={opt.hint}>
                  <OptionControl
                    option={opt}
                    value={v.options[opt.key]}
                    onChange={setOption(opt.key)}
                  />
                </Block>
              ))}
            </div>
          ) : null}

          <div className="space-y-3 border-t border-border pt-5">
            <Block
              label="Duration"
              hint="How long a member keeps access to what this plan unlocked."
            >
              <Tabs
                options={DURATION_TYPES}
                value={v.duration.type}
                onChange={(type) => setDuration({ type })}
                ariaLabel={`${item.label} duration`}
              />
            </Block>
            {durationHint ? (
              <p className="text-xs text-text-secondary">{durationHint}</p>
            ) : null}

            {v.duration.type === "timed" ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="w-24">
                  <p className="mb-1.5 text-xs text-text-secondary">Access for</p>
                  <Input
                    type="number"
                    min={1}
                    value={v.duration.amount}
                    onChange={(e) => setDuration({ amount: Number(e.target.value) || 1 })}
                    className="tabular-nums"
                  />
                </div>
                <div className="w-36">
                  <p className="mb-1.5 text-xs text-text-secondary">Unit</p>
                  <Select value={v.duration.unit} onValueChange={(unit) => setDuration({ unit })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DURATION_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <p className="pb-2.5 text-xs text-text-tertiary">after joining</p>
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

export default EntitlementEditor;
