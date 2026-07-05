"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ScanLine,
  UserPlus,
  Ticket,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Search,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { getEvent } from "@/lib/supabase/events";
import { registerForEvent } from "@/lib/supabase/registrations";
import { buyTicket } from "@/lib/supabase/orders";
import { searchCheckin, admitCheckin } from "@/lib/supabase/checkin";
import { AccessGate } from "@/components/checkin_routes/access_gate";
import { QrScanner } from "@/components/checkin_routes/qr_scanner";

const currency = (n) => `$${Number(n || 0).toLocaleString()}`;

// Shared full-screen confirmation, auto-returns to idle.
function Done({ title, message, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4000);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-background px-6 text-center text-foreground">
      <div className="flex h-20 w-20 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
        <CheckCircle2 className="h-10 w-10" />
      </div>
      <div className="space-y-1">
        <p className="text-2xl font-semibold text-foreground">{title}</p>
        <p className="text-text-secondary">{message}</p>
      </div>
      <Button className="h-12 bg-primary px-8 text-base text-primary-foreground hover:bg-primary/90" onClick={onDone}>
        Done
      </Button>
    </div>
  );
}

function CheckinAction({ eventId, code, role, onDone, onBack }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [paused, setPaused] = useState(false);
  const [msg, setMsg] = useState("");

  const admit = async (row, method) => {
    const res = await admitCheckin({
      eventId,
      code,
      registrationId: row.registrationId,
      name: row.name,
      ticketCode: row.ticketCode,
      method,
      staff: role?.name || null,
    });
    if (res?.ok) onDone(`Welcome, ${row.name || "guest"}!`, "You're checked in. Enjoy the event.");
    else if (res?.already) setMsg(`${row.name || "You"} are already checked in.`);
    else setMsg("Couldn't check in — please see staff.");
  };

  const run = async (text) => {
    const q = (text ?? query).trim();
    if (!q) return;
    setSearching(true);
    const rows = await searchCheckin(eventId, code, q);
    setSearching(false);
    setResults(rows || []);
    const exact = rows?.find((r) => r.ticketCode === q.toUpperCase()) || (rows?.length === 1 ? rows[0] : null);
    if (exact && !exact.checkedIn) admit(exact, "self");
    else if (exact?.checkedIn) setMsg(`${exact.name || "You"} are already checked in.`);
    else if (!rows?.length) setMsg("No match — try your name or see staff.");
  };

  const onScan = (text) => {
    setPaused(true);
    setQuery(text);
    run(text).finally(() => setTimeout(() => setPaused(false), 1500));
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
      <BackBtn onBack={onBack} />
      <h2 className="text-xl font-semibold text-foreground">Check yourself in</h2>
      <QrScanner onDecode={onScan} paused={paused} />
      {msg ? <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">{msg}</p> : null}
      <form onSubmit={(e) => { e.preventDefault(); run(); }} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or ticket #" className="h-11 bg-surface-card pl-9" />
        </div>
        <Button type="submit" disabled={searching} className="h-11 bg-primary text-primary-foreground hover:bg-primary/90">
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find"}
        </Button>
      </form>
      {results.map((r) => (
        <div key={r.registrationId} className="flex items-center gap-3 rounded-xl border border-border bg-surface-subtle p-3.5">
          <span className="min-w-0 flex-1 truncate font-medium text-foreground">{r.name || "Guest"}</span>
          {r.checkedIn ? (
            <span className="text-sm font-medium text-emerald-300">Checked in</span>
          ) : (
            <Button className="h-10 bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => admit(r, "self")}>Check in</Button>
          )}
        </div>
      ))}
    </div>
  );
}

function RegisterAction({ eventId, code, role, onDone, onBack }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    if (!name.trim()) return setErr("Enter your name.");
    setBusy(true);
    setErr("");
    const res = await registerForEvent({ eventId, name, email, source: "Kiosk" });
    if (!res?.ok) {
      setBusy(false);
      return setErr(res?.full ? "This event is full." : "Couldn't register — see staff.");
    }
    if (res.registration?.id) {
      await admitCheckin({ eventId, code, registrationId: res.registration.id, name, method: "kiosk", staff: role?.name || null });
    }
    setBusy(false);
    onDone(`You're registered, ${name.split(" ")[0]}!`, "And checked in. Enjoy the event.");
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
      <BackBtn onBack={onBack} />
      <h2 className="text-xl font-semibold text-foreground">Register on the spot</h2>
      <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11" autoFocus /></Field>
      <Field label="Email" hint="For your ticket & updates (optional)."><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" className="h-11" /></Field>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <Button className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={submit}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Registering…" : "Register & check in"}
      </Button>
    </div>
  );
}

