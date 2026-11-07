"use client";

import React, { useMemo, useState } from "react";
import { Search, UserPlus, Users } from "lucide-react";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui";
import { seatLabel } from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { GuestBadges } from "./dietary_icons";

// Left zone: the event's guests — search, status / ticket / party filters, drag a guest onto a seat or table.

export const GUEST_DRAG_MIME = "application/x-geiger-seating-guest";

const STATUS_OPTIONS = [
  { value: "all", label: "All guests" },
  { value: "unseated", label: "Not seated" },
  { value: "seated", label: "Seated" },
  { value: "reseat", label: "Needs reseating" },
  { value: "vip", label: "VIPs" },
  { value: "stale", label: "No longer attending" },
];

function matchesStatus(g, status) {
  if (status === "unseated") return !g.seated && !g.stale;
  if (status === "seated") return g.seated;
  if (status === "reseat") return g.orphan;
  if (status === "vip") return g.vip;
  if (status === "stale") return g.stale;
  return true;
}

function CompactSelect({ value, onChange, options, label }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-full min-w-0 text-xs" aria-label={label}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function GuestRow({ guest, index, selected, onSelect }) {
  const where = guest.orphan ? "Needs reseating" : guest.seated ? seatLabel(index, guest.itemId, guest.seatIndex) : guest.stale ? "No longer on the guest list" : "Not seated";
  const sub = [guest.tier, guest.partyLabel].filter(Boolean).join(" · ");
  return (
    <div
      role="button"
      tabIndex={0}
      draggable={!guest.stale}
      onDragStart={(e) => {
        e.dataTransfer.setData(GUEST_DRAG_MIME, guest.key);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => onSelect(guest)}
      onKeyDown={(e) => e.key === "Enter" && onSelect(guest)}
      className={cn(
        "flex cursor-pointer items-center gap-2.5 border-b border-border px-3 py-2 transition-colors last:border-b-0 hover:bg-surface-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/40",
        selected && "bg-surface-active",
        !guest.stale && "active:cursor-grabbing",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          guest.seated ? "bg-primary/15 text-primary" : "border border-border bg-surface-card text-text-secondary",
          guest.vip && "ring-1 ring-amber-500/60",
        )}
      >
        {guest.initials}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className={cn("truncate text-sm font-medium", guest.stale ? "text-text-tertiary line-through" : "text-foreground")}>
            {guest.name}
          </p>
          <GuestBadges guest={guest} />
        </div>
        <p
          className={cn(
            "truncate text-xs",
            guest.orphan ? "text-amber-700 dark:text-amber-400" : guest.seated ? "text-text-secondary" : "text-text-tertiary",
          )}
        >
          {where}
          {sub ? ` · ${sub}` : ""}
        </p>
      </div>
    </div>
  );
}

export function GuestList({ guests, index, selectedKey, onSelect, onAddGuest }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [tier, setTier] = useState("all");
  const [party, setParty] = useState("all");

  const tierOptions = useMemo(() => {
    const tiers = [...new Set(guests.map((g) => g.tier).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    return [{ value: "all", label: "Any ticket" }, ...tiers.map((t) => ({ value: t, label: t }))];
  }, [guests]);

  const partyOptions = useMemo(() => {
    const seen = new Map();
    for (const g of guests) if (g.partySize > 1 && !seen.has(g.partyKey)) seen.set(g.partyKey, `${g.partyLabel} (${g.partySize})`);
    return [
      { value: "all", label: "Any party" },
      ...[...seen.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ];
  }, [guests]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return guests.filter((g) => {
      if (!matchesStatus(g, status)) return false;
      if (tier !== "all" && g.tier !== tier) return false;
      if (party !== "all" && g.partyKey !== party) return false;
      if (q && !`${g.name} ${g.email} ${g.company} ${g.partyLabel} ${g.tier}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [guests, query, status, tier, party]);

  const unseated = guests.filter((g) => !g.seated && !g.stale).length;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search guests…" className="pl-9" aria-label="Search guests" />
        </div>
        <CompactSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} label="Seating status" />
        <div className="grid grid-cols-2 gap-2">
          <CompactSelect value={tier} onChange={setTier} options={tierOptions} label="Ticket type" />
          <CompactSelect value={party} onChange={setParty} options={partyOptions} label="Party" />
        </div>
        <p className="text-xs tabular-nums text-text-tertiary">
          {filtered.length === guests.length ? `${guests.length} guests` : `${filtered.length} of ${guests.length}`} · {unseated} not seated
        </p>
      </div>

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
        {filtered.length ? (
          filtered.map((g) => (
            <GuestRow key={g.key} guest={g} index={index} selected={g.key === selectedKey} onSelect={onSelect} />
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <Users className="h-5 w-5 text-text-tertiary" />
            <p className="text-sm text-text-secondary">{guests.length ? "No guests match." : "No guests on this event yet."}</p>
            <p className="text-xs text-text-tertiary">
              {guests.length ? "Clear the search or filters." : "Ticket buyers and registrations appear here; add others by hand."}
            </p>
          </div>
        )}
      </div>

      <div className="border-t border-border p-3">
        <Button
          variant="outline"
          size="sm"
          className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          onClick={onAddGuest}
        >
          <UserPlus className="h-4 w-4" /> Add a guest
        </Button>
      </div>
    </div>
  );
}

export default GuestList;
