"use client";

import React from "react";
import { Info } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { SegmentsScreen } from "../guests/segments";

export function SegmentationScreen() {
  return (
    <>
      <MainScreenWrapper>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
          <p className="text-sm text-text-secondary">
            Segments are your reusable campaign audiences. Build one here, then pick it as a
            campaign&apos;s audience — membership recomputes live as your contacts change.
          </p>
        </div>
      </MainScreenWrapper>
      <SegmentsScreen />
    </>
  );
}

export default SegmentationScreen;
