"use client";

import React from "react";
import { Heart } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultDonationConfig } from "./constants";

// Parse "5, 10, 25" into [5, 10, 25]; keep only positive numbers.
const parseAmounts = (str) =>
  String(str)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);

function DonationForm({ config, set }) {
  const amounts = Array.isArray(config.suggestedAmounts)
    ? config.suggestedAmounts
    : [];
  return (
    <div className="space-y-6">
      <SectionCard
        title="Donations"
        description="Let buyers add a donation at checkout. Enable it here; each event can take over the cause and amounts on its edit page."
      >
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

      <SectionCard
        title="Cause & amounts"
        description="Defaults events inherit unless they override them."
      >
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
              rows={2}
              value={config.description || ""}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Tell buyers how their donation helps."
            />
          </Field>
        </div>
      </SectionCard>
    </div>
  );
}

export function DonationsScreen() {
  return (
    <SettingsScreen
      module="donation"
      title="Donations"
      description="Project-wide donation settings. Enable donations and set defaults here; events take over the cause and amounts on their edit page."
      defaultConfig={defaultDonationConfig}
      Form={DonationForm}
    />
  );
}

export default DonationsScreen;
