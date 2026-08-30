"use client";

import React from "react";
import { CircleDollarSign, Coins, Landmark } from "lucide-react";

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
import { defaultCurrencyConfig, CURRENCY_PRESETS } from "./constants";

const KINDS = [
  { value: "currency", label: "Currency", defaultConfig: defaultCurrencyConfig },
];

// List-card summary line: "USD · $ · rate 1.00".
function summarize(r) {
  const c = r.config || {};
  return `${c.code || "—"} · ${c.symbol || "?"} · rate ${Number(c.rate ?? 1).toFixed(2)}`;
}

// --- Edit sections ----------------------------------------------------------
// records_kit renders each as an element, never calls it.

function CurrencySection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  // Picking a preset code auto-fills its symbol.
  const pickCode = (code) => {
    const preset = CURRENCY_PRESETS.find((p) => p.code === code);
    set({ code, symbol: preset?.symbol || config.symbol || "" });
  };

  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Code">
          <Select value={config.code || "USD"} onValueChange={pickCode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCY_PRESETS.map((p) => (
                <SelectItem key={p.code} value={p.code}>
                  {p.code} · {p.symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Symbol">
          <Input
            value={config.symbol || ""}
            onChange={(e) => set({ symbol: e.target.value })}
            className="w-24"
            placeholder="$"
          />
        </Field>
        <Field label="Rate" hint="Conversion from your base currency.">
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={config.rate ?? 1}
            onChange={(e) => set({ rate: Number(e.target.value) || 0 })}
            className="w-32 tabular-nums"
            placeholder="1.00"
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function SettlementSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <Field
        label="Stripe account"
        hint="The connected Stripe account or id that receives this currency."
      >
        <Input
          value={config.stripeAccount || ""}
          onChange={(e) => set({ stripeAccount: e.target.value })}
          className="max-w-sm"
          placeholder="acct_1A2B3C…"
        />
      </Field>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "currency",
    label: "Currency",
    icon: CircleDollarSign,
    desc: "An accepted currency, listed at the Stripe payment stage.",
    render: CurrencySection,
  },
  {
    key: "settlement",
    label: "Settlement",
    icon: Landmark,
    desc: "Where funds in this currency settle.",
    render: SettlementSection,
  },
];

export function MultiCurrencyScreen() {
  return (
    <RecordsScreen
      module="currency"
      title="Multi-currency"
      description="Reusable currencies buyers can pay in. Add one here, then it's offered at the Stripe payment stage."
      singular="currency"
      icon={Coins}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
    />
  );
}

export default MultiCurrencyScreen;
