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

// Buyer-facing seat selection. Loads the event's map through the anon RPC,
// holds every selected seat with a TTL, and reports the selection upward.
//
// map-first  — the section the buyer clicks decides the ticket and the price.
// type-first — the ticket is already chosen; only sections mapped to it are
//              selectable, and exactly `requiredQty` seats must be picked.
//
// The map is paired with an OFFERS rail (seat_offers.jsx) listing every row on
// sale, because a map alone can't answer the question buyers actually arrive
// with: "where are N seats together inside my budget?"

// Seconds left on the hold, ticking. A hook rather than a component because the
// stub renders the same number twice — once as a meter along its edge, once as
// digits beside the price — and they must never disagree by a second.
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

  // Reported against the current hold rather than the last one, so a released
  // selection can't leave a clock still reading 04:12.
  return expiresAt ? left : 0;
}

const clockFace = (seconds) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

// The accent arrives as the page's `{ color, text }` from one caller and as a
// bare hex from another. Take either and hand the rest of the file a string.
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
  // The rail's primary action — the buyer confirms from beside their seats
  // rather than hunting for a button below the map.
  onConfirm,
  confirmLabel = "Reserve seats",
  // The way back to the previous checkout step. It shares the picker's one
  // control strip rather than getting a footer band of its own.
  onBack,
  // Checkout owns the holds: the picker is unmounted the moment the buyer
  // moves to the details step, and dropping the holds there would put the
  // seats back on sale mid-purchase.
  releaseOnUnmount = false,
  // A hold this buyer already owns, handed back when they return to this step.
  // Without it the picker mounts under a fresh token and the map shows their
  // own seats as sold — the map has no way to tell whose hold it is looking at.
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
  // Offers rail: how it's sorted, the price ceiling (null = no ceiling), and
  // which row the buyer came in through.
  // "Best seats" leads: most events sell a section at one price, and a price
  // sort has nothing to say about a list where every row costs the same.
  const [sort, setSort] = useState("best");
  const [maxPrice, setMaxPrice] = useState(null);
  const [selectedOfferId, setSelectedOfferId] = useState(null);
  const [party, setParty] = useState(1);
  // The map moves in response to events (a row picked, a reset), never as a
  // consequence of the offer list changing underneath it.
  const chartRef = useRef(null);

  const mode = seating?.mode || "map-first";
  const sectionTiers = useMemo(() => seating?.sectionTiers || {}, [seating?.sectionTiers]);
  const holdMinutes = Number(seating?.holdMinutes) || 10;
  // Resuming means resuming the SAME token — a new one would be a stranger to
  // the hold and couldn't extend or release it.
  const [token] = useState(() => initialSelection?.token || seatToken());
  const tint = accentColor(accent);

  // Stable so the tick doesn't tear its own interval down on every render.
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

  // Only drop this session's holds on unmount when nobody upstream owns them.
  // Inside checkout this is off: advancing a step unmounts the picker, and
  // releasing there handed the buyer's seats back to everyone else while they
  // were still filling in their details.
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

  // Seats grouped by section, built once. Every section block on the map needs
  // its own seat list to show an availability count, and filtering the whole
  // array per section made a 20,000-seat arena quadratic on every render.
  const seatsBySection = useMemo(() => {
    const map = new Map();
    for (const seat of data?.seats ?? []) {
      const list = map.get(seat.sectionId);
      if (list) list.push(seat);
      else map.set(seat.sectionId, [seat]);
    }
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
    // Open, just hidden by the accessible filter — never call it sold.
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

  // Report the selection up. In map-first the section decides the ticket, so a
  // selection carries its own ticket id and unit price.
  // `expires` is passed explicitly rather than read off state: callers report
  // in the same breath as they set it, and state wouldn't have caught up.
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
      // Carried so the step can be re-entered on the hold it already owns.
      expiresAt: expires,
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
    report(result.held, result.expiresAt);
  };

  const toggleSeat = (seat) => {
    const isSelected = selected.includes(seat.id);
    let next = isSelected ? selected.filter((id) => id !== seat.id) : [...selected, seat.id];
    // Picking chairs by hand means the buyer is no longer on a listed row.
    setSelectedOfferId(null);

    // In map-first the SECTION sets the ticket and the price, and an order
    // carries one ticket — so a selection spanning two sections would be billed
    // entirely at the first one's price. Keep it to a single section.
    if (!isSelected && mode === "map-first") {
      const others = next
        .map((id) => seatsById.get(id))
        .filter((s) => s && s.sectionId !== seat.sectionId);
      if (others.length) {
        toast.error("Seats in one order have to come from the same section.");
        return;
      }
    }

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

  // How many seats sit together in one pick. type-first already knows, so the
  // rail only offers the choice in map-first.
  const partySize = mode === "type-first" && requiredQty > 0 ? requiredQty : party;

  // How good each row is, from the map's own geometry. Independent of who is
  // selling what, so it survives every filter the buyer applies — and it is the
  // only thing that can rank a venue selling at a single price.
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

  // Every row that is actually on sale — the list beside the map. Built from
  // the same data the map draws, so the two can never disagree.
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

  // How big a chair may be drawn. Measured from the venue's own chairs, because
  // an arena and a studio theatre disagree by an order of magnitude.
  const seatPitch = useMemo(
    () => measureSeatPitch(data?.seats ?? [], data?.aspect),
    [data],
  );

  const visibleOffers = useMemo(
    () =>
      sortOffers(
        // A ceiling at or above the dearest offer is no ceiling at all —
        // otherwise switching filters can shrink the range under the buyer's
        // slider and empty the list.
        filterOffers(allOffers, { maxPrice: maxPrice >= range.max ? null : maxPrice }),
        sort,
      ),
    [allOffers, maxPrice, range.max, sort],
  );

  // The best seat on sale, whatever the buyer is currently sorting by. It leads
  // the rail, and with one flat ticket price it is the only recommendation on
  // the panel.
  const bestOffer = useMemo(
    () => sortOffers(visibleOffers, "best").find((o) => o.fits) || null,
    [visibleOffers],
  );

  // Every seat of one row, for framing the map on it.
  const seatsOfOffer = (offer) =>
    (data?.seats ?? []).filter(
      (s) => s.sectionId === offer.sectionId && s.rowLabel === offer.rowLabel,
    );

  // Picking a row from the list moves the map to it and takes the adjacent
  // block the offer already worked out.
  const chooseOffer = (offer) => {
    if (!offer) return;
    chartRef.current?.focusSeats(seatsOfOffer(offer));
    if (!offer.fits || !offer.seatIds.length) {
      // Still open the row — it has seats, just not `partySize` in a run — so
      // the buyer can take what's there rather than hitting a dead end.
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
    // One flex column that fills whatever room the dialog gives it, so the map
    // and the rail grow into the space instead of leaving a dead band under a
    // fixed-ratio canvas.
    <div className="flex h-full min-h-0 flex-col gap-2">
      {/* Every control that isn't the map or the rail, on ONE strip. */}
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

        {/* The map is a canvas with no affordances of its own — say how it
            moves rather than leaving the buyer to discover it. */}
        <span className="hidden items-center gap-1.5 text-[11px] text-text-tertiary sm:inline-flex">
          <MousePointer2 className="h-3 w-3" />
          Drag to pan · scroll to zoom
        </span>
      </div>

      {/* The map bleeds to the edges of the dialog and the rail sits beside it.
          Nothing floats over the venue: whatever the buyer is aiming at stays
          visible while they read the list. */}
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

      {/* What the buyer has got and what it costs, on one bar under both panels
          — the map and the list are both about CHOOSING, and the decision to
          buy shouldn't be buried in the scroll of either one. */}
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

// The price bands, and — once seats are held — what they are and what they cost.
// One row that swaps its contents rather than two that fight for the space.
//
// Held, it is drawn as a TICKET STUB: torn edge, tear-off, and the hold clock
// running down the top as a hairline. The buyer isn't choosing any more, they're
// holding something with an expiry, and the shape says so before the words do.
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
  // Under a minute the clock stops being background information.
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
      {/* The event's own poster, printed on the ticket. Held back to a wash
          under a scrim: it has to survive whatever image the organiser
          uploaded without ever competing with the price. */}
      {held && coverUrl ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
      {/* The canvas can't be read by a screen reader, so the selection is
          announced from here instead. */}
      <p aria-live="polite" className="sr-only">
        {held
          ? `${seats.length} seat${seats.length === 1 ? "" : "s"} held in section ${
              section?.name ?? ""
            }, row ${first?.rowLabel ?? ""}, ${formatPrice(total)} total.`
          : "No seats selected."}
      </p>

      {/* The hold, draining along the bottom edge of the stub. */}
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
          {/* An empty stub is an invitation, not a blank. */}
          <p className="text-xs text-text-tertiary">
            Tap a seat on the map, or pick a row from the list.
          </p>
        </div>
      ) : (
        <div className="relative flex flex-wrap items-stretch gap-y-4 px-4 py-3 sm:flex-nowrap">
          {/* What they've got, then what it costs — left to right, in the order
              the buyer asks the questions. */}
          <div className="flex w-full min-w-0 flex-wrap items-center gap-x-8 gap-y-3 pr-3 sm:w-auto sm:flex-1">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-text-tertiary">
                <span className="truncate">Sec {section?.name || "—"}</span>
                <span className="text-border-strong">/</span>
                <span className="truncate">Row {first?.rowLabel}</span>
              </p>
              {/* Seat numbers as separate chips: they are what gets called out
                  at the door, and a comma-joined run hides how many there are. */}
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

          {/* The tear-off. The negative margin cancels the row's padding so the
              line spans the full height of the stub — the notches have to
              straddle its edges to read as punched rather than printed. */}
          <div
            aria-hidden="true"
            className="relative -my-3 hidden w-px shrink-0 border-l border-dashed border-border-strong sm:block"
          >
            <span className="absolute -top-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-surface-subtle" />
            <span className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rounded-full bg-surface-subtle" />
          </div>

          {/* The clock the hold runs against, and the one thing to do about it. */}
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
