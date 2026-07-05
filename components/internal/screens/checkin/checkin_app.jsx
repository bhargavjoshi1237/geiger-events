"use client";

import React from "react";
import { ScanLine, Info } from "lucide-react";

import {
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { CheckinSettingsScreen, RowSelect } from "./checkin_kit";
import { REENTRY_OPTIONS } from "./constants";

export function CheckinAppScreen() {
  return (
    <CheckinSettingsScreen
      title="Check-in App"
      description="Operate and manage the staff check-in app — the surface your team uses to scan and admit attendees at the door."
      icon={ScanLine}
      feature="checkinApp"
      enableLabel="Check-in app"
      enableHint="Allow staff to open the scanner for this project’s events."
    >
      {({ slice, set }) => (
        <>
          <SectionCard title="Allowed methods" description="How staff can admit an attendee.">
            <SettingsList>
              <SettingRow
                title="QR scan"
                description="Scan the attendee’s ticket QR with the device camera."
                checked={slice.methods?.qr}
                onCheckedChange={(v) => set({ methods: { ...slice.methods, qr: v } })}
              />
              <SettingRow
                title="Manual entry"
                description="Look up by ticket number or name when there’s no code to scan."
                checked={slice.methods?.manual}
                onCheckedChange={(v) => set({ methods: { ...slice.methods, manual: v } })}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard title="Entry policy" description="What happens after someone is admitted.">
            <SettingsList>
              <SettingRow
                title="Re-entry"
                description="Whether a checked-in attendee can scan again to re-enter."
                control={
                  <RowSelect
                    value={slice.reentry}
                    onChange={(v) => set({ reentry: v })}
                    options={REENTRY_OPTIONS}
                  />
                }
              />
              <SettingRow
                title="Offline caching"
                description="Cache the guest list on the device so scanning works without signal."
                checked={slice.offlineCache}
                onCheckedChange={(v) => set({ offlineCache: v })}
              />
            </SettingsList>
          </SectionCard>

          <SectionCard title="Staff access">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
              <div className="space-y-1 text-sm text-text-secondary">
                <p>
                  Staff open the scanner from a per-event link secured by an access
                  code. Generate codes and set who can scan which gates under{" "}
                  <span className="font-medium text-foreground">Staff Scanning Roles</span>.
                </p>
                <p className="font-mono text-xs text-text-tertiary">
                  /checkin/&lt;event&gt;?code=••••
                </p>
              </div>
            </div>
          </SectionCard>
        </>
      )}
    </CheckinSettingsScreen>
  );
}

export default CheckinAppScreen;
