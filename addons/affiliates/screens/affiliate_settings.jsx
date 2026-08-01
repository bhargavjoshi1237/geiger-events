"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { SecondaryScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  Field,
  ScreenHeader,
  SectionCard,
  SettingRow,
  SettingsList,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { useAddons } from "@/context/addons-context";
import { getAddon } from "@/addons";
import {
  COMMISSION_BASE_OPTIONS,
  DISCOUNT_HANDLING_OPTIONS,
} from "../lib/constants";

// Project-level defaults for the Affiliates addon. These seed a NEW program;
// they never reach an existing one, because each event's program is independent
// once created. Stored in events.project_addons.config for addon "affiliates".

const ADDON_ID = "affiliates";

export function AffiliateSettingsScreen() {
  const { getConfig, setConfig, loading } = useAddons();
  const manifest = getAddon(ADDON_ID);
  const stored = getConfig(ADDON_ID);
  const config = { ...(manifest?.defaultConfig || {}), ...stored };
  const [saving, setSaving] = useState(false);

  const save = async (patch) => {
    setSaving(true);
    const ok = await setConfig(ADDON_ID, { ...config, ...patch });
    setSaving(false);
    if (ok) toast.success("Defaults saved");
    else toast.error("Couldn't save those defaults.");
  };

  if (loading) {
    return (
      <SecondaryScreenWrapper>
        <ScreenHeader title="Affiliate settings" />
        <LoadingArea />
      </SecondaryScreenWrapper>
    );
  }

  return (
    <SecondaryScreenWrapper>
      <ScreenHeader
        title="Affiliate settings"
        description="Defaults applied to newly created programs. Existing programs keep their own settings — per-event programs are independent by design."
      />

      <div className="space-y-6">
        <SectionCard
          title="Attribution defaults"
          description="How a new program credits a sale before you change it."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Attribution window (days)"
              hint="How long a tracked-link click keeps earning. Last touch wins."
            >
              <Input
                type="number"
                min={1}
                max={365}
                defaultValue={config.attributionWindowDays}
                disabled={saving}
                onBlur={(e) =>
                  save({ attributionWindowDays: Number(e.target.value) || 30 })
                }
              />
            </Field>
            <Field label="Commission base">
              <Select
                value={config.commissionBase}
                disabled={saving}
                onValueChange={(v) => save({ commissionBase: v })}
              >
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle">
                  {COMMISSION_BASE_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field
              label="Discount handling"
              hint="Post-discount is the safe default — you never pay commission on money you discounted away."
            >
              <Select
                value={config.discountHandling}
                disabled={saving}
                onValueChange={(v) => save({ discountHandling: v })}
              >
                <SelectTrigger className="border-border bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border bg-surface-subtle">
                  {DISCOUNT_HANDLING_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="Rails"
          description="Enforced server-side at attribution time, not in the browser."
        >
          <SettingsList>
            <SettingRow
              title="Block self-referral"
              description="An affiliate can't earn commission on an order placed with their own email address."
              icon={ShieldCheck}
              checked={Boolean(config.selfReferralBlocked)}
              onCheckedChange={(v) => save({ selfReferralBlocked: v })}
            />
          </SettingsList>
        </SectionCard>

        <SectionCard
          title="How clearance works"
          description="This program family clears manually on purpose."
        >
          <p className="text-sm leading-relaxed text-text-secondary">
            Attribution files every commission as <strong>pending</strong>.
            Nothing auto-approves — you approve rows on the Commissions screen
            once you&apos;re satisfied the order will stick, then settle approved
            rows into a payout batch. A refunded order reverses its commission
            automatically, unless it has already been paid.
          </p>
          <div className="mt-4">
            <Button variant="ghost" disabled>
              Stripe Connect payouts — not enabled
            </Button>
          </div>
        </SectionCard>
      </div>
    </SecondaryScreenWrapper>
  );
}

export default AffiliateSettingsScreen;
