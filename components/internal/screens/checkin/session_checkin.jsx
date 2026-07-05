"use client";

import React from "react";
import { Clock, Info } from "lucide-react";

import { SectionCard } from "@/components/internal/shared/screen_kit";
import { CheckinSettingsScreen } from "./checkin_kit";

export function SessionCheckinScreen() {
  return (
    <CheckinSettingsScreen
      title="Session Check-in"
      description="Track attendance per session, workshop, or track — not just at the front door. Enable it per event in the event editor once it’s on here."
      icon={Clock}
      feature="session"
      enableLabel="Session check-in"
      enableHint="Record separate check-ins for each session within an event."
    >
      {({ enabled }) => (
        <div className={enabled ? "" : "hidden"}>
          <SectionCard title="How it works">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-surface-card px-4 py-3">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
              <p className="text-sm text-text-secondary">
                Define each event’s sessions on the{" "}
                <span className="font-medium text-foreground">Check-in → Sessions</span>{" "}
                tab in the event editor. Staff then pick a session at the scanner,
                and each session’s live count appears in{" "}
                <span className="font-medium text-foreground">Real-time Attendance</span>.
              </p>
            </div>
          </SectionCard>
        </div>
      )}
    </CheckinSettingsScreen>
  );
}

export default SessionCheckinScreen;
