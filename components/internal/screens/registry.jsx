import { EventsOverviewScreen } from "./overview/events_overview";
import { EventsHomeScreen } from "./events/events_home";
import { AllEventsScreen } from "./events/all_events";
import { TemplatesScreen, EventSeriesScreen } from "./events/templates_series";

/**
 * Maps a sidebar nav title to its screen component. Titles must exactly match
 * the `title` fields in `components/internal/sidebar/sidebar_nav.jsx`.
 *
 * Per-event features (cover media, tickets, visibility, sharing, etc.) are NOT
 * top-level screens — they live as tabs inside the Event editor
 * (`events/event_detail.jsx`), opened by selecting an event in All Events.
 *
 * Anything not listed here falls back to the ComingSoonScreen.
 */
export const SCREEN_REGISTRY = {
  // Overview
  Overview: EventsOverviewScreen,

  // Events area (workspace-level only)
  Events: EventsHomeScreen,
  "All Events": AllEventsScreen,
  Templates: TemplatesScreen,
  "Event Series": EventSeriesScreen,
};

export function getScreen(title) {
  return SCREEN_REGISTRY[title] || null;
}
