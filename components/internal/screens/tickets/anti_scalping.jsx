"use client";

import React from "react";
import { IdCard, Repeat, ShieldAlert, UserCheck } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";

import { RecordsScreen } from "./records_kit";
import { NumField as Num } from "./controls";
import {
  defaultResaleRuleConfig,
  TRANSFER_POLICY_OPTIONS,
} from "./constants";

const KINDS = [
  {
    value: "resale_rule",
    label: "Rule",
    defaultConfig: defaultResaleRuleConfig,
  },
];

const policyLabel = (value) =>
  TRANSFER_POLICY_OPTIONS.find((o) => o.value === value)?.label || value;

// List-card summary line: "Name-locked · organizer-approval transfers".
function summarize(r) {
  const c = r.config || {};
  const parts = [];
  if (c.nameLockRequired) parts.push("Name-locked");
  parts.push(`${(policyLabel(c.transferPolicy) || "").toLowerCase()} transfers`);
  if (c.maxResalePrice === "face") parts.push("resale capped at face");
  return parts.join(" · ");
}

// --- Edit sections ----------------------------------------------------------
// records_kit renders each as an element, never calls it.

function OwnershipSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <SettingsList>
        <SettingRow
          icon={UserCheck}
          title="Require name lock"
          description="Each ticket is tied to the buyer's name."
          checked={!!config.nameLockRequired}
          onCheckedChange={(v) => set({ nameLockRequired: v })}
        />
        <SettingRow
          icon={IdCard}
          title="ID check at entry"
          description="Staff verify a matching ID when admitting the holder."
          checked={!!config.identityCheck}
          onCheckedChange={(v) => set({ identityCheck: v })}
        />
      </SettingsList>
    </SectionCard>
  );
}

function ResaleSection({ config, setConfig }) {
  const set = (patch) => setConfig({ ...config, ...patch });

  return (
    <SectionCard bare>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Transfer policy">
          <Select
            value={config.transferPolicy || "off"}
            onValueChange={(v) => set({ transferPolicy: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TRANSFER_POLICY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Resale price cap"
          hint="Cap resale at the original face value to deter scalping."
        >
          <Select
            value={config.maxResalePrice || "none"}
            onValueChange={(v) => set({ maxResalePrice: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No cap</SelectItem>
              <SelectItem value="face">Face value</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Num
          label="Max per buyer"
          hint="0 = no limit."
          value={config.maxPerBuyer ?? 0}
          onChange={(v) => set({ maxPerBuyer: v })}
          unit="tickets"
        />
      </div>
    </SectionCard>
  );
}

const SECTIONS = [
  {
    key: "ownership",
    label: "Ownership",
    icon: UserCheck,
    desc: "Bind tickets to a buyer so they can't be freely resold.",
    render: OwnershipSection,
  },
  {
    key: "resale",
    label: "Transfers & resale",
    icon: Repeat,
    desc: "How, and whether, buyers can hand tickets on.",
    render: ResaleSection,
  },
];

export function AntiScalpingScreen() {
  return (
    <RecordsScreen
      module="resale_rule"
      title="Anti-scalping & Resale"
      description="Reusable rules that curb scalping and control resale. Create one here, then enable it on any event."
      singular="rule"
      icon={ShieldAlert}
      kinds={KINDS}
      summarize={summarize}
      sections={SECTIONS}
    />
  );
}

export default AntiScalpingScreen;
