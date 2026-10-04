"use client";

import { Check, CircleDollarSign, Clock, FileText, Plus, ScanLine, ShieldAlert, Ticket, X } from "lucide-react";
import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { Avatar, Bar, Field, Notice, Part, Pill, Row, RowText, SceneCard, flow, money } from "./kit";

// Registration and order scenes: each one ends on what changes for the guest or the order.

const FORM_FIELDS = [["Full name", "Text"], ["Work email", "Email"], ["Company", "Text"]];
const RESPONSES = [["Priya Raman", "To meet other synth players"], ["Marco Silva", "Covering it for Sound Weekly"], ["Jordan Lee", "First time at Nightshift"]];

// Forms: add a question, then see the answers land on each guest's record.
function FormScene({ view }) {
  const { state } = view;
  const fields = state.added ? [...FORM_FIELDS, ["Why do you want to come?", "Long text"]] : FORM_FIELDS;
  return (
    <SceneCard title="Registration form" meta="Nightshift 2026" aside={
      <div className="flex gap-1">
        {[["build", "Build"], ["responses", "Responses"]].map(([id, label]) => <Button key={id} data-part={`tab-${id}`} size="sm" variant={state.tab === id ? "default" : "outline"} className="h-7 px-2.5 text-xs">{label}</Button>)}
      </div>
    }>
      {state.tab === "build" ? (
        <div className="min-h-[236px]">
          <div className="space-y-2">
            {fields.map(([label, kind], index) => {
              const required = index < 2 || (index === 3 && state.required);
              return (
                <Row key={label} className={cn("py-2", index === 3 && "motion-safe:animate-in motion-safe:fade-in")}>
                  <RowText title={label} meta={kind} />
                  <Button data-part={`req-${index}`} size="sm" variant={required ? "default" : "outline"} className="h-6 px-2 text-[11px]">{required ? "Required" : "Optional"}</Button>
                </Row>
              );
            })}
          </div>
          <Button data-part="add-field" variant="outline" size="sm" className="mt-2 w-full"><Plus className="size-3.5" />Add question</Button>
        </div>
      ) : (
        <Part id="responses" view={view} className="min-h-[236px] space-y-2 motion-safe:animate-in motion-safe:fade-in">
          <div className="text-xs text-muted-foreground">Why do you want to come?</div>
          {RESPONSES.map(([name, answer]) => (
            <Row key={name} className="justify-start gap-3"><Avatar name={name} /><RowText title={name} meta={`“${answer}”`} /></Row>
          ))}
        </Part>
      )}
    </SceneCard>
  );
}

const APPLICANTS = [["Priya Raman", "“I run the Leeds synth meetup.”"], ["Marco Silva", "“Interested in the afterparty.”"], ["Jordan Lee", "“Press pass for Sound Weekly.”"]];

// Approvals: decide with the answers in front of you, while the places fill.
function ApprovalScene({ view }) {
  const { state } = view;
  const approved = 46 + Object.values(state.decided).filter((d) => d === "approved").length;
  return (
    <SceneCard title="Applications" meta="Nightshift Studio Session · 50 places">
      <Part id="places" view={view}>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Approved</span><span className="font-semibold tabular-nums">{approved} / 50</span></div>
        <Bar value={(approved / 50) * 100} className="mt-2" />
      </Part>
      <div className="mt-4 space-y-2">
        {APPLICANTS.map(([name, answer], index) => {
          const decision = state.decided[index];
          return (
            <Row key={name} part={`applicant-${index}`} view={view}>
              <RowText title={name} meta={decision === "approved" ? "Approved · ticket issued" : decision === "declined" ? "Declined" : answer} />
              {decision ? <Pill tone={decision === "approved" ? "success" : "neutral"}>{decision === "approved" ? "Approved" : "Declined"}</Pill> : (
                <div className="flex gap-1">
                  <Button data-part={`decline-${index}`} variant="outline" size="icon" className="size-7"><X className="size-3.5" /></Button>
                  <Button data-part={`approve-${index}`} size="icon" className="size-7"><Check className="size-3.5" /></Button>
                </div>
              )}
            </Row>
          );
        })}
      </div>
    </SceneCard>
  );
}

const WAITLIST = ["Priya Raman", "Marco Silva", "Jordan Lee"];

