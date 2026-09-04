import {
  FULL_BLEED,
  accentTint,
  accentWash,
  band,
  cmp,
  col,
  row,
  section,
  tree,
  withRail,
} from "./kit";

// Presets for events people go to for the night — the artwork and the lineup do
// the selling, and the buy button never leaves the screen.

export const festival = {
  key: "festival",
  name: "Festival",
  category: "live",
  description:
    "A full-bleed cover, the name scrolling underneath it, then the lineup as a wall of faces. The buy bar follows you down the page.",
  tags: ["Full-bleed cover", "Lineup wall", "Sticky buy bar"],
  theme: {
    base: "dark",
    font: { heading: "grotesk", body: "grotesk", scale: "md" },
    headingWeight: "black",
    headingUpper: true,
    radius: "rounded",
    button: "solid",
    elevation: "lifted",
    width: "wide",
    density: "comfortable",
    cover: "accent",
  },
  build: () =>
    tree([
      band(
        "Cover",
        [
          cmp(
            "hero-banner",
            {
              eyebrow: "",
              title: "{{event.name}}",
              subtitle:
                "{{event.startsAt | date:long}} · {{venue.name | fallback:Venue to be announced}}",
              imageUrl: "{{event.coverUrl}}",
              overlay: 50,
              height: "full",
              align: "center",
              buttons: [{ label: "Get tickets", url: "#tickets", style: "solid" }],
            },
            { radius: "none", maxWidth: "full" },
          ),
        ],
        FULL_BLEED,
      ),

      band(
        "Marquee",
        [
          cmp("marquee", {
            text: "{{event.name}}",
            size: "xl",
            speed: 30,
            repeat: 4,
            separator: "✦",
            outline: true,
            border: true,
          }),
        ],
        { layout: { maxWidth: "full", paddingX: "none", paddingY: "sm" } },
      ),

      band(
        "Lineup",
        [
          cmp("heading", { text: "The lineup" }),
          cmp("speakers", {
            title: "",
            source: "event",
            columns: "4",
            showBio: false,
            items: [],
          }),
        ],
        { layout: { paddingY: "xl" } },
      ),

      section(
        "Momentum",
        [
          row(
            [
              col(7, [
                cmp("stats", {
                  items: [
                    { value: "{{counts.going | number}}", label: "Going" },
                    { value: "{{counts.guests}}", label: "Acts" },
                    { value: "{{counts.daysUntil}}", label: "Days to go" },
                  ],
                }),
              ]),
              col(5, [
                cmp("urgency", {
                  title: "{count} tickets left",
                  soldOutText: "Sold out",
                  showPercent: true,
                  threshold: 0,
                }),
              ]),
            ],
            { vAlign: "center" },
          ),
        ],
        { layout: { paddingY: "lg" }, background: accentTint(10) },
      ),

      band(
        "Gallery",
        [
          cmp("gallery", {
            title: "",
            source: "event",
            columns: "3",
            lightbox: true,
            items: [],
          }),
        ],
        { layout: { maxWidth: "full", paddingX: "sm", paddingY: "lg" } },
      ),

      withRail(
        "Tickets",
        7,
        [
          cmp("heading", { text: "Tickets" }),
          cmp("pricing", {
            title: "",
            buttonLabel: "Get tickets",
            url: "#tickets",
            highlight: "",
            showRemaining: true,
          }),
        ],
        [cmp("register", {})],
        { layout: { paddingY: "xl" }, anchor: "tickets" },
      ),

      section(
        "Details",
        [
          row([
            col(7, [cmp("about", {}), cmp("schedule", {})]),
            col(5, [cmp("location", {}), cmp("goodtoknow", {})]),
          ]),
        ],
        { layout: { paddingY: "lg" } },
      ),

      band(
        "Buy bar",
        [
          cmp("sticky-cta", {
            title: "{{event.name}}",
            note: "{{tickets.priceRange | fallback:Free entry}}",
            label: "Get tickets",
            url: "#tickets",
            position: "bottom",
          }),
        ],
        { layout: { paddingY: "none", paddingX: "none", maxWidth: "full" } },
      ),
    ]),
};

