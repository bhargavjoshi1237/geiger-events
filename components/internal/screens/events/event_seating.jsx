"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Armchair, Loader2 } from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { useEventConfig } from "@/lib/events/use-event-config";
import { listSeatMaps } from "@/lib/supabase/seat_maps";
import {
  blockSeats,
  getEventSeating,
  listAssignments,
  unblockSeats,
} from "@/lib/supabase/seating";

import { SeatMapView } from "./seat_map_view";

const DEFAULT_SEATING = {
  seatMapId: "",
  mode: "map-first",
  sectionTiers: {},
  holdMinutes: 10,
};

const NONE = "__none__";

export function EventSeatingSection({ event, headerItem }) {
  const [seating, setSeating, saveSeating, saving] = useEventConfig(
    event,
    "seating",
    DEFAULT_SEATING,
  );

  const [maps, setMaps] = useState([]);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [liveRaw, setLive] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  const tickets = Array.isArray(event?.tickets) ? event.tickets : [];

  useEffect(() => {
    if (!event?.venueId) return undefined;
    let alive = true;
    listSeatMaps(event.venueId).then((rows) => {
      if (!alive) return;
      setMaps(rows ?? []);
      setLoadingMaps(false);
    });
    return () => {
      alive = false;
    };
  }, [event?.venueId]);

  useEffect(() => {
    if (!event?.id || !seating.seatMapId) return undefined;
    const mapId = seating.seatMapId;
    let alive = true;
    getEventSeating(event.id).then(
      (data) => alive && setLive(data ? { ...data, forMapId: mapId } : null),
    );
    listAssignments(event.id).then((rows) => alive && setAssignments(rows ?? []));
    return () => {
      alive = false;
    };
  }, [event?.id, seating.seatMapId, reloadToken]);

  const live = liveRaw?.forMapId === seating.seatMapId ? liveRaw : null;

  const blockedIds = useMemo(
    () => new Set(assignments.filter((a) => a.status === "blocked").map((a) => a.seatId)),
    [assignments],
  );
  const soldIds = useMemo(
    () => new Set(assignments.filter((a) => a.status !== "blocked").map((a) => a.seatId)),
    [assignments],
  );

  const patch = (partial) => {
    const next = { ...seating, ...partial };
    setSeating(next);
    saveSeating(next);
  };

  const setSectionTier = (sectionId, ticketId) => {
    const nextTiers = { ...(seating.sectionTiers || {}) };
    if (ticketId === NONE) delete nextTiers[sectionId];
    else nextTiers[sectionId] = ticketId;
    patch({ sectionTiers: nextTiers });
  };

  const toggleBlock = async (seat) => {
    if (soldIds.has(seat.id)) return;
    const isBlocked = blockedIds.has(seat.id);
    const ok = isBlocked
      ? await unblockSeats(event.id, [seat.id])
      : await blockSeats(event.id, [seat.id], "Production hold");
    if (!ok) {
      toast.error(isBlocked ? "Couldn't release the seat." : "Couldn't block the seat.");
      return;
    }
    toast.success(isBlocked ? "Seat released." : "Seat held off sale.");
    reload();
  };

  const seatState = (seat) => {
    if (soldIds.has(seat.id)) return "sold";
    if (blockedIds.has(seat.id)) return "blocked";
    return "available";
  };

  const seatsBySection = useMemo(() => {
    const map = new Map();
    for (const seat of live?.seats ?? []) {
      const list = map.get(seat.sectionId);
      if (list) list.push(seat);
      else map.set(seat.sectionId, [seat]);
    }
    return map;
  }, [live]);

  const sectionMeta = (section) => {
    const seats = seatsBySection.get(section.id) ?? [];
    let taken = 0;
    for (const seat of seats) if (soldIds.has(seat.id) || blockedIds.has(seat.id)) taken += 1;
    return {
      available: section.kind === "ga" ? section.capacity : seats.length - taken,
    };
  };

  if (!event?.venueId) {
    return (
      <>
        {headerItem ? (
          <EditorSectionHeader title={headerItem.label} description={headerItem.desc} />
        ) : null}
        <EmptyState
          icon={Armchair}
          title="Pick a venue first"
          description="Seat maps belong to a venue. Set this event's venue on the Location tab, then build or choose a configuration here."
        />
      </>
    );
  }

  if (loadingMaps) {
    return (
      <div className="flex h-40 items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (maps.length === 0) {
    return (
      <>
        {headerItem ? (
          <EditorSectionHeader title={headerItem.label} description={headerItem.desc} />
        ) : null}
        <EmptyState
          icon={Armchair}
          title="This venue has no seat maps"
          description="Open the venue and build a seat map configuration — sections, rows and seats — then come back to attach it to this event."
        />
      </>
    );
  }

  const sections = live?.sections ?? [];
  const seatedSections = sections.filter((s) => s.kind !== "ga");

  return (
    <div className="space-y-6">
      {headerItem ? (
        <EditorSectionHeader title={headerItem.label} description={headerItem.desc} />
      ) : null}

      <SectionCard
        title="Configuration"
        description="Which layout this event sells, and how buyers choose their seats."
      >
        <div className="grid gap-4">
          <Field label="Seat map" hint="Built on the venue, reusable across events.">
            <Select
              value={seating.seatMapId || NONE}
              onValueChange={(v) => patch({ seatMapId: v === NONE ? "" : v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="No seating — sell general admission" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No seating (general admission)</SelectItem>
                {maps.map((map) => (
                  <SelectItem key={map.id} value={map.id}>
                    {map.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {seating.seatMapId ? (
            <>
              <Field
                label="How buyers choose"
                hint="Map-first prices by section; type-first keeps the ticket picker and adds a seat step."
              >
                <Select value={seating.mode} onValueChange={(v) => patch({ mode: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="map-first">
                      Map first — the section sets the price
                    </SelectItem>
                    <SelectItem value="type-first">
                      Ticket and quantity first, then pick seats
                    </SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Hold seats for" hint="Minutes a seat stays reserved while a buyer pays.">
                <Input
                  type="number"
                  min={1}
                  max={60}
                  inputMode="numeric"
                  value={seating.holdMinutes ?? 10}
                  onChange={(e) => setSeating({ ...seating, holdMinutes: Number(e.target.value) || 10 })}
                  onBlur={() => saveSeating(seating)}
                  className="tabular-nums"
                />
              </Field>
            </>
          ) : null}
        </div>
      </SectionCard>

      {seating.seatMapId && sections.length > 0 ? (
        <SectionCard
          title="Section pricing"
          description="Map each section to one of this event's tickets. Unmapped sections aren't sellable."
        >
          {tickets.length === 0 ? (
            <p className="text-sm text-text-secondary">
              Add tickets on the Tickets tab first, then map them to sections here.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sections.map((section) => (
                <li key={section.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">
                      {section.name}
                    </span>
                    <span className="text-xs text-text-secondary">
                      {section.kind === "ga" ? `GA zone · ${section.capacity} capacity` : "Seated"}
                    </span>
                  </div>
                  <div className="w-56 shrink-0">
                    <Select
                      value={seating.sectionTiers?.[section.id] || NONE}
                      onValueChange={(v) => setSectionTier(section.id, v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Not sellable" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>Not sellable</SelectItem>
                        {tickets.map((ticket) => (
                          <SelectItem key={ticket.id} value={ticket.id}>
                            {ticket.name || "Untitled ticket"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      ) : null}

      {seating.seatMapId && seatedSections.length > 0 ? (
        <SectionCard
          title="Box office"
          description="Live seat state. Click an open seat to hold it off sale, or a held seat to release it."
          action={
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={reload}
              disabled={saving}
            >
              Refresh
            </Button>
          }
        >
          {live ? (
            <div className="space-y-4">
              <SeatMapView
                sections={sections}
                seats={live.seats}
                field={live.field}
                background={live.background}
                aspect={live.aspect}
                activeSectionId={activeSectionId}
                onSectionChange={setActiveSectionId}
                seatState={seatState}
                onSeatClick={toggleBlock}
                sectionMeta={sectionMeta}
              />
              <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary tabular-nums">
                <span>{soldIds.size} sold</span>
                <span>{blockedIds.size} held off sale</span>
                <span>{live.seats.length} seats total</span>
              </p>
            </div>
          ) : (
            <div className="flex h-32 items-center justify-center text-text-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
        </SectionCard>
      ) : null}
    </div>
  );
}

export default EventSeatingSection;
