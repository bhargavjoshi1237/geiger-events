// Section navigation + registry for the Event Wall editor. Mirrors
// event_sections.js, but for the wall's single (singleton) config instead of
// a per-row event.

import { SquarePen, Palette, CalendarDays, Link2 } from "lucide-react";

import { WallGeneralSection } from "./general";
import { WallDesignSection } from "./design";
import { WallEventsSection } from "./listing";
import { WallCustomUrlSection } from "./custom_url";

export const NAV_GROUPS = [
  {
    group: null,
    items: [
      {
        key: "general",
        label: "General",
        icon: SquarePen,
        desc: "Name, tagline, and logo for your public events page.",
      },
      {
        key: "design",
        label: "Design",
        icon: Palette,
        desc: "Brand colors, typography, and layout for the wall.",
      },
      {
        key: "listing",
        label: "Events",
        icon: CalendarDays,
        desc: "Which events show, how they're sorted, and what's featured.",
      },
      {
        key: "url",
        label: "Custom URL",
        icon: Link2,
        desc: "The public link people use to reach your events page.",
      },
    ],
  },
];

export const SECTIONS = {
  general: WallGeneralSection,
  design: WallDesignSection,
  listing: WallEventsSection,
  url: WallCustomUrlSection,
};
