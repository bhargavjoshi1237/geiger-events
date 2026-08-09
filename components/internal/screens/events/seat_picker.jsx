"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Accessibility, Loader2, Sparkles, Timer } from "lucide-react";

import { Button } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { currency } from "@/components/internal/screens/tickets/constants";
import { buildPriceTiers } from "@/lib/seating/price_tiers";
import {
  getEventSeating,
  holdSeats,
  releaseSeats,
  seatToken,
} from "@/lib/supabase/seating";

import { SeatMapView } from "./seat_map_view";

// Buyer-facing seat selection. Loads the event's map through the anon RPC,
// holds every selected seat with a TTL, and reports the selection upward.
//
// map-first  — the section the buyer clicks decides the ticket and the price.
// type-first — the ticket is already chosen; only sections mapped to it are
//              selectable, and exactly `requiredQty` seats must be picked.

const ACCESSIBLE_KINDS = new Set(["wheelchair", "companion"]);

function Countdown({ expiresAt, onExpire }) {
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setLeft(Math.max(0, Math.floor(ms / 1000)));
      if (ms <= 0) onExpire?.();
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt, onExpire]);

  if (!expiresAt || left <= 0) return null;
  const mins = String(Math.floor(left / 60)).padStart(2, "0");
  const secs = String(left % 60).padStart(2, "0");
  return (
    <span className="inline-flex items-center gap-1.5 text-xs tabular-nums text-text-secondary">
      <Timer className="h-3.5 w-3.5" />
      Seats held for {mins}:{secs}
    </span>
  );
}

