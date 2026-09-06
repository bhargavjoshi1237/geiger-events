import { router, usePathname } from "expo-router";
import type { Href } from "expo-router";
import { useEffect } from "react";

// The (app) group is one flat Tabs navigator, so detail routes are separate
// tab entries with no stacked history: router.back() drops to the Home tab.
// This trail remembers where the user came from so back returns there.
const trail: string[] = [];
const MAX_TRAIL = 20;

export function recordRoute(path: string | null) {
  if (!path) return;
  if (trail[trail.length - 1] === path) return;
  trail.push(path);
  if (trail.length > MAX_TRAIL) trail.shift();
}

// Back to the screen the user came from; Home tab only when there is none.
export function goBack(fallback = "/(app)/home" as Href) {
  const current = trail[trail.length - 1];
  const prev = [...trail].reverse().find((p) => p !== current);
  if (prev) {
    router.navigate(prev as Href);
  } else if (router.canGoBack()) {
    router.back();
  } else {
    router.navigate(fallback);
  }
}

// Mount once inside the root navigator; records every pathname change.
export function NavHistoryRecorder() {
  const path = usePathname();
  useEffect(() => {
    recordRoute(path);
  }, [path]);
  return null;
}
