"use client";

import React from "react";
import { Layers, SlidersHorizontal } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Textarea } from "@geiger/ui/textarea";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultReleaseConfig } from "./constants";

// --- Edit sections -----------------------------------------------------------
// settings_kit renders each as an element, never calls it.

function ReleaseEnableSection({ config, set }) {
  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          icon={Layers}
          title="Enable batched releases"
          description="Let this project's events split tickets into waves — e.g. 100 now, 100 on 1 Nov or 10 days after the first sells out."
          checked={!!config.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function ReleaseDefaultsSection({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard bare>
        <div className="grid gap-4 sm:grid-cols-2">
          <Num
            label="Default tranche size"
            hint="Suggested tickets per wave when an event splits a ticket."
            value={config.defaultQty ?? 100}
            onChange={(v) => set({ defaultQty: v })}
            unit="tickets"
            fullWidth
          />
          <Num
            label="Default sell-out delay"
            hint="Days after a sell-out the next wave opens (0 = immediately)."
            value={config.defaultDelayDays ?? 0}
            onChange={(v) => set({ defaultDelayDays: v })}
            unit="days"
            fullWidth
          />
        </div>
      </SectionCard>

      <SectionCard bare>
        <Field label="Note" hint="Optional context shown to your team.">
          <Textarea
            rows={3}
            value={config.note || ""}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="e.g. Flagship shows go in three waves: members, general, final release."
          />
        </Field>
      </SectionCard>
    </div>
  );
}

const SECTIONS = [
  {
    key: "waves",
    label: "Batched releases",
    icon: Layers,
    desc: "Split a ticket into waves that open on dates, after sell-outs, or by hand.",
    render: ReleaseEnableSection,
  },
  {
    key: "defaults",
    label: "Defaults",
    icon: SlidersHorizontal,
    desc: "Starting values events inherit — each event can override them per wave.",
    render: ReleaseDefaultsSection,
  },
];

export function BatchedReleasesScreen() {
  return (
    <SettingsScreen
      module="release"
      title="Batched Releases"
      description="Project-wide ticket waves. Enable it and set defaults here; events split their tickets into waves on their edit page."
      defaultConfig={defaultReleaseConfig}
      sections={SECTIONS}
    />
  );
}

export default BatchedReleasesScreen;