export function SeatPicker({
  event,
  seating,
  tickets = [],
  ticketId = null,
  requiredQty = 0,
  onChange,
  accent,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [activeSectionId, setActiveSectionId] = useState(null);
  const [expiresAt, setExpiresAt] = useState(null);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [taken, setTaken] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const mode = seating?.mode || "map-first";
  const sectionTiers = useMemo(() => seating?.sectionTiers || {}, [seating?.sectionTiers]);
  const holdMinutes = Number(seating?.holdMinutes) || 10;
  const token = useMemo(() => seatToken(), []);

  useEffect(() => {
    if (!event?.id) return undefined;
    let alive = true;
    getEventSeating(event.id).then((result) => {
      if (!alive) return;
      setData(result);
      setTaken(result?.taken ?? new Set());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [event?.id, reloadToken]);

  // Drop this session's holds when the picker unmounts (buyer closed checkout).
  useEffect(() => {
    return () => {
      if (event?.id && token) releaseSeats(event.id, token);
    };
  }, [event?.id, token]);

  const ticketById = useMemo(() => {
    const map = new Map();
    for (const ticket of tickets) map.set(ticket.id, ticket);
    return map;
  }, [tickets]);

  const seatsById = useMemo(() => {
    const map = new Map();
    for (const seat of data?.seats ?? []) map.set(seat.id, seat);
    return map;
  }, [data]);

  // In type-first mode only sections priced against the chosen ticket are open.
  const disabledSectionIds = useMemo(() => {
    const blocked = new Set();
    for (const section of data?.sections ?? []) {
      const mapped = sectionTiers[section.id];
      if (!mapped) blocked.add(section.id);
      else if (mode === "type-first" && ticketId && mapped !== ticketId) blocked.add(section.id);
    }
    return blocked;
  }, [data, sectionTiers, mode, ticketId]);

  // Section colours and the legend come straight from the pricing the organiser
  // already set — the buyer shops by price band without anyone configuring one.
  const priceTiers = useMemo(
    () => buildPriceTiers(data?.sections ?? [], sectionTiers, tickets),
    [data, sectionTiers, tickets],
  );

  const priceForSection = (sectionId) => {
    const ticket = ticketById.get(sectionTiers[sectionId]);
    return Number(ticket?.price) || 0;
  };

  const sectionMeta = (section) => {
    const seats = (data?.seats ?? []).filter((s) => s.sectionId === section.id);
    const open = seats.filter((s) => !taken.has(s.id)).length;
    const price = priceForSection(section.id);
    return {
      available: section.kind === "ga" ? section.capacity : open,
      price: price ? currency(price) : null,
    };
  };

  const seatState = (seat) => {
    if (selected.includes(seat.id)) return "selected";
    if (taken.has(seat.id)) return "sold";
    if (accessibleOnly && !ACCESSIBLE_KINDS.has(seat.kind)) return "sold";
    if (ACCESSIBLE_KINDS.has(seat.kind)) return "accessible";
    return "available";
  };

  const seatLabel = (seat, state) => {
    const price = priceForSection(seat.sectionId);
    return `Row ${seat.rowLabel} seat ${seat.seatLabel}, ${state}${
      price ? `, ${currency(price)}` : ""
    }`;
  };

  // Report the selection up. In map-first the section decides the ticket, so a
  // selection carries its own ticket id and unit price.
  const report = (ids) => {
    const seats = ids.map((id) => seatsById.get(id)).filter(Boolean);
    const sectionId = seats[0]?.sectionId;
    const resolvedTicketId = mode === "map-first" ? sectionTiers[sectionId] : ticketId;
    onChange?.({
      seats,
      seatIds: ids,
      ticketId: resolvedTicketId ?? null,
      price: Number(ticketById.get(resolvedTicketId)?.price) || 0,
      token,
      // Carried so the confirmation can name the section without refetching.
      sections: data?.sections ?? [],
    });
  };

  const applySelection = async (ids) => {
    setBusy(true);
    const result = await holdSeats(event.id, ids, token, holdMinutes);
    setBusy(false);

    if (!result) {
      toast.error("Couldn't hold those seats. Try again.");
      return;
    }

    if (result.rejected.length) {
      // Someone else got there first — mark them taken so the map tells the truth.
      setTaken((prev) => new Set([...prev, ...result.rejected]));
      toast.error(
        result.rejected.length === 1
          ? "That seat was just taken."
          : `${result.rejected.length} of those seats were just taken.`,
      );
    }

    setSelected(result.held);
    setExpiresAt(result.expiresAt);
    report(result.held);
  };

  const toggleSeat = (seat) => {
    const isSelected = selected.includes(seat.id);
    let next = isSelected ? selected.filter((id) => id !== seat.id) : [...selected, seat.id];

    // A wheelchair space and its companion seat sell together.
    if (!isSelected && seat.companionOf) next = [...new Set([...next, seat.companionOf])];
    if (!isSelected && seat.kind === "wheelchair") {
      const companion = (data?.seats ?? []).find((s) => s.companionOf === seat.id);
      if (companion) next = [...new Set([...next, companion.id])];
    }

    // type-first is capped at the quantity the buyer already chose.
    if (mode === "type-first" && requiredQty > 0 && next.length > requiredQty) {
      toast.error(`You've chosen ${requiredQty} ticket${requiredQty > 1 ? "s" : ""}.`);
      return;
    }

    if (next.length === 0) {
      setSelected([]);
      setExpiresAt(null);
      releaseSeats(event.id, token);
      report([]);
      return;
    }
    applySelection(next);
  };

  // Pick the best contiguous block in the highest-priced open section.
  const bestAvailable = () => {
    const qty = mode === "type-first" && requiredQty > 0 ? requiredQty : 1;
    const sections = [...(data?.sections ?? [])]
      .filter((s) => s.kind !== "ga" && !disabledSectionIds.has(s.id))
      .sort((a, b) => priceForSection(b.id) - priceForSection(a.id));

    for (const section of sections) {
      const rows = new Map();
      for (const seat of data.seats.filter((s) => s.sectionId === section.id)) {
        if (!rows.has(seat.rowLabel)) rows.set(seat.rowLabel, []);
        rows.get(seat.rowLabel).push(seat);
      }
      for (const rowSeats of rows.values()) {
        const ordered = [...rowSeats].sort((a, b) => a.x - b.x);
        let run = [];
        for (const seat of ordered) {
          run = taken.has(seat.id) ? [] : [...run, seat.id];
          if (run.length === qty) {
            setActiveSectionId(section.id);
            applySelection(run);
            return;
          }
        }
      }
    }
    toast.error("No block of that size is open. Try picking seats individually.");
  };

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="py-6 text-center text-sm text-text-secondary">
        Seating isn&apos;t available for this event.
      </p>
    );
  }

  const selectedSeats = selected.map((id) => seatsById.get(id)).filter(Boolean);
  const total = selectedSeats.reduce((sum, seat) => sum + priceForSection(seat.sectionId), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={bestAvailable}
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Sparkles className="h-4 w-4" /> Best available
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-pressed={accessibleOnly}
            onClick={() => setAccessibleOnly((v) => !v)}
            className={cn(
              "text-muted-foreground hover:bg-surface-active hover:text-foreground",
              accessibleOnly && "bg-surface-active text-foreground",
            )}
          >
            <Accessibility className="h-4 w-4" /> Accessible
          </Button>
        </div>
        <Countdown
          expiresAt={expiresAt}
          onExpire={() => {
            setSelected([]);
            setExpiresAt(null);
            report([]);
            setReloadToken((t) => t + 1);
            toast.error("Your seats were released. Please pick again.");
          }}
        />
      </div>

      <SeatMapView
        sections={data.sections}
        seats={data.seats}
        field={data.field}
        background={data.background}
        aspect={data.aspect}
        activeSectionId={activeSectionId}
        onSectionChange={setActiveSectionId}
        seatState={seatState}
        onSeatClick={toggleSeat}
        sectionMeta={sectionMeta}
        disabledSectionIds={disabledSectionIds}
        seatLabel={seatLabel}
        colorBySectionId={priceTiers.colorBySectionId}
        legend={priceTiers.legend}
        formatPrice={currency}
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-sm text-text-secondary">
          {selectedSeats.length === 0
            ? mode === "type-first" && requiredQty > 0
              ? `Choose ${requiredQty} seat${requiredQty > 1 ? "s" : ""}`
              : "Choose your seats"
            : selectedSeats
                .map((seat) => `${seat.rowLabel}${seat.seatLabel}`)
                .join(", ")}
        </p>
        {selectedSeats.length > 0 ? (
          <p
            className="text-sm font-medium tabular-nums text-foreground"
            style={accent ? { color: accent } : undefined}
          >
            {selectedSeats.length} × seat · {currency(total)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default SeatPicker;
