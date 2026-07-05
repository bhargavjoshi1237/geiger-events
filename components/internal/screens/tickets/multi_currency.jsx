"use client";

import React from "react";
import { Coins } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

function CurrencyEditForm({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  // Picking a preset code auto-fills its symbol.
  const pickCode = (code) => {
    const preset = CURRENCY_PRESETS.find((p) => p.code === code);
    set({ code, symbol: preset?.symbol || config.symbol || "" });
  };

  return (
    <div className="space-y-4">
      <SectionCard
        title="Currency"
        description="An accepted currency, listed at the Stripe payment stage."
      >
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

      <SectionCard
        title="Settlement"
        description="Where funds in this currency settle."
      >
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
    </div>
  );
}

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
      EditForm={CurrencyEditForm}
    />
  );
}

export default MultiCurrencyScreen;
