"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Gauge, Loader2, SlidersHorizontal } from "lucide-react";

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
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { listEvents, updateEvent, updateEventMeta } from "@/lib/supabase/events";
import { listRegistrations } from "@/lib/supabase/registrations";
import { countRegs, PipelineBar, PipelineChips } from "./pipeline";

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

export function CapacityLimitsScreen() {
  const [events, setEvents] = useState([]);
  const [regs, setRegs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [adjust, setAdjust] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(), listRegistrations()]).then(([evts, rows]) => {
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
      .sort((a, b) => b.fill - a.fill);
  }, [events, countsByEvent, search]);

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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search events…"
          className="w-full sm:max-w-xs"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading capacity…
        </div>
      ) : rows.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface-subtle p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  <p className="mt-0.5 text-xs text-text-secondary">
                    {r.counts.Waitlisted} waitlisted
                    {r.buffer ? ` · +${r.buffer} buffer` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-2xl font-bold tabular-nums ${r.over ? "text-red-400" : "text-foreground"}`}
                  >
                    {r.fill}%
                  </span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Adjust ${r.name}`}
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => setAdjust(r)}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <PipelineBar counts={r.counts} capacity={r.effective} size="lg" />
              <div className="flex items-center justify-between">
                <PipelineChips counts={r.counts} />
                <span className="shrink-0 text-xs font-medium tabular-nums">
                  {r.over ? (
                    <span className="text-red-400">Full</span>
                  ) : (
                    <span className="text-text-secondary">
                      {r.remaining} left of {r.effective || "∞"}
                    </span>
                  )}
                </span>
              </div>
            </div>
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
