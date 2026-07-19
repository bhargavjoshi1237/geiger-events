"use client";

import React from "react";
import dynamic from "next/dynamic";
import { BrowserFrame } from "./browser_frame";
import { ScaledViewport } from "./scaled_viewport";

// Live, focused previews of real app surfaces, embedded in the landing
// spotlights. Each screen is code-split (ssr: false) so the landing bundle stays
// lean and these only load in the browser. Screens render at a desktop logical
// width and are CSS-scaled to fit the frame (ScaledViewport) so their intended
// multi-column layout stays intact instead of collapsing in the narrow column.
// Each screen runs with its `demo` prop so it self-seeds without a session/DB.
const FRAME_CONTENT = "h-[500px] overflow-hidden";

const FloorPlanScreen = dynamic(
  () =>
    import("@/components/internal/screens/conference/floor_plan").then(
      (m) => m.FloorPlanScreen,
    ),
  { ssr: false },
);

const InsightsScreen = dynamic(
  () =>
    import("@/components/internal/screens/advertising/insights").then(
      (m) => m.InsightsScreen,
    ),
  { ssr: false },
);

const MobileAppScreen = dynamic(
  () =>
    import("@/components/internal/screens/conference/mobile_app").then(
      (m) => m.MobileAppScreen,
    ),
  { ssr: false },
);

// Plan the room — the real Floor Plan & Booths map, seeded with placed booths.
export function FloorPlanPlayground() {
  return (
    <BrowserFrame contentClassName={FRAME_CONTENT}>
      <ScaledViewport width={1360}>
        <FloorPlanScreen demo />
      </ScaledViewport>
    </BrowserFrame>
  );
}

// Measure what works — the real Advertising Insights dashboard, seeded campaigns.
export function InsightsPlayground() {
  return (
    <BrowserFrame contentClassName={FRAME_CONTENT}>
      <ScaledViewport width={1240}>
        <InsightsScreen demo />
      </ScaledViewport>
    </BrowserFrame>
  );
}

// In every pocket — the real Mobile Event App builder with its live phone preview.
export function MobileAppPlayground() {
  return (
    <BrowserFrame contentClassName={FRAME_CONTENT}>
      <ScaledViewport width={1200}>
        <MobileAppScreen demo />
      </ScaledViewport>
    </BrowserFrame>
  );
}
