"use client";

import React from "react";
import { Gift, Heart } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultDonationConfig } from "./constants";

// Parse "5, 10, 25" into [5, 10, 25]; keep only positive numbers.
const parseAmounts = (str) =>
  String(str)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

// --- Edit sections -----------------------------------------------------------
// settings_kit renders each as an element, never calls it.

function DonationsSection({ config, set }) {
  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          icon={Heart}
          title="Enable donations"
          description="Show a donation prompt during checkout."
          checked={!!config.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
        <SettingRow
          title="Allow custom amount"
          description="Let buyers enter their own donation amount."
          checked={!!config.allowCustom}
          onCheckedChange={(v) => set({ allowCustom: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function CauseSection({ config, set }) {
  const amounts = Array.isArray(config.suggestedAmounts)
    ? config.suggestedAmounts
    : [];

  return (
    <SectionCard bare>
      <div className="grid gap-4">
        <Field label="Cause" hint="What donations support.">
          <Input
            value={config.cause || ""}
            onChange={(e) => set({ cause: e.target.value })}
            placeholder="e.g. Community scholarship fund"
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Suggested amounts"
            hint="Comma-separated, e.g. 5, 10, 25."
          >
            <Input
              value={amounts.join(", ")}
              onChange={(e) =>
                set({ suggestedAmounts: parseAmounts(e.target.value) })
              }
              placeholder="5, 10, 25"
              className="tabular-nums"
            />
          </Field>
          <Num
            label="Minimum"
            hint="Smallest donation accepted."
            value={config.minAmount ?? 1}
            onChange={(v) => set({ minAmount: v })}
            unit="$"
          />
        </div>
        <Field label="Description">
          <Textarea
            rows={3}
            value={config.description || ""}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Tell buyers how their donation helps."
          />
        </Field>
      </div>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "donations",
    label: "Donations",
    icon: Heart,
    desc: "Let buyers add a donation at checkout.",
    render: DonationsSection,
  },
  {
    key: "cause",
    label: "Cause & amounts",
    icon: Gift,
    desc: "Defaults events inherit unless they override them.",
    render: CauseSection,
  },
];

export function DonationsScreen() {
  return (
    <SettingsScreen
      module="donation"
      title="Donations"
      description="Project-wide donation settings. Enable donations and set defaults here; events take over the cause and amounts on their edit page."
      defaultConfig={defaultDonationConfig}
      sections={SECTIONS}
    />
  );
}

export default DonationsScreen;
