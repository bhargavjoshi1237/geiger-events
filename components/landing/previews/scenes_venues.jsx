"use client";

import { AlertTriangle, ArrowRight, BedDouble, Check, Copy, Lock, MapPin, Plane, Plus, Star, Store, Timer, TrainFront } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { Bar, Field, Notice, Part, Pill, Row, RowText, SceneCard, flow, money } from "./kit";

// Venue, logistics and scale scenes: each one ends on a decision made or a result locked in.

const VENUES = [
  { name: "The Foundry", meta: "Leeds · 650 standing", price: 3200, capacity: 650, pin: [28, 38] },
  { name: "Skyline Bar", meta: "Leeds · 220 standing", price: 1900, capacity: 220, pin: [62, 30] },
  { name: "Mill Hall", meta: "Bradford · 900 standing", price: 5400, capacity: 900, pin: [46, 66] },
];

// Venue sourcing: a capacity filter rules out what's too small, then you shortlist what fits.
function VenueScene({ view }) {
  const { state } = view;
  const need = Number(state.guests) || 0;
  const fits = (venue) => venue.capacity >= need;
  return (
    <SceneCard title="Find a venue" meta="Leeds area · OpenStreetMap" aside={<span className="shrink-0 text-xs text-muted-foreground">{state.shortlist.length} shortlisted</span>}>
      <Field id="guests" label="Guests" placeholder="How many?" view={view} />
      <div className="relative mt-3 h-20 overflow-hidden rounded-lg border border-border bg-[linear-gradient(to_right,#80808018_1px,transparent_1px),linear-gradient(to_bottom,#80808018_1px,transparent_1px)] bg-[size:16px_16px]">
        {VENUES.map((venue) => <MapPin key={venue.name} className={cn("absolute size-5 -translate-x-1/2 -translate-y-full transition-all duration-300", state.shortlist.includes(venue.name) ? "fill-foreground text-background" : "text-muted-foreground", !fits(venue) && "opacity-20")} style={{ left: `${venue.pin[0]}%`, top: `${venue.pin[1]}%` }} />)}
      </div>
      <Part id="list" view={view} className="mt-3 space-y-2">
        {VENUES.map((venue) => (
          <Row key={venue.name} className={cn("py-2 transition-opacity duration-300", !fits(venue) && "opacity-35")}>
            <RowText title={venue.name} meta={`${venue.meta} · ${money(venue.price)}`} />
            {fits(venue) ? <Button data-part={`shortlist-${venue.name}`} variant={state.shortlist.includes(venue.name) ? "default" : "outline"} size="icon" className="size-7"><Star className="size-3.5" /></Button> : <Pill>Too small</Pill>}
          </Row>
        ))}
      </Part>
    </SceneCard>
  );
}

const DATES = [["12", "Thu", true], ["13", "Fri", false], ["14", "Sat", true], ["15", "Sun", true]];

// Instant booking: availability and the rate for the date, then a request in one click.
function BookingScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="The Foundry" meta="Leeds · 650 standing · March">
      <div className="grid grid-cols-4 gap-2">
        {DATES.map(([day, weekday, open]) => (
          <Button key={day} data-part={`date-${day}`} variant={state.date === day ? "default" : "outline"} disabled={!open} className="h-auto flex-col gap-0 py-2">
            <span className="text-[11px] opacity-70">{weekday}</span><span className="text-base font-semibold">{day}</span><span className="text-[10px] opacity-60">{open ? "Free" : "Booked"}</span>
          </Button>
        ))}
      </div>
      <Part id="rate" view={view} className="mt-3 space-y-1 rounded-lg bg-muted px-3 py-2.5 text-sm">
        <div className="flex justify-between"><span className="text-muted-foreground">Hire, 18:00–02:00</span><span className="font-medium tabular-nums">{state.date ? money(3200) : "—"}</span></div>
        <div className="flex justify-between"><span className="text-muted-foreground">Deposit</span><span className="tabular-nums">{state.date ? money(800) : "—"}</span></div>
      </Part>
      <Button data-part="request" className="mt-3 w-full" variant={state.requested ? "outline" : "default"} disabled={!state.date}>{state.requested ? <><Check className="size-3.5" />Requested for Sat {state.date} March</> : "Request booking"}</Button>
    </SceneCard>
  );
}

const STAYS = [[BedDouble, "Hotel Arden", "Stay · 0.4 km from venue"], [TrainFront, "Leeds Station", "Rail · 1.1 km"], [Plane, "Leeds Bradford Airport", "Air · 11 km"]];
const STAGES = ["Shortlisted", "Contacted", "Room block agreed"];

