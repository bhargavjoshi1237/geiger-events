"use client";

import React from "react";
import { Percent } from "lucide-react";

import {
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RecordsScreen } from "./records_kit";
import { Segmented, NumField as Num } from "./controls";

const KINDS = [
  {
    value: "coupon",
    label: "Coupon",
    defaultConfig: {
      code: "",
      discountType: "percent",
      value: 10,
      usageLimit: 0,
    },
  },
  {
    value: "group",
    label: "Group rule",
    defaultConfig: { mode: "automatic", minQty: 5, percent: 10, code: "" },
  },
  {
    value: "earlybird",
    label: "Early-bird rule",
    defaultConfig: { until: "", percent: 15 },
  },
  {
    value: "affiliate",
    label: "Affiliate code",
    defaultConfig: { code: "", partner: "", commission: 0 },
  },
];

function summarize(r) {
  const c = r.config || {};
  if (r.kind === "coupon")
    return `${c.code || "no code"} · ${c.discountType === "flat" ? `$${c.value}` : `${c.value}%`} off`;
  if (r.kind === "group")
    return `${c.mode === "manual" ? "Manual" : "Auto"} · ${c.percent}% at ${c.minQty}+`;
  if (r.kind === "earlybird")
    return `${c.percent}% off until ${c.until || "—"}`;
  if (r.kind === "affiliate")
    return `${c.code || "no code"} · ${c.partner || "unassigned"}`;
  return "";
}

function DiscountEditForm({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  if (record.kind === "coupon") {
    return (
      <SectionCard title="Coupon" description="A code buyers enter at checkout.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code">
            <Input
              value={config.code || ""}
              onChange={(e) => set({ code: e.target.value })}
              placeholder="SAVE10"
              className="uppercase"
            />
          </Field>
          <Field label="Discount">
            <div className="flex items-center gap-2">
              <Select
                value={config.discountType || "percent"}
                onValueChange={(v) => set({ discountType: v })}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">% off</SelectItem>
                  <SelectItem value="flat">$ off</SelectItem>
                </SelectContent>
              </Select>
              <Input
                type="number"
                min={0}
                value={config.value ?? 0}
                onChange={(e) => set({ value: Number(e.target.value) || 0 })}
                className="w-24 tabular-nums"
              />
            </div>
          </Field>
          <Num
            label="Usage limit"
            hint="0 = unlimited."
            value={config.usageLimit ?? 0}
            onChange={(v) => set({ usageLimit: v })}
            unit="uses"
          />
        </div>
      </SectionCard>
    );
  }

  if (record.kind === "group") {
    return (
      <SectionCard
        title="Group purchasing"
        description="Reward buyers who bring a crowd."
      >
        <Field
          label="Discount mode"
          hint="Automatic applies at a quantity threshold; Manual gives groups a code."
        >
          <Segmented
            value={config.mode || "automatic"}
            onChange={(v) => set({ mode: v })}
            options={[
              { value: "automatic", label: "Automatic" },
              { value: "manual", label: "Manual code" },
            ]}
          />
        </Field>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Num
            label="Min. quantity"
            value={config.minQty ?? 5}
            onChange={(v) => set({ minQty: v })}
            unit="tickets"
          />
          <Num
            label="Discount"
            value={config.percent ?? 10}
            onChange={(v) => set({ percent: v })}
            unit="%"
          />
          {config.mode === "manual" ? (
            <Field label="Group code">
              <Input
                value={config.code || ""}
                onChange={(e) => set({ code: e.target.value })}
                placeholder="TEAM"
                className="uppercase"
              />
            </Field>
          ) : null}
        </div>
      </SectionCard>
    );
  }

  if (record.kind === "earlybird") {
    return (
      <SectionCard
        title="Early-bird"
        description="A limited-time discount before a cut-off date."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Discount"
            value={config.percent ?? 15}
            onChange={(v) => set({ percent: v })}
            unit="%"
          />
          <Field label="Available until">
            <Input
              type="date"
              value={config.until || ""}
              onChange={(e) => set({ until: e.target.value })}
            />
          </Field>
        </div>
      </SectionCard>
    );
  }

  // affiliate
  return (
    <SectionCard
      title="Affiliate code"
      description="A tracked code that attributes sales to a partner."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code">
          <Input
            value={config.code || ""}
            onChange={(e) => set({ code: e.target.value })}
            placeholder="PARTNER"
            className="uppercase"
          />
        </Field>
        <Field label="Partner name">
          <Input
            value={config.partner || ""}
            onChange={(e) => set({ partner: e.target.value })}
            placeholder="e.g. City Radio"
          />
        </Field>
        <Num
          label="Commission"
          hint="Paid to the partner per sale."
          value={config.commission ?? 0}
          onChange={(v) => set({ commission: v })}
          unit="%"
        />
      </div>
    </SectionCard>
  );
}

export function DiscountsScreen() {
  return (
    <RecordsScreen
      module="discount"
      title="Discounts & Codes"
      description="Reusable coupons and discount rules. Create them here, then attach to any event from its edit page."
      singular="discount"
      icon={Percent}
      kinds={KINDS}
      summarize={summarize}
      EditForm={DiscountEditForm}
    />
  );
}

export default DiscountsScreen;
