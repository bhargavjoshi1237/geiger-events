"use client";

import { useState } from "react";
import {
  Award,
  Bell,
  Building2,
  CalendarCheck,
  Captions,
  Check,
  ChevronDown,
  CirclePlay,
  Clock,
  Compass,
  Download,
  Heart,
  HelpCircle,
  LayoutGrid,
  Layers,
  LayoutTemplate,
  MapPin,
  Megaphone,
  Newspaper,
  Play,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Send,
  ShoppingBag,
  ThumbsUp,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  CARD,
  HEADER,
  LABEL,
  META,
  PANEL,
  TITLE,
  WELL,
  useVisibleInterval,
} from "@/components/landing/showcase_demos";

// Second wave of landing miniatures for the conferences-and-logistics story.
// Same rules as the first batch: drawn at the app's own type scale on the bare
// FeatureCard shelf, deterministic values so SSR matches client, and each one is
// a detail of a feature rather than a whole screen.

// Small pill used for counts, states, and live markers across the demos.
function Chip({ children, tone = "muted", className }) {
  const tones = {
    muted: "border-white/8 text-white/45",
    live: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    paid: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
    partial: "border-amber-500/25 bg-amber-500/10 text-amber-400",
    disputed: "border-red-500/25 bg-red-500/10 text-red-400",
    ok: "border-emerald-500/25 bg-emerald-500/10 text-emerald-400",
  };
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] leading-none",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

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
    id: "copley",
    name: "Copley Hall",
    area: "Back Bay · Boston",
    cap: "1,200",
    price: 29000,
    dist: "2.8 mi",
    pin: "left-[24%] top-[62%]",
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
          "mt-2.5 flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-colors",
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
  { id: "union", name: "Union House", rate: 154, left: 0, dist: "1.1 mi" },
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

/* ------------------------------------------------------------------ *
 * Program — "Run the content, not just the door"
 * ------------------------------------------------------------------ */

const AGENDA_TRACKS = ["Main", "Studio B", "Lab"];

const TRACK_ACCENTS = [
  { text: "text-sky-300", border: "border-sky-400/30", bg: "bg-sky-500/10" },
  { text: "text-indigo-300", border: "border-indigo-400/30", bg: "bg-indigo-500/10" },
  { text: "text-emerald-300", border: "border-emerald-400/30", bg: "bg-emerald-500/10" },
];

const AGENDA_ROWS = [
  {
    time: "09:00",
    cells: [
      { id: "a1", title: "Opening keynote", who: "Ada Chen", track: 0 },
      null,
      { id: "a3", title: "Workshop intake", who: "Tom Okafor", track: 2 },
    ],
  },
  {
    time: "11:00",
    cells: [
      { id: "b1", title: "Scaling live ops", who: "Marco Silva", track: 0 },
      { id: "b2", title: "Room design", who: "Priya Raman", track: 1 },
      null,
    ],
  },
  {
    time: "14:00",
    cells: [
      { id: "c1", title: "Keynote 2", who: "Ada Chen", track: 0, conflict: true },
      { id: "c2", title: "Fireside", who: "Ada Chen", track: 1, conflict: true },
      { id: "c3", title: "Hands-on lab", who: "Lena Fischer", track: 2 },
    ],
  },
  {
    time: "16:30",
    cells: [
      { id: "d1", title: "Closing", who: "Marco Silva", track: 0 },
      null,
      { id: "d3", title: "Retro", who: "Jonas Weber", track: 2 },
    ],
  },
];