// Housing & travel: find what's near the venue, then track it through your pipeline.
function TravelScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="Housing & travel" meta="Near The Foundry, Leeds">
      <div className="space-y-2">
        {STAYS.map(([Icon, name, meta], index) => (
          <Row key={name} className="py-2">
            <div className="flex min-w-0 items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted"><Icon className="size-4" /></span><RowText title={name} meta={meta} /></div>
            <Button data-part={`add-${index}`} variant={index === 0 && state.added ? "default" : "outline"} size="icon" className="size-7">{index === 0 && state.added ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}</Button>
          </Row>
        ))}
      </div>
      <Part id="pipeline" view={view} className={cn("mt-3 rounded-lg bg-muted p-3 transition-opacity duration-300", state.added ? "opacity-100" : "opacity-40")}>
        <div className="mb-2 text-xs text-muted-foreground">Pipeline · Hotel Arden</div>
        <div className="flex items-center gap-1.5 text-[11px]">
          {STAGES.map((stage, index) => (
            <div key={stage} className="contents">
              <span data-part={`stage-${index}`} className={cn("rounded-md px-2 py-1 transition-colors", state.added && index <= state.stage ? "bg-foreground text-background" : "border border-border text-muted-foreground")}>{stage}</span>
              {index < STAGES.length - 1 ? <ArrowRight className="size-3 shrink-0 text-muted-foreground" /> : null}
            </div>
          ))}
        </div>
      </Part>
    </SceneCard>
  );
}

// Venue library: the venues you've used are ready to reuse, details and all.
function LibraryScene({ view }) {
  const { state } = view;
  return (
    <SceneCard title="Venue library" meta="Foundry Nights · 4 venues">
      <div className="space-y-2">
        {[["The Foundry", "Used for 3 events · 650 standing · contact: Lee Hart"], ["Mill Hall", "Used for 1 event · 900 standing"]].map(([name, meta]) => (
          <Row key={name} className="py-2">
            <RowText title={name} meta={meta} />
            <Button data-part={`use-${name}`} variant={state.used === name ? "default" : "outline"} size="sm" className="h-7 text-xs">{state.used === name ? "Used" : "Use for event"}</Button>
          </Row>
        ))}
      </div>
      <Part id="copied" view={view} className="mt-3">
        <Notice tone="success" icon={Copy} show={Boolean(state.used)}>
          <span className="font-semibold">Nightshift 2027</span> now has The Foundry&apos;s address, capacity and contact. Nothing to retype.
        </Notice>
      </Part>
    </SceneCard>
  );
}

const SEAT_ROWS = ["A", "B", "C", "D"];
const TAKEN = ["A3", "A4", "B5", "B6", "C1", "D7", "D8", "A7"];

// Seating: picked seats are held while the guest pays, so nobody else can take them.
function SeatScene({ view }) {
  const { state } = view;
  const taken = [...TAKEN, ...state.others];
  return (
    <SceneCard title="Choose your seats" meta="Nightshift Live · The Grand" aside={state.picked.length ? <Pill tone="strong"><Timer className="size-3" />Held {state.hold}</Pill> : null}>
      <div className="mx-auto mb-4 w-2/3 rounded-md bg-foreground py-1 text-center text-[11px] font-medium text-background">Stage</div>
      <div className="space-y-1.5">
        {SEAT_ROWS.map((row) => (
          <div key={row} className="flex items-center justify-center gap-1.5">
            <span className="w-4 text-[11px] text-muted-foreground">{row}</span>
            {Array.from({ length: 8 }, (_, i) => {
              const id = `${row}${i + 1}`;
              const picked = state.picked.includes(id);
              const isTaken = taken.includes(id);
              const fresh = state.others.includes(id);
              return <span key={id} data-part={`seat-${id}`} className={cn("grid size-6 place-items-center rounded-t-md rounded-b-sm border transition-colors duration-300", picked ? "border-foreground bg-foreground text-background" : isTaken ? "border-transparent bg-muted" : "border-border-strong", fresh && "bg-amber-500/30")}>{picked ? <Lock className="size-3" /> : null}</span>;
            })}
          </div>
        ))}
      </div>
      <Part id="hold" view={view} className="mt-4 border-t border-border pt-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{state.picked.length ? `Seats ${state.picked.join(", ")}` : "No seats selected"}</span>
          <span className="font-semibold tabular-nums">{money(state.picked.length * 65)}</span>
        </div>
        <Notice tone="neutral" icon={Lock} show={state.others.length > 0} className="mt-2">Another buyer just took C6. Your seats stay held for you until the timer runs out.</Notice>
      </Part>
    </SceneCard>
  );
}

