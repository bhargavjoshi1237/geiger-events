"use client";

import React from "react";
import { Hash } from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { SettingsScreen } from "../tickets/settings_kit";
import {
  defaultOrderSettingsConfig,
  REFUND_REASON_OPTIONS,
  REFUND_METHOD_OPTIONS,
  orderRef,
} from "./constants";

function toggleInList(list, value, on) {
  const set = new Set(Array.isArray(list) ? list : []);
  if (on) set.add(value);
  else set.delete(value);
  return Array.from(set);
}

function OrderSettingsForm({ config, set }) {
  const reasonCodes = config.refundReasonCodes ?? [];
  const methods = config.refundMethods ?? [];

  return (
    <div className="space-y-6">
      <SectionCard
        title="Order numbering"
        description="How order references read on receipts and in the cockpit."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Order prefix" hint={`Preview: ${orderRef("00000000-0000-0000-0000-000000000000", config.orderPrefix || "ORD")}`}>
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-text-tertiary" />
              <Input
                value={config.orderPrefix || ""}
                onChange={(e) => set({ orderPrefix: e.target.value.toUpperCase() })}
                placeholder="ORD"
                className="w-32"
              />
            </div>
          </Field>
          <Field label="Default refund policy">
            <Select
              value={config.defaultRefundPolicy || "partial"}
              onValueChange={(v) => set({ defaultRefundPolicy: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No refunds</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
                <SelectItem value="full">Full</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard
        title="Refund reasons"
        description="Which reason codes staff can pick when issuing a refund."
      >
        <SettingsList>
          {REFUND_REASON_OPTIONS.map((r) => (
            <SettingRow
              key={r.value}
              title={r.label}
              checked={reasonCodes.includes(r.value)}
              onCheckedChange={(on) =>
                set({ refundReasonCodes: toggleInList(reasonCodes, r.value, on) })
              }
            />
          ))}
        </SettingsList>
      </SectionCard>

      <SectionCard
        title="Refund methods"
        description="How refunds can be paid back."
      >
        <SettingsList>
          {REFUND_METHOD_OPTIONS.map((m) => (
            <SettingRow
              key={m.value}
              title={m.label}
              checked={methods.includes(m.value)}
              onCheckedChange={(on) =>
                set({ refundMethods: toggleInList(methods, m.value, on) })
              }
            />
          ))}
        </SettingsList>
      </SectionCard>

      <SectionCard title="Receipt footer" description="Shown at the bottom of every receipt.">
        <Field label="Footer text">
          <Textarea
            rows={2}
            value={config.receiptFooter || ""}
            onChange={(e) => set({ receiptFooter: e.target.value })}
            placeholder="e.g. Thanks for your order!"
          />
        </Field>
      </SectionCard>
    </div>
  );
}

export function OrderSettingsScreen() {
  return (
    <SettingsScreen
      module="orders"
      title="Order Settings"
      description="Project-wide defaults for order references, refunds, and receipts."
      defaultConfig={defaultOrderSettingsConfig}
      Form={OrderSettingsForm}
    />
  );
}

export default OrderSettingsScreen;
