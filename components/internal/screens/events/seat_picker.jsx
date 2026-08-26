"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MousePointer2, Timer, X } from "lucide-react";

import { Button } from "@geiger/ui";
import { currency } from "@/components/internal/screens/tickets/constants";
import { buildPriceTiers } from "@/lib/seating/price_tiers";
import {
  ACCESSIBLE_KINDS,
  buildSeatOffers,
  filterOffers,
  offerPriceRange,
  sortOffers,
} from "@/lib/seating/offers";
import { buildRowQuality } from "@/lib/seating/quality";
import {
  getEventSeating,
  holdSeats,
  releaseSeats,
  seatToken,
} from "@/lib/supabase/seating";

import { VenueChart } from "@/components/internal/shared/venue_chart";
import { measureSeatPitch } from "@/lib/seating/viewport";
import { cn } from "@/lib/utils";

import { SeatOffers } from "./seat_offers";

function useCountdown(expiresAt, onExpire) {
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

  return expiresAt ? left : 0;
}

const clockFace = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

const accentColor = (accent) =>
  (typeof accent === "string" ? accent : accent?.color) || null;

export function SeatPicker({
  event,
  seating,
  tickets = [],
  ticketId = null,
  requiredQty = 0,
  onChange,
  accent,
  onConfirm,
  confirmLabel = "Reserve seats",
  onBack,
  releaseOnUnmount = false,
  initialSelection = null,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(() => initialSelection?.seatIds ?? []);
  const [expiresAt, setExpiresAt] = useState(() => initialSelection?.expiresAt ?? null);
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [taken, setTaken] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [sort, setSort] = useState("best");
  const [maxPrice, setMaxPrice] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [party, setParty] = useState(1);
  const chartRef = useRef(null);

  const mode = seating?.mode || "map-first";
  const sectionTiers = useMemo(() => seating?.sectionTiers || {}, [seating?.sectionTiers]);
  const holdMinutes = Number(seating?.holdMinutes) || 10;
  const [token] = useState(() => initialSelection?.token || seatToken());
  const tint = accentColor(accent);

  const onHoldExpire = useCallback(() => {
    setSelected([]);
    setSelectedOfferId(null);
    setExpiresAt(null);
    onChange?.({
      seats: [],
      seatIds: [],
      ticketId: null,
      price: 0,
      token,
      expiresAt: null,
      sections: [],
    });
    setReloadToken((t) => t + 1);
    toast.error("Your seats were released. Please pick again.");
  }, [onChange, token]);

  const secondsLeft = useCountdown(expiresAt, onHoldExpire);

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

  useEffect(() => {
    if (!releaseOnUnmount) return undefined;
    return () => {
      if (event?.id && token) releaseSeats(event.id, token);
    };
  }, [event?.id, token, releaseOnUnmount]);

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

  const seatsBySection = useMemo(() => {
    const map = new Map();
    for (const seat of data?.seats ?? []) {
      const list = map.get(seat.sectionId);
      if (list) list.push(seat);
      else map.set(seat.sectionId, [seat]);
    }
    return map;
  }, [data]);

  const disabledSectionIds = useMemo(() => {
    const blocked = new Set();
    for (const section of data?.sections ?? []) {
      const mapped = sectionTiers[section.id];
      if (!mapped) blocked.add(section.id);
      else if (mode === "type-first" && ticketId && mapped !== ticketId) blocked.add(section.id);
    }
    return blocked;
  }, [data, sectionTiers, mode, ticketId]);

  const priceTiers = useMemo(
    () => buildPriceTiers(data?.sections ?? [], sectionTiers, tickets),
    [data, sectionTiers, tickets],
  );

  const priceForSection = (sectionId) => {
    const ticket = ticketById.get(sectionTiers[sectionId]);
    return Number(ticket?.price) || 0;
  };

  const sectionMeta = (section) => {
    const seats = seatsBySection.get(section.id) ?? [];
    let open = 0;
    for (const seat of seats) if (!taken.has(seat.id)) open += 1;
    const price = priceForSection(section.id);
    return {
      available: section.kind === "ga" ? section.capacity : open,
      price: price ? currency(price) : null,
    };
  };

  const seatState = (seat) => {
    if (selected.includes(seat.id)) return "selected";
    if (taken.has(seat.id)) return "sold";
    if (accessibleOnly && !ACCESSIBLE_KINDS.has(seat.kind)) return "filtered";
    if (ACCESSIBLE_KINDS.has(seat.kind)) return "accessible";
    return "available";
  };

  const seatLabel = (seat, state) => {
    const price = priceForSection(seat.sectionId);
    const said = state === "filtered" ? "hidden by the accessible filter" : state;
    return `Row ${seat.rowLabel} seat ${seat.seatLabel}, ${said}${
      price ? `, ${currency(price)}` : ""
    }`;
  };

  const report = (ids, expires = null) => {
    const seats = ids.map((id) => seatsById.get(id)).filter(Boolean);
    const sectionId = seats[0]?.sectionId;
    const resolvedTicketId = mode === "map-first" ? sectionTiers[sectionId] : ticketId;
    onChange?.({
      seats,
      seatIds: ids,
      ticketId: resolvedTicketId ?? null,
      price: Number(ticketById.get(resolvedTicketId)?.price) || 0,
      token,
      expiresAt: expires,
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
      setTaken((prev) => new Set([...prev, ...result.rejected]));
      toast.error(
        result.rejected.length === 1
          ? "That seat was just taken."
          : `${result.rejected.length} of those seats were just taken.`,
      );
    }

    setSelected(result.held);
    setExpiresAt(result.expiresAt);
    report(result.held, result.expiresAt);
  };

  const toggleSeat = (seat) => {
    const isSelected = selected.includes(seat.id);
    let next = isSelected ? selected.filter((id) => id !== seat.id) : [...selected, seat.id];
    setSelectedOfferId(null);

    if (!isSelected && mode === "map-first") {
      const others = next
        .map((id) => seatsById.get(id))
        .filter((s) => s && s.sectionId !== seat.sectionId);
      if (others.length) {
        toast.error("Seats in one order have to come from the same section.");
        return;
      }
    }

    if (!isSelected && seat.companionOf) next = [...new Set([...next, seat.companionOf])];
    if (!isSelected && seat.kind === "wheelchair") {
      const companion = (data?.seats ?? []).find((s) => s.companionOf === seat.id);
      if (companion) next = [...new Set([...next, companion.id])];
    }

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

  const partySize = mode === "type-first" && requiredQty > 0 ? requiredQty : party;

  const rowQuality = useMemo(
    () =>
      buildRowQuality({
        sections: data?.sections ?? [],
        seats: data?.seats ?? [],
        field: data?.field,
        aspect: data?.aspect,
      }),
    [data],
  );

  const allOffers = useMemo(
    () =>
      buildSeatOffers({
        sections: data?.sections ?? [],
        seats: data?.seats ?? [],
        taken,
        sectionTiers,
        tickets,
        aspect: data?.aspect,
        quantity: partySize,
        accessibleOnly,
        quality: rowQuality,
      }).filter((o) => !disabledSectionIds.has(o.sectionId)),
    [data, taken, sectionTiers, tickets, partySize, accessibleOnly, disabledSectionIds, rowQuality],
  );

  const range = useMemo(() => offerPriceRange(allOffers), [allOffers]);

  const seatPitch = useMemo(
    () => measureSeatPitch(data?.seats ?? [], data?.aspect),
    [data],
  );

  const visibleOffers = useMemo(
    () =>
      sortOffers(
        filterOffers(allOffers, { maxPrice: maxPrice >= range.max ? null : maxPrice }),
        sort,
      ),
    [allOffers, maxPrice, range.max, sort],
  );

  const bestOffer = useMemo(
    () => sortOffers(visibleOffers, "best").find((o) => o.fits) || null,
    [visibleOffers],
  );

  const seatsOfOffer = (offer) =>
    (data?.seats ?? []).filter(
      (s) => s.sectionId === offer.sectionId && s.rowLabel === offer.rowLabel,
    );

  const chooseOffer = (offer) => {
    if (!offer) return;
    chartRef.current?.focusSeats(seatsOfOffer(offer));
    if (!offer.fits || !offer.seatIds.length) {
      setSelectedOfferId(null);
      toast.error(
        `Row ${offer.rowLabel} hasn't got ${partySize} together. Pick from what's open.`,
      );
      return;
    }
    setSelectedOfferId(offer.id);
    applySelection(offer.seatIds);
  };

  const clearSelection = () => {
    setSelected([]);
    setSelectedOfferId(null);
    setExpiresAt(null);
    releaseSeats(event.id, token);
    report([]);
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="flex h-full min-h-48 items-center justify-center text-center text-sm text-text-secondary">
        Seating isn&apos;t available for this event.
      </p>
    );
  }

  const selectedSeats = selected.map((id) => seatsById.get(id)).filter(Boolean);
  const total = selectedSeats.reduce((sum, seat) => sum + priceForSection(seat.sectionId), 0);

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {onBack ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={onBack}
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          ) : null}
        </div>

        <span className="hidden items-center gap-1.5 text-[11px] text-text-tertiary sm:inline-flex">
          <MousePointer2 className="h-3 w-3" />
          Drag to pan · scroll to zoom
        </span>
      </div>

      <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border border-border shadow-inner shadow-black/20 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <VenueChart
          ref={chartRef}
          ambient
          className="min-h-[17rem] lg:min-h-0"
          sections={data.sections}
          seats={data.seats}
          field={data.field}
          aspect={data.aspect}
          seatPitch={seatPitch}
          seatState={seatState}
          onSeatClick={toggleSeat}
          sectionMeta={sectionMeta}
          disabledSectionIds={disabledSectionIds}
          seatLabel={seatLabel}
          colorBySectionId={priceTiers.colorBySectionId}
          formatPrice={currency}
        />

        <div className="min-h-[20rem] overflow-hidden border-t border-border bg-surface-subtle lg:min-h-0 lg:border-l lg:border-t-0">
          <SeatOffers
            offers={visibleOffers}
            sort={sort}
            onSortChange={setSort}
            maxPrice={maxPrice}
            priceRange={range}
            onMaxPriceChange={setMaxPrice}
            accessibleOnly={accessibleOnly}
            onAccessibleChange={setAccessibleOnly}
            quantity={partySize}
            onQuantityChange={mode === "map-first" ? setParty : undefined}
            bestOffer={bestOffer}
            selectedOfferId={selectedOfferId}
            onSelectOffer={chooseOffer}
            formatPrice={currency}
            accent={tint}
          />
        </div>
      </div>

      <SelectionBar
        seats={selectedSeats}
        sections={data.sections}
        total={total}
        legend={priceTiers.legend}
        formatPrice={currency}
        onClear={clearSelection}
        onConfirm={onConfirm}
        confirmLabel={confirmLabel}
        busy={busy}
        accent={tint}
        secondsLeft={secondsLeft}
        holdSeconds={holdMinutes * 60}
        coverUrl={event?.coverUrl}
      />
    </div>
  );
}

