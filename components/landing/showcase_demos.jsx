"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Clock,
  Minus,
  Plus,
  QrCode,
  Radio,
  ScanLine,
  Search,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";

import { cn } from "@/lib/utils";

// Hands-on miniatures of real product surfaces for the landing showcase cards.
// They are drawn at the app's own type scale — 13px rows, 11px meta — and the
// card's well crops whatever overflows, rather than shrinking a whole screen
// down until it stops being readable. Every value is deterministic so the client
// render matches SSR.

export const WELL = "flex h-full w-full flex-col bg-[#1a1a1a]";
// Feature-detail previews sit directly on the card's own shelf, so they carry no
// surface of their own — only their rows do.
export const PANEL = "flex h-full w-full flex-col p-3.5";
export const HEADER =
  "flex shrink-0 items-center justify-between border-b border-white/5 px-3.5 py-2.5";
export const TITLE = "text-[13px] font-medium text-white";
export const META = "text-[11px] text-white/40";
export const LABEL = "text-[10px] uppercase tracking-wider text-white/35";
export const CARD = "rounded-lg border border-white/[0.07] bg-[#212121]";

// Ticks on an interval, but only while the element is on screen — the landing
// page must not run timers for demos nobody is looking at.
export function useVisibleInterval(callback, ms, enabled = true) {
  const ref = useRef(null);
  const saved = useRef(callback);

  useEffect(() => {
    saved.current = callback;
  }, [callback]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let timer = null;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !timer) {
        timer = setInterval(() => saved.current(), ms);
      } else if (!entry.isIntersecting && timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      if (timer) clearInterval(timer);
    };
  }, [ms, enabled]);

  return ref;
}

