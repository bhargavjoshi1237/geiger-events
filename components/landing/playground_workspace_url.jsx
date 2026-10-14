"use client";

import React, { useCallback, useMemo, useState } from "react";
import {
  WorkspaceUrlContext,
  DEFAULT_TAB,
  DEFAULT_SECTION,
} from "@/lib/hooks/use-workspace-url";
import { PLAYGROUND_PROJECT } from "@/lib/playground/mode";

// In-memory stand-in for the routed workspace URL, for shells that run outside a
// /project/<id> route — today the /playground route. It exposes exactly the
// useWorkspaceUrl() API, but the active tab, open event/venue/workflow/record and
// editor section live in React state, so a screen can open its detail view inside
// the embed without navigating the page hosting it.
//
// The project is the playground's seeded Halcyon Studio project, served by the
// in-memory database (lib/playground) while the playground is mounted.

const EMPTY_STATE = {
  tab: DEFAULT_TAB,
  event: null,
  section: DEFAULT_SECTION,
  workflow: null,
  venue: null,
  record: null,
};

const STATE_KEYS = Object.keys(EMPTY_STATE);

export function PlaygroundWorkspaceUrlProvider({ children }) {
  const [state, setState] = useState(EMPTY_STATE);

  // Same patch semantics as the routed hook: `undefined` keeps the current
  // value, an explicit value (including null) replaces it.
  const apply = useCallback((next) => {
    setState((prev) => {
      const merged = { ...prev };
      for (const key of STATE_KEYS) {
        if (next[key] !== undefined) merged[key] = next[key];
      }
      return merged;
    });
  }, []);

  const value = useMemo(
    () => ({
      projectId: PLAYGROUND_PROJECT.id,
      tab: state.tab || DEFAULT_TAB,
      eventId: state.event,
      section: state.section || DEFAULT_SECTION,
      workflowId: state.workflow,
      venueId: state.venue,
      recordId: state.record,
      // Nothing to switch to — the playground has exactly one project.
      setProject: () => {},
      // Switching tabs exits any open entity, mirroring the routed behaviour.
      setTab: (tab) =>
        apply({
          tab,
          event: null,
          section: null,
          workflow: null,
          venue: null,
          record: null,
        }),
      openEvent: (id) => apply({ event: id, section: null }),
      openEventInTab: (id, tab) => apply({ tab, event: id, section: null }),
      closeEvent: () => apply({ event: null, section: null }),
      setSection: (section) => apply({ section }),
      openWorkflow: (id) => apply({ workflow: id }),
      closeWorkflow: () => apply({ workflow: null }),
      openWorkflowInTab: (id, tab) => apply({ tab, workflow: id }),
      openVenue: (id) => apply({ venue: id, section: null }),
      closeVenue: () => apply({ venue: null, section: null }),
      openRecord: (id) => apply({ record: id, section: null }),
      closeRecord: () => apply({ record: null, section: null }),
    }),
    [state, apply],
  );

  return (
    <WorkspaceUrlContext.Provider value={value}>
      {children}
    </WorkspaceUrlContext.Provider>
  );
}

export default PlaygroundWorkspaceUrlProvider;
