"use client";

import React from "react";
import { KeyRound, MessageSquare } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";

import { SettingsScreen } from "./settings_kit";
import { defaultAccessCodeConfig } from "./constants";

// --- Edit sections -----------------------------------------------------------
// settings_kit renders each as an element (never calls it) and keeps the
// project-global ScreenHeader on top, so sections only group their own fields.

function AccessCodeSection({ config, set }) {
  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          icon={KeyRound}
          title="Enable access-code tickets"
          description="Allow hidden tickets unlocked by a code on the event page."
          checked={!!config.enabled}
          onCheckedChange={(v) => set({ enabled: v })}
        />
        <SettingRow
          title="Case-sensitive codes"
          description="Require the exact letter case when a buyer enters a code."
          checked={!!config.caseSensitive}
          onCheckedChange={(v) => set({ caseSensitive: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function PromptSection({ config, set }) {
  return (
    <SectionCard bare>
      <Field label="Prompt text">
        <Input
          value={config.promptText || ""}
          onChange={(e) => set({ promptText: e.target.value })}
          placeholder="Have an access code?"
          className="max-w-sm"
        />
      </Field>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "codes",
    label: "Access codes",
    icon: KeyRound,
    desc: "Hidden ticket types that unlock only when a buyer enters a code.",
    render: AccessCodeSection,
  },
  {
    key: "prompt",
    label: "Prompt",
    icon: MessageSquare,
    desc: "The unlock prompt shown on the public event page.",
    render: PromptSection,
  },
];

export function AccessCodeTicketsScreen() {
  return (
    <SettingsScreen
      module="access_code"
      title="Access-code Tickets"
      description="Hidden ticket types unlocked with a special code. Enable the feature here, then add code-gated tickets to any event from its page."
      defaultConfig={defaultAccessCodeConfig}
      sections={SECTIONS}
    />
  );
}

export default AccessCodeTicketsScreen;
