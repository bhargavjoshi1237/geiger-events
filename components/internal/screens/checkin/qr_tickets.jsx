"use client";

import React, { useMemo } from "react";
import { QrCode } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@geiger/ui/input";
import { CheckinSettingsScreen, RowSelect } from "./checkin_kit";
import { QR_SIZE_OPTIONS, QR_EC_OPTIONS, QR_ENCODE_OPTIONS } from "./constants";
import { qrTicketSvg, logoEligible } from "@/lib/passes/qr_core";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

const QR_SIZE_PX = { small: 96, medium: 128, large: 160 };

// Stand-ins for whatever the "Encoded value" select resolves to, so the
// preview scans exactly like a real ticket would for the chosen setting.
const SAMPLE_PAYLOAD = {
  ticketCode: "8F3A9C2D",
  orderId: "b7e2c9a1-4f3d-4e6a-9b2c-1a2b3c4d5e6f",
  url: "https://checkin.geiger.events/t/demo",
};

// A real, scannable QR reflecting the current appearance settings — the
// brand color, size, error correction, and logo knockout all render exactly
// as they will on an issued ticket or emailed pass.
function QrPreview({ size, errorCorrection, showLogo, color, payload }) {
  const px = QR_SIZE_PX[size] || QR_SIZE_PX.medium;
  const svg = useMemo(
    () =>
      qrTicketSvg({
        payload,
        errorCorrection,
        brandColor: color,
        showLogo,
        logoHref: `${BASE_PATH}/logo1.svg`,
        size: px,
      }),
    [payload, errorCorrection, showLogo, color, px],
  );
  const logoSuppressed = showLogo && !logoEligible(errorCorrection);

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="rounded-lg border border-border bg-white p-2 [&>svg]:block"
        style={{ width: px + 16, height: px + 16 }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {logoSuppressed ? (
        <p className="max-w-[180px] text-center text-[11px] text-text-tertiary">
          Logo needs Quartile or High error correction to stay scannable — hidden at the current level.
        </p>
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
              <div className="mt-4">
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
              <QrPreview
                size={slice.size}
                errorCorrection={slice.errorCorrection}
                showLogo={slice.showLogo}
                color={slice.brandColor}
                payload={SAMPLE_PAYLOAD[slice.encode] || SAMPLE_PAYLOAD.ticketCode}
              />
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
