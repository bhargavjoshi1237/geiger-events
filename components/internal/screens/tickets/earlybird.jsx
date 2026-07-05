"use client";

import React from "react";
import { Timer } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Textarea } from "@/components/ui/textarea";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultEarlybirdConfig } from "./constants";

function EarlybirdForm({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Early-bird pricing"
        description="Reward the first buyers with a limited-time discount. Turn it on here, then set the discount per event from the event's edit page."
      >
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

      <SectionCard
        title="Defaults"
        description="Starting values events inherit — each event can override them."
      >
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
        <div className="mt-4">
          <Field label="Note" hint="Optional context shown to your team.">
            <Textarea
              rows={2}
              value={config.note || ""}
              onChange={(e) => set({ note: e.target.value })}
              placeholder="e.g. Early-bird runs for the first two weeks after announcement."
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export function EarlybirdSalesScreen() {
  return (
    <SettingsScreen
      module="earlybird"
      title="Early-bird Sales"
      description="Project-wide early-bird pricing. Enable it and set defaults here; events tune the discount on their edit page."
      defaultConfig={defaultEarlybirdConfig}
      Form={EarlybirdForm}
    />
  );
}

export default EarlybirdSalesScreen;
