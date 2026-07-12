"use client";

import React from "react";
import { BadgeCheck } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
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

import { RecordsScreen } from "../tickets/records_kit";
import { NumField as Num } from "../tickets/controls";
import {
  currency,
  defaultMembershipPlanConfig,
  BILLING_PERIOD_OPTIONS,
} from "../tickets/constants";

const KINDS = [
  {
    value: "membership",
    label: "Membership",
    defaultConfig: defaultMembershipPlanConfig,
  },
];

const periodLabel = (value) =>
  BILLING_PERIOD_OPTIONS.find((o) => o.value === value)?.label || value;

// List-card summary: "$99/yearly · 10% member discount".
function summarize(r) {
  const c = r.config || {};
  const price = Number(c.price) || 0;
  const priceStr =
    price === 0
      ? "Free"
      : `${currency(price)}${c.billingPeriod && c.billingPeriod !== "one-time" ? `/${c.billingPeriod}` : ""}`;
  const disc = Number(c.discountPercent) || 0;
  const parts = [priceStr, disc ? `${disc}% member discount` : "no discount"];
  if (c.applyToAllEvents) parts.push("All events");
  return parts.join(" · ");
}

function MembershipPlanEditForm({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const benefits = Array.isArray(config.benefits) ? config.benefits : [];
  return (
    <div className="space-y-4">
      <SectionCard
        title="Pricing"
        description="What members pay, and how often."
      >
        <div className="space-y-4">
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

          {/* Member discount spans full width, with its scope switch inline. */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface-card px-3.5 py-3">
            <Num
              label="Member discount"
              hint="Applied to ticket prices for members."
              value={config.discountPercent ?? 0}
              onChange={(v) => set({ discountPercent: v })}
              unit="%"
            />
            <label className="flex cursor-pointer items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-medium text-foreground">
                  Apply to all events
                </p>
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
      </SectionCard>

      <SectionCard
        title="Benefits"
        description="What this membership includes — one per line."
      >
        <Textarea
          rows={4}
          value={benefits.join("\n")}
          onChange={(e) =>
            set({
              benefits: e.target.value
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
          placeholder={"Early access to tickets\nMember-only events\nPriority seating"}
        />
      </SectionCard>

      <SectionCard title="Description">
        <Field label="Summary" hint="Shown to prospective members.">
          <Textarea
            rows={2}
            value={config.description || ""}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="e.g. Annual membership with perks across every event."
          />
        </Field>
      </SectionCard>
    </div>
  );
}

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
      EditForm={MembershipPlanEditForm}
    />
  );
}

export default MembershipPlansScreen;
