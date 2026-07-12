"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarDays, Gauge, Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { listEvents, updateEvent, updateEventMeta } from "@/lib/supabase/events";
import { listRegistrations } from "@/lib/supabase/registrations";
import { useProject } from "@/context/project-context";
import { EVENT_TYPE_MAP_LITE, formatDate } from "./constants";
import { countRegs, PipelineBar } from "./pipeline";

// Sort orders for the capacity list — the right-hand toolbar filter.
const SORT_OPTIONS = [
  { value: "fill-desc", label: "Fullest first" },
  { value: "fill-asc", label: "Emptiest first" },
  { value: "remaining-desc", label: "Most seats left" },
  { value: "capacity-desc", label: "Largest capacity" },
  { value: "name-asc", label: "Name (A–Z)" },
];

function AdjustDialog({ row, open, onOpenChange, onSave }) {
  const [capacity, setCapacity] = useState(row?.capacity ?? 0);
  const [buffer, setBuffer] = useState(row?.buffer ?? 0);
  const [seed, setSeed] = useState(row?.id);
  if (row?.id !== seed) {
    setSeed(row?.id);
    setCapacity(row?.capacity ?? 0);
    setBuffer(row?.buffer ?? 0);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>Adjust capacity</DialogTitle>
          <DialogDescription>{row?.name}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Capacity" hint="Total seats available.">
            <Input
              type="number"
              min={0}
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
            />
          </Field>
          <Field label="Overbook buffer" hint="Extra seats beyond capacity.">
            <Input
              type="number"
              min={0}
              value={buffer}
              onChange={(e) => setBuffer(e.target.value)}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              onSave(row.id, Number(capacity) || 0, Number(buffer) || 0);
              onOpenChange(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// One event's capacity as a clickable card — same shell as the RSVP event card,
// wired to open the adjust dialog and show fill against the effective cap.
function CapacityCard({ row, onAdjust }) {
  const { counts, effective, fill, over, buffer } = row;
  return (
    <button
      type="button"
      onClick={() => onAdjust(row)}
      className="group flex w-full items-center gap-4 rounded-xl border border-border bg-surface-subtle p-4 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-text-secondary transition-colors group-hover:text-foreground">
        <CalendarDays className="h-5 w-5" />
      </div>
      <div className="w-px self-stretch bg-border" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium text-foreground">{row.name}</span>
              {row.type ? (
                <Badge variant={EVENT_TYPE_MAP_LITE[row.type] || "neutral"}>
                  {row.type}
                </Badge>
              ) : null}
              {over ? (
                <span className="text-[11px] font-medium uppercase tracking-wide text-red-400">
                  Full
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-xs text-text-secondary">
              {formatDate(row.date)}
              {buffer ? ` · +${buffer} buffer` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="text-right">
              <span
                className={`text-sm font-semibold tabular-nums ${over ? "text-red-400" : "text-foreground"}`}
              >
                {counts.seats}
                <span className="font-normal text-text-secondary">
                  /{effective || "∞"}
                </span>
              </span>
              <p className="text-[11px] text-text-tertiary tabular-nums">
                {over ? "Full" : `${fill}% full`}
              </p>
            </div>
          </div>
        </div>
        <PipelineBar counts={counts} capacity={effective} size="lg" />
      </div>
    </button>
  );
}

export function CapacityLimitsScreen() {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("fill-desc");
  const [adjust, setAdjust] = useState(null);
  const { projectId } = useProject();

  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), listRegistrations(projectId)]).then(([evts, rows]) => {
      if (!alive) return;
      setEvents(evts ?? []);
      setRegs(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  const countsByEvent = useMemo(() => {
    const by = {};
    for (const r of regs) (by[r.eventId] ||= []).push(r);
    const m = {};
    for (const [id, list] of Object.entries(by)) m[id] = countRegs(list);
    return m;
  }, [regs]);

  const rows = useMemo(() => {
    return events
      .filter((e) =>
        search ? e.name.toLowerCase().includes(search.toLowerCase()) : true,
      )
      .map((e) => {
        const counts = countsByEvent[e.id] || countRegs([]);
        const buffer = Number(e.capacityBuffer) || 0;
        const effective = (e.capacity || 0) + buffer;
        // Fill = confirmed registration seats vs the effective cap. Paid buyers
        // are included here: checkout files a parity registration alongside the
        // order, so `seats` already unifies free RSVPs and paid tickets. (The
        // events.sold column is the paid-only tally; it and `seats` track the
        // same people and aren't summed.)
        const fill = effective ? Math.round((counts.seats / effective) * 100) : 0;
        return {
          ...e,
          counts,
          buffer,
          effective,
          fill,
          remaining: Math.max(0, effective - counts.seats),
          over: effective > 0 && counts.seats >= effective,
        };
      })
      .sort((a, b) => {
        switch (sort) {
          case "fill-asc":
            return a.fill - b.fill;
          case "remaining-desc":
            return b.remaining - a.remaining;
          case "capacity-desc":
            return b.effective - a.effective;
          case "name-asc":
            return a.name.localeCompare(b.name);
          case "fill-desc":
          default:
            return b.fill - a.fill;
        }
      });
  }, [events, countsByEvent, search, sort]);

  const stats = useMemo(() => {
    const atCap = rows.filter((r) => r.over).length;
    const seats = events.reduce((s, e) => s + (e.capacity || 0), 0);
    const withCap = rows.filter((r) => r.effective > 0);
    const avg = withCap.length
      ? Math.round(withCap.reduce((s, r) => s + r.fill, 0) / withCap.length)
      : 0;
    return [
      { label: "At capacity", value: String(atCap), footer: "Full or over" },
      { label: "Total seats", value: seats.toLocaleString(), footer: "Across all events" },
      { label: "Avg. fill", value: `${avg}%`, footer: "Confirmed vs capacity" },
    ];
  }, [rows, events]);

  const handleSave = (id, capacity, buffer) => {
    setEvents((prev) =>
      prev.map((e) =>
        e.id === id ? { ...e, capacity, capacityBuffer: buffer } : e,
      ),
    );
    toast.success("Capacity updated.");
    updateEvent(id, { capacity }).then((res) => {
      if (res === false) toast.error("Couldn't update capacity.");
    });
    updateEventMeta(id, { capacityBuffer: buffer }).then((res) => {
      if (res === false) toast.error("Couldn't update the buffer.");
    });
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Capacity Limits"
        description="Live fill across every event. Confirmed registrations count against the cap; set an overbooking buffer to allow a little extra."
      />

      <StatsBar stats={stats} columns={3} />

      <Toolbar>
        <span />
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search events…"
            className="w-full sm:max-w-xs"
          />
          <FilterDropdown
            value={sort}
            onValueChange={setSort}
            options={SORT_OPTIONS}
            height="h-9"
          />
        </div>
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading capacity…
        </div>
      ) : rows.length ? (
        <div className="grid gap-3">
          {rows.map((r) => (
            <CapacityCard key={r.id} row={r} onAdjust={setAdjust} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={Gauge}
            title={events.length ? "No events match your search" : "No events yet"}
            description={
              events.length
                ? "Try a different search."
                : "Create an event to start tracking its capacity and fill."
            }
          />
        </div>
      )}

      <AdjustDialog
        row={adjust}
        open={!!adjust}
        onOpenChange={(o) => !o && setAdjust(null)}
        onSave={handleSave}
      />
    </MainScreenWrapper>
  );
}

export default CapacityLimitsScreen;