// Waitlist: a released place is offered to the next guest, they buy it, and the event is full again.
function WaitlistScene({ view }) {
  const { state } = view;
  const queue = state.accepted ? WAITLIST.slice(1) : WAITLIST;
  const sold = state.released && !state.accepted ? 479 : 480;
  return (
    <SceneCard title="General admission" meta="Nightshift 2026" aside={<Pill tone={sold === 480 ? "strong" : "warning"}>{sold === 480 ? "Sold out" : "1 place free"}</Pill>}>
      <Part id="capacity" view={view}>
        <div className="flex justify-between text-sm"><span className="text-muted-foreground">Sold</span><span className="font-medium tabular-nums">{sold} / 480</span></div>
        <Bar value={(sold / 480) * 100} className="mt-2" />
      </Part>
      <Part id="waitlist" view={view} className="mt-4">
        <div className="mb-2 text-xs text-muted-foreground">Waitlist · {queue.length} waiting</div>
        <div className="space-y-2">
          {queue.map((name, index) => {
            const offered = index === 0 && state.released && !state.accepted;
            return (
              <Row key={name} className="py-2">
                <RowText title={`${index + 1}. ${name}`} meta={offered ? `Offer sent · expires in ${state.expires}m` : "Waiting"} />
                {offered ? <Pill tone="warning"><Clock className="size-3" />{state.expires}m</Pill> : null}
              </Row>
            );
          })}
        </div>
      </Part>
      {state.accepted ? <Notice tone="success" icon={Ticket} className="mt-3">Priya Raman bought the place. Next in line: Marco Silva.</Notice>
        : <Button data-part="release" className="mt-3 w-full" variant={state.released ? "outline" : "default"}>{state.released ? "Place released" : "Release a place"}</Button>}
    </SceneCard>
  );
}

const ORDERS = [
  { id: "GE-20418", name: "Ada Chen", amount: 95.4, status: "Paid", tone: "success" },
  { id: "GE-20402", name: "Marco Silva", amount: 120, status: "Partial", tone: "warning" },
  { id: "GE-20391", name: "Jordan Lee", amount: 45, status: "Refunded", tone: "neutral" },
  { id: "GE-20377", name: "Sam Okafor", amount: 240, status: "Disputed", tone: "danger" },
];
const HISTORY = [[CircleDollarSign, "Paid $240.00 · VIP + afterparty × 2", "12 Feb"], [ScanLine, "Checked in at Door A", "14 Mar, 21:12"], [ShieldAlert, "Chargeback opened · respond by 9 Apr", "2 Apr"]];

// Order cockpit: find any order fast and see its whole story in one place.
function OrdersScene({ view }) {
  const { state } = view;
  const term = state.query.trim().toLowerCase();
  const shown = term ? ORDERS.filter((order) => order.name.toLowerCase().includes(term)) : ORDERS;
  return (
    <SceneCard title="Orders" meta="Nightshift 2026 · 214 orders">
      <Field id="query" placeholder="Search name or order" view={view} />
      <div className="mt-3 min-h-[214px] space-y-2">
        {shown.map((order) => (
          <div key={order.id}>
            <Row part={`order-${order.id}`} view={view} className={cn(state.open === order.id && "border-foreground")}>
              <RowText title={order.name} meta={order.id} />
              <div className="flex items-center gap-2"><span className="text-sm tabular-nums">{money(order.amount)}</span><Pill tone={order.tone}>{order.status}</Pill></div>
            </Row>
            {state.open === order.id ? (
              <Part id="history" view={view} className="ml-3 mt-2 space-y-2 border-l border-border pl-4 motion-safe:animate-in motion-safe:fade-in">
                {HISTORY.map(([Icon, text, when]) => (
                  <div key={text} className="flex items-start gap-2 text-xs"><Icon className="mt-px size-3.5 shrink-0 text-muted-foreground" /><span className="flex-1">{text}</span><span className="shrink-0 text-muted-foreground">{when}</span></div>
                ))}
              </Part>
            ) : null}
          </div>
        ))}
      </div>
    </SceneCard>
  );
}

// Refunds: pick the tickets, the policy sets the amount, and the order updates.
function RefundScene({ view }) {
  const { state } = view;
  const amount = state.picked.length * 45;
  return (
    <SceneCard title="Refund · GE-20418" meta="Ada Chen · paid $95.40" aside={<Pill tone={state.recorded ? "warning" : "success"}>{state.recorded ? "Partly refunded" : "Paid"}</Pill>}>
      <Part id="policy" view={view} className="rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">Policy: tickets refundable up to 48 hours before doors. Service fees aren&apos;t refunded.</Part>
      <div className="mt-3 space-y-2">
        {[1, 2].map((n) => {
          const picked = state.picked.includes(n);
          const refunded = state.recorded && picked;
          return (
            <Row key={n} className="py-2">
              <RowText title={`General admission · ticket ${n}`} meta={refunded ? "Refunded" : "$45.00"} />
              {refunded ? <Pill>Refunded</Pill> : <Button data-part={`pick-${n}`} size="icon" variant={picked ? "default" : "outline"} className="size-7">{picked ? <Check className="size-3.5" /> : null}</Button>}
            </Row>
          );
        })}
      </div>
      <Part id="amount" view={view} className="mt-3 flex justify-between border-t border-border pt-3 text-sm">
        <span className="text-muted-foreground">Refund under policy</span><span className="font-semibold tabular-nums">{money(amount)}</span>
      </Part>
      <Button data-part="record" className="mt-3 w-full" variant={state.recorded ? "outline" : "default"} disabled={!amount}>{state.recorded ? <><Check className="size-3.5" />{money(amount)} refund recorded</> : "Record refund"}</Button>
    </SceneCard>
  );
}

