"use client";

import { ArrowRight, Check, Loader2, Lock, Zap } from "lucide-react";

import { Button } from "@geiger/ui/button";

import { cn } from "@/lib/utils";

import { QtyStepper } from "./qty_stepper";
import { PurchaseDisclaimerBody } from "./purchase_gate";

const money = (n) => `$${(Math.round((Number(n) || 0) * 100) / 100).toLocaleString("en-US")}`;

function ClickTrail({ clicks, accent }) {
  return (
    <div className="flex items-center gap-1.5" aria-label={`${clicks} clicks to checkout`}>
      {Array.from({ length: clicks }, (_, i) => (
        <span
          key={i}
          className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold tabular-nums"
          style={
            i === 0
              ? { backgroundColor: accent.color, color: accent.text, borderColor: accent.color }
              : { borderColor: `color-mix(in srgb, ${accent.color} 45%, transparent)`, color: accent.color }
          }
        >
          {i === 0 ? <Check className="h-3 w-3" /> : i + 1}
        </span>
      ))}
    </div>
  );
}

function TicketChoice({ ticket, on, onPick, accent }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
        on ? "bg-surface-card" : "border-border hover:border-border-strong hover:bg-surface-active",
      )}
      style={on ? { borderColor: accent.color } : undefined}
    >
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium text-foreground">{ticket.name}</span>
        {ticket.note ? (
          <span className="block truncate text-xs text-text-tertiary">{ticket.note}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
        {money(ticket.price)}
      </span>
    </button>
  );
}

// Pure view of the Express Lane sheet — the runtime step and the editor preview both render it.
export function ExpressSheet({
  cfg,
  tickets,
  ticketId,
  onTicket,
  qty,
  setQty,
  maxQty,
  unitPrice,
  effUnit,
  total,
  gate,
  gateChecked,
  setGateChecked,
  clicks = 2,
  payerEmail,
  busy,
  onPay,
  onFullCheckout,
  accent,
  accentStyle,
}) {
  const current = tickets.find((t) => String(t.id) === String(ticketId)) || tickets[0];
  const canSwitch = cfg.allowTicketSwitch && tickets.length > 1;
  const canQty = cfg.allowQuantity && maxQty > 1;
  const ready = !(gate?.requireCheck && !gateChecked);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs font-medium text-text-secondary">
          <Zap className="h-3.5 w-3.5" style={{ color: accent.color }} />
          {cfg.tagline || "Two clicks to your tickets"}
        </p>
        <ClickTrail clicks={clicks} accent={accent} />
      </div>

      {canSwitch ? (
        <div className="space-y-1.5">
          {tickets.map((t) => (
            <TicketChoice
              key={t.id ?? t.name}
              ticket={t}
              on={current && String(t.id) === String(current.id)}
              onPick={() => onTicket?.(t.id)}
              accent={accent}
            />
          ))}
        </div>
      ) : current ? (
        <TicketChoice ticket={current} on accent={accent} />
      ) : null}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
        {canQty ? (
          <QtyStepper qty={qty} setQty={setQty} max={maxQty} accent={accent} />
        ) : (
          <span className="text-sm text-text-secondary">
            {qty} ticket{qty > 1 ? "s" : ""}
          </span>
        )}
        <div className="text-right">
          {effUnit < unitPrice ? (
            <span className="mr-1.5 text-xs text-text-tertiary line-through tabular-nums">
              {money(unitPrice * qty)}
            </span>
          ) : null}
          <span className="text-lg font-bold tabular-nums text-foreground">{money(total)}</span>
        </div>
      </div>

      {gate ? (
        <PurchaseDisclaimerBody
          cfg={gate}
          checked={gateChecked}
          onCheckedChange={setGateChecked}
          scroll
        />
      ) : null}

      <div className="space-y-2">
        <Button
          style={ready ? accentStyle : undefined}
          disabled={busy || !ready}
          className="h-11 w-full text-base hover:opacity-90 disabled:opacity-50"
          onClick={onPay}
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Lock className="h-4 w-4" />
              Pay {money(total)}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
        <p className="text-center text-[11px] leading-snug text-text-tertiary">
          {payerEmail
            ? `Paying as ${payerEmail} — `
            : cfg.collectName
              ? "Your name, email and card are taken on Stripe — "
              : "Your email and card are taken on Stripe — "}
          {gate && !gate.requireCheck ? "by paying you accept the terms above." : "nothing else to fill in here."}
        </p>
      </div>

      {cfg.showFullCheckout && onFullCheckout ? (
        <div className="border-t border-border pt-3 text-center">
          <button
            type="button"
            onClick={onFullCheckout}
            className="text-xs font-medium text-text-secondary underline-offset-4 hover:text-foreground hover:underline"
          >
            Need add-ons, a promo code or a time slot? Use full checkout
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ExpressStep({ checkout, accent, accentStyle }) {
  const {
    expressCfg,
    expressOptions,
    ticket,
    setExpressTicketId,
    qty,
    setQty,
    expressMaxQty,
    price,
    effPrice,
    total,
    expressGate,
    gateChecked,
    setGateChecked,
    expressClickCount,
    expressPayerEmail,
    busy,
    expressPay,
    leaveExpress,
  } = checkout;

  return (
    <ExpressSheet
      cfg={expressCfg}
      tickets={expressOptions}
      ticketId={ticket?.id}
      onTicket={setExpressTicketId}
      qty={qty}
      setQty={setQty}
      maxQty={expressMaxQty}
      unitPrice={price}
      effUnit={effPrice}
      total={total}
      gate={expressGate}
      gateChecked={gateChecked}
      setGateChecked={setGateChecked}
      clicks={expressClickCount}
      payerEmail={expressPayerEmail}
      busy={busy}
      onPay={expressPay}
      onFullCheckout={leaveExpress}
      accent={accent}
      accentStyle={accentStyle}
    />
  );
}
