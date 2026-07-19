"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  Loader2,
  Ticket,
  Tag,
  CircleDot,
  Layers,
  Package,
  ShoppingBag,
  ChevronDown,
  Check,
  X,
  Users,
  SlidersHorizontal,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { listOrders } from "@/lib/supabase/orders";
import { listGuests } from "@/lib/supabase/contacts";
import { listSegments } from "@/lib/supabase/segments";
import { CONTACT_STATUS_VALUES } from "@/components/internal/screens/guests/constants";
import {
  buildContext,
  matchesFilters,
  normalizeSpec,
  resolvePeople,
} from "@/lib/audience/resolve";

// Reusable audience builder — resolves guests/buyers from combinable facets
// (ticket / offering-option / add-on when an eventId is given, plus tag / status
// / segment / individual project-wide). Two modes:
//
//   • Spec mode  (spec + onSpecChange): stores a live rule — an All/Filtered
//     toggle, facet criteria, and per-person include/exclude — so future buyers
//     who match are picked up on the next resolve. This is what Community records
//     and chat channels persist.
//   • Set mode   (selected + onSelectedChange): a plain multi-select that
//     resolves to a fixed Set<email> right now (e.g. "add these people"). Facets
//     just narrow the visible list here.

// A multi-select facet dropdown (label + count) over `[{ value, label }]` options.
function FacetFilter({ label, icon: Icon, options, selected, onToggle }) {
  const count = selected.size;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!options.length}
          className={cn(
            "h-8 gap-1.5 border-border bg-surface-subtle text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground",
            count && "border-primary/40 text-foreground",
          )}
        >
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
          {label}
          {count ? (
            <span className="rounded-full bg-primary/15 px-1.5 text-[10px] font-medium text-primary">
              {count}
            </span>
          ) : null}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-60 overflow-y-auto">
        <DropdownMenuLabel>{label}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {options.map((opt) => (
          <DropdownMenuCheckboxItem
            key={opt.value}
            checked={selected.has(opt.value)}
            onCheckedChange={() => onToggle(opt.value)}
            onSelect={(e) => e.preventDefault()}
          >
            {opt.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SegmentFilter({ segments, value, onChange }) {
  const active = segments.find((s) => s.id === value);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={!segments.length}
          className={cn(
            "h-8 gap-1.5 border-border bg-surface-subtle text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground",
            active && "border-primary/40 text-foreground",
          )}
        >
          <Layers className="h-3.5 w-3.5" />
          {active ? active.name : "Segment"}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-64 w-56 overflow-y-auto">
        <DropdownMenuLabel>Segment</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={value || "none"}
          onValueChange={(v) => onChange(v === "none" ? "" : v)}
        >
          <DropdownMenuRadioItem value="none">No segment</DropdownMenuRadioItem>
          {segments.map((s) => (
            <DropdownMenuRadioItem key={s.id} value={s.id}>
              {s.name}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// One selectable person row (shared by both modes).
function PersonRow({ person, on, onClick }) {
  const meta = [
    [...person.tickets][0],
    person.status,
    (person.tags || []).length
      ? `${person.tags.length} tag${person.tags.length > 1 ? "s" : ""}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
        on ? "bg-surface-active" : "hover:bg-surface-hover",
      )}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          on ? "border-primary bg-primary text-primary-foreground" : "border-border",
        )}
      >
        {on ? <Check className="h-3 w-3" /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm text-foreground">{person.name || person.email}</span>
        <span className="block truncate text-[11px] text-text-tertiary">
          {person.name ? person.email : ""}
          {person.name && meta ? " · " : ""}
          {meta}
        </span>
      </span>
    </button>
  );
}

const EMPTY_LOCAL_FILTERS = {
  tickets: new Set(),
  offerings: new Set(),
  purchasables: new Set(),
  tags: new Set(),
  statuses: new Set(),
  segmentId: "",
};

export function AudienceBuilder({
  projectId,
  eventId = "",
  spec,
  onSpecChange,
  selected,
  onSelectedChange,
}) {
  const specMode = typeof onSpecChange === "function";
  const activeSpec = useMemo(
    () => (specMode ? normalizeSpec(spec, { fallbackEventId: eventId }) : null),
    [specMode, spec, eventId],
  );

  const [data, setData] = useState(null); // { pool, segments, ctx, offeringLabels, purchasableLabels }
  const [localFilters, setLocalFilters] = useState(EMPTY_LOCAL_FILTERS); // Set-mode only
  const [q, setQ] = useState("");

  // Load the pool + CRM enrichment. Keyed by (projectId, eventId) — the parent
  // remounts on scope change, so this runs once per scope with no reset churn.
  useEffect(() => {
    if (!projectId) return;
    let alive = true;
    Promise.all([
      listGuests(projectId),
      listSegments(projectId),
      eventId ? listOrders(eventId) : Promise.resolve([]),
    ]).then(([guests, segments, orders]) => {
      if (!alive) return;
      const built = buildContext({ guests: guests || [], orders: orders || [], eventId });
      setData({ ...built, segments: segments || [] });
    });
    return () => {
      alive = false;
    };
  }, [projectId, eventId]);

  // Facet option lists derived from the loaded pool.
  const facets = useMemo(() => {
    const pool = data?.pool || [];
    const tickets = new Set();
    const offerings = new Set();
    const purchasables = new Set();
    const tags = new Set();
    const statuses = new Set();
    for (const p of pool) {
      p.tickets.forEach((t) => tickets.add(t));
      p.offeringKeys.forEach((k) => offerings.add(k));
      p.purchasableKeys.forEach((k) => purchasables.add(k));
      (p.tags || []).forEach((t) => tags.add(t));
      if (p.status) statuses.add(p.status);
    }
    const asOpts = (set) => [...set].sort().map((v) => ({ value: v, label: v }));
    const labelled = (set, labels) =>
      [...set]
        .map((v) => ({ value: v, label: labels.get(v) || v }))
        .sort((a, b) => a.label.localeCompare(b.label));
    return {
      tickets: asOpts(tickets),
      offerings: labelled(offerings, data?.offeringLabels || new Map()),
      purchasables: labelled(purchasables, data?.purchasableLabels || new Map()),
      tags: asOpts(tags),
      statuses: CONTACT_STATUS_VALUES.filter((s) => statuses.has(s)).map((v) => ({ value: v, label: v })),
    };
  }, [data]);

  // Emails the spec currently resolves to (spec mode) — drives the count + which
  // rows read as "in".
  const resolvedEmails = useMemo(() => {
    if (!specMode || !data) return new Set();
    return new Set(
      resolvePeople(activeSpec, data.pool, { segments: data.segments, ctx: data.ctx }).map(
        (p) => p.email,
      ),
    );
  }, [specMode, activeSpec, data]);

  // The visible people list (search + set-mode local filters applied).
  const shown = useMemo(() => {
    const pool = data?.pool || [];
    const term = q.trim().toLowerCase();
    const bySearch = (p) =>
      !term || p.email.includes(term) || (p.name || "").toLowerCase().includes(term);
    if (specMode) return pool.filter(bySearch);
    // Set mode: facets narrow the list; individual selection is the output.
    const f = {
      tickets: [...localFilters.tickets],
      offerings: [...localFilters.offerings],
      purchasables: [...localFilters.purchasables],
      tags: [...localFilters.tags],
      statuses: [...localFilters.statuses],
      segmentId: localFilters.segmentId,
    };
    return pool.filter(
      (p) => bySearch(p) && matchesFilters(p, f, { segments: data?.segments || [], ctx: data?.ctx || {} }),
    );
  }, [data, q, specMode, localFilters]);

  const loading = !data;

  // ---- Spec-mode helpers ---------------------------------------------------
  const specFilterSet = (group) => new Set(activeSpec?.filters?.[group] || []);
  const toggleSpecFacet = (group, value) => {
    const cur = specFilterSet(group);
    cur.has(value) ? cur.delete(value) : cur.add(value);
    onSpecChange({
      ...activeSpec,
      mode: "filtered",
      filters: { ...activeSpec.filters, [group]: [...cur] },
    });
  };
  const setSpecSegment = (id) =>
    onSpecChange({
      ...activeSpec,
      mode: "filtered",
      filters: { ...activeSpec.filters, segmentId: id },
    });
  const setMode = (mode) => onSpecChange({ ...activeSpec, mode });
  const clearSpecFilters = () =>
    onSpecChange({
      ...activeSpec,
      filters: { tickets: [], offerings: [], purchasables: [], tags: [], statuses: [], segmentId: "" },
    });
  const togglePerson = (person) => {
    const email = person.email;
    const include = new Set(activeSpec.include);
    const exclude = new Set(activeSpec.exclude);
    if (resolvedEmails.has(email)) {
      if (include.has(email)) include.delete(email);
      else exclude.add(email);
    } else {
      if (exclude.has(email)) exclude.delete(email);
      else include.add(email);
    }
    onSpecChange({ ...activeSpec, include: [...include], exclude: [...exclude] });
  };
  const specFiltersActive =
    activeSpec &&
    (activeSpec.filters.tickets.length ||
      activeSpec.filters.offerings.length ||
      activeSpec.filters.purchasables.length ||
      activeSpec.filters.tags.length ||
      activeSpec.filters.statuses.length ||
      activeSpec.filters.segmentId);

  // ---- Set-mode helpers ----------------------------------------------------
  const toggleLocalFacet = (group, value) =>
    setLocalFilters((f) => {
      const next = new Set(f[group]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...f, [group]: next };
    });
  const localFiltersActive =
    localFilters.tickets.size ||
    localFilters.offerings.size ||
    localFilters.purchasables.size ||
    localFilters.tags.size ||
    localFilters.statuses.size ||
    localFilters.segmentId;
  const clearLocalFilters = () => setLocalFilters(EMPTY_LOCAL_FILTERS);
  const toggleOne = (email) => {
    const next = new Set(selected);
    next.has(email) ? next.delete(email) : next.add(email);
    onSelectedChange(next);
  };
  const selectAllShown = () => {
    const next = new Set(selected);
    shown.forEach((p) => next.add(p.email));
    onSelectedChange(next);
  };
  const clearSelected = () => onSelectedChange(new Set());

  // Which facet dropdowns to render: bound to the spec (spec mode) or local
  // state (set mode). Only shown in filtered spec mode / always in set mode.
  const showFacets = specMode ? activeSpec.mode === "filtered" : true;
  const facetSel = (group) => (specMode ? specFilterSet(group) : localFilters[group]);
  const onFacet = (group) => (v) =>
    specMode ? toggleSpecFacet(group, v) : toggleLocalFacet(group, v);
  const segmentValue = specMode ? activeSpec.filters.segmentId : localFilters.segmentId;
  const onSegment = specMode ? setSpecSegment : (id) => setLocalFilters((f) => ({ ...f, segmentId: id }));
  const filtersActive = specMode ? specFiltersActive : localFiltersActive;
  const clearFilters = specMode ? clearSpecFilters : clearLocalFilters;

  const countBadge = (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-surface-subtle px-2.5 py-1 text-xs text-text-secondary">
      <Users className="h-3.5 w-3.5" />
      {loading ? (
        "…"
      ) : (
        <>
          <span className="font-medium text-foreground">{resolvedEmails.size}</span>
          {resolvedEmails.size === 1 ? "person" : "people"}
        </>
      )}
    </span>
  );

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface-card">
      {/* Header — mode segmented control + live count (spec mode) */}
      {specMode ? (
        <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2.5">
          <div className="inline-flex rounded-lg bg-surface-subtle p-0.5">
            {[
              { value: "all", label: eventId ? "All attendees" : "All guests", icon: Users },
              { value: "filtered", label: "Filtered", icon: SlidersHorizontal },
            ].map((opt) => {
              const Icon = opt.icon;
              const on = activeSpec.mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    on
                      ? "bg-surface-active text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              );
            })}
          </div>
          {countBadge}
        </div>
      ) : null}

      {/* Filter bar — a labelled, uniform row of facet dropdowns */}
      {showFacets ? (
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border px-3 py-2.5">
          <span className="mr-0.5 text-[11px] font-medium uppercase tracking-wide text-text-tertiary">
            Narrow by
          </span>
          {eventId ? (
            <>
              <FacetFilter
                label="Ticket"
                icon={Ticket}
                options={facets.tickets}
                selected={facetSel("tickets")}
                onToggle={onFacet("tickets")}
              />
              <FacetFilter
                label="Offering"
                icon={Package}
                options={facets.offerings}
                selected={facetSel("offerings")}
                onToggle={onFacet("offerings")}
              />
              <FacetFilter
                label="Add-on"
                icon={ShoppingBag}
                options={facets.purchasables}
                selected={facetSel("purchasables")}
                onToggle={onFacet("purchasables")}
              />
            </>
          ) : null}
          <FacetFilter
            label="Tag"
            icon={Tag}
            options={facets.tags}
            selected={facetSel("tags")}
            onToggle={onFacet("tags")}
          />
          <FacetFilter
            label="Status"
            icon={CircleDot}
            options={facets.statuses}
            selected={facetSel("statuses")}
            onToggle={onFacet("statuses")}
          />
          <SegmentFilter segments={data?.segments || []} value={segmentValue} onChange={onSegment} />
          {filtersActive ? (
            <button
              type="button"
              onClick={clearFilters}
              className="ml-auto inline-flex items-center gap-1 text-xs text-text-tertiary hover:text-foreground"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Search + bulk actions */}
      {specMode && activeSpec.mode === "all" ? null : (
        <div className="flex items-center gap-2 border-b border-border px-3 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={specMode ? "Search to include / exclude people…" : "Search people…"}
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-text-tertiary"
          />
          {specMode ? null : (
            <>
              <button
                type="button"
                onClick={selectAllShown}
                disabled={!shown.length}
                className="shrink-0 text-[11px] font-medium text-primary hover:underline disabled:opacity-40"
              >
                Select all ({shown.length})
              </button>
              {selected.size ? (
                <button
                  type="button"
                  onClick={clearSelected}
                  className="shrink-0 text-[11px] text-text-tertiary hover:text-foreground"
                >
                  Clear
                </button>
              ) : null}
            </>
          )}
        </div>
      )}

      {/* People list (or the all-mode summary panel) */}
      {specMode && activeSpec.mode === "all" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-surface-subtle text-text-secondary">
            <Users className="h-5 w-5" />
          </span>
          <p className="max-w-xs text-xs text-text-secondary">
            {loading
              ? "Loading people…"
              : eventId
                ? `Everyone who buys a ticket to this event. New buyers are added automatically.`
                : `Every guest in this project.`}
          </p>
        </div>
      ) : (
        <div className="max-h-56 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-text-secondary">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading people…
            </div>
          ) : !shown.length ? (
            <p className="py-8 text-center text-xs text-text-secondary">
              {data.pool.length
                ? "No one matches these filters."
                : eventId
                  ? "No buyers for this event yet."
                  : "No guests in this project yet."}
            </p>
          ) : (
            <div className="space-y-0.5">
              {shown.map((p) =>
                specMode ? (
                  <PersonRow
                    key={p.email}
                    person={p}
                    on={resolvedEmails.has(p.email)}
                    onClick={() => togglePerson(p)}
                  />
                ) : (
                  <PersonRow
                    key={p.email}
                    person={p}
                    on={selected.has(p.email)}
                    onClick={() => toggleOne(p.email)}
                  />
                ),
              )}
            </div>
          )}
        </div>
      )}

      {/* Footer — selection summary (set mode only; spec mode shows it in header) */}
      {!specMode ? (
        <div className="border-t border-border px-3 py-2 text-[11px] text-text-tertiary">
          {`${selected.size} ${selected.size === 1 ? "person" : "people"} selected`}
        </div>
      ) : null}
    </div>
  );
}

export default AudienceBuilder;
