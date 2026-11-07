"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { listVenues } from "@/lib/supabase/venues";
import { listVenueSpaces } from "@/lib/supabase/venue_spaces";
import { listEvents } from "@/lib/supabase/events";

// Venues, spaces and events every Event Design screen links plans to — loaded once per screen, never null.
export function useDesignContext(projectId) {
  const [state, setState] = useState({ venues: [], spaces: [], events: [], loading: true });

  useEffect(() => {
    let alive = true;
    Promise.all([listVenues(projectId), listVenueSpaces(projectId), listEvents(projectId)]).then(
      ([venues, spaces, events]) => {
        if (!alive) return;
        setState({ venues: venues ?? [], spaces: spaces ?? [], events: events ?? [], loading: false });
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const addSpace = useCallback(
    (space) => space && setState((prev) => ({ ...prev, spaces: [...prev.spaces, space] })),
    [],
  );

  const venueById = useMemo(() => new Map(state.venues.map((v) => [v.id, v])), [state.venues]);
  const spaceById = useMemo(() => new Map(state.spaces.map((s) => [s.id, s])), [state.spaces]);
  const eventById = useMemo(() => new Map(state.events.map((e) => [e.id, e])), [state.events]);

  return { ...state, addSpace, venueById, spaceById, eventById };
}

// "Grand Hotel · Ballroom" for a plan's links, or "" when it has none.
export function placeLabel(plan, ctx) {
  const venue = plan?.venueId ? ctx.venueById.get(plan.venueId) : null;
  const space = plan?.venueSpaceId ? ctx.spaceById.get(plan.venueSpaceId) : null;
  return [venue?.name, space?.name].filter(Boolean).join(" · ");
}
