"use client";

import React from "react";
import { CalendarClock } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultPaymentPlanConfig, CADENCE_OPTIONS } from "./constants";

function PaymentPlanForm({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Payment plans"
        description="Let buyers spread a ticket's cost over installments. Enable it here; events opt in on their edit page."
      >
        <SettingsList>
          <SettingRow
            icon={CalendarClock}
            title="Enable payment plans"
            description="Offer installment payments at checkout."
            checked={!!config.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Plan terms"
        description="Defaults for how installments are split."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Installments"
            hint="Number of payments after the deposit."
            value={config.installments ?? 3}
            onChange={(v) => set({ installments: v })}
            min={1}
            unit="payments"
          />
          <Num
            label="Deposit"
            hint="Taken up front at checkout."
            value={config.depositPercent ?? 20}
            onChange={(v) => set({ depositPercent: v })}
            unit="%"
          />
          <Field label="Cadence">
            <Select
              value={config.cadence || "monthly"}
              onValueChange={(v) => set({ cadence: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CADENCE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Num
            label="Late fee"
            hint="Charged on a missed installment. 0 = none."
            value={config.lateFee ?? 0}
            onChange={(v) => set({ lateFee: v })}
            unit="$"
          />
        </div>
      </SectionCard>
    </div>
  );
}

export function PaymentPlansScreen() {
  return (
    <SettingsScreen
      module="payment_plan"
      title="Payment Plans"
      description="Let buyers pay for tickets in installments. Configure the default plan here; events choose whether to offer it."
      defaultConfig={defaultPaymentPlanConfig}
      Form={PaymentPlanForm}
    />
  );
}

export default PaymentPlansScreen;
