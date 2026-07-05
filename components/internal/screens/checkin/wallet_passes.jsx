"use client";

import React from "react";
import { Wallet } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { CheckinSettingsScreen } from "./checkin_kit";

const FIELD_LABELS = {
  name: "Attendee name",
  ticketType: "Ticket type",
  seat: "Seat / table",
  qr: "QR code",
};

export function WalletPassesScreen() {
  return (
    <CheckinSettingsScreen
      title="Wallet Passes"
      description="Let attendees add their ticket to Apple Wallet and Google Wallet. Enable it per event in the event editor once it’s on here."
      icon={Wallet}
      feature="walletPasses"
      enableLabel="Wallet passes"
      enableHint="Generate Apple & Google Wallet passes for tickets."
    >
      {({ slice, set, enabled }) => (
        <div className={enabled ? "grid gap-6 lg:grid-cols-3" : "hidden"}>
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Platforms" description="Which wallets attendees can add their pass to.">
              <SettingsList>
                <SettingRow
                  title="Apple Wallet"
                  checked={slice.apple}
                  onCheckedChange={(v) => set({ apple: v })}
                />
                <SettingRow
                  title="Google Wallet"
                  checked={slice.google}
                  onCheckedChange={(v) => set({ google: v })}
                />
              </SettingsList>
            </SectionCard>

            <SectionCard title="Branding" description="How the pass looks in the wallet.">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Organization name" hint="Shown on the pass front.">
                  <Input
                    value={slice.orgName || ""}
                    onChange={(e) => set({ orgName: e.target.value })}
                    placeholder="e.g. Geiger Events"
                  />
                </Field>
                <Field label="Background color" hint="Hex. Leave blank for the default.">
                  <Input
                    value={slice.bgColor || ""}
                    onChange={(e) => set({ bgColor: e.target.value })}
                    placeholder="#1d1d1f"
                  />
                </Field>
                <Field label="Logo URL" className="sm:col-span-2" hint="Square logo shown on the pass.">
                  <Input
                    value={slice.logoUrl || ""}
                    onChange={(e) => set({ logoUrl: e.target.value })}
                    placeholder="https://…/logo.png"
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Pass fields" description="Details printed on the pass.">
              <SettingsList>
                {Object.keys(FIELD_LABELS).map((key) => (
                  <SettingRow
                    key={key}
                    title={FIELD_LABELS[key]}
                    checked={slice.fields?.[key]}
                    onCheckedChange={(v) => set({ fields: { ...slice.fields, [key]: v } })}
                  />
                ))}
              </SettingsList>
            </SectionCard>
          </div>

          <SectionCard title="Preview">
            <div className="py-2">
              <div
                className="mx-auto w-full max-w-[240px] rounded-2xl border border-border p-4 text-white shadow-lg"
                style={{ background: slice.bgColor || "#1d1d1f" }}
              >
                <p className="text-[11px] uppercase tracking-wide opacity-70">
                  {slice.orgName || "Your organization"}
                </p>
                <p className="mt-6 text-lg font-semibold">Sample Event</p>
                {slice.fields?.ticketType ? (
                  <p className="text-sm opacity-80">General Admission</p>
                ) : null}
                {slice.fields?.seat ? (
                  <p className="mt-1 text-xs opacity-70">Seat A-12</p>
                ) : null}
                {slice.fields?.qr ? (
                  <div className="mt-4 h-16 w-16 rounded bg-white/90" />
                ) : null}
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default WalletPassesScreen;
