"use client";

import { Bookmark, BookmarkCheck, CalendarClock, Check, CircleCheck, CreditCard, LayoutDashboard, Loader2, Minus, Plus, QrCode, ShieldAlert } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { Bar, Field, Notice, Part, Row, RowText, SceneCard, flow, money } from "./kit";

// Front-of-house scenes: the event page booking, the door, the attendee portal and the staff desk.

const TIERS = [
  { id: "ga", name: "General admission", price: 45, left: "128 left" },
  { id: "vip", name: "VIP + afterparty", price: 120, left: "12 left" },
];
const BOOKING_START = { screen: "tickets", ga: 0, vip: 0, name: "", email: "", card: "", expiry: "", cvc: "", paying: false };
const CHECKOUT_STEPS = [["tickets", "Tickets"], ["details", "Details"], ["payment", "Payment"]];

function EventPageScene({ view }) {
  const { state } = view;
  const count = state.ga + state.vip;
  const subtotal = state.ga * 45 + state.vip * 120;
  const fee = Math.round(subtotal * 6) / 100;
  const summary = TIERS.filter((tier) => state[tier.id]).map((tier) => `${state[tier.id]} × ${tier.name}`).join(", ") || "No tickets selected";
  const stepIndex = CHECKOUT_STEPS.findIndex(([screen]) => screen === state.screen);

  return (
    <SceneCard title="Nightshift 2026" meta="Sat 14 Mar · 21:00 · The Foundry" aside={state.screen !== "done" ? <span className="shrink-0 text-xs text-muted-foreground">Step {stepIndex + 1} of 3</span> : null}>
      {state.screen !== "done" ? (
        <div className="mb-4 flex gap-1.5">
          {CHECKOUT_STEPS.map(([screen, label], index) => (
            <div key={screen} className="flex-1">
              <div className={cn("h-1 rounded-full transition-colors duration-300", index <= stepIndex ? "bg-foreground" : "bg-border")} />
              <div className={cn("mt-1.5 text-[11px]", index === stepIndex ? "font-medium text-foreground" : "text-muted-foreground")}>{label}</div>
            </div>
          ))}
        </div>
      ) : null}

      {state.screen === "tickets" ? (
        <div className="min-h-[252px]">
          <div className="space-y-2">
            {TIERS.map((tier) => (
              <Row key={tier.id}>
                <RowText title={tier.name} meta={`$${tier.price} · ${tier.left}`} />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="size-7"><Minus className="size-3.5" /></Button>
                  <span className="w-4 text-center text-sm font-medium tabular-nums">{state[tier.id]}</span>
                  <Button data-part={`plus-${tier.id}`} variant="outline" size="icon" className="size-7"><Plus className="size-3.5" /></Button>
                </div>
              </Row>
            ))}
          </div>
          <div className="mt-4 border-t border-border pt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{count} {count === 1 ? "ticket" : "tickets"}</span>
              <span className="font-semibold tabular-nums">{money(subtotal)}</span>
            </div>
            <Button data-part="continue" className="mt-3 w-full" disabled={count === 0}>Continue</Button>
          </div>
        </div>
      ) : null}

      {state.screen === "details" ? (
        <div className="min-h-[252px] space-y-3">
          <Field id="name" label="Full name" placeholder="Your name" view={view} />
          <Field id="email" label="Email" placeholder="you@example.com" view={view} />
          <div className="flex items-center justify-between gap-3 pt-1 text-sm">
            <span className="truncate text-muted-foreground">{summary}</span>
            <span className="shrink-0 font-semibold tabular-nums">{money(subtotal)}</span>
          </div>
          <Button data-part="toPayment" className="w-full">Continue to payment</Button>
        </div>
      ) : null}

      {state.screen === "payment" ? (
        <div className="min-h-[252px] space-y-3">
          <Field id="card" label="Card number" placeholder="1234 1234 1234 1234" view={view} />
          <div className="grid grid-cols-2 gap-3">
            <Field id="expiry" label="Expiry" placeholder="MM / YY" view={view} />
            <Field id="cvc" label="CVC" placeholder="123" view={view} />
          </div>
          <div className="space-y-1 pt-1 text-xs text-muted-foreground">
            <div className="flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(subtotal)}</span></div>
            <div className="flex justify-between"><span>Service fee</span><span className="tabular-nums">{money(fee)}</span></div>
          </div>
          <Button data-part="pay" className="w-full" disabled={state.paying}>
            {state.paying ? <><Loader2 className="size-4 animate-spin" />Processing</> : <><CreditCard className="size-4" />Pay {money(subtotal + fee)}</>}
          </Button>
        </div>
      ) : null}

      {state.screen === "done" ? (
        <div className="min-h-[252px] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <CircleCheck className="size-5 text-emerald-600 dark:text-emerald-400" />
            You&apos;re in{state.name ? `, ${state.name.split(" ")[0]}` : ""}
          </div>
          <Part id="ticket" view={view} className="mt-3 rounded-xl bg-foreground p-4 text-background">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs opacity-70">Nightshift 2026 · Door B</div>
                <div className="mt-1 text-base font-semibold">{summary}</div>
                <div className="mt-3 font-mono text-xs opacity-80">Order GE-20418</div>
              </div>
              <QrCode className="size-14 shrink-0" strokeWidth={1.25} />
            </div>
          </Part>
          <p className="mt-3 text-xs text-muted-foreground">Tickets sent to {state.email || "your email"}. Show the QR code at the door.</p>
          <Part id="sale" view={view} className="mt-4 flex items-center justify-between rounded-lg bg-muted px-3 py-2.5 text-xs">
            <span className="flex items-center gap-2 text-muted-foreground"><LayoutDashboard className="size-3.5" />Your dashboard</span>
            <span className="font-medium">+{count} tickets · {money(subtotal + fee)}</span>
          </Part>
        </div>
      ) : null}
    </SceneCard>
  );
}

