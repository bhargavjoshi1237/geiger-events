"use client";

import React from "react";
import { Info } from "lucide-react";

import { SegmentsScreen } from "../guests/segments";

// Segmentation appears in both Guests and Campaigns. Rather than a duplicate
// table, Campaigns > Segmentation reuses the shared Segments screen (one
// audience source of truth) with a short context banner — the folded pattern.
export function SegmentationScreen() {
  return (
    <>
      <div className="w-full px-2 pt-4 lg:px-0 lg:max-w-[85%] mx-auto">
        <div className="flex items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-text-tertiary" />
          <p className="text-sm text-text-secondary">
            Segments are your reusable campaign audiences. Build one here, then pick it as a
            campaign&apos;s audience — membership recomputes live as your contacts change.
          </p>
        </div>
      </div>
      <SegmentsScreen />
    </>
  );
}

export default SegmentationScreen;