// Disputes: the order's own history, including the door scan, is the evidence.
function DisputeScene({ view }) {
  const { state } = view;
  const evidence = [[FileText, "Order receipt", "Paid $240.00 on 12 Feb"], [ScanLine, "Check-in record", "Scanned at Door A, 14 Mar 21:12"]];
  return (
    <SceneCard title="Chargeback · GE-20377" meta="Sam Okafor · $240.00 · “Not received”" aside={state.submitted ? <Pill tone="success">Submitted</Pill> : <Pill tone="danger"><Clock className="size-3" />7 days left</Pill>}>
      <div className="mb-2 text-xs text-muted-foreground">Evidence from this order</div>
      <Part id="evidence" view={view} className="space-y-2">
        {evidence.map(([Icon, title, meta], index) => (
          <Row key={title} className={cn("py-2 transition-opacity duration-300", index < state.found ? "opacity-100" : "opacity-0")}>
            <div className="flex min-w-0 items-center gap-3"><Icon className="size-4 shrink-0 text-muted-foreground" /><RowText title={title} meta={meta} /></div>
            <Pill tone="success"><Check className="size-3" />Attached</Pill>
          </Row>
        ))}
      </Part>
      <Notice tone="neutral" icon={ScanLine} show={state.found === 2} className="mt-3">The scan shows the ticket was used at the door, so the guest did attend.</Notice>
      <Button data-part="submit" className="mt-3 w-full" variant={state.submitted ? "outline" : "default"}>{state.submitted ? <><Check className="size-3.5" />Evidence submitted</> : "Submit evidence"}</Button>
    </SceneCard>
  );
}

export const ORDER_PREVIEWS = {
  forms: {
    Scene: FormScene,
    script: flow({ tab: "build", added: false, required: false }, [
      { caption: "Start from the questions you always ask.", hold: 1000 },
      { cursor: "add-field", click: true, set: { added: true }, caption: "Add your own question.", hold: 600 },
      { cursor: "req-3", click: true, set: { required: true }, caption: "Make it required.", hold: 600 },
      { cursor: "tab-responses", click: true, set: { tab: "responses" }, highlight: "responses", caption: "Answers arrive on each guest's record as they register.", hold: 2000 },
    ]),
  },
  approvals: {
    Scene: ApprovalScene,
    script: flow({ decided: {} }, [
      { highlight: "places", caption: "Only 4 places left. Each application comes with its answers.", hold: 1300 },
      { cursor: "approve-0", click: true, set: { decided: { 0: "approved" } }, caption: "Approving issues the ticket and fills a place.", hold: 900 },
      { cursor: "decline-1", click: true, set: { decided: { 0: "approved", 1: "declined" } }, caption: "Declining keeps the place free.", hold: 800 },
      { cursor: "approve-2", click: true, set: { decided: { 0: "approved", 1: "declined", 2: "approved" } }, highlight: "places", caption: "You stay in control of who gets in.", hold: 1700 },
    ]),
  },
  waitlist: {
    Scene: WaitlistScene,
    script: flow({ released: false, expires: 12, accepted: false }, [
      { highlight: "waitlist", caption: "Sold out. Guests who missed out join the waitlist.", hold: 1300 },
      { cursor: "release", click: true, set: { released: true }, caption: "Release a place and the first guest in line gets an offer.", hold: 900 },
      { set: { expires: 11 }, hold: 600 },
      { set: { accepted: true }, highlight: "capacity", caption: "They buy it before it expires, and the event is full again.", hold: 2000 },
    ]),
  },
  orders: {
    Scene: OrdersScene,
    script: flow({ query: "", open: null }, [
      { caption: "Every order, with its status and amount.", hold: 1000 },
      { cursor: "query", type: "query", set: { query: "Sam" }, caption: "Find any order by name or number.", hold: 300 },
      { cursor: "order-GE-20377", click: true, set: { open: "GE-20377" }, highlight: "history", caption: "Open it to see the whole story: payment, check-in and dispute.", hold: 2200 },
    ]),
  },
  refunds: {
    Scene: RefundScene,
    script: flow({ picked: [], recorded: false }, [
      { highlight: "policy", caption: "The event's refund policy sits next to the order.", hold: 1300 },
      { cursor: "pick-2", click: true, set: { picked: [2] }, highlight: "amount", caption: "Pick the tickets to refund, and the amount follows the policy.", hold: 1100 },
      { cursor: "record", click: true, set: { recorded: true }, caption: "Record it, and the order shows exactly what was refunded.", hold: 1900 },
    ]),
  },
  disputes: {
    Scene: DisputeScene,
    script: flow({ found: 0, submitted: false }, [
      { caption: "A chargeback arrives with a deadline.", hold: 1000 },
      { set: { found: 1 }, highlight: "evidence", caption: "The order's history becomes your evidence.", hold: 700 },
      { set: { found: 2 }, highlight: "evidence", caption: "Including the door scan that shows they came.", hold: 1300 },
      { cursor: "submit", click: true, set: { submitted: true }, caption: "Submit it well before the deadline.", hold: 1700 },
    ]),
  },
};