const BOOTHS = [["A1", true], ["A2", true], ["A3", true], ["B1", false], ["B2", true], ["B3", false]];

// Expo: exhibitors reserve a booth from the hall map, and booth sales update.
function ExpoScene({ view }) {
  const { state } = view;
  const sold = BOOTHS.filter(([, s]) => s).length + (state.reserved ? 1 : 0);
  return (
    <SceneCard title="Expo hall" meta="Nightshift Conference · Hall 2">
      <div className="grid grid-cols-3 gap-2">
        {BOOTHS.map(([id, isSold]) => {
          const mine = state.reserved && id === "B3";
          return (
            <div key={id} data-part={`booth-${id}`} className={cn("grid h-11 place-items-center rounded-md border text-xs font-medium transition-colors duration-300", mine ? "border-foreground bg-foreground text-background" : isSold ? "border-transparent bg-muted text-muted-foreground" : state.selected === id ? "border-foreground" : "border-dashed border-border-strong")}>
              {mine ? "B3 · Soundcraft" : isSold ? `${id} · sold` : `${id} · open`}
            </div>
          );
        })}
      </div>
      <Part id="booth" view={view} className="mt-3 rounded-lg bg-muted px-3 py-2.5 text-sm">
        {state.selected ? <div className="flex justify-between"><span>Booth {state.selected} · 3 × 3 m · power included</span><span className="font-medium tabular-nums">{money(1200)}</span></div> : <span className="text-muted-foreground">Exhibitors pick an open booth</span>}
      </Part>
      <Button data-part="reserve" className="mt-3 w-full" variant={state.reserved ? "outline" : "default"} disabled={!state.selected}>{state.reserved ? <><Check className="size-3.5" />Reserved by Soundcraft</> : "Reserve booth"}</Button>
      <Part id="sales" view={view} className="mt-3 flex items-center justify-between text-sm">
        <span className="flex items-center gap-2 text-muted-foreground"><Store className="size-3.5" />{sold} of 6 booths sold</span>
        <span className="font-semibold tabular-nums">{money(sold * 1200)}</span>
      </Part>
    </SceneCard>
  );
}

// Live operations: counts move as guests scan in, and the room that needs attention is called out.
function LiveScene({ view }) {
  const { state } = view;
  const gates = [["Door A", 168 + state.tick * 9], ["Door B", 213 + state.tick * 14]];
  const main = 404 + state.tick * 20;
  return (
    <SceneCard title="Live operations" meta={`Nightshift 2026 · ${["21:40", "21:45", "21:50"][state.tick]}`}>
      <Part id="gates" view={view} className="space-y-3">
        {gates.map(([name, count]) => (
          <div key={name}>
            <div className="flex justify-between text-sm"><span>{name}</span><span className="tabular-nums text-muted-foreground">{count} in</span></div>
            <Bar value={(count / 260) * 100} className="mt-1.5" />
          </div>
        ))}
      </Part>
      <Part id="room" view={view} className="mt-4">
        <div className="flex justify-between text-sm"><span>Main room</span><span className="tabular-nums text-muted-foreground">{main} / 480</span></div>
        <Bar value={(main / 480) * 100} className="mt-1.5" />
      </Part>
      <Notice tone="warning" icon={AlertTriangle} show={main >= 440} className="mt-3"><span className="font-semibold">Main room is 92% full.</span> Door B is filling fastest.</Notice>
    </SceneCard>
  );
}

// Series: add the next date and the whole setup comes with it.
function SeriesScene({ view }) {
  const { state } = view;
  const dates = ["Fri 3 Oct", "Fri 10 Oct", "Fri 17 Oct", ...(state.added ? ["Fri 24 Oct"] : [])];
  return (
    <SceneCard title="Open Mic" meta="Series · The Loft · every Friday">
      <Part id="dates" view={view} className="space-y-2">
        {dates.map((date, index) => (
          <Row key={date} className={cn("py-2", index === 3 && "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1")}>
            <RowText title={date} meta={index === 3 ? "Copied: 3 ticket types, 60 capacity, page and form" : `${[58, 41, 12][index]} of 60 sold`} />
            <Pill tone={index === 3 ? "strong" : "neutral"}>{index === 3 ? "On sale" : index === 0 ? "Next" : "On sale"}</Pill>
          </Row>
        ))}
      </Part>
      <Button data-part="add-date" variant="outline" size="sm" className="mt-2 w-full"><Copy className="size-3.5" />Add next date</Button>
    </SceneCard>
  );
}

