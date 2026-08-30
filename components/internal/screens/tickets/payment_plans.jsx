"use client";

import React from "react";
import { CalendarClock, SlidersHorizontal } from "lucide-react";

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
} from "@geiger/ui/select";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultPaymentPlanConfig, CADENCE_OPTIONS } from "./constants";

// --- Edit sections -----------------------------------------------------------
// settings_kit renders each as an element, never calls it.

function PaymentPlansSection({ config, set }) {
  return (
    <SectionCard bare>
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
  );
}

function PlanTermsSection({ config, set }) {
  return (
    <SectionCard bare>
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
  );
}

const SECTIONS = [
  {
    key: "plans",
    label: "Payment plans",
    icon: CalendarClock,
    desc: "Let buyers spread a ticket's cost over installments.",
    render: PaymentPlansSection,
  },
  {
    key: "terms",
    label: "Plan terms",
    icon: SlidersHorizontal,
    desc: "Defaults for how installments are split.",
    render: PlanTermsSection,
  },
];

export function PaymentPlansScreen() {
  return (
    <SettingsScreen
      module="payment_plan"
      title="Payment Plans"
      description="Let buyers pay for tickets in installments. Configure the default plan here; events choose whether to offer it."
      defaultConfig={defaultPaymentPlanConfig}
      sections={SECTIONS}
    />
  );
}

export default PaymentPlansScreen;
