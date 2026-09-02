"use client";

import React from "react";
import { Banknote, Percent, UserRound, Wallet } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { IconInput } from "@/components/internal/shared/icon_input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { RecordsScreen } from "./records_kit";
import { Segmented } from "./controls";

const KINDS = [
  {
    value: "account",
    label: "Payout account",
    defaultConfig: {
      method: "stripe",
      schedule: "weekly",
      feesTo: "organizer",
      account: "",
    },
  },
];

const METHODS = [
  { value: "stripe", label: "Stripe" },
  { value: "bank", label: "Bank transfer" },
  { value: "paypal", label: "PayPal" },
];
const SCHEDULES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "on-request", label: "On request" },
];

function summarize(r) {
  const c = r.config || {};
  const m = METHODS.find((x) => x.value === c.method)?.label || c.method;
  return `${m} · ${c.schedule || "weekly"}`;
}

// --- Edit sections ----------------------------------------------------------
// records_kit renders each as an element, never calls it.

function DestinationSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Method">
          <Select
            value={config.method || "stripe"}
            onValueChange={(v) => set({ method: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Schedule">
          <Select
            value={config.schedule || "weekly"}
            onValueChange={(v) => set({ schedule: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SCHEDULES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label={config.method === "paypal" ? "PayPal email" : "Account"}
          hint="Where funds are sent."
          className="sm:col-span-2"
        >
          <IconInput
            icon={Wallet}
            wrapperClassName="max-w-sm"
            className="w-full"
            value={config.account || ""}
            onChange={(e) => set({ account: e.target.value })}
            placeholder={
              config.method === "paypal"
                ? "payouts@yourorg.com"
                : "Account ending 4242"
            }
          />
        </Field>
      </div>
    </SectionCard>
  );
}

function FeesSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <SettingRow
        title="Who pays the fee"
        description="Absorb it into your revenue, or add it on top of the buyer's total."
        control={
          <Segmented
            value={config.feesTo || "organizer"}
            onChange={(v) => set({ feesTo: v })}
            options={[
              { value: "organizer", label: "Absorb fees", icon: Wallet },
              { value: "buyer", label: "Pass to buyer", icon: UserRound },
            ]}
          />
        }
      />
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "destination",
    label: "Destination",
    icon: Wallet,
    desc: "Where payouts are sent, and how often.",
    render: DestinationSection,
  },
  {
    key: "fees",
    label: "Processing fees",
    icon: Percent,
    desc: "Whether you absorb processing fees or pass them to the buyer.",
    render: FeesSection,
  },
];

export function PayoutsScreen() {
  return (
    <RecordsScreen
      module="payout"
      title="Payouts"
      description="Reusable payout accounts — where ticket revenue lands, and when. Attach one to an event."
      singular="payout account"
      icon={Banknote}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
    />
  );
}

export default PayoutsScreen;
