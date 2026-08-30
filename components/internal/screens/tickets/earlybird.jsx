"use client";

import React from "react";
import { SlidersHorizontal, Timer } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Textarea } from "@geiger/ui/textarea";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultEarlybirdConfig } from "./constants";

// --- Edit sections -----------------------------------------------------------
// settings_kit renders each as an element, never calls it.

function EarlybirdSection({ config, set }) {
  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          icon={Timer}
          title="Enable early-bird sales"
          description="Offer early-bird pricing across this project's events."
          checked={!!config.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
        <SettingRow
          title="Stack with coupons"
          description="Let buyers combine early-bird pricing with a coupon code."
          checked={!!config.stackable}
          onCheckedChange={(v) => set({ stackable: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function EarlybirdDefaultsSection({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard bare>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Default discount"
            value={config.defaultPercent ?? 15}
            onChange={(v) => set({ defaultPercent: v })}
            unit="%"
          />
          <Num
            label="Ends before event"
            hint="Days before the event early-bird pricing closes."
            value={config.defaultCutoffDays ?? 14}
            onChange={(v) => set({ defaultCutoffDays: v })}
            unit="days"
          />
        </div>
      </SectionCard>

      <SectionCard bare>
        <Field label="Note" hint="Optional context shown to your team.">
          <Textarea
            rows={3}
            value={config.note || ""}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="e.g. Early-bird runs for the first two weeks after announcement."
          />
        </Field>
      </SectionCard>
    </div>
  );
}

const SECTIONS = [
  {
    key: "pricing",
    label: "Early-bird pricing",
    icon: Timer,
    desc: "Reward the first buyers with a limited-time discount.",
    render: EarlybirdSection,
  },
  {
    key: "defaults",
    label: "Defaults",
    icon: SlidersHorizontal,
    desc: "Starting values events inherit — each event can override them.",
    render: EarlybirdDefaultsSection,
  },
];

export function EarlybirdSalesScreen() {
  return (
    <SettingsScreen
      module="earlybird"
      title="Early-bird Sales"
      description="Project-wide early-bird pricing. Enable it and set defaults here; events tune the discount on their edit page."
      defaultConfig={defaultEarlybirdConfig}
      sections={SECTIONS}
    />
  );
}

export default EarlybirdSalesScreen;