function Stepper({ value, onAdd, onRemove, label }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <button
        type="button"
        aria-label={`Remove one ${label}`}
        onClick={onRemove}
        className="grid h-6 w-6 place-items-center rounded-md border border-white/10 text-white/50 transition-colors hover:border-white/25 hover:text-white"
      >
        <Minus className="h-3 w-3" />
      </button>
      <span className="w-4 text-center text-[13px] font-medium tabular-nums text-white">
        {value}
      </span>
      <button
        type="button"
        aria-label={`Add one ${label}`}
        onClick={onAdd}
        className="grid h-6 w-6 place-items-center rounded-md border border-white/10 text-white/50 transition-colors hover:border-white/25 hover:text-white"
      >
        <Plus className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Surfaces — "Everywhere your event happens"
 * ------------------------------------------------------------------ */

const TIERS = [
  { id: "ga", name: "General Admission", price: 45, left: 128 },
  { id: "vip", name: "VIP + Afterparty", price: 120, left: 12 },
  { id: "early", name: "Early Bird", price: 32, soldOut: true },
];

const FEE_RATE = 0.06;

// Event page — the public /e/<id> page: tiers, urgency, fees, checkout.
export function EventPageDemo() {
  const [qty, setQty] = useState({ ga: 2, vip: 0, early: 0 });

  const bump = (id, delta) =>
    setQty((prev) => ({ ...prev, [id]: Math.max(0, Math.min(9, prev[id] + delta)) }));

  const { count, subtotal } = useMemo(() => {
    let count = 0;
    let subtotal = 0;
    for (const tier of TIERS) {
      count += qty[tier.id];
      subtotal += qty[tier.id] * tier.price;
    }
    return { count, subtotal };
  }, [qty]);

  const fees = subtotal * FEE_RATE;

  return (
    <div className={WELL}>
      <div className="relative h-[76px] shrink-0 overflow-hidden border-b border-white/5 bg-gradient-to-br from-indigo-500/20 via-indigo-500/[0.06] to-transparent">
        <div className="absolute inset-x-3.5 bottom-2.5">
          <div className="text-[15px] font-semibold leading-tight text-white">
            Nightshift 2026
          </div>
          <div className="mt-0.5 text-[11px] text-white/55">
            Sat 14 Mar · 21:00 · The Foundry
          </div>
        </div>
      </div>

      <div className="flex-1 space-y-2 p-3">
        {TIERS.map((tier) => (
          <div
            key={tier.id}
            className={cn(
              CARD,
              "flex items-center justify-between gap-2 px-3 py-2.5",
              tier.soldOut && "opacity-45",
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-white">
                {tier.name}
              </div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px]">
                {tier.soldOut ? (
                  <span className="text-white/40">Sold out</span>
                ) : (
                  <>
                    <span className="text-white/70">${tier.price}</span>
                    <span className="text-white/25">·</span>
                    <span
                      className={tier.left < 20 ? "text-amber-400" : "text-white/40"}
                    >
                      {tier.left} left
                    </span>
                  </>
                )}
              </div>
            </div>
            {tier.soldOut ? (
              <span className="shrink-0 rounded-md border border-white/10 px-2 py-1 text-[11px] text-white/40">
                Closed
              </span>
            ) : (
              <Stepper
                label={tier.name}
                value={qty[tier.id]}
                onAdd={() => bump(tier.id, 1)}
                onRemove={() => bump(tier.id, -1)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/5 px-3.5 py-3">
        <div className="flex items-center justify-between text-[11px] text-white/45">
          <span>Subtotal · {count === 1 ? "1 ticket" : `${count} tickets`}</span>
          <span className="tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-white/45">
          <span>Service fee</span>
          <span className="tabular-nums">${fees.toFixed(2)}</span>
        </div>
        <div
          className={cn(
            "mt-2.5 flex h-9 items-center justify-center rounded-lg text-[13px] font-medium transition-colors",
            count ? "bg-white text-zinc-950" : "border border-white/10 text-white/30",
          )}
        >
          {count ? `Pay $${(subtotal + fees).toFixed(2)}` : "Select a ticket"}
        </div>
      </div>
    </div>
  );
}

// Deterministic arrival queue; the repeat of Marco shows the double-scan guard.
const ARRIVALS = [
  { name: "Priya Raman", tier: "VIP", time: "21:04", ok: true },
  { name: "Marco Silva", tier: "General", time: "21:04", ok: true },
  { name: "Marco Silva", tier: "General", time: "21:05", ok: false },
  { name: "Ada Chen", tier: "General", time: "21:05", ok: true },
  { name: "Tom Okafor", tier: "Crew", time: "21:06", ok: true },
];

const CAPACITY = 1800;

// The door — QR scanning, the duplicate guard, and the offline queue.
export function DoorDemo() {
  const [scanned, setScanned] = useState([]);
  const [online, setOnline] = useState(true);

  const admitted = 1204 + scanned.filter((entry) => entry.ok).length;
  const feed = scanned.slice(-3).reverse();
  const pct = Math.round((admitted / CAPACITY) * 100);

  const scan = () =>
    setScanned((prev) => [...prev, ARRIVALS[prev.length % ARRIVALS.length]]);

  return (
    <div className={WELL}>
      <div className={HEADER}>
        <div className="flex items-center gap-1.5">
          <ScanLine className="h-3.5 w-3.5 text-white/60" />
          <span className={TITLE}>Main Gate</span>
        </div>
        <button
          type="button"
          onClick={() => setOnline((value) => !value)}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] transition-colors",
            online
              ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
              : "border-amber-500/25 bg-amber-500/10 text-amber-400",
          )}
        >
          {online ? <Wifi className="h-2.5 w-2.5" /> : <WifiOff className="h-2.5 w-2.5" />}
          {online ? "Online" : "Offline"}
        </button>
      </div>

      <div className="shrink-0 px-3.5 pt-3">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[26px] font-semibold leading-none tabular-nums text-white">
            {admitted.toLocaleString("en-US")}
          </span>
          <span className="text-[11px] text-white/40">
            / {CAPACITY.toLocaleString("en-US")} inside
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-white/35">
          <span>{pct}% of capacity</span>
          <span>{online ? "Synced" : `${scanned.length} queued`}</span>
        </div>
      </div>

      <div className="flex-1 space-y-1.5 p-3">
        {feed.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-white/8 text-[11px] text-white/25">
            Waiting for the first scan
          </div>
        ) : (
          feed.map((entry, index) => (
            <div
              key={`${entry.name}-${scanned.length - index}`}
              className={cn(
                CARD,
                "flex items-center gap-2.5 px-3 py-2",
                !entry.ok && "border-red-500/25 bg-red-500/[0.07]",
              )}
            >
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-medium",
                  entry.ok
                    ? "bg-emerald-500/15 text-emerald-400"
                    : "bg-red-500/15 text-red-400",
                )}
              >
                {entry.ok ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white">
                  {entry.name}
                </div>
                <div className={cn("truncate", META)}>
                  {entry.ok ? `${entry.tier} · ${entry.time}` : "Already scanned 21:04"}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-white/5 p-3">
        <button
          type="button"
          onClick={scan}
          className="flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-white text-[13px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
        >
          <QrCode className="h-4 w-4" />
          Scan next ticket
        </button>
      </div>
    </div>
  );
}

const PORTAL_TABS = [
  { id: "agenda", label: "Agenda" },
  { id: "ticket", label: "Ticket" },
  { id: "live", label: "Live" },
];

const SESSIONS = [
  { time: "09:30", title: "Opening keynote", who: "Ada Chen", room: "Main Hall" },
  { time: "11:00", title: "Scaling live ops", who: "Marco Silva", room: "Studio B" },
  { time: "14:15", title: "Sponsor showcase", who: "12 exhibitors", room: "Expo Floor" },
];

// Attendee pocket — the members portal and the branded mobile event app.
export function PortalDemo() {
  const [tab, setTab] = useState("agenda");
  const [saved, setSaved] = useState(["11:00"]);

  const toggle = (time) =>
    setSaved((prev) =>
      prev.includes(time) ? prev.filter((t) => t !== time) : [...prev, time],
    );

  // The phone bezel comes from the card's DeviceFrame, so this draws the screen
  // only — status bar down.
  return (
    <div className="flex h-full w-full">
      <div className="flex h-full w-full flex-col overflow-hidden bg-[#151515]">
        <div className="flex shrink-0 items-center justify-between px-3.5 pb-1.5 pt-2.5">
          <span className="text-[10px] font-medium tabular-nums text-white/50">9:41</span>
          <span className="h-1 w-10 rounded-full bg-white/15" />
          <span className="text-[10px] text-white/30">100%</span>
        </div>

        <div className="shrink-0 px-3 pb-2">
          <div className="text-[13px] font-semibold text-white">Nightshift 2026</div>
          <div className="text-[10px] text-white/35">VIP · Day 1 of 2</div>
        </div>

        <div className="flex shrink-0 gap-1 px-3 pb-2">
          {PORTAL_TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex-1 rounded-full py-1.5 text-[11px] font-medium transition-colors",
                tab === item.id
                  ? "bg-white text-zinc-950"
                  : "bg-white/[0.06] text-white/45 hover:text-white/75",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden px-3">
          {tab === "agenda" &&
            SESSIONS.map((session) => (
              <button
                key={session.time}
                type="button"
                onClick={() => toggle(session.time)}
                className={cn(CARD, "flex w-full items-center gap-2 px-2.5 py-2 text-left")}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] tabular-nums text-white/40">
                    {session.time}
                  </div>
                  <div className="truncate text-[12px] font-medium text-white">
                    {session.title}
                  </div>
                  <div className="truncate text-[10px] text-white/35">
                    {session.who} · {session.room}
                  </div>
                </div>
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
                    saved.includes(session.time)
                      ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-400"
                      : "border-white/15 text-white/30",
                  )}
                >
                  {saved.includes(session.time) ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </span>
              </button>
            ))}

          {tab === "ticket" && (
            <div className={cn(CARD, "p-3 text-center")}>
              <div className="mx-auto grid h-[104px] w-[104px] place-items-center rounded-lg bg-white">
                <QrCode className="h-[88px] w-[88px] text-zinc-950" strokeWidth={1} />
              </div>
              <div className="mt-2 text-[12px] font-medium text-white">
                VIP + Afterparty
              </div>
              <div className="text-[10px] tabular-nums text-white/40">
                Seat A-118 · #NS-4821
              </div>
              <div className="mt-2 rounded-md bg-white/10 py-1.5 text-[10px] font-medium text-white">
                Add to Apple Wallet
              </div>
            </div>
          )}

          {tab === "live" && (
            <>
              <div className={cn(CARD, "p-2.5")}>
                <div className="flex items-center gap-1 text-[10px] font-medium text-red-400">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
                  LIVE NOW
                </div>
                <div className="mt-1 text-[12px] font-medium text-white">
                  Main stage stream
                </div>
                <div className="text-[10px] text-white/35">412 watching · 4K</div>
              </div>
              <div className={cn(CARD, "p-2.5")}>
                <div className="text-[12px] font-medium text-white">Sponsor rooms</div>
                <div className="text-[10px] text-white/35">6 open · 2 with Q&amp;A</div>
              </div>
              <div className={cn(CARD, "p-2.5")}>
                <div className="text-[12px] font-medium text-white">Replays</div>
                <div className="text-[10px] text-white/35">18 sessions on demand</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

const GUESTS = [
  { name: "Ada Chen", tier: "VIP", order: "#NS-4821" },
  { name: "Tom Okafor", tier: "General", order: "#NS-4903" },
  { name: "Priya Raman", tier: "VIP", order: "#NS-4712" },
];

const ENTITLEMENTS = {
  "Ada Chen": [
    { id: "tee", label: "Crew tee · L", from: "VIP ticket" },
    { id: "tote", label: "Welcome tote", from: "Add-on purchase" },
    { id: "badge", label: "Printed badge", from: "All attendees" },
  ],
  "Tom Okafor": [
    { id: "tote", label: "Welcome tote", from: "Add-on purchase" },
    { id: "badge", label: "Printed badge", from: "All attendees" },
  ],
  "Priya Raman": [
    { id: "tee", label: "Crew tee · M", from: "VIP ticket" },
    { id: "badge", label: "Printed badge", from: "All attendees" },
    { id: "drink", label: "Drink token ×2", from: "Membership plan" },
  ],
};

// Staff desk — the code-gated /issue desk handing stock to buyers, with the
// double-collect guard that also lives in the database.
export function StaffDeskDemo() {
  const [guest, setGuest] = useState("Ada Chen");
  const [collected, setCollected] = useState({ "Ada Chen": ["badge"] });
  const [blocked, setBlocked] = useState(null);

  const taken = collected[guest] ?? [];
  const items = ENTITLEMENTS[guest] ?? [];
  const active = GUESTS.find((person) => person.name === guest) ?? GUESTS[0];

  const issue = (id) => {
    if (taken.includes(id)) {
      setBlocked(id);
      return;
    }
    setBlocked(null);
    setCollected((prev) => ({ ...prev, [guest]: [...(prev[guest] ?? []), id] }));
  };

  return (
    <div className={WELL}>
      <div className="shrink-0 border-b border-white/5 p-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-[#212121] px-2.5 py-2">
          <Search className="h-3.5 w-3.5 shrink-0 text-white/35" />
          <span className="text-[12px] text-white/35">Search name or order…</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {GUESTS.map((person) => (
            <button
              key={person.name}
              type="button"
              onClick={() => {
                setGuest(person.name);
                setBlocked(null);
              }}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                guest === person.name
                  ? "border-white/25 bg-white/10 text-white"
                  : "border-white/[0.07] text-white/40 hover:text-white/70",
              )}
            >
              {person.name.split(" ")[0]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between px-3.5 py-2.5">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-medium text-white">{active.name}</div>
          <div className={META}>
            {active.tier} · {active.order}
          </div>
        </div>
        <span className="shrink-0 text-[11px] tabular-nums text-white/35">
          {taken.length}/{items.length} out
        </span>
      </div>

      <div className="flex-1 space-y-1.5 px-3 pb-3">
        {items.map((item) => {
          const done = taken.includes(item.id);
          return (
            <div
              key={item.id}
              className={cn(
                CARD,
                "flex items-center justify-between gap-2 px-3 py-2",
                blocked === item.id && "border-red-500/30 bg-red-500/[0.07]",
              )}
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-white">
                  {item.label}
                </div>
                <div
                  className={cn(
                    "truncate text-[11px]",
                    blocked === item.id ? "text-red-400" : "text-white/40",
                  )}
                >
                  {blocked === item.id ? "Already collected 18:22" : item.from}
                </div>
              </div>
              <button
                type="button"
                onClick={() => issue(item.id)}
                className={cn(
                  "shrink-0 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  done
                    ? "border border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : "bg-white text-zinc-950 hover:bg-white/90",
                )}
              >
                {done ? "Collected" : "Issue"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Registrations — "Not every event just sells a ticket"
 *
 * Deliberately quieter than the surface miniatures above: no device chrome,
 * one accent each, few rows. These sit on a bare shelf and read as a detail of
 * a feature, not as another whole screen.
 * ------------------------------------------------------------------ */

const FORM_FIELDS = [
  { id: "name", label: "Full name", type: "Text", required: true },
  { id: "email", label: "Work email", type: "Email", required: true },
  { id: "company", label: "Company & role", type: "Text", required: false },
  { id: "why", label: "Why do you want to attend?", type: "Long text", required: true },
];

// Pulled in one at a time by "Add field", so the builder has somewhere to go.
const SPARE_FIELDS = [
  { id: "diet", label: "Dietary needs", type: "Select", required: false },
  { id: "access", label: "Accessibility needs", type: "Long text", required: false },
  { id: "referral", label: "Who referred you?", type: "Text", required: false },
];

// Registration forms — the questions an applicant answers before they get in.
export function RegistrationFormDemo() {
  const [fields, setFields] = useState(FORM_FIELDS);

  const toggle = (id) =>
    setFields((prev) =>
      prev.map((field) =>
        field.id === id ? { ...field, required: !field.required } : field,
      ),
    );

  const addField = () => {
    const next = SPARE_FIELDS.find(
      (spare) => !fields.some((field) => field.id === spare.id),
    );
    if (next) setFields((prev) => [...prev, next]);
  };

  const exhausted = fields.length >= FORM_FIELDS.length + SPARE_FIELDS.length;

  return (
    <div className={PANEL}>
      <div className="mb-2.5 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Apply to attend</span>
        <span className={META}>{fields.filter((f) => f.required).length} required</span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {fields.map((field) => (
          <button
            key={field.id}
            type="button"
            onClick={() => toggle(field.id)}
            className={cn(
              CARD,
              "flex w-full items-center justify-between gap-2 px-3 py-2 text-left transition-colors hover:border-white/15",
            )}
          >
            <div className="min-w-0">
              <div className="truncate text-[13px] text-white">{field.label}</div>
              <div className={META}>{field.type}</div>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-md border px-2 py-0.5 text-[10px] transition-colors",
                field.required
                  ? "border-white/20 bg-white/10 text-white/80"
                  : "border-white/[0.07] text-white/30",
              )}
            >
              {field.required ? "Required" : "Optional"}
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={addField}
          disabled={exhausted}
          className={cn(
            "flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/10 py-2 text-[12px] transition-colors",
            exhausted
              ? "text-white/20"
              : "text-white/40 hover:border-white/25 hover:text-white/70",
          )}
        >
          <Plus className="h-3.5 w-3.5" />
          {exhausted ? "All fields added" : "Add field"}
        </button>
      </div>
    </div>
  );
}

const APPLICANTS = [
  { id: "marco", name: "Marco Silva", org: "Northwind Labs · Sponsor track" },
  { id: "ada", name: "Ada Chen", org: "Independent · General" },
  { id: "priya", name: "Priya Raman", org: "Cobalt · Speaker" },
  { id: "tom", name: "Tom Okafor", org: "Fieldnote · General" },
];

// Approval gates — the review queue that stands between applying and getting in.
export function ApprovalQueueDemo() {
  const [decided, setDecided] = useState({});

  const pending = APPLICANTS.filter((person) => !decided[person.id]);
  const counts = Object.values(decided);
  const approved = counts.filter((value) => value === "approved").length;

  const decide = (id, verdict) =>
    setDecided((prev) => ({ ...prev, [id]: verdict }));

  return (
    <div className={PANEL}>
      <div className="mb-2.5 flex shrink-0 items-baseline justify-between">
        <span className={TITLE}>Review queue</span>
        <span className={META}>
          {pending.length} pending · {approved} approved
        </span>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {pending.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-white/8">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-emerald-500/15 text-emerald-400">
              <Check className="h-4 w-4" />
            </span>
            <span className="text-[12px] text-white/40">Queue clear</span>
            <button
              type="button"
              onClick={() => setDecided({})}
              className="text-[11px] text-white/30 underline-offset-2 hover:text-white/60 hover:underline"
            >
              Reset the queue
            </button>
          </div>
        ) : (
          pending.map((person) => (
            <div
              key={person.id}
              className={cn(CARD, "flex items-center gap-2 px-3 py-2")}
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium text-white">
                  {person.name}
                </div>
                <div className={cn("truncate", META)}>{person.org}</div>
              </div>
              <button
                type="button"
                aria-label={`Decline ${person.name}`}
                onClick={() => decide(person.id, "declined")}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/10 text-white/35 transition-colors hover:border-red-500/30 hover:text-red-400"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => decide(person.id, "approved")}
                className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-950 transition-colors hover:bg-white/90"
              >
                Approve
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const WAITLIST = [
  "Ada Chen",
  "Tom Okafor",
  "Priya Raman",
  "Marco Silva",
  "Lena Ortiz",
];

const HALL_CAPACITY = 1800;

// Waitlist & capacity — a released spot promotes the next person automatically.
export function WaitlistDemo() {
  const [promoted, setPromoted] = useState(0);

  const confirmed = 1796 + promoted;
  const queue = WAITLIST.slice(promoted);
  const full = confirmed >= HALL_CAPACITY;
  const pct = Math.round((confirmed / HALL_CAPACITY) * 100);

  return (
    <div className={PANEL}>
      <div className="shrink-0">
        <div className="flex items-baseline justify-between">
          <span className={TITLE}>Main Hall</span>
          <span className={META}>
            {confirmed.toLocaleString("en-US")} / {HALL_CAPACITY.toLocaleString("en-US")}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-300",
              full ? "bg-amber-400" : "bg-white/50",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="mt-1.5 text-[11px] text-white/35">
          {full ? "At capacity · waitlist open" : `${HALL_CAPACITY - confirmed} seats left`}
        </div>
      </div>

      <div className={cn(LABEL, "mt-4 shrink-0")}>Waitlist · {queue.length}</div>

      <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-hidden">
        {queue.slice(0, 3).map((name, index) => (
          <div
            key={name}
            className={cn(CARD, "flex items-center gap-2.5 px-3 py-2")}
          >
            <span className="w-3 shrink-0 text-[11px] tabular-nums text-white/25">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] text-white">
              {name}
            </span>
            {index === 0 ? (
              <span className={META}>next up</span>
            ) : null}
          </div>
        ))}
        {promoted > 0 ? (
          <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-emerald-400">
            <Check className="h-3.5 w-3.5" />
            {promoted} auto-promoted and invited
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={() => setPromoted((value) => Math.min(WAITLIST.length, value + 1))}
        disabled={queue.length === 0}
        className={cn(
          "mt-3 flex h-9 shrink-0 items-center justify-center rounded-lg text-[13px] font-medium transition-colors",
          queue.length
            ? "bg-white text-zinc-950 hover:bg-white/90"
            : "border border-white/10 text-white/30",
        )}
      >
        {queue.length ? "Release a spot" : "Waitlist cleared"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Scale — "Runs the whole floor"
 * ------------------------------------------------------------------ */

const SEAT_ROWS = ["A", "B", "C", "D", "E", "F", "G"];
const SEATS_PER_ROW = 15;
// Fixed sold map keeps SSR and client identical.
const SOLD = new Set([
  "A2", "A3", "A7", "A11", "B0", "B1", "B5", "B9", "B13", "C4", "C6", "C7",
  "C10", "C14", "D2", "D3", "D8", "D12", "E0", "E5", "E6", "E11", "F3", "F4",
  "F9", "F13", "G1", "G7", "G8", "G12",
]);
const SEAT_PRICE = 90;
const HOLD_SECONDS = 300;

function formatHold(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Assigned seating — pick seats off the real bowl and watch the TTL hold run.
export function SeatMapDemo() {
  const [picked, setPicked] = useState(["C1", "C2"]);
  const [hold, setHold] = useState(HOLD_SECONDS - 2);

  const timerRef = useVisibleInterval(
    () => setHold((value) => (value <= 1 ? HOLD_SECONDS : value - 1)),
    1000,
    picked.length > 0,
  );

  const toggle = (seat) => {
    if (SOLD.has(seat)) return;
    if (picked.includes(seat)) {
      setPicked(picked.filter((s) => s !== seat));
      return;
    }
    if (picked.length >= 8) return;
    setPicked([...picked, seat]);
    setHold(HOLD_SECONDS); // a fresh pick restarts the hold, like the real TTL
  };

  const remaining = SEAT_ROWS.length * SEATS_PER_ROW - SOLD.size - picked.length;

  return (
    <div className={WELL} ref={timerRef}>
      <div className={HEADER}>
        <span className={TITLE}>Lower Bowl · Sec A</span>
        <span className="text-[11px] tabular-nums text-white/40">
          {remaining} open
        </span>
      </div>

      <div className="shrink-0 px-4 pt-3.5">
        <div className="rounded bg-white/[0.09] py-1.5 text-center text-[10px] uppercase tracking-[0.2em] text-white/45">
          Stage
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1.5 px-4 py-3">
        {SEAT_ROWS.map((row, rowIndex) => (
          <div key={row} className="flex items-center gap-2">
            <span className="w-2.5 shrink-0 text-[10px] text-white/25">{row}</span>
            <div
              className="flex flex-1 justify-center gap-[3px]"
              style={{ paddingInline: `${Math.abs(3 - rowIndex) * 4}px` }}
            >
              {Array.from({ length: SEATS_PER_ROW }, (_, i) => {
                const seat = `${row}${i}`;
                const sold = SOLD.has(seat);
                const chosen = picked.includes(seat);
                return (
                  <button
                    key={seat}
                    type="button"
                    aria-label={`Seat ${row}${i + 1}`}
                    onClick={() => toggle(seat)}
                    className={cn(
                      "h-[15px] flex-1 rounded-[3px] transition-colors",
                      sold && "cursor-not-allowed bg-white/[0.07]",
                      !sold && !chosen && "bg-white/25 hover:bg-white/45",
                      chosen && "bg-emerald-400",
                    )}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-white/5 px-3.5 py-3">
        <div className="mb-2.5 flex items-center gap-3.5 text-[10px] text-white/35">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-white/25" />
            Open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-400" />
            Yours
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[2px] bg-white/[0.07]" />
            Sold
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] font-medium text-white">
              {picked.length} {picked.length === 1 ? "seat" : "seats"} ·{" "}
              <span className="tabular-nums">${picked.length * SEAT_PRICE}</span>
            </div>
            <div className={META}>${SEAT_PRICE} each · rows A–G</div>
          </div>
          <span
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] tabular-nums",
              picked.length
                ? "border-amber-500/25 bg-amber-500/10 text-amber-400"
                : "border-white/[0.07] text-white/25",
            )}
          >
            <Clock className="h-3 w-3" />
            {picked.length ? formatHold(hold) : "No hold"}
          </span>
        </div>
      </div>
    </div>
  );
}

const BOOTHS = [
  { id: "1A", size: "3×3", price: 4200, status: "sold", who: "Northwind Labs" },
  { id: "1B", size: "3×3", price: 4200, status: "sold", who: "Cobalt" },
  { id: "1C", size: "3×3", price: 4200, status: "open" },
  { id: "1D", size: "6×3", price: 7800, status: "held", who: "Hexpoint · 12m left" },
  { id: "2A", size: "3×3", price: 4200, status: "open" },
  { id: "2B", size: "6×6", price: 14500, status: "sold", who: "Lumen Group" },
  { id: "2C", size: "3×3", price: 4200, status: "open" },
  { id: "2D", size: "3×3", price: 4200, status: "sold", who: "Fieldnote" },
  { id: "3A", size: "3×3", price: 4200, status: "open" },
  { id: "3B", size: "3×3", price: 4200, status: "sold", who: "Arclight" },
  { id: "3C", size: "6×3", price: 7800, status: "open" },
  { id: "3D", size: "3×3", price: 4200, status: "sold", who: "Beacon AI" },
  { id: "4A", size: "3×3", price: 4200, status: "sold", who: "Postline" },
  { id: "4B", size: "3×3", price: 4200, status: "open" },
  { id: "4C", size: "3×3", price: 4200, status: "held", who: "Junip · 4m left" },
  { id: "4D", size: "3×3", price: 4200, status: "open" },
];

const BOOTH_STYLES = {
  sold: "bg-indigo-500/25 border-indigo-400/30 text-indigo-100",
  held: "bg-amber-500/20 border-amber-400/30 text-amber-100",
  open: "bg-white/[0.04] border-white/10 text-white/40 hover:border-white/30",
};

// Expo floor — sellable exhibitor booths with the same hold/sold model as seats.
export function ExpoFloorDemo() {
  const [booths, setBooths] = useState(BOOTHS);
  const [selected, setSelected] = useState("1D");

  const active = booths.find((booth) => booth.id === selected) ?? booths[0];
  const taken = booths.filter((booth) => booth.status !== "open");
  const value = taken.reduce((sum, booth) => sum + booth.price, 0);

  const reserve = () =>
    setBooths((prev) =>
      prev.map((booth) =>
        booth.id === active.id && booth.status === "open"
          ? { ...booth, status: "held", who: "Held by you · 15m" }
          : booth,
      ),
    );

  return (
    <div className={WELL}>
      <div className={HEADER}>
        <span className={TITLE}>Hall 2 · Expo floor</span>
        <span className="text-[11px] tabular-nums text-white/40">
          {taken.length}/{booths.length} sold
        </span>
      </div>

      <div className="grid flex-1 grid-cols-4 gap-1.5 p-3.5">
        {booths.map((booth) => (
          <button
            key={booth.id}
            type="button"
            onClick={() => setSelected(booth.id)}
            className={cn(
              "grid place-items-center rounded-md border text-[12px] font-medium transition-colors",
              BOOTH_STYLES[booth.status],
              selected === booth.id && "ring-2 ring-white/60",
            )}
          >
            {booth.id}
          </button>
        ))}
      </div>

      <div className="flex shrink-0 items-center gap-3.5 px-3.5 pb-2 text-[10px] text-white/35">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-indigo-400/30 bg-indigo-500/25" />
          Sold
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-amber-400/30 bg-amber-500/20" />
          Held
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[2px] border border-white/10 bg-white/[0.04]" />
          Open
        </span>
      </div>

      <div className="shrink-0 border-t border-white/5 px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-white">
              Booth {active.id} · {active.size}m
            </div>
            <div className={cn("truncate", META)}>
              {active.who ?? "Available now"} · ${active.price.toLocaleString("en-US")}
            </div>
          </div>
          <button
            type="button"
            onClick={reserve}
            disabled={active.status !== "open"}
            className={cn(
              "shrink-0 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
              active.status === "open"
                ? "bg-white text-zinc-950 hover:bg-white/90"
                : "border border-white/10 text-white/30",
            )}
          >
            {active.status === "open" ? "Hold booth" : "Taken"}
          </button>
        </div>
        <div className="mt-2 flex items-center justify-between border-t border-white/5 pt-2 text-[11px]">
          <span className="text-white/35">Floor value</span>
          <span className="tabular-nums text-white">${value.toLocaleString("en-US")}</span>
        </div>
      </div>
    </div>
  );
}

const GATES = [
  { id: "north", label: "North", capacity: 900 },
  { id: "west", label: "West", capacity: 640 },
  { id: "vip", label: "VIP", capacity: 260 },
];

// Deterministic per-minute check-in shape; the demo walks a window across it.
const FLOW = [3, 5, 8, 12, 17, 22, 28, 34, 31, 27, 24, 19, 23, 29, 36, 33, 26, 21, 16, 12];

// Live attendance — the real-time gate dashboard, ticking while it's on screen.
export function LiveAttendanceDemo() {
  const [offset, setOffset] = useState(0);
  const ref = useVisibleInterval(() => setOffset((value) => value + 1), 1400);

  const bars = useMemo(
    () => Array.from({ length: 18 }, (_, i) => FLOW[(offset + i) % FLOW.length]),
    [offset],
  );
  const peak = Math.max(...bars);
  // One slow doors-open cycle so the room fills rather than visibly resetting.
  const cycle = offset % 80;
  const inside = 1204 + cycle * 4;
  const perMinute = bars[bars.length - 1];

  return (
    <div className={WELL} ref={ref}>
      <div className={HEADER}>
        <div className="flex items-center gap-1.5">
          <Radio className="h-3.5 w-3.5 text-emerald-400" />
          <span className={TITLE}>Live attendance</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] text-emerald-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          Now
        </span>
      </div>

      <div className="shrink-0 px-3.5 pt-3.5">
        <div className="flex items-baseline gap-2">
          <span className="text-[30px] font-semibold leading-none tabular-nums text-white">
            {inside.toLocaleString("en-US")}
          </span>
          <span className="text-[11px] text-white/35">inside · cap 1,800</span>
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
          <ArrowUpRight className="h-3.5 w-3.5 text-emerald-400" />
          <span className="tabular-nums text-emerald-400">{perMinute}</span>
          <span className="text-white/35">scans / min</span>
        </div>
      </div>

      <div className="flex h-20 shrink-0 items-end gap-[3px] px-3.5 pt-3">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-[2px] transition-all duration-700",
              i === bars.length - 1 ? "bg-emerald-400" : "bg-white/[0.16]",
            )}
            style={{ height: `${Math.max(8, (bar / peak) * 100)}%` }}
          />
        ))}
      </div>
      <div className="shrink-0 px-3.5 pt-1.5 text-[10px] text-white/25">
        Last 18 minutes
      </div>

      <div className="flex flex-1 flex-col justify-center gap-3 p-3.5">
        <div className={LABEL}>By gate</div>
        {GATES.map((gate, index) => {
          const through = Math.min(
            gate.capacity,
            Math.round(gate.capacity * (0.42 + index * 0.18) + cycle * 2),
          );
          const pct = Math.round((through / gate.capacity) * 100);
          return (
            <div key={gate.id}>
              <div className="mb-1.5 flex items-center justify-between text-[11px]">
                <span className="text-white/60">{gate.label} gate</span>
                <span className="tabular-nums text-white/35">
                  {through}/{gate.capacity} · {pct}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-700",
                    pct > 90 ? "bg-amber-400" : "bg-white/50",
                  )}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