function BuyAction({ eventId, code, role, event, onDone, onBack }) {
  const tickets = useMemo(() => {
    const list = Array.isArray(event?.tickets) ? event.tickets : [];
    const mapped = list.filter((t) => t && (t.name || t.id)).map((t) => ({ id: t.id ?? null, name: t.name || "Ticket", price: Number(t.price) || 0 }));
    return mapped.length ? mapped : [{ id: null, name: "General Admission", price: 0 }];
  }, [event]);
  const [idx, setIdx] = useState(0);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ticket = tickets[idx];

  const submit = async () => {
    if (!name.trim()) return setErr("Enter your name.");
    setBusy(true);
    setErr("");
    const res = await buyTicket({ eventId, name, email, ticket: ticket.name, ticketId: ticket.id, price: ticket.price, quantity: 1, selections: { channel: "kiosk" } });
    if (!res?.ok) {
      setBusy(false);
      return setErr(res?.soldOut ? "That ticket is sold out." : "Couldn't complete — see staff.");
    }
    await admitCheckin({ eventId, code, orderId: res.orderId, name: name || "Guest", method: "kiosk", staff: role?.name || null });
    setBusy(false);
    onDone(`Enjoy, ${name.split(" ")[0]}!`, `${ticket.name} — you're in.`);
  };

  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 py-6">
      <BackBtn onBack={onBack} />
      <h2 className="text-xl font-semibold text-foreground">Buy a ticket</h2>
      <div className="grid gap-2">
        {tickets.map((t, i) => (
          <button key={t.id || t.name} type="button" onClick={() => setIdx(i)}
            className={cn("flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors", i === idx ? "border-primary bg-primary/10" : "border-border bg-surface-card")}>
            <span className="text-sm font-medium text-foreground">{t.name}</span>
            <span className="text-sm tabular-nums text-text-secondary">{t.price ? currency(t.price) : "Free"}</span>
          </button>
        ))}
      </div>
      <Field label="Full name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="h-11" /></Field>
      <Field label="Email"><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" className="h-11" /></Field>
      {err ? <p className="text-sm text-red-400">{err}</p> : null}
      <Button className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={submit}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {busy ? "Processing…" : ticket.price ? `Buy · ${currency(ticket.price)}` : "Get ticket"}
      </Button>
    </div>
  );
}

function BackBtn({ onBack }) {
  return (
    <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground">
      <ArrowLeft className="h-3.5 w-3.5" /> Back
    </button>
  );
}

function Kiosk({ eventId, code, role, exit, event }) {
  const [view, setView] = useState("idle"); // idle | menu | checkin | register | buy | done
  const [done, setDone] = useState(null);

  const finish = (title, message) => {
    setDone({ title, message });
    setView("done");
  };
  const toIdle = () => {
    setDone(null);
    setView("idle");
  };

  if (view === "done" && done) return <Done title={done.title} message={done.message} onDone={toIdle} />;

  if (view === "idle") {
    return (
      <button type="button" onClick={() => setView("menu")} className="flex min-h-[100dvh] w-full flex-col items-center justify-center gap-6 bg-background px-6 text-center text-foreground">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-surface-subtle text-primary">
          <ScanLine className="h-10 w-10" />
        </div>
        <div className="space-y-2">
          <p className="text-3xl font-semibold text-foreground">{event?.name || "Welcome"}</p>
          <p className="text-lg text-text-secondary">Tap anywhere to begin</p>
        </div>
      </button>
    );
  }

  if (view === "menu") {
    const actions = [
      { key: "checkin", label: "Check in", desc: "Already have a ticket", icon: ScanLine },
      { key: "register", label: "Register", desc: "Sign up on the spot", icon: UserPlus },
      { key: "buy", label: "Buy a ticket", desc: "Purchase entry", icon: Ticket },
    ];
    return (
      <div className="flex min-h-[100dvh] flex-col bg-background px-6 py-8 text-foreground">
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4">
          <div className="mb-2 flex items-center justify-between">
            <h1 className="text-2xl font-semibold">{event?.name || "Kiosk"}</h1>
            <Button variant="outline" size="sm" onClick={exit} className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">Exit</Button>
          </div>
          {actions.map((a) => (
            <button key={a.key} type="button" onClick={() => setView(a.key)}
              className="flex items-center gap-4 rounded-2xl border border-border bg-surface-subtle p-5 text-left transition-colors hover:border-border-strong hover:bg-surface-hover">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-primary">
                <a.icon className="h-6 w-6" />
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{a.label}</p>
                <p className="text-sm text-text-secondary">{a.desc}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const back = () => setView("menu");
  return (
    <div className="min-h-[100dvh] bg-background">
      {view === "checkin" ? <CheckinAction eventId={eventId} code={code} role={role} onDone={finish} onBack={back} /> : null}
      {view === "register" ? <RegisterAction eventId={eventId} code={code} role={role} onDone={finish} onBack={back} /> : null}
      {view === "buy" ? <BuyAction eventId={eventId} code={code} role={role} event={event} onDone={finish} onBack={back} /> : null}
    </div>
  );
}

export default function KioskPage() {
  const params = useParams();
  const eventId = Array.isArray(params?.eventId) ? params.eventId[0] : params?.eventId;
  const [event, setEvent] = useState(null);

  useEffect(() => {
    let alive = true;
    getEvent(eventId).then((row) => alive && setEvent(row));
    return () => {
      alive = false;
    };
  }, [eventId]);

  return (
    <AccessGate eventId={eventId} title="Kiosk setup" subtitle="Enter the staff access code to start kiosk mode." require="canScan">
      {({ code, role, exit }) => <Kiosk eventId={eventId} code={code} role={role} exit={exit} event={event} />}
    </AccessGate>
  );
}
