"use client";

import React from "react";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Switch } from "@geiger/ui";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import { Badge } from "@geiger/ui/badge";
import { CampaignSettingsScreen } from "./campaigns_kit";

function AuthPill({ ok }) {
  return (
    <Badge variant={ok ? "success" : "neutral"}>
      {ok ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
      {ok ? "Verified" : "Not set"}
    </Badge>
  );
}

export function DeliverabilityScreen() {
  return (
    <CampaignSettingsScreen
      title="Deliverability"
      description="Sender identity and authentication so your messages land in the inbox, not spam."
      feature="deliverability"
    >
      {({ slice, set }) => (
        <>
          <SectionCard
            title="Sender identity"
            description="The name and address your recipients see."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="From name">
                <Input
                  value={slice.fromName}
                  onChange={(e) => set({ fromName: e.target.value })}
                  placeholder="e.g. Acme Events"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="From email">
                <Input
                  type="email"
                  value={slice.fromEmail}
                  onChange={(e) => set({ fromEmail: e.target.value })}
                  placeholder="hello@yourdomain.com"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Reply-to">
                <Input
                  type="email"
                  value={slice.replyTo}
                  onChange={(e) => set({ replyTo: e.target.value })}
                  placeholder="replies@yourdomain.com"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="SMS sender ID" hint="Shown as the sender on text messages.">
                <Input
                  value={slice.smsSenderId}
                  onChange={(e) => set({ smsSenderId: e.target.value })}
                  placeholder="e.g. ACME"
                  className="bg-surface-card uppercase"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Sending domain & authentication"
            description="Verify your domain and enable DKIM/SPF to maximise deliverability."
          >
            <Field label="Sending domain">
              <Input
                value={slice.sendingDomain}
                onChange={(e) => set({ sendingDomain: e.target.value })}
                placeholder="mail.yourdomain.com"
                className="max-w-sm bg-surface-card"
              />
            </Field>
            <div className="mt-4 border-t border-border pt-4">
              <SettingsList>
                <SettingRow
                  icon={ShieldCheck}
                  title="Domain verified"
                  description="Confirm ownership of your sending domain."
                  control={
                    <div className="flex items-center gap-2">
                      <AuthPill ok={slice.domainVerified} />
                      <Switch
                        checked={!!slice.domainVerified}
                        onCheckedChange={(v) => set({ domainVerified: v })}
                      />
                    </div>
                  }
                />
                <SettingRow
                  title="DKIM signing"
                  description="Cryptographically sign outgoing mail."
                  checked={!!slice.dkim}
                  onCheckedChange={(v) => set({ dkim: v })}
                />
                <SettingRow
                  title="SPF alignment"
                  description="Authorise this platform to send for your domain."
                  checked={!!slice.spf}
                  onCheckedChange={(v) => set({ spf: v })}
                />
              </SettingsList>
            </div>
          </SectionCard>

          <SectionCard
            title="Compliance"
            description="Required footer details and unsubscribe handling."
          >
            <div className="space-y-4">
              <Field
                label="Physical mailing address"
                hint="Anti-spam laws (CAN-SPAM, CASL) require a real postal address in every email."
              >
                <Input
                  value={slice.footerAddress}
                  onChange={(e) => set({ footerAddress: e.target.value })}
                  placeholder="123 Main St, City, Country"
                  className="bg-surface-card"
                />
              </Field>
              <Field label="Unsubscribe link text">
                <Input
                  value={slice.unsubscribeText}
                  onChange={(e) => set({ unsubscribeText: e.target.value })}
                  placeholder="Unsubscribe from these emails"
                  className="max-w-sm bg-surface-card"
                />
              </Field>
              <Field
                label="Daily send cap"
                hint="Throttle to protect sender reputation. 0 = no cap."
              >
                <Input
                  type="number"
                  min={0}
                  value={slice.dailyCap}
                  onChange={(e) => set({ dailyCap: Number(e.target.value) || 0 })}
                  className="max-w-[8rem] bg-surface-card tabular-nums"
                />
              </Field>
            </div>
          </SectionCard>
        </>
      )}
    </CampaignSettingsScreen>
  );
}

export default DeliverabilityScreen;
