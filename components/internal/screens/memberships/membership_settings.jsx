"use client";

import React from "react";
import { BadgeCheck, DoorOpen, RefreshCw, StickyNote } from "lucide-react";

import { Field, SettingsList, SettingRow } from "@/components/internal/shared/screen_kit";
import { Textarea } from "@/components/ui/textarea";

import { SettingsScreen } from "../tickets/settings_kit";
import { defaultMembershipConfig } from "../tickets/constants";

function JoiningSection({ config, set }) {
  return (
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
        description="Let people buy a membership from your public event pages and the members portal."
        checked={!!config.publicJoin}
        onCheckedChange={(v) => set({ publicJoin: v })}
      />
    </SettingsList>
  );
}

function RenewalSection({ config, set }) {
  return (
    <SettingsList>
      <SettingRow
        icon={RefreshCw}
        title="Auto-renew"
        description="Automatically renew memberships at the end of each period."
        checked={!!config.autoRenew}
        onCheckedChange={(v) => set({ autoRenew: v })}
      />
    </SettingsList>
  );
}

function NotesSection({ config, set }) {
  return (
    <Field label="Internal note" hint="Optional context for your team.">
      <Textarea
        rows={3}
        value={config.note || ""}
        onChange={(e) => set({ note: e.target.value })}
        placeholder="e.g. Members get 10% off all tickets and early access."
      />
    </Field>
  );
}

const SECTIONS = [
  {
    key: "joining",
    label: "Joining",
    icon: DoorOpen,
    desc: "Whether memberships are on for this project, and how people join.",
    render: JoiningSection,
  },
  {
    key: "renewal",
    label: "Renewal",
    icon: RefreshCw,
    desc: "What happens at the end of each membership period.",
    render: RenewalSection,
  },
  {
    key: "notes",
    label: "Notes",
    icon: StickyNote,
    desc: "Context for your team — never shown to members.",
    render: NotesSection,
  },
];

export function MembershipSettingsScreen() {
  return (
    <SettingsScreen
      module="membership"
      title="Membership Settings"
      description="Enable memberships and set how they renew and how people join. Build the plans themselves under Membership Plans."
      defaultConfig={defaultMembershipConfig}
      sections={SECTIONS}
    />
  );
}

export default MembershipSettingsScreen;
