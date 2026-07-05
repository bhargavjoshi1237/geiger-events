"use client";

import React from "react";
import { Repeat } from "lucide-react";

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
} from "@/components/ui/select";

import { SettingsScreen } from "./settings_kit";
import { NumField as Num } from "./controls";
import { defaultTransferConfig, FEE_TYPE_OPTIONS } from "./constants";

function TransferForm({ config, set }) {
  const feeType = config.feeType || "none";
  return (
    <div className="space-y-6">
      <SectionCard
        title="Ticket transfers"
        description="Let buyers hand their ticket to someone else. Enable it here; events opt in from their edit page. Resale caps live under Anti-scalping & Resale."
      >
        <SettingsList>
          <SettingRow
            icon={Repeat}
            title="Enable transfers"
            description="Allow buyers to reassign a ticket to a new holder."
            checked={!!config.enabled}
            onCheckedChange={(v) => set({ enabled: v })}
          />
          <SettingRow
            title="Allow resale"
            description="Permit reselling a ticket, not just gifting it."
            checked={!!config.allowResale}
            onCheckedChange={(v) => set({ allowResale: v })}
          />
          <SettingRow
            title="Require approval"
            description="Organizer must approve each transfer before it takes effect."
            checked={!!config.requireApproval}
            onCheckedChange={(v) => set({ requireApproval: v })}
          />
        </SettingsList>
      </SectionCard>

      <SectionCard title="Fees & deadline">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Transfer fee">
            <Select
              value={feeType}
              onValueChange={(v) => set({ feeType: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEE_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          {feeType !== "none" ? (
            <Num
              label={feeType === "percent" ? "Fee percentage" : "Fee amount"}
              value={config.feeAmount ?? 0}
              onChange={(v) => set({ feeAmount: v })}
              unit={feeType === "percent" ? "%" : "$"}
            />
          ) : null}
          <Num
            label="Transfer deadline"
            hint="Transfers close this many days before the event."
            value={config.deadlineDays ?? 2}
            onChange={(v) => set({ deadlineDays: v })}
            unit="days"
          />
        </div>
      </SectionCard>
    </div>
  );
}

export function TransfersScreen() {
  return (
    <SettingsScreen
      module="transfer"
      title="Transfers"
      description="Control how buyers transfer or resell tickets. Set the project default here; events choose whether to allow it."
      defaultConfig={defaultTransferConfig}
      Form={TransferForm}
    />
  );
}

export default TransfersScreen;
