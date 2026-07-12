"use client";

import React from "react";
import { BadgeCheck, Check, CalendarClock } from "lucide-react";

import { EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";
import { Card, money, fmtDate, useCountdown } from "./portal_kit";

const MEMBER_STATUS = {
  Active: { label: "Active", dotClass: "bg-emerald-400" },
  Expired: { label: "Expired", dotClass: "bg-amber-400" },
  Cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
};

function RenewsIn({ dateStr }) {
  const p = useCountdown(dateStr);
  if (!p || p.done) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-subtle px-2 py-0.5 text-xs text-muted-foreground">
      <CalendarClock className="h-3.5 w-3.5" />
      Renews in {p.days} {p.days === 1 ? "day" : "days"}
    </span>
  );
}

export function PortalMemberships({ memberships }) {
  if (!memberships?.length) {
    return (
      <EmptyState
        icon={BadgeCheck}
        title="No memberships"
        description="Memberships you hold will appear here with their benefits and renewal dates."
      />
    );
  }
  return (
    <div className="space-y-3">
      {memberships.map((m) => (
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
            </div>
            <StatusPill status={m.status} map={MEMBER_STATUS} />
          </div>

          {m.description ? (
            <p className="mt-3 text-sm text-muted-foreground">{m.description}</p>
          ) : null}

          {m.benefits?.length ? (
            <ul className="mt-3 space-y-1.5">
              {m.benefits.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {b}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-text-tertiary">
            {m.startedAt ? <span>Since {fmtDate(m.startedAt)}</span> : null}
            {m.expiresAt ? <span>· Renews {fmtDate(m.expiresAt)}</span> : null}
            {m.status === "Active" ? <RenewsIn dateStr={m.expiresAt} /> : null}
          </div>
        </Card>
      ))}
    </div>
  );
}

export default PortalMemberships;
