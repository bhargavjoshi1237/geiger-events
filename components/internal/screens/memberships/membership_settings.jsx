"use client";

import React from "react";
import { BadgeCheck } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Textarea } from "@/components/ui/textarea";

import { SettingsScreen } from "../tickets/settings_kit";
import { defaultMembershipConfig } from "../tickets/constants";

function MembershipSettingsForm({ config, set }) {
  return (
    <div className="space-y-6">
      <SectionCard
        title="Memberships"
        description="Sell recurring memberships that unlock special pricing and access. Enable the feature, then build plans under Membership Plans."
      >
        <SettingsList>
          <SettingRow
            icon={BadgeCheck}
            title="Enable memberships"
            description="Turn on the Memberships section for this project."
            checked={!!config.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
          <SettingRow
            title="Public join"
            description="Let people buy a membership from your public event pages."
            checked={!!config.publicJoin}
            onCheckedChange={(v) => set({ publicJoin: v })}
          />
          <SettingRow
            title="Auto-renew"
            description="Automatically renew memberships at the end of each period."
            checked={!!config.autoRenew}
            onCheckedChange={(v) => set({ autoRenew: v })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Notes">
        <Field label="Internal note" hint="Optional context for your team.">
          <Textarea
            rows={2}
            value={config.note || ""}
            onChange={(e) => set({ note: e.target.value })}
            placeholder="e.g. Members get 10% off all tickets and early access."
          />
        </Field>
      </SectionCard>
    </div>
  );
}

export function MembershipSettingsScreen() {
  return (
    <SettingsScreen
      module="membership"
      title="Membership Settings"
      description="Enable memberships and set how they renew and how people join. Build the plans themselves under Membership Plans."
      defaultConfig={defaultMembershipConfig}
      Form={MembershipSettingsForm}
    />
  );
}

export default MembershipSettingsScreen;
