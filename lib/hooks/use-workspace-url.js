"use client";

import { useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Persistent workspace navigation, mirrored to the URL so a refresh (or a shared
// link) lands the user on the exact same place — the active sidebar tab, the
// open event, and the editor section. Matches the suite pattern (Geiger Flow):
// the URL is the source of truth, navigation uses `router.push(..., { scroll:
// false })`, and a default value drops its param for a clean URL.
//
// Schema:  /home?tab=All%20Events&event=evt_123&section=tickets
//   - tab     → workspace tab (sidebar). Default "Overview" ⇒ omitted.
//   - event   → id of the open event in All Events. None ⇒ omitted.
//   - section → editor section inside an event. Default "overview" ⇒ omitted.
//
// Components reading this hook must sit under a <Suspense> boundary (required by
// `useSearchParams`); the /home page provides one.
export const DEFAULT_TAB = "Overview";
export const DEFAULT_SECTION = "overview";

export function useWorkspaceUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = searchParams.get("tab") || DEFAULT_TAB;
  const eventId = searchParams.get("event") || null;
  const section = searchParams.get("section") || DEFAULT_SECTION;

  // Patch the query string immutably. For each key: `undefined` leaves it
  // untouched, while a value equal to its default (or null/empty) deletes it so
  // the URL stays clean.
  const apply = useCallback(
    (next) => {
      const params = new URLSearchParams(searchParams.toString());
      const put = (key, value, fallback) => {
        if (value === undefined) return;
        if (value === null || value === "" || value === fallback)
          params.delete(key);
        else params.set(key, value);
      };
      put("tab", next.tab, DEFAULT_TAB);
      put("event", next.event, null);
      put("section", next.section, DEFAULT_SECTION);

      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  // Switching workspace tabs exits any open event/section.
  const setTab = useCallback(
    (next) => apply({ tab: next, event: null, section: null }),
    [apply],
  );
  // Opening an event keeps the tab but resets to its default section.
  const openEvent = useCallback(
    (id) => apply({ event: id, section: null }),
    [apply],
  );
  // Switch to another tab and open an event there in one navigation — used when
  // a different screen (e.g. Templates) hands off to the event editor.
  const openEventInTab = useCallback(
    (id, nextTab) => apply({ tab: nextTab, event: id, section: null }),
    [apply],
  );
  const closeEvent = useCallback(
    () => apply({ event: null, section: null }),
    [apply],
  );
  const setSection = useCallback((next) => apply({ section: next }), [apply]);

  return {
    tab,
    eventId,
    section,
    setTab,
    openEvent,
    openEventInTab,
    closeEvent,
    setSection,
  };
}