// The door: scan, admit, and stop the same ticket coming in twice.
function DoorScene({ view }) {
  const { state } = view;
  const arrived = 212 + (state.admitted ? 1 : 0);
  return (
    <SceneCard title="Check-in · Door B" meta="Nightshift 2026">
      <Part id="count" view={view}>
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Arrived, all doors</span>
          <span className="font-semibold tabular-nums">{arrived} <span className="font-normal text-muted-foreground">/ 480</span></span>
        </div>
        <Bar value={(arrived / 480) * 100} className="mt-2" />
      </Part>
      <div className="relative mt-4 grid h-32 place-items-center overflow-hidden rounded-lg bg-foreground">
        {["left-3 top-3 border-l-2 border-t-2", "right-3 top-3 border-r-2 border-t-2", "bottom-3 left-3 border-b-2 border-l-2", "bottom-3 right-3 border-b-2 border-r-2"].map((corner) => <span key={corner} className={cn("absolute size-5 rounded-sm border-background/60", corner)} />)}
        {state.scanning ? <QrCode key={state.scanning} className="size-16 text-background motion-safe:animate-in motion-safe:zoom-in-90 motion-safe:fade-in motion-safe:duration-300" strokeWidth={1.25} /> : <span className="text-xs text-background/60">Point at a ticket</span>}
        {state.scanning && !state.result ? <span className="absolute inset-x-6 top-1/2 h-px bg-emerald-400 motion-safe:animate-pulse" /> : null}
      </div>
      <Part id="result" view={view} className="mt-3 min-h-[58px]">
        {state.result === "valid" ? (
          <Notice tone="success" icon={Check}><span className="font-semibold">Admitted · Ada Chen</span><br />General admission · GE-20418</Notice>
        ) : state.result === "duplicate" ? (
          <Notice tone="danger" icon={ShieldAlert}><span className="font-semibold">Already scanned at 21:07, Door B</span><br />This ticket has been used. Don&apos;t admit.</Notice>
        ) : (
          <div className="grid h-[58px] place-items-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Waiting for a scan</div>
        )}
      </Part>
    </SceneCard>
  );
}

const SESSIONS = [
  { time: "21:30", title: "Opening set", room: "Main room" },
  { time: "22:45", title: "Live: Halcyon", room: "Main room" },
  { time: "23:30", title: "Vinyl corner", room: "Loft" },
];

// The attendee portal: a guest's saved plan follows changes made in the agenda.
function PortalScene({ view }) {
  const { state } = view;
  return (
    <SceneCard className="max-w-[310px]" title="Nightshift 2026" meta="Attendee portal · Ada Chen">
      <Part id="ticket" view={view} className="flex items-center gap-3 bg-foreground p-3 text-background">
        <QrCode className="size-10 shrink-0" strokeWidth={1.5} />
        <div className="min-w-0">
          <div className="text-sm font-semibold">2 × General admission</div>
          <div className="text-xs opacity-70">Show at Door B</div>
        </div>
      </Part>
      {state.changed ? <Notice tone="warning" icon={CalendarClock} className="mt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1">Live: Halcyon moved to 23:00 in the Loft.</Notice> : null}
      <Part id="agenda" view={view} className="mt-3">
        <div className="divide-y divide-border rounded-lg border border-border">
          {SESSIONS.map((session) => {
            const saved = state.saved.includes(session.time);
            const moved = state.changed && session.time === "22:45";
            const Icon = saved ? BookmarkCheck : Bookmark;
            return (
              <div key={session.time} className="flex items-center gap-3 px-3 py-2.5">
                <span className={cn("w-10 shrink-0 text-xs tabular-nums", moved ? "font-semibold text-foreground" : "text-muted-foreground")}>{moved ? "23:00" : session.time}</span>
                <div className="min-w-0 flex-1"><RowText title={session.title} meta={moved ? "Loft · updated" : session.room} /></div>
                <Button data-part={`save-${session.time}`} variant="ghost" size="icon" className="size-8"><Icon className={cn("size-4", saved && "fill-foreground")} /></Button>
              </div>
            );
          })}
        </div>
      </Part>
    </SceneCard>
  );
}

