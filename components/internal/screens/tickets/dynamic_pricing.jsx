"use client";

import React from "react";
import {
  CalendarDays,
  Gauge,
  Hourglass,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";

import { RecordsScreen } from "./records_kit";
import { Segmented, withIcons, NumField as Num } from "./controls";
import {
  defaultDemandRuleConfig,
  defaultPricingResaleRuleConfig,
  defaultQuantityRuleConfig,
  defaultTimeRuleConfig,
  PRICING_ADJUSTMENT_OPTIONS,
  PRICING_DIRECTION_OPTIONS,
  QUANTITY_APPLY_OPTIONS,
  TIME_TRIGGER_OPTIONS,
  pricingRuleSummary,
} from "./constants";

// Icons are attached here rather than in constants.js so that module stays
// plain data.
const DIRECTION_OPTIONS = withIcons(PRICING_DIRECTION_OPTIONS, {
  increase: TrendingUp,
  decrease: TrendingDown,
});
const TRIGGER_OPTIONS = withIcons(TIME_TRIGGER_OPTIONS, {
  days_before: Hourglass,
  on_date: CalendarDays,
});

// Four kinds of reusable rule. Three move the ticket price — each is a trigger
// plus an adjustment — and `resale` caps what a buyer may resell a ticket for.
const KINDS = [
  {
    value: "demand",
    label: "Sell-through rule",
    defaultConfig: defaultDemandRuleConfig,
  },
  {
    value: "time",
    label: "Date & time rule",
    defaultConfig: defaultTimeRuleConfig,
  },
  {
    value: "quantity",
    label: "Quantity rule",
    defaultConfig: defaultQuantityRuleConfig,
  },
  {
    value: "resale",
    label: "Resale rule",
    defaultConfig: defaultPricingResaleRuleConfig,
  },
];

// Guardrails are optional: an emptied field stores null rather than 0, and null
// renders back as an empty input.
const toAmount = (raw) => (raw === "" ? null : Number(raw) || 0);
const fromAmount = (v) => (v == null ? "" : v);

// A flat adjustment is money, so it takes a "$" prefix; a percent one reads
// better as a unit on the number field.
function AdjustmentValue({ config, set }) {
  if (config.adjustment === "flat") {
    return (
      <Field label="Amount" hint="Added to, or taken off, the ticket price.">
        <div className="flex items-center gap-1.5">
          <span className="text-sm text-text-secondary">$</span>
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            value={config.value ?? 0}
            onChange={(e) => set({ value: Number(e.target.value) || 0 })}
            className="max-w-[10rem] tabular-nums"
            placeholder="0"
          />
        </div>
      </Field>
    );
  }

  return (
    <Num
      label="Percent"
      hint="Share of the ticket price this rule moves."
      value={config.value ?? 0}
      onChange={(v) => set({ value: v })}
      unit="%"
      fullWidth
    />
  );
}

// Direction + size of the change — shared by the time and quantity kinds.
function AdjustmentFields({ config, set }) {
  return (
    <div className="space-y-4">
      <Field label="Direction">
        <Segmented
          className="w-fit"
          value={config.direction || "decrease"}
          onChange={(v) => set({ direction: v })}
          options={DIRECTION_OPTIONS}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Adjust by">
          <Select
            value={config.adjustment || "percent"}
            onValueChange={(v) => set({ adjustment: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRICING_ADJUSTMENT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <AdjustmentValue config={config} set={set} />
      </div>
    </div>
  );
}

// --- Edit sections ----------------------------------------------------------
// records_kit renders each as an element, never calls it. Every kind carries a
// different trigger and a different adjustment, so each section branches on
// `record.kind` — the same shape Discounts uses for its four kinds.

function TriggerSection({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const kind = record.kind || "demand";

  if (kind === "demand") {
    return (
      <SectionCard bare>
        <Num
          label="Trigger at"
          hint="Share of the allocation that must sell before the price moves."
          value={config.threshold ?? 75}
          onChange={(v) => set({ threshold: v })}
          unit="% sold"
          fullWidth
        />
      </SectionCard>
    );
  }

  if (kind === "time") {
    return (
      <SectionCard bare>
        <div className="space-y-4">
          <Field label="Arms">
            <Segmented
              className="w-fit"
              value={config.trigger || "days_before"}
              onChange={(v) => set({ trigger: v })}
              options={TRIGGER_OPTIONS}
            />
          </Field>
          {config.trigger === "on_date" ? (
            <Field
              label="Date & time"
              hint="The ticket price changes from this moment on."
            >
              <Input
                type="datetime-local"
                value={config.at || ""}
                onChange={(e) => set({ at: e.target.value })}
                className="max-w-[16rem]"
              />
            </Field>
          ) : (
            <Num
              label="Days before the event"
              hint="Counted back from the event's start."
              value={config.daysBefore ?? 14}
              onChange={(v) => set({ daysBefore: v })}
              unit="days"
              fullWidth
            />
          )}
        </div>
      </SectionCard>
    );
  }

  if (kind === "quantity") {
    return (
      <SectionCard bare>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Minimum tickets"
            hint="Tickets in one order that arm the rule."
            value={config.minQty ?? 4}
            onChange={(v) => set({ minQty: v })}
            min={2}
            unit="tickets"
            fullWidth
          />
          <Field label="Applies">
            <Select
              value={config.applyPer || "ticket"}
              onValueChange={(v) => set({ applyPer: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUANTITY_APPLY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>
    );
  }

  // resale
  return (
    <SectionCard bare>
      <Num
        label="Transfers per ticket"
        hint="How many times one ticket may change hands."
        value={config.transferCap ?? 2}
        onChange={(v) => set({ transferCap: v })}
        unit="transfers"
        fullWidth
      />
    </SectionCard>
  );
}

function AdjustmentSection({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const kind = record.kind || "demand";

  if (kind === "demand") {
    return (
      <SectionCard bare>
        <Num
          label="Raise price by"
          hint="Applied on top of the listed price once the trigger is reached."
          value={config.bump ?? 10}
          onChange={(v) => set({ bump: v })}
          unit="%"
          fullWidth
        />
      </SectionCard>
    );
  }

  if (kind === "resale") {
    return (
      <SectionCard bare>
        <Num
          label="Max resale price"
          hint="Ceiling for a resale listing, as a share of face value. 100% means a buyer may not list above what they paid."
          value={config.maxPricePercent ?? 100}
          onChange={(v) => set({ maxPricePercent: v })}
          unit="% of face"
          fullWidth
        />
      </SectionCard>
    );
  }

  return (
    <SectionCard bare>
      <AdjustmentFields config={config} set={set} />
    </SectionCard>
  );
}

// A rule can move the price a long way once several stack, so every
// price-moving kind carries an optional floor and ceiling. Resale rules cap a
// listing rather than the ticket price, so they get a pointer instead.
function GuardrailsSection({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  if (record.kind === "resale") {
    return (
      <SectionCard bare>
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-text-secondary">
          A resale rule caps what a buyer may list a ticket for — it never moves
          the ticket&apos;s own price, so there is nothing to bound here.
        </p>
      </SectionCard>
    );
  }

  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Price floor" hint="Blank = no floor.">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-secondary">$</span>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={fromAmount(config.floor)}
              onChange={(e) => set({ floor: toAmount(e.target.value) })}
              className="tabular-nums"
              placeholder="No floor"
            />
          </div>
        </Field>
        <Field label="Price ceiling" hint="Blank = no ceiling.">
          <div className="flex items-center gap-1.5">
            <span className="text-sm text-text-secondary">$</span>
            <Input
              type="number"
              min={0}
              inputMode="decimal"
              value={fromAmount(config.ceiling)}
              onChange={(e) => set({ ceiling: toAmount(e.target.value) })}
              className="tabular-nums"
              placeholder="No ceiling"
            />
          </div>
        </Field>
      </div>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "trigger",
    label: "Trigger",
    icon: Gauge,
    desc: "What has to happen before this rule moves the price.",
    render: TriggerSection,
  },
  {
    key: "adjustment",
    label: "Price change",
    icon: TrendingUp,
    desc: "How far the price moves once the trigger is met.",
    render: AdjustmentSection,
  },
  {
    key: "guardrails",
    label: "Guardrails",
    icon: SlidersHorizontal,
    desc: "Keep the resulting price inside a range.",
    render: GuardrailsSection,
  },
];

export function DynamicPricingScreen() {
  return (
    <RecordsScreen
      module="pricing_rule"
      title="Dynamic Pricing"
      description="Reusable pricing rules — by sell-through, by date, or by how many tickets a buyer takes. Create one here, then attach it to any event."
      singular="rule"
      icon={TrendingUp}
      kinds={KINDS}
      summarize={pricingRuleSummary}
      sections={SECTIONS}
    />
  );
}

export default DynamicPricingScreen;
