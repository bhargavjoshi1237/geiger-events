"use client";

import React, { useEffect, useState } from "react";
import { BadgeCheck, CircleDollarSign, Gift, SquarePen } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import { listSeries } from "@/lib/supabase/series";
import {
  ENTITLEMENT_ITEMS,
  entitlementSummary,
  normalizeEntitlements,
} from "@/lib/memberships/entitlements";

import { RecordsScreen } from "../tickets/records_kit";
import { NumField as Num } from "../tickets/controls";
import {
  currency,
  defaultMembershipPlanConfig,
  BILLING_PERIOD_OPTIONS,
} from "../tickets/constants";
import { EntitlementEditor } from "./entitlement_editor";

const KINDS = [
  {
    value: "membership",
    label: "Membership",
    defaultConfig: defaultMembershipPlanConfig,
  },
];

// List-card summary: "$99/yearly · 10% member discount · VOD content, Special access".
function summarize(r) {
  const c = r.config || {};
  const price = Number(c.price) || 0;
  const priceStr =
    price === 0
      ? "Free"
      : `${currency(price)}${c.billingPeriod && c.billingPeriod !== "one-time" ? `/${c.billingPeriod}` : ""}`;
  const disc = Number(c.discountPercent) || 0;
  const parts = [priceStr, disc ? `${disc}% member discount` : "no discount"];
  if (c.applyToAllEvents) parts.push("All Events");
  const ents = normalizeEntitlements(c);
  const attached = ENTITLEMENT_ITEMS.filter((i) => ents[i.key].mode !== "none");
  if (attached.length) parts.push(attached.map((i) => i.label).join(", "));
  return parts.join(" · ");
}

// --- Sections ----------------------------------------------------------------

function PricingSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-secondary">$</span>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={config.price ?? 0}
              onChange={(e) => set({ price: Number(e.target.value) || 0 })}
              className="tabular-nums"
              placeholder="0"
            />
          </div>
        </Field>
        <Field label="Billing">
          <Select
            value={config.billingPeriod || "yearly"}
            onValueChange={(v) => set({ billingPeriod: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_PERIOD_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5">
        <Num
          label="Member discount"
          hint="Applied to ticket prices for members."
          value={config.discountPercent ?? 0}
          onChange={(v) => set({ discountPercent: v })}
          unit="%"
        />
        <label className="flex cursor-pointer items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-foreground">Apply to all events</p>
            <p className="text-xs text-text-secondary">
              On applies it everywhere (rare); off is per-event.
            </p>
          </div>
          <Switch
            checked={!!config.applyToAllEvents}
            onCheckedChange={(v) => set({ applyToAllEvents: v })}
          />
        </label>
      </div>
    </div>
  );
}

function BenefitsSection({ config, setConfig }) {
  const { projectId } = useProject();
  const [events, setEvents] = useState([]);
  const [series, setSeries] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [openItem, setOpenItem] = useState(ENTITLEMENT_ITEMS[0].key);
  const benefits = Array.isArray(config.benefits) ? config.benefits : [];
  const entitlements = normalizeEntitlements(config);

  // The "selected" scope targets events (and, for rich items, series), so the
  // editor needs both lists.
  useEffect(() => {
    let alive = true;
    Promise.all([listEvents(projectId), listSeries(projectId)]).then(([e, s]) => {
      if (!alive) return;
      setEvents(e ?? []);
      setSeries(s ?? []);
      setLoadingEvents(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const setEntitlement = (key) => (next) =>
    setConfig({ ...config, entitlements: { ...entitlements, [key]: next } });

  const active = ENTITLEMENT_ITEMS.find((i) => i.key === openItem) || ENTITLEMENT_ITEMS[0];

  return (
    <div className="space-y-8">
      <Field
        label="Perks"
        hint="One per line — shown on the plan card in the members portal."
      >
        <Textarea
          rows={4}
          value={benefits.join("\n")}
          onChange={(e) =>
            setConfig({
              ...config,
              benefits: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder={"Early access to tickets\nMember-only events\nPriority seating"}
        />
      </Field>

      {/* What's attached — one editor per attachable item type, switched by a
          row of cards so a long plan doesn't become one endless form. */}
      <div className="space-y-5 border-t border-border pt-6">
        <div>
          <p className="text-sm font-medium text-foreground">What&apos;s attached</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            What members can open once they join, and for how long.
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {ENTITLEMENT_ITEMS.map((item) => {
            const ent = entitlements[item.key];
            const on = ent.mode !== "none";
            const isOpen = item.key === active.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setOpenItem(item.key)}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  isOpen
                    ? "border-border-strong bg-surface-card"
                    : "border-border bg-surface-subtle/40 hover:bg-surface-hover",
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 shrink-0 rounded-full",
                      on ? "bg-emerald-400" : "bg-text-tertiary/50",
                    )}
                    aria-hidden
                  />
                  <span className="truncate text-sm font-medium text-foreground">
                    {item.label}
                  </span>
                </div>
                <p className="mt-1 truncate text-xs text-text-secondary">
                  {entitlementSummary(ent)}
                </p>
              </button>
            );
          })}
        </div>

        <div className="border-t border-border pt-5">
          <EntitlementEditor
            key={active.key}
            item={active}
            value={entitlements[active.key]}
            onChange={setEntitlement(active.key)}
            events={events}
            series={series}
            loadingEvents={loadingEvents}
          />
        </div>
      </div>
    </div>
  );
}

function DetailsSection({ config, setConfig }) {
  return (
    <Field label="Summary" hint="Shown to prospective members.">
      <Textarea
        rows={3}
        value={config.description || ""}
        onChange={(e) => setConfig({ ...config, description: e.target.value })}
        placeholder="e.g. Annual membership with perks across every event."
      />
    </Field>
  );
}

const SECTIONS = [
  {
    key: "pricing",
    label: "Pricing",
    icon: CircleDollarSign,
    desc: "What members pay, how often, and the discount they get on tickets.",
    render: PricingSection,
  },
  {
    key: "benefits",
    label: "Benefits",
    icon: Gift,
    desc: "The perks members see, and the content this plan unlocks for them.",
    render: BenefitsSection,
  },
  {
    key: "details",
    label: "Details",
    icon: SquarePen,
    desc: "How this plan describes itself to prospective members.",
    render: DetailsSection,
  },
];

export function MembershipPlansScreen() {
  return (
    <RecordsScreen
      module="membership"
      title="Membership Plans"
      description="Reusable membership tiers. Create a plan here, then attach it to events for special pricing and access."
      singular="plan"
      icon={BadgeCheck}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
    />
  );
}

export default MembershipPlansScreen;
