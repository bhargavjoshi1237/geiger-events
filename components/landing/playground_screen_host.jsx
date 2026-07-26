"use client";

import React from "react";

import { getScreen } from "@/components/internal/screens/registry";
import { ComingSoonScreen } from "@/components/internal/screens/coming_soon";

// The resolved screen, or the same Coming Soon fallback the workspace uses for a
// nav item without one. `demo` is passed to every screen: the ones that support
// it (Insights, Floor Plan & Booths, Mobile Event App, Real-time Attendance…)
// self-seed sample data and skip fetching; the rest ignore it and render their
// real empty states, since the playground has no project.
function ScreenSlot({ Screen, activeItem }) {
  if (!Screen) {
    return <ComingSoonScreen title={activeItem.title} icon={activeItem.icon} />;
  }
  return <Screen demo />;
}

// Resolves a sidebar tab to its real screen, exactly like the workspace shell
// (app/project/[projectId]/[[...rest]]/page.js). Split into its own module so the
// registry — which statically imports every screen in the app — only loads once a
// visitor leaves the playground's Overview, keeping the landing page light.
export default function PlaygroundScreenHost({ activeItem }) {
  return (
    <ScreenSlot Screen={getScreen(activeItem.title)} activeItem={activeItem} />
  );
}
