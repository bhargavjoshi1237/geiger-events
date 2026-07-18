"use client";

import React from "react";
import { Check, Clock, MapPin, Minus, Plus, ShoppingBag } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  slotBookingStatus,
  slotRemaining,
  bandLabel,
  parseSlotDate,
} from "@/lib/events/slots";
import { purchasableUnitPrice } from "@/lib/events/purchasables";

// Buyer-facing checkout pieces for slot booking + conditional purchasables.
// Rendered inside the TicketCheckout dialog (event_public_page.jsx): the slot
// picker sits in the details step, the purchasables list is the second slide.

function fmtSlotTime(slot) {
  const d = parseSlotDate(slot.start);
  if (!d) return bandLabel(slot.band);
  const start = d.toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
  const e = parseSlotDate(slot.end);
  return e
    ? `${start} – ${e.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" })}`
    : start;
}

// Radio list of bookable slots. Sold-out slots without a waitlist are disabled.
export function SlotPicker({ slots, slotsSold, ticketId, qty, selectedId, onSelect, accent, label }) {
  if (!slots?.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock className="h-4 w-4 text-muted-foreground" />
        {label || "Choose your time"}
        <span className="ml-1 text-red-400">*</span>
      </p>
      <div className="space-y-2">
        {slots.map((s) => {
          const status = slotBookingStatus(s, { ticketId, qty, slotsSold });
          const selected = selectedId === s.id;
          const remaining = slotRemaining(s, slotsSold);
          const disabled = !status.bookable;
          const delta = Number(s.priceDelta) || 0;
          return (
            <button
              key={s.id}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(s.id)}
              style={selected ? { borderColor: accent.color } : undefined}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                disabled
                  ? "cursor-not-allowed border-border bg-transparent opacity-50"
                  : selected
                    ? "bg-surface-card"
                    : "border-border bg-transparent hover:bg-surface-card",
              )}
            >
              <span
                style={
                  selected
                    ? { backgroundColor: accent.color, borderColor: accent.color }
                    : undefined
                }
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                  selected ? "" : "border-[#444]",
                )}
              >
                {selected ? <Check className="h-3 w-3" style={{ color: accent.text }} /> : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{s.label}</span>
                <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-text-secondary">
                  <span>{fmtSlotTime(s)}</span>
                  {s.location ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> {s.location}
                    </span>
                  ) : null}
                  {status.waitlisted ? (
                    <span className="text-amber-400">Waitlist</span>
                  ) : Number.isFinite(remaining) && remaining <= 10 ? (
                    <span className={disabled ? "text-red-400" : "text-text-tertiary"}>
                      {disabled && status.reason === "full"
                        ? "Full"
                        : disabled && status.reason === "cutoff"
                          ? "Closed"
                          : `${remaining} left`}
                    </span>
                  ) : null}
                </span>
              </span>
              {delta ? (
                <span className="shrink-0 text-sm font-medium tabular-nums text-white">
                  {delta > 0 ? `+$${delta}` : `-$${Math.abs(delta)}`}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function QuantityControl({ value, onChange, max, accent }) {
  const v = Number(value) || 0;
  const dec = () => onChange(Math.max(0, v - 1));
  const inc = () => onChange(max != null ? Math.min(max, v + 1) : v + 1);
  return (
    <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={dec}
        disabled={v <= 0}
        aria-label="Decrease"
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-active disabled:opacity-30"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-medium tabular-nums text-foreground">{v}</span>
      <button
        type="button"
        onClick={inc}
        disabled={max != null && v >= max}
        aria-label="Increase"
        style={v > 0 ? { backgroundColor: accent.color, color: accent.text, borderColor: accent.color } : undefined}
        className="flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-surface-active disabled:opacity-30"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

// The animated second step: the conditional purchasables the buyer can add.
export function TicketAddonsStep({ purchasables, selections, onToggle, onQty, accent }) {
  if (!purchasables?.length) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center text-text-secondary">
        <ShoppingBag className="h-6 w-6" />
        <p className="text-sm">No add-ons for this selection.</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Enhance your booking with these extras.
      </p>
      {purchasables.map((p) => {
        const sel = selections[p.id];
        const isQty = p.pickType === "quantity";
        const chosen = isQty ? (Number(sel) || 0) > 0 : !!sel;
        const lineTotal = purchasableUnitPrice(p, sel);
        return (
          <div
            key={p.id}
            role={isQty ? undefined : "button"}
            tabIndex={isQty ? undefined : 0}
            onClick={isQty ? undefined : () => onToggle(p.id)}
            onKeyDown={
              isQty
                ? undefined
                : (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onToggle(p.id);
                    }
                  }
            }
            style={chosen ? { borderColor: accent.color } : undefined}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-3 py-3 text-left transition-colors",
              isQty ? "border-border bg-surface-card" : "cursor-pointer",
              chosen && !isQty ? "bg-surface-card" : !isQty ? "border-border bg-transparent hover:bg-surface-card" : "",
            )}
          >
            {!isQty ? (
              <span
                style={chosen ? { backgroundColor: accent.color, borderColor: accent.color } : undefined}
                className={cn(
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  chosen ? "" : "border-[#444]",
                )}
              >
                {chosen ? <Check className="h-3 w-3" style={{ color: accent.text }} /> : null}
              </span>
            ) : null}
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                {p.name}
                {p.required ? <span className="text-red-400">*</span> : null}
              </p>
              {p.description ? (
                <p className="mt-0.5 text-xs text-text-secondary">{p.description}</p>
              ) : null}
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <span className="text-sm font-medium tabular-nums text-white">
                {Number(p.price) > 0 ? `+$${Number(p.price)}` : "Free"}
                {isQty ? <span className="text-xs text-text-tertiary"> ea</span> : null}
              </span>
              {isQty ? (
                <QuantityControl
                  value={sel}
                  onChange={(v) => onQty(p.id, v)}
                  max={p.maxPerOrder}
                  accent={accent}
                />
              ) : chosen && lineTotal > 0 ? (
                <span className="text-xs text-text-tertiary tabular-nums">${lineTotal}</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
