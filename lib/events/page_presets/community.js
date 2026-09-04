import {
  FULL_BLEED,
  accentTint,
  band,
  cmp,
  col,
  row,
  section,
  tree,
} from "./kit";

// Presets that stay out of the way — one for work that should be looked at, one
// for the regular get-together that just needs to be legible on a phone.

export const exhibition = {
  key: "exhibition",
  name: "Exhibition",
  category: "community",
  description:
    "The work first, edge to edge, before a word of copy. Quiet type, wide margins, opening times set as a table.",
  tags: ["Gallery first", "Quiet type", "Wide margins"],
  theme: {
    base: "light",
    font: { heading: "sans", body: "sans", scale: "md" },
    headingWeight: "medium",
    headingUpper: false,
    radius: "sharp",
    button: "outline",
    elevation: "flat",
    width: "narrow",
    density: "spacious",
    cover: "solid",
  },
  build: () =>
    tree([
      band(
        "The work",
        [
          cmp(
            "gallery",
            {
              title: "",
              source: "event",
              columns: "3",
              lightbox: true,
              items: [],
            },
            { radius: "none", maxWidth: "full" },
          ),
        ],
        FULL_BLEED,
      ),

      band(
        "Title",
        [
          cmp("hero-centered", {
            eyebrow: "{{event.type | fallback:Exhibition}}",
            title: "{{event.name}}",
            subtitle: "{{venue.full | fallback:Location to be announced}}",
            buttons: [{ label: "Plan a visit", url: "#visit", style: "outline" }],
          }),
        ],
        {
          layout: { paddingY: "2xl", maxWidth: "content" },
          style: { textAlign: "center" },
        },
      ),

      band("About", [cmp("about", {})], {
        layout: { paddingY: "lg", maxWidth: "narrow" },
      }),

      band("Artists", [cmp("heading", { text: "Showing" }), cmp("guests", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
      }),

      band(
        "Opening times",
        [
          cmp("heading", { text: "Opening times" }),
          cmp("table", {
            head: "Day, Hours",
            rows: [
              { cells: "Tuesday – Friday, 11:00 – 18:00" },
              { cells: "Saturday, 10:00 – 19:00" },
              { cells: "Sunday, 12:00 – 17:00" },
              { cells: "Monday, Closed" },
            ],
          }),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),

      section(
        "Visit",
        [
          row([
            col(6, [cmp("location", {})]),
            col(6, [cmp("register", {}), cmp("goodtoknow", {})]),
          ]),
        ],
        {
          layout: { paddingY: "xl", maxWidth: "content" },
          anchor: "visit",
          background: accentTint(6),
        },
      ),
    ]),
};

export const meetup = {
  key: "meetup",
  name: "Meetup",
  category: "community",
  description:
    "Phone-shaped: one narrow column of cards, who's coming near the top, and a buy bar within thumb reach.",
  tags: ["Single column", "Who's going", "Thumb reach"],
  theme: {
    base: "dark",
    font: { heading: "sans", body: "sans", scale: "md" },
    headingWeight: "semibold",
    headingUpper: false,
    radius: "rounded",
    button: "solid",
    elevation: "subtle",
    width: "narrow",
    density: "compact",
    cover: "gradient",
  },
  build: () =>
    tree([
      band(
        "Title bar",
        [
          cmp("titlebar", {
            title: "{{event.name}}",
            meta: "{{event.startsAt | date:medium}}",
            label: "Join",
            url: "#tickets",
            sticky: true,
          }),
        ],
        { layout: { paddingY: "sm", maxWidth: "content" } },
      ),

      band(
        "Hero",
        [
          cmp("hero-centered", {
            eyebrow: "{{event.startsAt | date:weekday}}",
            title: "{{event.name}}",
            subtitle:
              "{{event.tagline | fallback:A couple of hours, a few talks, and a drink after.}}",
            buttons: [{ label: "Save me a spot", url: "#tickets", style: "solid" }],
          }),
        ],
        {
          layout: { paddingY: "xl", maxWidth: "content" },
          style: { textAlign: "center" },
        },
      ),

      band("Join", [cmp("register", {})], {
        layout: { paddingY: "none", maxWidth: "content" },
        anchor: "tickets",
      }),

      band("What happens", [cmp("about", {}), cmp("expect", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
      }),

      band("Who's coming", [cmp("whosgoing", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
        background: accentTint(8),
      }),

      band("Running order", [cmp("schedule", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
      }),

      band(
        "Getting there",
        [cmp("location", {}), cmp("goodtoknow", {}), cmp("guidelines", {})],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),

      band(
        "Buy bar",
        [
          cmp("sticky-cta", {
            title: "{{event.name}}",
            note: "{{tickets.priceRange | fallback:Free}}",
            label: "Save me a spot",
            url: "#tickets",
            position: "bottom",
          }),
        ],
        { layout: { paddingY: "none", paddingX: "none", maxWidth: "full" } },
      ),
    ]),
};