// Agenda builder — sessions on tracks with live conflict detection.
export function AgendaBuilderDemo() {
  const [resolved, setResolved] = useState(false);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Agenda builder</span>
        <span className={META}>Day 1 · 3 tracks</span>
      </div>

      {resolved ? (
        <div className="mb-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] text-emerald-400">
          <Check className="h-3 w-3" />
          Conflict resolved — Ada Chen stays in Main
        </div>
      ) : (
        <div className="mb-2 flex shrink-0 items-center gap-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5">
          <span className="min-w-0 flex-1 truncate text-[11px] text-amber-300">
            Ada Chen is booked in two rooms at 14:00
          </span>
          <button
            type="button"
            onClick={() => setResolved(true)}
            className="shrink-0 rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
          >
            Swap
          </button>
        </div>
      )}

      <div className="grid shrink-0 grid-cols-[34px_1fr_1fr_1fr] gap-1 px-0.5 pb-1 text-[9px] uppercase tracking-wider text-white/30">
        <span />
        {AGENDA_TRACKS.map((track, index) => (
          <span key={track} className={TRACK_ACCENTS[index].text}>
            {track}
          </span>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
        {AGENDA_ROWS.map((row) => (
          <div key={row.time} className="grid grid-cols-[34px_1fr_1fr_1fr] items-stretch gap-1">
            <span className="pt-1 text-[10px] tabular-nums text-white/30">{row.time}</span>
            {row.cells.map((cell, index) => {
              if (!cell) {
                return (
                  <span
                    key={index}
                    className="rounded-md border border-dashed border-white/[0.07]"
                  />
                );
              }
              const accent = TRACK_ACCENTS[cell.track];
              const conflicted = cell.conflict && !resolved;
              const who = resolved && cell.id === "c2" ? "Ravi Patel" : cell.who;
              return (
                <button
                  key={cell.id}
                  type="button"
                  className={cn(
                    "rounded-md border px-1.5 py-1 text-left transition-colors",
                    accent.border,
                    accent.bg,
                    conflicted && "border-red-500/40 bg-red-500/[0.07]",
                  )}
                >
                  <span className="block truncate text-[10px] font-medium leading-tight text-white">
                    {cell.title}
                  </span>
                  <span
                    className={cn(
                      "block truncate text-[9px] leading-tight",
                      conflicted ? "text-red-400" : accent.text,
                    )}
                  >
                    {conflicted ? `${who} · double-booked` : who}
                  </span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

const SUBMISSIONS = [
  { id: "s1", title: "Scaling live ops with bounded queues", who: "Marco Silva", track: "Engineering", status: "new" },
  { id: "s2", title: "Designing for the doorless event", who: "Ada Chen", track: "Experience", status: "review" },
  { id: "s3", title: "Metrics that survive the afterparty", who: "Priya Raman", track: "Analytics", status: "accepted" },
  { id: "s4", title: "A tiny conference, run properly", who: "Tom Okafor", track: "Operations", status: "declined" },
];

// Call for papers — the submission queue feeding the agenda.
export function CallForPapersDemo() {
  const [statuses, setStatuses] = useState(
    Object.fromEntries(SUBMISSIONS.map((item) => [item.id, item.status])),
  );

  const set = (id, status) => setStatuses((prev) => ({ ...prev, [id]: status }));

  const pending = SUBMISSIONS.filter(
    (item) => statuses[item.id] === "new" || statuses[item.id] === "review",
  ).length;

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Call for papers</span>
        <span className={META}>{pending} to review</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {SUBMISSIONS.map((item) => {
          const status = statuses[item.id];
          const actionable = status === "new" || status === "review";
          return (
            <div
              key={item.id}
              className={cn(CARD, "flex items-center gap-2 px-3 py-2")}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {item.title}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {item.who} · {item.track}
                </div>
              </div>
              {actionable ? (
                <button
                  type="button"
                  onClick={() => set(item.id, "accepted")}
                  className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
                >
                  Accept
                </button>
              ) : (
                <Chip tone={status === "accepted" ? "ok" : "muted"}>
                  {status === "accepted" ? "Accepted" : "Declined"}
                </Chip>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5">
        <span className="text-[10px] text-white/35">214 submissions total</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-white/60">
          Review queue
          <ChevronDown className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

const SPEAKER_RUN = [
  { id: "ada", name: "Ada Chen", session: "Keynote · Main Hall 14:00" },
  { id: "marco", name: "Marco Silva", session: "Scaling live ops · 11:00" },
  { id: "lena", name: "Lena Fischer", session: "Hands-on lab · 14:00" },
];

const RUN_STAGES = ["confirmed", "in-room", "on-stage", "done"];
const STAGE_LABEL = {
  confirmed: "Confirmed",
  "in-room": "In green room",
  "on-stage": "On stage",
  done: "Wrapped",
};

// Speakers & CEU — the roster, run-of-show, and the credits attendees earn.
export function SpeakersCEUDemo() {
  const [stage, setStage] = useState({ ada: 0, marco: 0, lena: 0 });

  const advance = (id) =>
    setStage((prev) => ({
      ...prev,
      [id]: Math.min(RUN_STAGES.length - 1, prev[id] + 1),
    }));

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Speakers & CEU</span>
        <span className={META}>Run of show</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {SPEAKER_RUN.map((speaker) => {
          const step = stage[speaker.id];
          const on = RUN_STAGES[step];
          return (
            <div
              key={speaker.id}
              className={cn(CARD, "flex items-center gap-2 px-3 py-2")}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/10 bg-[#2b2b2b] text-[9px] font-medium text-white/60">
                {speaker.name.split(" ").map((part) => part[0]).join("")}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {speaker.name}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {speaker.session}
                </div>
              </div>
              <button
                type="button"
                onClick={() => advance(speaker.id)}
                className={cn(
                  "shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium transition-colors",
                  on === "on-stage"
                    ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : on === "done"
                      ? "border border-white/10 text-white/30"
                      : "bg-white/10 text-white hover:bg-white/20",
                )}
              >
                {STAGE_LABEL[on]}
              </button>
            </div>
          );
        })}
      </div>

      <div className={cn(CARD, "mt-2 flex shrink-0 items-center gap-2 px-3 py-2")}>
        <Award className="h-3.5 w-3.5 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-medium text-white">
            CEU & certificates
          </div>
          <div className={META}>6.0 hrs earned · 2 certs ready to send</div>
        </div>
        <button
          type="button"
          className="flex shrink-0 items-center gap-1 rounded-md bg-white px-2 py-1 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
        >
          <Download className="h-3 w-3" />
          Send
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Community — "The event doesn't stop between sessions"
 * ------------------------------------------------------------------ */

const QUESTIONS = [
  { id: "q1", text: "Will the livestream be captioned?", votes: 48, answered: true },
  { id: "q2", text: "Can recordings be shared with the team?", votes: 31, answered: false },
  { id: "q3", text: "Is there a quiet room on day two?", votes: 17, answered: false },
];

// Q&A — upvoted questions float to the room, answered ones are marked.
export function QADemo() {
  const [votes, setVotes] = useState(
    Object.fromEntries(QUESTIONS.map((item) => [item.id, item.votes])),
  );
  const [voted, setVoted] = useState({});

  const upvote = (id) => {
    if (voted[id]) return;
    setVoted((prev) => ({ ...prev, [id]: true }));
    setVotes((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  };

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Q&A · Main stage</span>
        <span className={META}>128 asked</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {QUESTIONS.map((item) => (
          <div key={item.id} className={cn(CARD, "flex items-start gap-2 px-3 py-2")}>
            <button
              type="button"
              onClick={() => upvote(item.id)}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-md border px-1.5 py-1 transition-colors",
                voted[item.id]
                  ? "border-indigo-400/40 bg-indigo-500/15 text-indigo-300"
                  : "border-white/10 text-white/40 hover:text-white",
              )}
            >
              <ThumbsUp className="h-3 w-3" />
              <span className="mt-0.5 text-[10px] tabular-nums">{votes[item.id]}</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] leading-snug text-white">{item.text}</div>
              {item.answered && (
                <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-emerald-400">
                  <Check className="h-3 w-3" />
                  Answered on stage
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center gap-2 rounded-lg border border-white/[0.07] bg-[#262626] px-2.5 py-1.5">
        <HelpCircle className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <span className="flex-1 text-[11px] text-white/35">Ask a question…</span>
        <Send className="h-3 w-3 shrink-0 text-white/30" />
      </div>
    </div>
  );
}

const POLL_OPTIONS = [
  { id: "a", label: "Right after the last session", votes: 128 },
  { id: "b", label: "An hour break, then party", votes: 94 },
  { id: "c", label: "Quiet hang at the hotel", votes: 41 },
];

// Live polls — results rendered as the votes land, visible to the whole room.
export function PollsDemo() {
  const [counts, setCounts] = useState(
    Object.fromEntries(POLL_OPTIONS.map((item) => [item.id, item.votes])),
  );
  const [mine, setMine] = useState(null);
  const ref = useVisibleInterval(() => {
    setCounts((prev) => ({ ...prev, a: prev.a + 1 }));
  }, 3000);

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  const vote = (id) => {
    if (mine) return;
    setMine(id);
    setCounts((prev) => ({ ...prev, [id]: prev[id] + 1 }));
  };

  return (
    <div className={PANEL} ref={ref}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Live poll</span>
        <Chip tone="live">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {total} votes
        </Chip>
      </div>

      <div className="mb-2 shrink-0 text-[12px] font-medium text-white">
        What&apos;s the best time for the afterparty?
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {POLL_OPTIONS.map((option) => {
          const count = counts[option.id];
          const pct = Math.round((count / total) * 100);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => vote(option.id)}
              className={cn(
                "relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors",
                mine === option.id
                  ? "border-indigo-400/40"
                  : "border-white/[0.07] bg-[#212121] hover:border-white/20",
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-indigo-500/15 transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
              <span className="relative flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-[11px] text-white">
                  {option.label}
                </span>
                {mine === option.id && (
                  <span className="shrink-0 text-[10px] font-medium text-indigo-300">
                    You voted
                  </span>
                )}
                <span className="shrink-0 text-[10px] tabular-nums text-white/45">
                  {pct}% · {count}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SLOTS = ["14:00", "14:30", "15:00", "15:30", "16:00", "16:30"];
const PRE_TAKEN = { "14:30": true, "15:30": true };

// Meeting scheduler — office hours with open slots left for the taking.
export function MeetingSchedulerDemo() {
  const [booked, setBooked] = useState({});
  const [mine, setMine] = useState(null);

  const take = (slot) => {
    if (mine || booked[slot]) return;
    setBooked((prev) => ({ ...prev, [slot]: true }));
    setMine(slot);
  };

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Meeting scheduler</span>
        <span className={META}>Office hours · Ada Chen</span>
      </div>

      <div className="grid shrink-0 grid-cols-3 gap-1.5">
        {SLOTS.map((slot) => {
          const taken = PRE_TAKEN[slot];
          const isMine = mine === slot;
          return (
            <button
              key={slot}
              type="button"
              onClick={() => take(slot)}
              className={cn(
                "flex items-center justify-center gap-1 rounded-md border py-2 text-[11px] transition-colors",
                isMine
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                  : taken
                    ? "border-white/[0.07] text-white/20 line-through"
                    : "border-white/10 text-white/60 hover:border-white/30 hover:text-white",
              )}
            >
              <Clock className="h-3 w-3" />
              {slot}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-2">
        <span className="text-[10px] text-white/35">
          {mine ? "Meeting request sent with the agenda attached" : "Pick a free slot to book 1:1"}
        </span>
        {mine && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-emerald-400">
            <Check className="h-3 w-3" />
            {mine} booked
          </span>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Broadcast & On-demand — "Hybrid without a second vendor"
 * ------------------------------------------------------------------ */

const CHAT_LINES = [
  { who: "Lena", text: "Captions on, thanks crew" },
  { who: "Jonas", text: "Slide 14 is from the talk this morning?" },
  { who: "Sofia", text: "Livestream is crisp in the sponsor room too" },
];

// Livestream rooms — a live room with presence, chat, and caption control.
export function LivestreamDemo() {
  const [viewers, setViewers] = useState(1214);
  const [captions, setCaptions] = useState(true);
  const ref = useVisibleInterval(() => setViewers((value) => value + 1), 2500);

  return (
    <div className={PANEL} ref={ref}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Livestream · Main stage</span>
        <Chip tone="live">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          {viewers.toLocaleString()} watching
        </Chip>
      </div>

      <div className="relative h-[104px] shrink-0 overflow-hidden rounded-lg border border-white/[0.07] bg-gradient-to-br from-indigo-500/15 via-[#1c1c1c] to-[#141414]">
        <span className="absolute left-2.5 top-2 flex items-center gap-1 rounded-full bg-red-500 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-white">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
          Live now
        </span>
        <div className="absolute inset-x-3 bottom-2.5 flex h-6 items-end gap-[3px]">
          {[6, 12, 18, 26, 20, 32, 24, 14, 30, 18, 26, 12].map((height, index) => (
            <span
              key={index}
              className="w-[3px] rounded-[2px] bg-white/25"
              style={{ height: `${height}px` }}
            />
          ))}
        </div>
        <span className="absolute bottom-3 left-3 text-[10px] text-white/45">
          Opening keynote · 4K
        </span>
      </div>

      {captions && (
        <div className="mt-1.5 shrink-0 rounded-md border border-white/[0.07] bg-[#212121] px-2.5 py-1.5 text-[11px] italic text-white/70">
          “…and that is exactly how a two-day event stays hybrid without a second vendor.”
        </div>
      )}

      <div className="mt-1.5 min-h-0 flex-1 space-y-1">
        {CHAT_LINES.map((line) => (
          <div key={`${line.who}-${line.text}`} className="flex items-baseline gap-1.5 text-[10px]">
            <span className="shrink-0 font-medium text-white/60">{line.who}</span>
            <span className="min-w-0 truncate text-white/40">{line.text}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between border-t border-white/5 pt-2">
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          <Captions className="h-3 w-3" />
          <button
            type="button"
            onClick={() => setCaptions((value) => !value)}
            className={cn(
              "rounded px-1.5 py-0.5 transition-colors",
              captions ? "bg-white/10 text-white" : "hover:bg-white/5",
            )}
          >
            Captions {captions ? "on" : "off"}
          </button>
        </div>
        <span className="text-[10px] text-white/30">English · auto</span>
      </div>
    </div>
  );
}

const REPLAYS = [
  { id: "r1", title: "Opening keynote", who: "Ada Chen", dur: "48 min", views: "1,204" },
  { id: "r2", title: "Scaling live ops", who: "Marco Silva", dur: "36 min", views: "892" },
  { id: "r3", title: "Sponsor showcase", who: "12 exhibitors", dur: "22 min", views: "441" },
];

// On-demand library — every session stays available after the room empties.
export function OnDemandDemo() {
  const [playing, setPlaying] = useState(null);

  const active = REPLAYS.find((item) => item.id === playing);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>On-demand library</span>
        <span className={META}>42 sessions</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {REPLAYS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setPlaying(item.id)}
            className={cn(
              CARD,
              "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors",
              playing === item.id && "border-indigo-400/40 bg-[#2a2a2a]",
            )}
          >
            <span className="grid h-7 w-10 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500/25 to-[#232323] text-white/70">
              <Play className="h-3 w-3" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-medium text-white">
                {item.title}
              </span>
              <span className="block truncate text-[10px] text-white/40">
                {item.who} · {item.dur} · {item.views} views
              </span>
            </span>
            {playing === item.id && (
              <CirclePlay className="h-3.5 w-3.5 shrink-0 text-indigo-300" />
            )}
          </button>
        ))}
      </div>

      {active ? (
        <div className="mt-2 shrink-0">
          <div className="flex items-center justify-between text-[10px] text-white/40">
            <span className="truncate">Now playing · {active.title}</span>
            <span className="shrink-0 tabular-nums">12:34 / 48:00</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
            <div className="h-full w-[26%] rounded-full bg-indigo-400/70" />
          </div>
        </div>
      ) : (
        <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5 text-[10px] text-white/35">
          <span>Replay is gated until the livestream ends</span>
          <span className="text-white/50">Browse all 42</span>
        </div>
      )}
    </div>
  );
}

const TRANSCRIPT = [
  { time: "00:12", who: "Ada Chen", text: "So the door isn't the whole event — it's where the content starts." },
  { time: "00:24", who: "Ada Chen", text: "We measured engagement against the agenda, and the afterparty won." },
  { time: "00:41", who: "Marco Silva", text: "And that changed how we schedule the second day entirely." },
  { time: "00:58", who: "Ada Chen", text: "Thank you — let's take questions from the room." },
];

// Captions & transcription — the talk becomes searchable the moment it's spoken.
export function CaptionsDemo() {
  const [captions, setCaptions] = useState(true);
  const [active, setActive] = useState(1);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Captions & transcription</span>
        <button
          type="button"
          onClick={() => setCaptions((value) => !value)}
          className={cn(
            "flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] transition-colors",
            captions
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
              : "border-white/10 text-white/40",
          )}
        >
          <Captions className="h-3 w-3" />
          {captions ? "On" : "Off"}
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-hidden">
        {TRANSCRIPT.map((line, index) => (
          <button
            key={line.time}
            type="button"
            onClick={() => setActive(index)}
            className={cn(
              "w-full rounded-md px-2.5 py-1.5 text-left transition-colors",
              active === index ? "bg-white/[0.07]" : "hover:bg-white/[0.03]",
            )}
          >
            <span className="flex items-center gap-2 text-[10px]">
              <span className="shrink-0 tabular-nums text-white/30">{line.time}</span>
              <span className="shrink-0 font-medium text-white/55">{line.who}</span>
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-white/80">
              {line.text}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between border-t border-white/5 pt-2 text-[10px] text-white/35">
        <span>98.7% accuracy · English</span>
        <span className="flex items-center gap-1 font-medium text-white/60">
          <Download className="h-3 w-3" />
          Export .vtt
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Orders — "what happens after money moves"
 * ------------------------------------------------------------------ */

const ORDERS = [
  { id: "NS-4821", name: "Priya Raman", amount: 240, status: "paid" },
  { id: "NS-4822", name: "Marco Silva", amount: 45, status: "paid" },
  { id: "NS-4823", name: "Ada Chen", amount: 240, status: "partial" },
  { id: "NS-4824", name: "Tom Okafor", amount: 120, status: "disputed" },
  { id: "NS-4825", name: "Lena Fischer", amount: 45, status: "refunded" },
];

const ORDER_TABS = ["All", "Paid", "Partial", "Refunded", "Disputed"];

// Order cockpit — every order, every state, one list.
export function OrdersCockpitDemo() {
  const [tab, setTab] = useState("All");
  const shown =
    tab === "All" ? ORDERS : ORDERS.filter((order) => order.status === tab.toLowerCase());

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Order cockpit</span>
        <span className={META}>Today · $12,480 · 214 orders</span>
      </div>

      <div className="mb-2 flex shrink-0 flex-wrap gap-1">
        {ORDER_TABS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setTab(item)}
            className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] transition-colors",
              tab === item
                ? "border-white/25 bg-white/10 text-white"
                : "border-white/[0.07] text-white/40 hover:text-white/70",
            )}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {shown.map((order) => (
          <div key={order.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
            <span
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                order.status === "paid"
                  ? "bg-emerald-400"
                  : order.status === "partial"
                    ? "bg-amber-400"
                    : order.status === "disputed"
                      ? "bg-red-400"
                      : "bg-white/25",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">
                {order.name}
              </div>
              <div className="truncate text-[10px] text-white/40">{order.id}</div>
            </div>
            <span className="shrink-0 text-[11px] tabular-nums text-white/80">
              ${order.amount}
            </span>
            <Chip tone={order.status === "refunded" ? "muted" : order.status}>
              {order.status}
            </Chip>
          </div>
        ))}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5">
        <span className="text-[10px] text-white/35">Payouts run twice daily</span>
        <span className="flex items-center gap-1 text-[10px] font-medium text-white/60">
          <ShoppingBag className="h-3 w-3" />
          Open cockpit
        </span>
      </div>
    </div>
  );
}

// Refunds — full or partial, with the money-path guard rails on screen.
export function RefundsDemo() {
  const [mode, setMode] = useState("full");
  const [issued, setIssued] = useState(false);
  const amount = mode === "full" ? 240 : 120;

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Refunds & cancellations</span>
        <span className={META}>Policy · refundable 48h</span>
      </div>

      <div className={cn(CARD, "mb-2 flex shrink-0 items-center justify-between px-3 py-2")}>
        <div className="min-w-0">
          <div className="text-[12px] font-medium text-white">Ada Chen · NS-4823</div>
          <div className={META}>VIP + Afterparty ×2 · paid $240</div>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-white/60">3h ago</span>
      </div>

      <div className={cn(LABEL, "shrink-0")}>Refund amount</div>
      <div className="mt-1.5 grid shrink-0 grid-cols-2 gap-1.5">
        {[
          { id: "full", label: "Full", value: "$240" },
          { id: "half", label: "Partial", value: "$120" },
        ].map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              setMode(option.id);
              setIssued(false);
            }}
            className={cn(
              "rounded-md border px-2 py-1.5 text-left transition-colors",
              mode === option.id
                ? "border-white/25 bg-white/10"
                : "border-white/[0.07] text-white/45 hover:text-white/70",
            )}
          >
            <div className="text-[11px] text-white">{option.label}</div>
            <div className="text-[10px] tabular-nums text-white/40">{option.value}</div>
          </button>
        ))}
      </div>

      <div className={cn(LABEL, "mt-2.5 shrink-0")}>Reason</div>
      <div className="mt-1.5 flex shrink-0 items-center justify-between rounded-md border border-white/[0.08] bg-[#262626] px-2.5 py-1.5 text-[11px] text-white/70">
        Buyer request · change of plans
        <ChevronDown className="h-3 w-3 text-white/30" />
      </div>

      <button
        type="button"
        onClick={() => setIssued(true)}
        disabled={issued}
        className={cn(
          "mt-2.5 flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg text-[11px] font-medium transition-colors",
          issued
            ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
            : "bg-white text-zinc-950 hover:bg-white/90",
        )}
      >
        {issued ? (
          <>
            <Check className="h-3 w-3" />
            ${amount} refunded · back to card in 5–7 days
          </>
        ) : (
          <>
            <RotateCcw className="h-3 w-3" />
            Issue ${amount} refund
          </>
        )}
      </button>
    </div>
  );
}

const DISPUTES = [
  { id: "d1", order: "NS-4824 · Tom Okafor", amount: 120, reason: "Fraud", deadline: "3d left", status: "evidence" },
  { id: "d2", order: "NS-4799 · Iris Nakamura", amount: 45, reason: "Not as described", deadline: "6d left", status: "won" },
  { id: "d3", order: "NS-4903 · Hugo Alves", amount: 240, reason: "Duplicate charge", deadline: "1d left", status: "review" },
];

// Disputes & chargebacks — evidence windows the card networks actually give you.
export function DisputesDemo() {
  const [statuses, setStatuses] = useState(
    Object.fromEntries(DISPUTES.map((item) => [item.id, item.status])),
  );

  const submit = (id) => setStatuses((prev) => ({ ...prev, [id]: "review" }));

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Disputes & chargebacks</span>
        <span className={META}>$11,800 open</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {DISPUTES.map((item) => {
          const status = statuses[item.id];
          return (
            <div key={item.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {item.order}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {item.reason} · ${item.amount} · {item.deadline}
                </div>
              </div>
              {status === "evidence" ? (
                <button
                  type="button"
                  onClick={() => submit(item.id)}
                  className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[10px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
                >
                  Submit evidence
                </button>
              ) : (
                <Chip tone={status === "review" ? "live" : "ok"}>
                  {status === "review" ? "Under review" : "Won"}
                </Chip>
              )}
            </div>
          );
        })}
      </div>

      <div className="mt-2 flex shrink-0 items-center justify-between rounded-lg border border-dashed border-white/10 px-2.5 py-1.5">
        <span className="flex items-center gap-1 text-[10px] text-white/35">
          <Scale className="h-3 w-3" />
          Chargebacks auto-defend from your ticket policy
        </span>
        <span className="text-[10px] font-medium text-white/60">Open dispute center</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Distribution & growth — campaigns, advertising, discovery
 * ------------------------------------------------------------------ */

const CAMPAIGNS = [
  { id: "c1", kind: "Newsletter", name: "March lineup", meta: "8,400 recipients · 61% open", icon: Newspaper, active: true },
  { id: "c2", kind: "Ad campaign", name: "Retargeting — VIP", meta: "$1,200 budget · $0.34 / result", icon: Megaphone, active: true },
  { id: "c3", kind: "Auto reminder", name: "T-minus 7 days", meta: "12,400 delivered · 98.2%", icon: Bell, active: false },
];

// Campaigns & advertising — one place for the emails, reminders, and paid ads.
export function CampaignsAdvertisingDemo() {
  const [active, setActive] = useState(
    Object.fromEntries(CAMPAIGNS.map((item) => [item.id, item.active])),
  );

  const toggle = (id) => setActive((prev) => ({ ...prev, [id]: !prev[id] }));

  const liveCount = CAMPAIGNS.filter((item) => active[item.id]).length;
  const spend = active.c2 ? 2400 : 1200;

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Campaigns & advertising</span>
        <span className={META}>{liveCount} live</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5">
        {CAMPAIGNS.map((item) => {
          const Icon = item.icon;
          const on = active[item.id];
          return (
            <div key={item.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
              <span
                className={cn(
                  "grid h-6 w-6 shrink-0 place-items-center rounded-md border",
                  on ? "border-indigo-400/30 bg-indigo-500/10 text-indigo-300" : "border-white/10 text-white/30",
                )}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12px] font-medium text-white">
                  {item.name}
                </div>
                <div className="truncate text-[10px] text-white/40">
                  {item.kind} · {item.meta}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggle(item.id)}
                className={cn(
                  "relative h-4 w-7 shrink-0 rounded-full transition-colors",
                  on ? "bg-emerald-500/80" : "bg-white/15",
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                    on ? "left-3.5" : "left-0.5",
                  )}
                />
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-2 shrink-0">
        <div className="flex items-center justify-between text-[10px] text-white/40">
          <span>Ad budget · this month</span>
          <span className="tabular-nums">
            ${spend.toLocaleString()} / $3,000
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-indigo-400/70"
            style={{ width: `${Math.min(100, (spend / 3000) * 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

const WALL_EVENTS = [
  { id: "w1", name: "Nightshift 2026", date: "Sat 14 Mar", status: "Selling" },
  { id: "w2", name: "Nightshift Day", date: "Sun 15 Mar", status: "Apply" },
  { id: "w3", name: "Nightshift Open Labs", date: "Fri 20 Mar", status: "Selling" },
];

// Discovery — an organizer profile and public wall buyers can follow.
export function DiscoveryDemo() {
  const [following, setFollowing] = useState(false);
  const followers = 4200 + (following ? 1 : 0);

  return (
    <div className={PANEL}>
      <div className="mb-2 flex shrink-0 items-center justify-between">
        <span className={TITLE}>Discovery & distribution</span>
        <button
          type="button"
          onClick={() => setFollowing((value) => !value)}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium transition-colors",
            following
              ? "border-white/25 bg-white/10 text-white"
              : "bg-white text-zinc-950 hover:bg-white/90",
          )}
        >
          <Heart className={cn("h-3 w-3", following && "fill-red-400 text-red-400")} />
          {following ? "Following" : "Follow"}
        </button>
      </div>

      <div className={cn(CARD, "mb-2 flex shrink-0 items-center gap-2.5 px-3 py-2")}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-indigo-500/40 to-[#2b2b2b] text-[10px] font-semibold text-white">
          NS
        </span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-medium text-white">
            Nightshift Live
          </div>
          <div className={META}>
            {followers.toLocaleString()} followers · geiger.events/w/nightshift
          </div>
        </div>
      </div>

      <div className={cn(LABEL, "shrink-0")}>Upcoming on the wall</div>
      <div className="mt-1.5 min-h-0 flex-1 space-y-1.5">
        {WALL_EVENTS.map((event) => (
          <div key={event.id} className={cn(CARD, "flex items-center gap-2 px-3 py-2")}>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[12px] font-medium text-white">
                {event.name}
              </div>
              <div className="truncate text-[10px] text-white/40">{event.date}</div>
            </div>
            <Chip tone={event.status === "Selling" ? "live" : "muted"}>{event.status}</Chip>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Run many events — templates, series, and the public wall
 * ------------------------------------------------------------------ */

const TEMPLATES = [
  { id: "conf", name: "Conference", meta: "used by 12 events", icon: LayoutTemplate },
  { id: "summit", name: "Summit", meta: "used by 7 events", icon: LayoutGrid },
  { id: "launch", name: "Product launch", meta: "used by 9 events", icon: Zap },
];

const SERIES_EVENTS = [
  { date: "Sat 14 Mar", venue: "The Foundry", status: "Selling" },
  { date: "Sun 15 Mar", venue: "The Foundry", status: "Selling" },
  { date: "Fri 20 Mar", venue: "The Mill", status: "Planned" },
  { date: "Sat 21 Mar", venue: "The Mill", status: "Planned" },
];

// Templates, series, and the event wall — the second event is the first one
// reused, not rebuilt.
export function RunManyEventsDemo() {
  const [view, setView] = useState("Series");
  const [template, setTemplate] = useState("conf");

  const active = TEMPLATES.find((item) => item.id === template);

  return (
    <div className={WELL}>
      <div className={HEADER}>
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-white/60" />
          <span className={TITLE}>Run many events</span>
        </div>
        <div className="flex items-center gap-1">
          {["Templates", "Series", "Wall"].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setView(item)}
              className={cn(
                "rounded px-2 py-0.5 text-[10px] transition-colors",
                view === item ? "bg-white/10 text-white" : "text-white/40 hover:text-white/70",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      {view === "Templates" && (
        <div className="flex min-h-0 flex-1 gap-2.5 p-3">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5">
            {TEMPLATES.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTemplate(item.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-md border px-2.5 py-2 text-left transition-colors",
                    template === item.id
                      ? "border-white/25 bg-[#242424]"
                      : "border-white/5 hover:border-white/15",
                  )}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-indigo-400/30 bg-indigo-500/10 text-indigo-300">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12px] font-medium text-white">
                      {item.name}
                    </span>
                    <span className="block truncate text-[10px] text-white/40">
                      {item.meta}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex min-h-0 flex-[2] flex-col gap-2">
            <div className="flex h-9 items-center justify-center rounded-md border border-dashed border-white/10 text-[11px] text-white/35">
              New event from template
            </div>
            <div className="flex h-9 items-center justify-center rounded-md border border-white/[0.07] bg-[#212121] px-2.5 text-[11px] text-white">
              {active.name} · Sat 14 Mar
            </div>
            <div className="flex h-9 items-center justify-center rounded-md border border-white/[0.07] bg-[#212121] px-2.5 text-[11px] text-white/60">
              The Foundry · 1,800 cap
            </div>
            <button
              type="button"
              className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-white text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
            >
              <Plus className="h-3 w-3" />
              Create event
            </button>
          </div>
        </div>
      )}

      {view === "Series" && (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="flex shrink-0 items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-white">
                Nightshift 2026 · series of 4
              </div>
              <div className={META}>Template: Conference · runs Fri → Sat</div>
            </div>
            <Chip tone="live">Live</Chip>
          </div>
          <div className="mt-3 min-h-0 flex-1 space-y-1.5">
            {SERIES_EVENTS.map((event, index) => (
              <div
                key={`${event.date}-${event.venue}`}
                className="flex shrink-0 items-center gap-2 rounded-md border border-white/[0.07] bg-[#212121] px-3 py-2"
              >
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/10 text-[9px] tabular-nums text-white/40">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[12px] font-medium text-white">
                    {event.date}
                  </div>
                  <div className="truncate text-[10px] text-white/40">{event.venue}</div>
                </div>
                <Chip tone={event.status === "Selling" ? "live" : "muted"}>{event.status}</Chip>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "Wall" && (
        <div className="flex min-h-0 flex-1 flex-col p-3">
          <div className="flex shrink-0 items-center justify-between">
            <div>
              <div className="text-[13px] font-medium text-white">Public event wall</div>
              <div className={META}>geiger.events/w/nightshift · 4,201 followers</div>
            </div>
            <Compass className="h-3.5 w-3.5 text-white/40" />
          </div>
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-3 gap-2">
            {SERIES_EVENTS.slice(0, 3).map((event, index) => (
              <div
                key={`${event.date}-wall`}
                className="flex flex-col justify-between rounded-md border border-white/[0.07] bg-gradient-to-br from-indigo-500/10 to-[#212121] p-2.5"
              >
                <div>
                  <div className="text-[10px] tabular-nums text-white/40">{event.date}</div>
                  <div className="mt-0.5 text-[11px] font-medium leading-tight text-white">
                    Nightshift {index + 1}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-[9px] text-white/40">{event.venue}</span>
                  <span className="grid h-5 w-5 place-items-center rounded-full border border-white/15 text-white/40">
                    <Heart className="h-2.5 w-2.5" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex shrink-0 items-center justify-between border-t border-white/5 px-3 py-2 text-[10px] text-white/30">
        <span>Nightshift 2026 · created from the Conference template</span>
        <span className="flex items-center gap-1">
          <Check className="h-3 w-3 text-emerald-400" />
          Saved
        </span>
      </div>
    </div>
  );
}
