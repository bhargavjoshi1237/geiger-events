"use client";

import React from "react";
import { QrCode } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { CheckinSettingsScreen, RowSelect } from "./checkin_kit";
import { QR_SIZE_OPTIONS, QR_EC_OPTIONS, QR_ENCODE_OPTIONS } from "./constants";

// A small faux-QR preview so the appearance settings read as real.
function QrPreview({ showLogo, color }) {
  return (
    <div
      className="relative grid h-32 w-32 grid-cols-8 grid-rows-8 gap-0.5 rounded-lg border border-border bg-white p-2"
      aria-hidden
    >
      {Array.from({ length: 64 }).map((_, i) => {
        const on = (i * 7 + (i % 5) * 3) % 3 !== 0;
        return (
          <span
            key={i}
            className="rounded-[1px]"
            style={{ background: on ? color || "#111111" : "transparent" }}
          />
        );
      })}
      {showLogo ? (
        <span className="absolute inset-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-md border-2 border-white bg-primary" />
      ) : null}
    </div>
  );
}

export function QrTicketsScreen() {
  return (
    <CheckinSettingsScreen
      title="QR Tickets"
      description="How the QR code on each ticket looks and what it encodes. Turn QR on per event with “Include QR on ticket” in the event editor."
      icon={QrCode}
      feature="qrTickets"
    >
      {({ slice, set }) => (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <SectionCard title="Appearance" description="Size, contrast, and branding of the printed code.">
              <SettingsList>
                <SettingRow
                  title="Code size"
                  description="Larger codes scan faster from a distance."
                  control={
                    <RowSelect
                      value={slice.size}
                      onChange={(v) => set({ size: v })}
                      options={QR_SIZE_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Error correction"
                  description="Higher levels stay scannable when a code is scuffed or partly covered."
                  control={
                    <RowSelect
                      value={slice.errorCorrection}
                      onChange={(v) => set({ errorCorrection: v })}
                      options={QR_EC_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Show logo in center"
                  description="Overlay your mark in the middle of the code."
                  checked={slice.showLogo}
                  onCheckedChange={(v) => set({ showLogo: v })}
                />
              </SettingsList>
              <div className="mt-4 max-w-xs">
                <Field label="Brand color" hint="Hex used for the code modules. Leave blank for black.">
                  <Input
                    value={slice.brandColor || ""}
                    onChange={(e) => set({ brandColor: e.target.value })}
                    placeholder="#111111"
                  />
                </Field>
              </div>
            </SectionCard>

            <SectionCard title="Encoding" description="What the scanner reads out of the code.">
              <SettingsList>
                <SettingRow
                  title="Encoded value"
                  description="What the QR payload resolves to at the gate."
                  control={
                    <RowSelect
                      value={slice.encode}
                      onChange={(v) => set({ encode: v })}
                      options={QR_ENCODE_OPTIONS}
                    />
                  }
                />
                <SettingRow
                  title="Rotating (dynamic) codes"
                  description="Codes refresh periodically to prevent screenshots being reused."
                  checked={slice.dynamic}
                  onCheckedChange={(v) => set({ dynamic: v })}
                />
              </SettingsList>
            </SectionCard>
          </div>

          <SectionCard title="Preview">
            <div className="flex flex-col items-center gap-3 py-2">
              <QrPreview showLogo={slice.showLogo} color={slice.brandColor} />
              <p className="text-center text-xs text-text-secondary">
                {slice.dynamic ? "Rotating code" : "Static code"} · EC {slice.errorCorrection}
              </p>
            </div>
          </SectionCard>
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default QrTicketsScreen;
