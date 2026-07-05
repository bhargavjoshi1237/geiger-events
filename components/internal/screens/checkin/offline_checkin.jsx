"use client";

import React from "react";
import { CloudOff, Wrench, CheckCircle2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader } from "@/components/internal/shared/screen_kit";

// Offline Check-in is intentionally under active development — shown as a
// themed "in progress" surface (not the generic ComingSoon) so the roadmap is
// clear while the sync engine is built.
const PLANNED = [
  "Cache the full guest list on each device before doors open",
  "Scan and admit with no connection — queued locally",
  "Automatic conflict-safe sync when signal returns",
  "Cross-device de-duplication so one ticket can’t enter twice",
];

export function OfflineCheckinScreen() {
  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Offline Check-in"
        description="Keep scanning when the venue Wi-Fi drops — check-ins queue on the device and sync automatically once you’re back online."
      />

      <div className="rounded-2xl border border-dashed border-border bg-surface-subtle px-6 py-12">
        <div className="mx-auto flex max-w-lg flex-col items-center gap-5 text-center">
          <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-surface-card text-muted-foreground">
            <CloudOff className="h-6 w-6" />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-amber-500/20 text-amber-300">
              <Wrench className="h-3 w-3" />
            </span>
          </div>
          <div className="space-y-1.5">
            <p className="text-base font-semibold text-foreground">Under development</p>
            <p className="text-sm text-text-secondary">
              The offline sync engine is being built. Everything else in Check-in
              works online today; this adds resilience for low-signal venues.
            </p>
          </div>

          <div className="w-full space-y-2 text-left">
            {PLANNED.map((item) => (
              <div
                key={item}
                className="flex items-start gap-2.5 rounded-lg border border-border bg-surface-card px-4 py-2.5"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
                <span className="text-sm text-text-secondary">{item}</span>
              </div>
            ))}
          </div>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
            <Wrench className="h-3.5 w-3.5" />
            In progress
          </span>
        </div>
      </div>
    </MainScreenWrapper>
  );
}

export default OfflineCheckinScreen;
