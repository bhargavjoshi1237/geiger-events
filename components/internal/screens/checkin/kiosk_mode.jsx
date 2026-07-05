"use client";

import React from "react";
import { Monitor } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
  Field,
} from "@/components/internal/shared/screen_kit";
import { Input } from "@/components/ui/input";
import { CheckinSettingsScreen, RowSelect } from "./checkin_kit";
import { KIOSK_MODE_OPTIONS } from "./constants";

export function KioskModeScreen() {
  return (
    <CheckinSettingsScreen
      title="Kiosk Mode"
      description="A full-screen self-service interface for a kiosk or tablet at the entrance. Enable it per event in the event editor once it’s on here."
      icon={Monitor}
      feature="kiosk"
      enableLabel="Kiosk mode"
      enableHint="Allow a kiosk/tablet self-service screen for this project’s events."
    >
      {({ slice, set, enabled }) => (
        <div className={enabled ? "space-y-6" : "hidden"}>
          <SectionCard title="Device" description="How the kiosk screen behaves.">
            <SettingsList>
              <SettingRow
                title="Mode"
                description="Kiosk pairs with a scanner; tablet is touch self-service."
                control={
                  <RowSelect
                    value={slice.mode}
                    onChange={(v) => set({ mode: v })}
                    options={KIOSK_MODE_OPTIONS}
                  />
                }
              />
            </SettingsList>
            <div className="mt-4 max-w-md">
              <Field label="Idle screen message" hint="Shown between attendees.">
                <Input
                  value={slice.idleMessage || ""}
                  onChange={(e) => set({ idleMessage: e.target.value })}
                  placeholder="Welcome — tap to check in"
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Allowed actions" description="What attendees can do at the kiosk.">
            <SettingsList>
              <SettingRow
                title="Self check-in"
                description="Scan or search to admit themselves."
                checked={slice.actions?.checkin}
                onCheckedChange={(v) => set({ actions: { ...slice.actions, checkin: v } })}
              />
              <SettingRow
                title="On-site registration"
                description="Register on the spot if they haven’t already."
                checked={slice.actions?.register}
                onCheckedChange={(v) => set({ actions: { ...slice.actions, register: v } })}
              />
              <SettingRow
                title="Buy a ticket"
                description="Purchase a ticket at the kiosk (requires Door Sales)."
                checked={slice.actions?.buy}
                onCheckedChange={(v) => set({ actions: { ...slice.actions, buy: v } })}
              />
            </SettingsList>
          </SectionCard>
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default KioskModeScreen;
