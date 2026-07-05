"use client";

import React from "react";
import { Scale } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader, EmptyState } from "@/components/internal/shared/screen_kit";

// Placeholder surface — tax configuration is intentionally empty for now.
export function TaxesScreen() {
  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Taxes"
        description="Configure tax rates applied to ticket sales."
      />
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={Scale}
          title="No taxes configured"
          description="Tax rules aren't set up yet. This section will let you define rates and apply them to ticket sales."
        />
      </div>
    </MainScreenWrapper>
  );
}

export default TaxesScreen;
