"use client";

import React from "react";
import { KeyRound } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";

import { SettingsScreen } from "./settings_kit";
import { defaultAccessCodeConfig } from "./constants";

function AccessCodeForm({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Access-code tickets"
        description="Hidden ticket types that unlock only when a buyer enters a code. Enable it here; add code-gated tickets on each event's page (Ticket Types → access code)."
      >
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

      <SectionCard
        title="Prompt"
        description="The unlock prompt shown on the public event page."
      >
        <Field label="Prompt text">
          <Input
            value={config.promptText || ""}
            onChange={(e) => set({ promptText: e.target.value })}
            placeholder="Have an access code?"
            className="max-w-sm"
          />
        </Field>
      </SectionCard>
    </div>
  );
}

export function AccessCodeTicketsScreen() {
  return (
    <SettingsScreen
      module="access_code"
      title="Access-code Tickets"
      description="Hidden ticket types unlocked with a special code. Enable the feature here, then add code-gated tickets to any event from its page."
      defaultConfig={defaultAccessCodeConfig}
      Form={AccessCodeForm}
    />
  );
}

export default AccessCodeTicketsScreen;
