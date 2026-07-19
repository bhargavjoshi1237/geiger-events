"use client";

import React, { useEffect, useState } from "react";
import { AlertCircle, Check, Clock, Loader2, ShoppingCart, Users } from "lucide-react";

import { Input, Switch, cn } from "@geiger/ui";
import { listRecords } from "@/lib/supabase/ticketing";
import { currency } from "./builders";

// Content access model — a reusable editor for "who can watch this". A piece of
// content is either Free (optionally registration-gated) or Restricted, in which
// case any combination of three paid paths unlocks it: an active membership, a
// one-time purchase, or a time-limited rental. Stored on a record's config as an
// `access` object; used by the "access" FieldControl type. Membership options are
// the project's membership plans (ticketing_records, module "membership").

export const DEFAULT_ACCESS = {
  free: true,
  registrationRequired: false,
  membership: { enabled: false, planIds: [] },
  purchase: { enabled: false, price: 0 },
  rental: { enabled: false, price: 0, days: 3 },
};

export function normalizeAccess(a) {
  const v = a && typeof a === "object" ? a : {};
  return {
    free: v.free === undefined ? true : Boolean(v.free),
    registrationRequired: Boolean(v.registrationRequired),
    membership: {
      enabled: Boolean(v.membership?.enabled),
      planIds: Array.isArray(v.membership?.planIds) ? v.membership.planIds : [],
    },
    purchase: { enabled: Boolean(v.purchase?.enabled), price: Number(v.purchase?.price) || 0 },
    rental: {
      enabled: Boolean(v.rental?.enabled),
      price: Number(v.rental?.price) || 0,
      days: Number(v.rental?.days) || 3,
    },
  };
}

// A short label for lists/pills — "Free", "Registered", or the enabled paths.
export function accessSummary(a) {
  const v = normalizeAccess(a);
  if (v.free) return v.registrationRequired ? "Registered" : "Free";
  const parts = [];
  if (v.membership.enabled) parts.push("Members");
  if (v.purchase.enabled) parts.push(`Buy ${currency(v.purchase.price)}`);
  if (v.rental.enabled) parts.push(`Rent ${currency(v.rental.price)}`);
  return parts.length ? parts.join(" · ") : "Restricted";
}

const PERIOD_SHORT = { monthly: "mo", yearly: "yr", "one-time": "once" };

// --- Small building blocks ---------------------------------------------------

function PriceInput({ value, onChange, placeholder = "0" }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-text-secondary">
        $
      </span>
      <Input
        type="number"
        min={0}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="pl-6"
      />
    </div>
  );
}

function MethodCard({ icon: Icon, title, desc, enabled, onToggle, children }) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        enabled ? "border-border-strong bg-surface-card" : "border-border bg-surface-subtle/40",
      )}
    >
      <div className="flex items-center gap-3 p-3.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-text-secondary">
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-text-secondary">{desc}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} />
      </div>
      {enabled && children ? (
        <div className="border-t border-border px-3.5 py-3.5">{children}</div>
      ) : null}
    </div>
  );
}

// --- The field ---------------------------------------------------------------

export function AccessControlField({ projectId, value, onChange }) {
  const v = normalizeAccess(value);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  useEffect(() => {
    if (!projectId) return undefined;
    let alive = true;
    listRecords(projectId, "membership").then((rows) => {
      if (!alive) return;
      setPlans((rows ?? []).filter((r) => r.active !== false));
      setLoadingPlans(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const patch = (partial) => onChange({ ...v, ...partial });
  const patchMethod = (key, partial) => patch({ [key]: { ...v[key], ...partial } });
  const togglePlan = (id) => {
    const has = v.membership.planIds.includes(id);
    patchMethod("membership", {
      planIds: has ? v.membership.planIds.filter((p) => p !== id) : [...v.membership.planIds, id],
    });
  };

  const noneEnabled =
    !v.membership.enabled && !v.purchase.enabled && !v.rental.enabled;

  return (
    <div className="space-y-3">
      {/* Free vs restricted */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { free: true, title: "Free to watch", desc: "Anyone with access can play it." },
          { free: false, title: "Paid / restricted", desc: "Membership, purchase, or rental." },
        ].map((opt) => {
          const active = v.free === opt.free;
          return (
            <button
              key={String(opt.free)}
              type="button"
              onClick={() => patch({ free: opt.free })}
              className={cn(
                "rounded-xl border px-3.5 py-3 text-left transition-colors",
                active
                  ? "border-primary/50 bg-primary/10"
                  : "border-border bg-surface-subtle/40 hover:bg-surface-hover",
              )}
            >
              <p className="text-sm font-medium text-foreground">{opt.title}</p>
              <p className="mt-0.5 text-xs text-text-secondary">{opt.desc}</p>
            </button>
          );
        })}
      </div>

      {v.free ? (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-subtle/40 px-3.5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">Require registration</p>
            <p className="text-xs text-text-secondary">Only registered attendees can watch.</p>
          </div>
          <Switch
            checked={v.registrationRequired}
            onCheckedChange={(on) => patch({ registrationRequired: on })}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {/* Membership */}
          <MethodCard
            icon={Users}
            title="Membership"
            desc="Members on the selected plans watch at no extra cost."
            enabled={v.membership.enabled}
            onToggle={(on) => patchMethod("membership", { enabled: on })}
          >
            {loadingPlans ? (
              <div className="flex items-center gap-2 text-xs text-text-secondary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading plans…
              </div>
            ) : plans.length ? (
              <div className="space-y-1.5">
                {plans.map((p) => {
                  const on = v.membership.planIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => togglePlan(p.id)}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
                        on
                          ? "border-primary/50 bg-primary/10"
                          : "border-border bg-surface-subtle hover:bg-surface-hover",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                          on
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border-strong",
                        )}
                      >
                        {on ? <Check className="h-3 w-3" /> : null}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{p.name}</span>
                      <span className="shrink-0 text-xs text-text-secondary">
                        {currency(p.config?.price)}
                        {p.config?.billingPeriod
                          ? `/${PERIOD_SHORT[p.config.billingPeriod] || p.config.billingPeriod}`
                          : ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-text-secondary">
                No membership plans yet — create one under Memberships to grant members access.
              </p>
            )}
          </MethodCard>

          {/* One-time purchase */}
          <MethodCard
            icon={ShoppingCart}
            title="One-time purchase"
            desc="Buyers own it and can watch any time."
            enabled={v.purchase.enabled}
            onToggle={(on) => patchMethod("purchase", { enabled: on })}
          >
            <div className="max-w-[10rem]">
              <PriceInput
                value={v.purchase.price}
                onChange={(val) => patchMethod("purchase", { price: val })}
              />
            </div>
          </MethodCard>

          {/* Rental */}
          <MethodCard
            icon={Clock}
            title="Rental"
            desc="Time-limited access from first play."
            enabled={v.rental.enabled}
            onToggle={(on) => patchMethod("rental", { enabled: on })}
          >
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-[10rem]">
                <p className="mb-1 text-xs text-text-secondary">Price</p>
                <PriceInput
                  value={v.rental.price}
                  onChange={(val) => patchMethod("rental", { price: val })}
                />
              </div>
              <div className="w-[8rem]">
                <p className="mb-1 text-xs text-text-secondary">Access window</p>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    value={v.rental.days ?? ""}
                    onChange={(e) => patchMethod("rental", { days: e.target.value })}
                    className="pr-12"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-secondary">
                    days
                  </span>
                </div>
              </div>
            </div>
          </MethodCard>

          {noneEnabled ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Enable at least one way to unlock this content.
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default AccessControlField;
