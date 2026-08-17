"use client";

import { useState } from "react";
import {
  Building2,
  CalendarCheck,
  Check,
  MapPin,
  Plus,
  Search,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CARD,
  LABEL,
  META,
  PANEL,
  TITLE,
} from "@/components/landing/showcase_demos";

/* ------------------------------------------------------------------ *
 * Sourcing — "Find the room before you sell it"
 * ------------------------------------------------------------------ */

const SOURCE_VENUES = [
  {
    id: "foundry",
    name: "The Foundry",
    area: "Seaport · Boston",
    cap: "1,800",
    price: 38500,
    dist: "1.2 mi",
    pin: "left-[50%] top-[42%]",
  },
  {
    id: "mill",
    name: "The Mill",
    area: "Fort Point · Boston",
    cap: "900",
    price: 21500,
    dist: "0.9 mi",
    pin: "left-[72%] top-[66%]",
  },
];

// Venue sourcing — filter, scan the map, and shortlist before you ever email.
export function VenueSourcingDemo() {
  const [selected, setSelected] = useState("foundry");
  const active = SOURCE_VENUES.find((venue) => venue.id === selected);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Venue sourcing</span>
        <span className={META}>Boston · 38 matches</span>
      </div>

      <div className="mb-2 flex shrink-0 gap-1.5">
        {["All of Boston", "≥ 900 cap", "≤ $40k"].map((chip, index) => (
          <span
            key={chip}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px]",
              index === 0
                ? "border-white/20 bg-white/10 text-white"
                : "border-white/[0.07] text-white/40",
            )}
          >
            {chip}
          </span>
        ))}
      </div>

      <div
        className="relative h-[88px] shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-[#1f1f1f]"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
      >
        <div className="absolute left-1/2 top-1/2 h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.04]" />
        {SOURCE_VENUES.map((venue) => (
          <MapPin
            key={venue.id}
            className={cn(
              "absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-full transition-colors",
              venue.pin,
              selected === venue.id ? "fill-emerald-400 text-emerald-400" : "fill-white/20 text-white/30",
            )}
          />
        ))}
        <span className="absolute bottom-1.5 left-2 text-[9px] uppercase tracking-wider text-white/25">
          Greater Boston
        </span>
      </div>

      <div className="mt-2 min-h-0 flex-1 space-y-1.5">
        {SOURCE_VENUES.map((venue) => (
          <button
            key={venue.id}
            type="button"
            onClick={() => setSelected(venue.id)}
            className={cn(
              CARD,
              "flex w-full items-center gap-2 px-2.5 py-1.5 text-left transition-colors",
              selected === venue.id && "border-white/25 bg-[#2a2a2a]",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">
                {venue.name}
              </div>
              <div className="truncate text-[10px] text-white/40">
                {venue.area} · {venue.cap} cap · {venue.dist}
              </div>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-white">
              ${(venue.price / 1000).toFixed(1)}k
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setSelected("foundry")}
        className="mt-2 flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
      >
        <CalendarCheck className="h-3 w-3" />
        Book {active.name}
      </button>
    </div>
  );
}

const BOOK_DATES = ["Sat 14", "Sun 15", "Mon 16", "Fri 21"];

// Instant Book — pick a day, see live availability, confirm on the spot.
export function InstantBookDemo() {
  const [date, setDate] = useState(0);
  const [booked, setBooked] = useState(false);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Instant book</span>
        <span className={META}>The Foundry</span>
      </div>

      <div className={cn(CARD, "flex items-center gap-2.5 px-3 py-2")}>
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-white">
            Main Hall · full buyout
          </div>
          <div className={META}>14 Mar · all-day rate</div>
        </div>
        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">
          $38.5k
        </span>
      </div>

      <div className={cn(LABEL, "mt-2.5 shrink-0")}>Available days</div>
      <div className="mt-1.5 grid shrink-0 grid-cols-4 gap-1.5">
        {BOOK_DATES.map((day, index) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              setDate(index);
              setBooked(false);
            }}
            className={cn(
              "rounded-md border py-1.5 text-[11px] transition-colors",
              date === index
                ? "border-white/30 bg-white/10 text-white"
                : "border-white/[0.07] text-white/40 hover:text-white/70",
            )}
          >
            {day}
          </button>
        ))}
      </div>

      <div className="mt-2 shrink-0 space-y-1 text-[10px] text-white/35">
        <div className="flex justify-between">
          <span>Room rate · {BOOK_DATES[date]}</span>
          <span className="tabular-nums">$38,500</span>
        </div>
        <div className="flex justify-between">
          <span>Instant book fee</span>
          <span className="tabular-nums">Included</span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setBooked(true)}
        disabled={booked}
        className={cn(
          "mt-auto flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-colors",
          booked
            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            : "bg-white text-zinc-950 hover:bg-white/90",
        )}
      >
        {booked ? (
          <>
            <Check className="h-3 w-3" />
            Confirmed instantly
          </>
        ) : (
          <>
            <Zap className="h-3 w-3" />
            Confirm · $38,500
          </>
        )}
      </button>
      <div className="mt-1.5 text-center text-[10px] text-white/30">
        {booked ? "Receipt sent · event saved to your calendar" : "14 organizers booked this month"}
      </div>
    </div>
  );
}

