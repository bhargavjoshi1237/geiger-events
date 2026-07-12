"use client";

import React from "react";
import { Ticket, BadgeCheck, ShoppingBag } from "lucide-react";

import { EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

const ORDER_STATUS = {
  confirmed: { label: "Confirmed", dotClass: "bg-emerald-400" },
  cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
  refunded: { label: "Refunded", dotClass: "bg-sky-400" },
};
const MEMBER_STATUS = {
  Active: { label: "Active", dotClass: "bg-emerald-400" },
  Expired: { label: "Expired", dotClass: "bg-amber-400" },
  Cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
};

function Card({ children }) {
  return (
    <div className="rounded-xl border border-border bg-surface-card p-4">
      {children}
    </div>
  );
}

export function OrdersList({ items }) {
  if (!items?.length) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="No orders yet"
        description="Your ticket purchases will show up here."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((o) => (
        <Card key={o.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{o.eventName}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {o.ticket} × {o.quantity} · {fmtDate(o.createdAt)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <StatusPill status={o.status} map={ORDER_STATUS} />
              <span className="text-sm tabular-nums text-foreground">
                {money(o.total)}
              </span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

export function TicketsList({ items }) {
  if (!items?.length) {
    return (
      <EmptyState
        icon={Ticket}
        title="No tickets yet"
        description="Tickets from your purchases will appear here."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((t) => (
        <Card key={t.id}>
          <p className="text-sm font-semibold text-foreground">{t.eventName}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {t.ticket} × {t.quantity}
            {t.eventDate ? ` · ${fmtDate(t.eventDate)}` : ""}
          </p>
        </Card>
      ))}
    </div>
  );
}

export function MembershipsList({ items }) {
  if (!items?.length) {
    return (
      <EmptyState
        icon={BadgeCheck}
        title="No memberships"
        description="Memberships you hold will appear here."
      />
    );
  }
  return (
    <div className="space-y-3">
      {items.map((m) => (
        <Card key={m.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{m.planName}</p>
              <p className="mt-0.5 text-xs text-text-secondary">
                {money(m.price)}
                {m.billingPeriod && m.billingPeriod !== "one-time"
                  ? `/${m.billingPeriod}`
                  : ""}
                {m.discountPercent ? ` · ${m.discountPercent}% member discount` : ""}
              </p>
              <p className="mt-0.5 text-xs text-text-tertiary">
                {m.startedAt ? `Since ${fmtDate(m.startedAt)}` : ""}
                {m.expiresAt ? ` · renews ${fmtDate(m.expiresAt)}` : ""}
              </p>
            </div>
            <StatusPill status={m.status} map={MEMBER_STATUS} />
          </div>
        </Card>
      ))}
    </div>
  );
}
