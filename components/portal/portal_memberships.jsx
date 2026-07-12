"use client";

import React from "react";
import { BadgeCheck, Check, CalendarClock, Loader2, Sparkles } from "lucide-react";

import { EmptyState, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Card, money, fmtDate, useCountdown, SectionTitle } from "./portal_kit";

const MEMBER_STATUS = {
  Active: { label: "Active", dotClass: "bg-emerald-400" },
  Expired: { label: "Expired", dotClass: "bg-amber-400" },
  Cancelled: { label: "Cancelled", dotClass: "bg-red-400" },
};

const periodSuffix = (p) => (p && p !== "one-time" ? `/${p === "monthly" ? "mo" : p === "yearly" ? "yr" : p}` : "");

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

function HeldCard({ m }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{m.planName}</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            {money(m.price)}
            {periodSuffix(m.billingPeriod)}
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
  );
}

function PlanCard({ plan, paymentsEnabled, busy, onBuy }) {
  const free = plan.price <= 0;
  const disabled = plan.held || busy || (!free && !paymentsEnabled);
  const label = plan.held
    ? "Current plan"
    : free
      ? "Join for free"
      : `Join — ${money(plan.price)}${periodSuffix(plan.billingPeriod)}`;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{plan.name}</p>
          <p className="mt-0.5 text-sm text-text-secondary">
            <span className="text-base font-semibold text-foreground">
              {free ? "Free" : money(plan.price)}
            </span>
            {!free ? (
              <span className="text-xs text-text-tertiary">{periodSuffix(plan.billingPeriod)}</span>
            ) : null}
            {plan.discountPercent ? ` · ${plan.discountPercent}% off tickets` : ""}
          </p>
        </div>
        {plan.held ? (
          <StatusPill status="Active" map={MEMBER_STATUS} />
        ) : (
          <Sparkles className="h-4 w-4 shrink-0 text-text-tertiary" />
        )}
      </div>

      {plan.description ? (
        <p className="mt-3 text-sm text-muted-foreground">{plan.description}</p>
      ) : null}

      {plan.benefits?.length ? (
        <ul className="mt-3 space-y-1.5">
          {plan.benefits.map((b, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
              {b}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex-1" />
      <Button
        type="button"
        disabled={disabled}
        onClick={() => onBuy(plan)}
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : label}
      </Button>
      {!free && !paymentsEnabled && !plan.held ? (
        <p className="mt-2 text-center text-xs text-text-tertiary">
          Online payments aren&apos;t available right now.
        </p>
      ) : null}
    </Card>
  );
}

export function PortalMemberships({
  memberships,
  plans = [],
  paymentsEnabled = false,
  busyPlanId = null,
  onBuy,
}) {
  const available = (plans || []).filter((p) => !p.held);
  const held = memberships || [];

  return (
    <div className="space-y-8">
      {held.length ? (
        <section>
          <SectionTitle>Your memberships</SectionTitle>
          <div className="space-y-3">
            {held.map((m) => (
              <HeldCard key={m.id} m={m} />
            ))}
          </div>
        </section>
      ) : null}

      {available.length ? (
        <section>
          <SectionTitle>{held.length ? "Available memberships" : "Join a membership"}</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2">
            {available.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                paymentsEnabled={paymentsEnabled}
                busy={busyPlanId === p.id}
                onBuy={onBuy}
              />
            ))}
          </div>
        </section>
      ) : null}

      {!held.length && !available.length ? (
        <EmptyState
          icon={BadgeCheck}
          title="No memberships"
          description="Memberships you hold will appear here. When an organizer offers one, you'll be able to join right from this page."
        />
      ) : null}
    </div>
  );
}

export default PortalMemberships;
