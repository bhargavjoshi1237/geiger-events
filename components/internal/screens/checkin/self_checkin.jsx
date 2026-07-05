"use client";

import React from "react";
import { UserCheck } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { CheckinSettingsScreen } from "./checkin_kit";

export function SelfCheckinScreen() {
  return (
    <CheckinSettingsScreen
      title="Self Check-in"
      description="Let attendees check themselves in by scanning their own QR code. Enable it per event in the event editor once it’s on here."
      icon={UserCheck}
      feature="selfCheckin"
      enableLabel="Self check-in"
      enableHint="Allow attendees to admit themselves without a staff scan."
    >
      {({ slice, set, enabled }) => (
        <div className={enabled ? "" : "hidden"}>
          <SectionCard title="Options" description="How self check-in behaves.">
            <SettingsList>
              <SettingRow
                title="Require QR code"
                description="Only allow self check-in when the attendee scans their own ticket QR."
                checked={slice.requireQr}
                onCheckedChange={(v) => set({ requireQr: v })}
              />
              <SettingRow
                title="Confirmation screen"
                description="Show a “You’re in” screen with next steps and directions after check-in."
                checked={slice.confirmScreen}
                onCheckedChange={(v) => set({ confirmScreen: v })}
              />
            </SettingsList>
          </SectionCard>
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default SelfCheckinScreen;