export const clubNight = {
  key: "club",
  name: "Club night",
  category: "live",
  description:
    "Dark, loud and compact. A full-screen cover, an outlined marquee, the bill, and a countdown running against the clock.",
  tags: ["Full-screen cover", "Outlined marquee", "Countdown"],
  theme: {
    base: "dark",
    font: { heading: "grotesk", body: "grotesk", scale: "md" },
    headingWeight: "black",
    headingUpper: true,
    radius: "sharp",
    button: "solid",
    buttonUpper: true,
    elevation: "lifted",
    width: "wide",
    density: "compact",
    cover: "accent",
    coverOverlay: "scrim",
  },
  build: () =>
    tree([
      band(
        "Cover",
        [
          cmp(
            "hero-banner",
            {
              eyebrow: "{{event.startsAt | date:weekday}}",
              title: "{{event.name}}",
              subtitle: "{{venue.name | fallback:Location on release}}",
              imageUrl: "{{event.coverUrl}}",
              overlay: 60,
              height: "full",
              align: "left",
              buttons: [{ label: "Tickets", url: "#tickets", style: "solid" }],
            },
            { radius: "none", maxWidth: "full" },
          ),
        ],
        FULL_BLEED,
      ),

      band(
        "Marquee",
        [
          cmp("marquee", {
            text: "{{event.name}}",
            size: "xl",
            speed: 16,
            repeat: 6,
            separator: "//",
            outline: true,
            border: true,
          }),
        ],
        { layout: { maxWidth: "full", paddingX: "none", paddingY: "none" } },
      ),

      band(
        "On the night",
        [
          cmp("heading", { text: "On the night" }),
          cmp("speakers", {
            title: "",
            source: "event",
            columns: "3",
            showBio: false,
            items: [],
          }),
        ],
        { layout: { paddingY: "lg" } },
      ),

      section(
        "Countdown",
        [
          row(
            [
              col(6, [
                cmp("countdown", {
                  title: "Doors open in",
                  target: "{{event.startsAt}}",
                  showSeconds: true,
                  endedText: "We're inside.",
                }),
              ]),
              col(6, [
                cmp("urgency", {
                  title: "{count} on the door",
                  soldOutText: "Sold out",
                  showPercent: true,
                  threshold: 0,
                }),
                cmp("checkout-button", {
                  label: "Get tickets — {{tickets.priceRange | fallback:free}}",
                  url: "#tickets",
                  fullWidth: true,
                  note: "",
                }),
              ]),
            ],
            { vAlign: "center" },
          ),
        ],
        { layout: { paddingY: "lg" }, background: accentWash(22, 4) },
      ),

      band(
        "Gallery",
        [
          cmp("gallery", {
            title: "",
            source: "event",
            columns: "2",
            lightbox: true,
            items: [],
          }),
        ],
        { layout: { maxWidth: "full", paddingX: "sm", paddingY: "lg" } },
      ),

      withRail(
        "Tickets",
        7,
        [
          cmp("pricing", {
            title: "Tickets",
            buttonLabel: "Get tickets",
            url: "#tickets",
            highlight: "",
            showRemaining: true,
          }),
        ],
        [cmp("register", {})],
        { layout: { paddingY: "lg" }, anchor: "tickets" },
      ),

      section(
        "Where",
        [
          row([
            col(7, [cmp("about", {}), cmp("location", {})]),
            col(5, [cmp("goodtoknow", {}), cmp("guidelines", {})]),
          ]),
        ],
        { layout: { paddingY: "lg" } },
      ),

      band(
        "Buy bar",
        [
          cmp("sticky-cta", {
            title: "{{event.name}}",
            note: "{{event.startsAt | date:medium}}",
            label: "Tickets",
            url: "#tickets",
            position: "bottom",
          }),
        ],
        { layout: { paddingY: "none", paddingX: "none", maxWidth: "full" } },
      ),
    ]),
};