const ROOM_BLOCKS = [
  { id: "foundry-hotel", name: "The Foundry Hotel", rate: 219, left: 40, dist: "0.2 mi" },
  { id: "harbor", name: "Harbor Inn", rate: 189, left: 12, dist: "0.6 mi" },
];

// Housing & travel — room blocks that release with the ticket, plus the shuttle.
export function HousingTravelDemo() {
  const [taken, setTaken] = useState({});

  const book = (id) => setTaken((prev) => ({ ...prev, [id]: true }));

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Housing & travel</span>
        <span className={META}>Nightshift 2026</span>
      </div>

      <div className={cn(LABEL, "shrink-0")}>Room blocks</div>
      <div className="mt-1.5 min-h-0 flex-1 space-y-1.5">
        {ROOM_BLOCKS.map((block) => {
          const done = taken[block.id];
          const sold = block.left === 0;
          return (
            <div
              key={block.id}
              className={cn(CARD, "flex items-center gap-2 px-3 py-2")}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {block.name}
                </div>
                <div className={cn("truncate text-[10px]", sold ? "text-white/25" : "text-white/40")}>
                  ${block.rate} / night · {sold ? "Sold out" : `${block.left} left`} · {block.dist}
                </div>
              </div>
              <button
                type="button"
                onClick={() => book(block.id)}
                disabled={sold || done}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                  done
                    ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : sold
                      ? "border border-white/10 text-white/25"
                      : "bg-white text-zinc-950 hover:bg-white/90",
                )}
              >
                {done ? "Booked" : sold ? "Full" : "Book"}
              </button>
            </div>
          );
        })}
      </div>

      <div className={cn(CARD, "mt-2 flex shrink-0 items-center gap-2 px-3 py-2")}>
        <Building2 className="h-3.5 w-3.5 shrink-0 text-white/40" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] text-white">Airport shuttle · both days</div>
          <div className={META}>$18 / ride · 8 seats left · 4:00 PM pickup</div>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
        >
          Add
        </button>
      </div>
    </div>
  );
}

const LIBRARY_VENUES = [
  {
    id: "foundry",
    name: "The Foundry",
    city: "Boston, MA",
    cap: "1,800",
    events: 6,
    tags: ["Projector", "A/V included", "Catering"],
  },
  {
    id: "copley",
    name: "Copley Hall",
    city: "Boston, MA",
    cap: "1,200",
    events: 3,
    tags: ["Ballroom", "Valet", "4 loading bays"],
  },
  {
    id: "mill",
    name: "The Mill",
    city: "Cambridge, MA",
    cap: "900",
    events: 2,
    tags: ["Loft", "Daylight", "Paid lot"],
  },
];

// Venue library — venues live once, then get reused by any event.
export function VenueLibraryDemo() {
  const [selected, setSelected] = useState("foundry");
  const active = LIBRARY_VENUES.find((venue) => venue.id === selected);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Venue library</span>
        <span className={META}>{LIBRARY_VENUES.length} saved</span>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.07] bg-[#262626] px-2.5 py-1.5">
        <Search className="h-3 w-3 shrink-0 text-white/30" />
        <span className="text-[11px] text-white/35">Search your venues…</span>
      </div>

      <div className="mt-2 min-h-0 flex-1 space-y-1.5">
        {LIBRARY_VENUES.map((venue) => (
          <button
            key={venue.id}
            type="button"
            onClick={() => setSelected(venue.id)}
            className={cn(
              CARD,
              "flex w-full items-center gap-2 px-3 py-2 text-left transition-colors",
              selected === venue.id && "border-white/25 bg-[#2a2a2a]",
            )}
          >
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">
                {venue.name}
              </div>
              <div className="truncate text-[10px] text-white/40">
                {venue.city} · {venue.cap} cap · used by {venue.events} events
              </div>
            </div>
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/15 text-white/40">
              {selected === venue.id ? (
                <Check className="h-3 w-3 text-emerald-400" />
              ) : (
                <Plus className="h-3 w-3" />
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 flex-wrap gap-1">
        {active.tags.map((tag) => (
          <span
            key={tag}
            className="rounded-md border border-white/[0.07] bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-white/45"
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}
