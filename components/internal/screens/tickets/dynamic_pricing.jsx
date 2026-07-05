"use client";

import React from "react";
import { TrendingUp } from "lucide-react";

import { SectionCard } from "@/components/internal/shared/screen_kit";
import { RecordsScreen } from "./records_kit";
import { NumField as Num } from "./controls";

const KINDS = [
  {
    value: "demand",
    label: "Demand rule",
    defaultConfig: { threshold: 75, bump: 10 },
  },
  {
    value: "resale",
    label: "Resale rule",
    defaultConfig: { maxPricePercent: 100, transferCap: 2 },
  },
];

function summarize(r) {
  const c = r.config || {};
  if (r.kind === "demand")
    return `+${c.bump}% once ${c.threshold}% sold`;
  if (r.kind === "resale")
    return `Resale ≤ ${c.maxPricePercent}% · ${c.transferCap} transfers`;
  return "";
}

function PricingEditForm({ record, config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  if (record.kind === "demand") {
    return (
      <SectionCard
        title="Demand-based pricing"
        description="Raise the price automatically as tickets sell through."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Trigger at"
            hint="% of tickets sold."
            value={config.threshold ?? 75}
            onChange={(v) => set({ threshold: v })}
            unit="% sold"
          />
          <Num
            label="Raise price by"
            value={config.bump ?? 10}
            onChange={(v) => set({ bump: v })}
            unit="%"
          />
        </div>
      </SectionCard>
    );
  }

  // resale
  return (
    <SectionCard
      title="Anti-scalping & resale"
      description="Rules for buyers who resell or transfer their tickets."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Num
          label="Max resale price"
          hint="% of face value."
          value={config.maxPricePercent ?? 100}
          onChange={(v) => set({ maxPricePercent: v })}
          unit="%"
        />
        <Num
          label="Transfers per ticket"
          value={config.transferCap ?? 2}
          onChange={(v) => set({ transferCap: v })}
        />
      </div>
    </SectionCard>
  );
}

export function DynamicPricingScreen() {
  return (
    <RecordsScreen
      module="pricing_rule"
      title="Dynamic Pricing"
      description="Reusable demand-based pricing and resale rules. Attach them to events that should price by demand."
      singular="rule"
      icon={TrendingUp}
      kinds={KINDS}
      summarize={summarize}
      EditForm={PricingEditForm}
    />
  );
}

export default DynamicPricingScreen;