// The staff desk: entitlements come from the ticket and add-ons, and each item can only be collected once.
function DeskScene({ view }) {
  const { state } = view;
  const items = [
    { id: "badge", name: "Event badge", source: "Ticket", done: true, note: "Collected 20:58" },
    { id: "shirt", name: "T-shirt · M", source: "VIP add-on", done: state.shirt, note: state.shirt ? "Collected just now" : "Not collected" },
    { id: "tokens", name: "Drink tokens × 2", source: "VIP add-on", done: false, note: "Not collected" },
  ];
  return (
    <SceneCard title="Staff desk" meta="Nightshift 2026 · Merch table">
      <Field id="search" placeholder="Search guest or scan ticket" view={view} />
      <Part id="owed" view={view} className={cn("mt-3 space-y-2 transition-opacity duration-300", state.found ? "opacity-100" : "opacity-0")}>
        <div className="text-xs text-muted-foreground">Ada Chen is owed</div>
        {items.map((item) => (
          <Row key={item.id}>
            <RowText title={item.name} meta={`${item.source} · ${item.note}`} />
            <Button data-part={`issue-${item.id}`} size="sm" variant={item.done ? "outline" : "default"}>{item.done ? <><Check className="size-3.5" />Issued</> : "Issue"}</Button>
          </Row>
        ))}
      </Part>
      <Notice tone="warning" icon={ShieldAlert} show={state.blocked} className="mt-3">Badge already collected at 20:58. It can&apos;t be issued twice, at this desk or any other.</Notice>
    </SceneCard>
  );
}

export const FRONT_PREVIEWS = {
  page: {
    Scene: EventPageScene,
    script: flow(BOOKING_START, [
      { chapter: "Tickets", caption: "A guest opens your event page.", hold: 900 },
      { cursor: "plus-ga", click: true, set: { ga: 1 }, caption: "They choose their tickets.", hold: 200 },
      { cursor: "plus-ga", click: true, set: { ga: 2 }, hold: 450 },
      { cursor: "continue", click: true, set: { screen: "details" }, hold: 200 },
      { chapter: "Details", cursor: "name", type: "name", set: { name: "Ada Chen" }, caption: "They add their name and email.", hold: 150 },
      { cursor: "email", type: "email", set: { email: "ada@example.com" }, hold: 400 },
      { cursor: "toPayment", click: true, set: { screen: "payment" }, hold: 200 },
      { chapter: "Payment", cursor: "card", type: "card", set: { card: "4242 4242 4242 4242" }, caption: "They pay by card, on the same page.", hold: 100 },
      { cursor: "expiry", type: "expiry", set: { expiry: "12 / 28" }, hold: 50 },
      { cursor: "cvc", type: "cvc", set: { cvc: "123" }, hold: 300 },
      { cursor: "pay", click: true, set: { paying: true }, hold: 800 },
      { chapter: "Ticket", set: { screen: "done", paying: false }, highlight: "ticket", caption: "Their ticket arrives straight away, with a QR code for the door.", hold: 1600 },
      { highlight: "sale", caption: "And the sale is already on your dashboard.", hold: 1800 },
    ]),
  },
  door: {
    Scene: DoorScene,
    script: flow({ scanning: null, result: null, admitted: false }, [
      { caption: "Door staff scan tickets with their phone.", hold: 1000 },
      { set: { scanning: "first" }, caption: "A guest shows their QR code.", hold: 500 },
      { set: { result: "valid", admitted: true }, highlight: "count", caption: "Valid tickets are admitted, and the count updates for every door.", hold: 1600 },
      { set: { scanning: "second", result: null }, caption: "Someone tries the same ticket again.", hold: 500 },
      { set: { result: "duplicate" }, highlight: "result", caption: "It's stopped, with the time and door of the first scan.", hold: 2000 },
    ]),
  },
  portal: {
    Scene: PortalScene,
    script: flow({ saved: ["21:30"], changed: false }, [
      { highlight: "ticket", caption: "Guests keep their tickets and schedule in the attendee portal.", hold: 1300 },
      { cursor: "save-22:45", click: true, set: { saved: ["21:30", "22:45"] }, caption: "They save the sets they want to see.", hold: 900 },
      { set: { changed: true }, highlight: "agenda", caption: "Move a session in your agenda and every guest's plan updates.", hold: 2200 },
    ]),
  },
  desk: {
    Scene: DeskScene,
    script: flow({ search: "", found: false, shirt: false, blocked: false }, [
      { cursor: "search", type: "search", set: { search: "Ada Chen" }, caption: "Staff look a guest up by name, or scan their ticket.", hold: 200 },
      { set: { found: true }, highlight: "owed", caption: "Their ticket and add-ons decide what they're owed.", hold: 1300 },
      { cursor: "issue-shirt", click: true, set: { shirt: true }, caption: "Hand an item over and record it.", hold: 900 },
      { cursor: "issue-badge", click: true, set: { blocked: true }, caption: "A second collection is blocked, at every desk.", hold: 2000 },
    ]),
  },
};