function SelectionBar({
  seats,
  sections,
  total,
  legend,
  formatPrice,
  onClear,
  onConfirm,
  confirmLabel,
  busy,
  accent,
  secondsLeft,
  holdSeconds,
  coverUrl,
}) {
  const first = seats[0];
  const section = first ? sections.find((s) => s.id === first.sectionId) : null;
  const held = seats.length > 0;
  const urgent = secondsLeft > 0 && secondsLeft <= 60;
  const remaining = holdSeconds > 0 ? Math.min(1, secondsLeft / holdSeconds) : 0;

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden rounded-xl transition-colors",
        held
          ? "bg-surface-card shadow-lg shadow-black/20"
          : "bg-surface-subtle",
      )}
    >
      {held && coverUrl ? (
        <>
          <img
            src={coverUrl}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 h-full w-full scale-105 object-cover opacity-25 blur-[2px]"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-surface-card via-surface-card/92 to-surface-card/75"
          />
        </>
      ) : null}
      <p aria-live="polite" className="sr-only">
        {held
          ? `${seats.length} seat${seats.length === 1 ? "" : "s"} held in section ${
              section?.name ?? ""
            }, row ${first?.rowLabel ?? ""}, ${formatPrice(total)} total.`
          : "No seats selected."}
      </p>

      {held && secondsLeft > 0 ? (
        <div className="absolute inset-x-0 bottom-0 z-10 h-0.5">
          <div
            className={cn(
              "h-full transition-[width] duration-1000 ease-linear",  
              urgent ? "bg-amber-400" : "bg-primary",
            )}
            style={{
              width: `${remaining * 100}%`,
              backgroundColor: urgent ? undefined : accent || undefined,
            }}
          />
        </div>
      ) : null}

      {!held ? (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-3 py-2.5">
          <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {(legend ?? []).map((band) => (
              <li
                key={band.key}
                className="inline-flex items-center gap-1.5 text-xs text-text-secondary"
              >
                <span className={cn("h-2 w-2 rounded-full", band.dot)} />
                <span className="tabular-nums">{formatPrice(band.price)}</span>
                {band.label ? <span className="text-text-tertiary">{band.label}</span> : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-text-tertiary">
            Tap a seat on the map, or pick a row from the list.
          </p>
        </div>
      ) : (
        <div className="relative flex flex-wrap items-stretch gap-y-4 px-4 py-3 sm:flex-nowrap">
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-8 gap-y-3 pr-3 sm:w-auto sm:flex-1">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                <span className="truncate">Sec {section?.name || "—"}</span>
                <span className="text-border-strong">/</span>
                <span className="truncate">Row {first?.rowLabel}</span>
              </p>
              <ul className="mt-1.5 flex flex-wrap items-center gap-1">
                {seats.map((seat) => (
                  <li
                    key={seat.id}
                    className="rounded bg-surface-active px-1.5 py-0.5 text-xs font-medium tabular-nums text-foreground"
                  >
                    {seat.seatLabel}
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={onClear}
                    className="ml-1 inline-flex items-center gap-0.5 text-[11px] text-text-tertiary transition-colors hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                    Clear
                  </button>
                </li>
              </ul>
            </div>

            <div className="shrink-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                Total
              </p>
              <p className="text-2xl font-semibold leading-tight tracking-tight tabular-nums text-foreground">
                {formatPrice(total)}
              </p>
            </div>
          </div>

          <div
            aria-hidden="true"
            className="relative -my-3 hidden w-px shrink-0 border-l border-dashed border-border-strong sm:block"
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-surface-subtle" />
            <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-surface-subtle" />
          </div>

          <div className="flex w-full flex-col items-stretch justify-center gap-1.5 sm:w-auto sm:min-w-[11.5rem] sm:pl-5">
            {secondsLeft > 0 ? (
              <span
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 text-xs tabular-nums",
                  urgent ? "font-semibold text-amber-400" : "text-text-secondary",
                )}
              >
                <Timer className="h-3.5 w-3.5" />
                Held {clockFace(secondsLeft)}
              </span>
            ) : null}
            <Button
              type="button"
              disabled={busy}
              onClick={onConfirm}
              className="h-11 w-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              style={accent ? { backgroundColor: accent } : undefined}
            >
              {confirmLabel}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SeatPicker;
