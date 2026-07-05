"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { CheckCircle2, Loader2, Minus, Plus, Ticket } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { getEvent } from "@/lib/supabase/events";
import { buyTicket } from "@/lib/supabase/orders";
import { admitCheckin, checkinStats } from "@/lib/supabase/checkin";
import { AccessGate } from "@/components/checkin_routes/access_gate";
import { RouteShell } from "@/components/checkin_routes/route_shell";

const METHODS = [
  { value: "cash", label: "Cash" },
  { value: "card", label: "Card" },
  { value: "comp", label: "Comp" },
];

const currency = (n) => `$${Number(n || 0).toLocaleString()}`;

function DoorPos({ eventId, code, role, exit, event }) {
  const tickets = useMemo(() => {
    const list = Array.isArray(event?.tickets) ? event.tickets : [];
    const mapped = list
      .filter((t) => t && (t.name || t.id))
      .map((t) => ({ id: t.id ?? null, name: t.name || "Ticket", price: Number(t.price) || 0 }));
    return mapped.length ? mapped : [{ id: null, name: "General Admission", price: 0 }];
  }, [event]);

  const [ticketIdx, setTicketIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [method, setMethod] = useState("cash");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [stats, setStats] = useState(null);

  const ticket = tickets[ticketIdx] || tickets[0];
  const isComp = method === "comp";
  const unit = isComp ? 0 : ticket.price;
  const total = unit * qty;

  useEffect(() => {
    checkinStats(eventId, code).then((s) => s && setStats(s));
  }, [eventId, code, receipt]);

  const reset = () => {
    setQty(1);
    setName("");
    setEmail("");
    setMethod("cash");
    setTicketIdx(0);
  };

  const sell = async () => {
    setSubmitting(true);
    const res = await buyTicket({
      eventId,
      name,
      email,
      ticket: ticket.name,
      ticketId: ticket.id,
      price: unit,
      quantity: qty,
      selections: { doorMethod: method },
    });
    if (!res?.ok) {
      setSubmitting(false);
      setReceipt({ error: res?.soldOut ? "That ticket is sold out." : "Couldn't complete the sale." });
      return;
    }
    // Auto-admit the walk-in buyer.
    await admitCheckin({
      eventId,
      code,
      orderId: res.orderId,
      name: name || "Walk-in",
      method: "door",
      staff: role?.name || null,
    });
    setSubmitting(false);
    setReceipt({
      ok: true,
      name: name || "Walk-in",
      ticket: ticket.name,
      qty,
      total,
      method,
    });
    reset();
  };

  if (receipt) {
    return (
      <RouteShell title={event?.name || "Door sales"} subtitle="Sale complete" count={stats} onExit={exit}>
        <div className="mx-auto max-w-sm space-y-5 pt-8 text-center">
          {receipt.ok ? (
            <>
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/15 text-emerald-300">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-semibold text-foreground">Sold & checked in</p>
                <p className="text-sm text-text-secondary">
                  {receipt.qty}× {receipt.ticket} · {currency(receipt.total)} ({receipt.method}) — {receipt.name} admitted.
                </p>
              </div>
            </>
          ) : (
            <div className="space-y-1">
              <p className="text-lg font-semibold text-red-300">Sale failed</p>
              <p className="text-sm text-text-secondary">{receipt.error}</p>
            </div>
          )}
          <Button className="h-12 w-full bg-primary text-base text-primary-foreground hover:bg-primary/90" onClick={() => setReceipt(null)}>
            New sale
          </Button>
        </div>
      </RouteShell>
    );
  }

  return (
    <RouteShell title={event?.name || "Door sales"} subtitle={role?.name ? `Selling as ${role.name}` : "Door sales"} count={stats} onExit={exit}>
      <div className="space-y-5">
        <SectionCard title="Ticket">
          <div className="grid gap-2 sm:grid-cols-2">
            {tickets.map((t, i) => (
              <button
                key={t.id || t.name}
                type="button"
                onClick={() => setTicketIdx(i)}
                className={cn(
                  "flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors",
                  i === ticketIdx ? "border-primary bg-primary/10" : "border-border bg-surface-card hover:border-border-strong",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Ticket className="h-4 w-4 text-text-secondary" /> {t.name}
                </span>
                <span className="text-sm tabular-nums text-text-secondary">{t.price ? currency(t.price) : "Free"}</span>
              </button>
            ))}
          </div>
        </SectionCard>

        <SectionCard title="Quantity & payment">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="icon" className="border-border bg-transparent" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease">
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-8 text-center text-lg font-semibold tabular-nums text-foreground">{qty}</span>
              <Button variant="outline" size="icon" className="border-border bg-transparent" onClick={() => setQty((q) => q + 1)} aria-label="Increase">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="inline-flex rounded-lg border border-border bg-surface-card p-0.5">
              {METHODS.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMethod(m.value)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    method === m.value ? "bg-surface-hover text-foreground" : "text-text-secondary hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Buyer">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in name" />
            </Field>
            <Field label="Email" hint="For their receipt & ticket (optional).">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@email.com" />
            </Field>
          </div>
        </SectionCard>

        <div className="sticky bottom-0 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-text-secondary">{qty}× {ticket.name} ({method})</p>
              <p className="text-xl font-bold tabular-nums text-foreground">{currency(total)}</p>
            </div>
            <Button className="h-12 shrink-0 bg-primary px-6 text-base text-primary-foreground hover:bg-primary/90" disabled={submitting} onClick={sell}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {submitting ? "Selling…" : "Sell & check in"}
            </Button>
          </div>
        </div>
      </div>
    </RouteShell>
  );
}

export default function DoorSalesPage() {
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
    <AccessGate eventId={eventId} title="Door sales" subtitle="Enter the staff access code to sell at the door." require="canSell" codeType="staff">
      {({ code, role, exit }) => <DoorPos eventId={eventId} code={code} role={role} exit={exit} event={event} />}
    </AccessGate>
  );
}