export const VENUE_PREVIEWS = {
  venues: {
    Scene: VenueScene,
    script: flow({ guests: "", shortlist: [] }, [
      { highlight: "list", caption: "Search venues near you on a map.", hold: 1000 },
      { cursor: "guests", type: "guests", set: { guests: "600" }, caption: "Enter your guest count, and venues that are too small drop out.", hold: 700 },
      { cursor: "shortlist-The Foundry", click: true, set: { shortlist: ["The Foundry"] }, caption: "Shortlist the ones that fit.", hold: 400 },
      { cursor: "shortlist-Mill Hall", click: true, set: { shortlist: ["The Foundry", "Mill Hall"] }, hold: 1500 },
    ]),
  },
  booking: {
    Scene: BookingScene,
    script: flow({ date: null, requested: false }, [
      { caption: "See which dates the venue has free.", hold: 1100 },
      { cursor: "date-14", click: true, set: { date: "14" }, highlight: "rate", caption: "Pick one to see the hire rate and deposit.", hold: 1000 },
      { cursor: "request", click: true, set: { requested: true }, caption: "Then request it without the email back-and-forth.", hold: 1800 },
    ]),
  },
  travel: {
    Scene: TravelScene,
    script: flow({ added: false, stage: 0 }, [
      { caption: "Find stays, stations and airports near the venue.", hold: 1100 },
      { cursor: "add-0", click: true, set: { added: true }, highlight: "pipeline", caption: "Add a hotel to your pipeline.", hold: 800 },
      { cursor: "stage-1", click: true, set: { stage: 1 }, caption: "Track it from first contact…", hold: 600 },
      { cursor: "stage-2", click: true, set: { stage: 2 }, caption: "…to an agreed room block.", hold: 1500 },
    ]),
  },
  library: {
    Scene: LibraryScene,
    script: flow({ used: null }, [
      { caption: "Every venue you've worked with, saved with its details.", hold: 1300 },
      { cursor: "use-The Foundry", click: true, set: { used: "The Foundry" }, highlight: "copied", caption: "Use one for your next event and the details come with it.", hold: 2100 },
    ]),
  },
  seats: {
    Scene: SeatScene,
    script: flow({ picked: [], hold: "15:00", others: [] }, [
      { caption: "Guests pick exact seats from the map.", hold: 900 },
      { cursor: "seat-C4", click: true, set: { picked: ["C4"] }, hold: 300 },
      { cursor: "seat-C5", click: true, set: { picked: ["C4", "C5"], hold: "14:58" }, caption: "Their seats are held while they pay.", hold: 800 },
      { set: { others: ["C6"], hold: "14:54" }, highlight: "hold", caption: "Other buyers can't take them, even when the seats next door sell.", hold: 2000 },
    ]),
  },
  expo: {
    Scene: ExpoScene,
    script: flow({ selected: null, reserved: false }, [
      { highlight: "sales", caption: "Exhibitors see which booths are still open.", hold: 1100 },
      { cursor: "booth-B3", click: true, set: { selected: "B3" }, highlight: "booth", caption: "They pick one to see its size and price.", hold: 800 },
      { cursor: "reserve", click: true, set: { reserved: true }, highlight: "sales", caption: "Reserve it, and your booth sales update.", hold: 1800 },
    ]),
  },
  live: {
    Scene: LiveScene,
    script: flow({ tick: 0 }, [
      { highlight: "gates", caption: "Watch every door as guests scan in.", hold: 1100 },
      { set: { tick: 1 }, highlight: "room", caption: "Room capacity updates with each scan.", hold: 1000 },
      { set: { tick: 2 }, caption: "When a room is nearly full, you'll know before it's a problem.", hold: 2200 },
    ]),
  },
  series: {
    Scene: SeriesScene,
    script: flow({ added: false }, [
      { highlight: "dates", caption: "A series keeps every date of a recurring event together.", hold: 1300 },
      { cursor: "add-date", click: true, set: { added: true }, highlight: "dates", caption: "Add the next date, and tickets, capacity, page and form are copied.", hold: 2100 },
    ]),
  },
};
