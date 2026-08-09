"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Timer } from "lucide-react";

import { Button } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { currency } from "@/components/internal/screens/tickets/constants";
import { buildPriceBands } from "@/lib/seating/price_tiers";
import { boothToken, getEventExpo, holdBooths, releaseBooths } from "@/lib/supabase/expo";

import { HallMapView } from "./hall_map_view";

// Exhibitor-facing booth selection — the booth mirror of seat_picker. Loads the
// event's hall through the anon RPC, holds every selected booth with a TTL, and
// reports the selection upward for checkout.
//
// Pricing follows the event's expo config:
//   tier   — the booth's mapped ticket sets the price
//   direct — the booth's own price applies, and one nominated ticket carries
//            the order line

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
      Booths held for {mins}:{secs}
    </span>
  );
}

export function BoothPicker({ event, expo, tickets = [], maxBooths = 0, onChange, accent }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState([]);
  const [expiresAt, setExpiresAt] = useState(null);
  const [taken, setTaken] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  const pricing = expo?.pricing === "direct" ? "direct" : "tier";
  const boothTiers = useMemo(() => expo?.boothTiers || {}, [expo?.boothTiers]);
  const holdMinutes = Number(expo?.holdMinutes) || 15;
  const token = useMemo(() => boothToken(), []);

  useEffect(() => {
    if (!event?.id) return undefined;
    let alive = true;
    getEventExpo(event.id).then((result) => {
      if (!alive) return;
      setData(result);
      setTaken(result?.taken ?? new Set());
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [event?.id, reloadToken]);

  // Drop this session's holds when the picker unmounts.
  useEffect(() => {
    return () => {
      if (event?.id && token) releaseBooths(event.id, token);
    };
  }, [event?.id, token]);

  const ticketById = useMemo(() => {
    const map = new Map();
    for (const ticket of tickets) map.set(ticket.id, ticket);
    return map;
  }, [tickets]);

  const boothsById = useMemo(() => {
    const map = new Map();
    for (const booth of data?.booths ?? []) map.set(booth.id, booth);
    return map;
  }, [data]);

  // In direct mode the stall carries its own price; in tier mode it inherits
  // the mapped ticket's. A booth with neither isn't sellable.
  const priceForBooth = useMemo(() => {
    return (booth) => {
      if (!booth) return null;
      if (pricing === "direct") return Number(booth.price) || 0;
      const ticket = ticketById.get(boothTiers[booth.id]);
      return ticket ? Number(ticket.price) || 0 : null;
    };
  }, [pricing, ticketById, boothTiers]);

  const bands = useMemo(
    () =>
      buildPriceBands(
        (data?.booths ?? []).filter((b) => b.kind === "booth"),
        priceForBooth,
        (booth) =>
          pricing === "direct"
            ? booth.sizeClass || ""
            : ticketById.get(boothTiers[booth.id])?.name || "",
      ),
    [data, priceForBooth, pricing, ticketById, boothTiers],
  );

  const ticketForBooth = (booth) =>
    pricing === "direct" ? expo?.exhibitorTicketId || null : boothTiers[booth?.id] || null;

  const boothState = (booth) => {
    if (selected.includes(booth.id)) return "selected";
    if (taken.has(booth.id)) return "sold";
    // An unpriced booth can't be bought, so it reads as unavailable.
    if (priceForBooth(booth) === null) return "sold";
    return "available";
  };

  const boothMeta = (booth) => {
    const price = priceForBooth(booth);
    return { price: price === null ? null : currency(price) };
  };

  const boothLabel = (booth, state) => {
    const price = priceForBooth(booth);
    return `Booth ${booth.code || booth.name}${booth.hall ? `, ${booth.hall}` : ""}, ${state}${
      price === null ? "" : `, ${currency(price)}`
    }`;
  };

  // Report the selection up. Every booth in one purchase must share a ticket
  // line, so the first selection's ticket wins.
  const report = (ids) => {
    const booths = ids.map((id) => boothsById.get(id)).filter(Boolean);
    const total = booths.reduce((sum, b) => sum + (priceForBooth(b) || 0), 0);
    onChange?.({
      booths,
      boothIds: ids,
      ticketId: ticketForBooth(booths[0]) ?? null,
      // In direct mode the per-booth prices differ, so the caller gets the mean
      // for the order line and the exact total alongside it.
      price: booths.length ? total / booths.length : 0,
      total,
      token,
      pricing,
    });
  };

  const applySelection = async (ids) => {
    setBusy(true);
    const result = await holdBooths(event.id, ids, token, holdMinutes);
    setBusy(false);

    if (!result) {
      toast.error("Couldn't hold those booths. Try again.");
      return;
    }

    if (result.rejected.length) {
      // Someone else got there first — mark them taken so the floor tells the truth.
      setTaken((prev) => new Set([...prev, ...result.rejected]));
      toast.error(
        result.rejected.length === 1
          ? "That booth was just taken."
          : `${result.rejected.length} of those booths were just taken.`,
      );
    }

    setSelected(result.held);
    setExpiresAt(result.expiresAt);
    report(result.held);
  };

  const toggleBooth = (booth) => {
    const isSelected = selected.includes(booth.id);
    const next = isSelected
      ? selected.filter((id) => id !== booth.id)
      : [...selected, booth.id];

    // Mixing tickets in one order would need two order lines; keep it to one.
    if (!isSelected && pricing === "tier" && selected.length) {
      const current = ticketForBooth(boothsById.get(selected[0]));
      if (current && ticketForBooth(booth) !== current) {
        toast.error("Those booths are sold under different packages. Buy them separately.");
        return;
      }
    }

    if (maxBooths > 0 && next.length > maxBooths) {
      toast.error(`You can book up to ${maxBooths} booth${maxBooths > 1 ? "s" : ""} at a time.`);
      return;
    }

    if (next.length === 0) {
      setSelected([]);
      setExpiresAt(null);
      releaseBooths(event.id, token);
      report([]);
      return;
    }
    applySelection(next);
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
        The exhibitor floor isn&apos;t available for this event.
      </p>
    );
  }

  const selectedBooths = selected.map((id) => boothsById.get(id)).filter(Boolean);
  const total = selectedBooths.reduce((sum, b) => sum + (priceForBooth(b) || 0), 0);
  const openCount = (data.booths ?? []).filter(
    (b) => b.kind === "booth" && !taken.has(b.id) && priceForBooth(b) !== null,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs tabular-nums text-text-secondary">
          {openCount} booth{openCount === 1 ? "" : "s"} still available
        </p>
        <Countdown
          expiresAt={expiresAt}
          onExpire={() => {
            setSelected([]);
            setExpiresAt(null);
            report([]);
            setReloadToken((t) => t + 1);
            toast.error("Your booths were released. Please pick again.");
          }}
        />
      </div>

      <HallMapView
        booths={data.booths}
        field={data.field}
        background={data.background}
        aspect={data.aspect}
        boothState={boothState}
        onBoothClick={toggleBooth}
        boothMeta={boothMeta}
        boothLabel={boothLabel}
        colorByBoothId={bands.colorById}
        legend={bands.legend}
        formatPrice={currency}
        emptyMessage="No booths have been laid out for this event yet."
      />

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className={cn("text-sm text-text-secondary", busy && "opacity-60")}>
          {selectedBooths.length === 0
            ? "Choose your stand"
            : selectedBooths.map((b) => b.code || b.name).join(", ")}
        </p>
        {selectedBooths.length > 0 ? (
          <p
            className="text-sm font-medium tabular-nums text-foreground"
            style={accent ? { color: accent } : undefined}
          >
            {selectedBooths.length} × booth · {currency(total)}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default BoothPicker;
