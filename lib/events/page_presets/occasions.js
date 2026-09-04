import {
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

// Presets where the page has to feel like an invitation rather than a shop —
// typography leads, the price is present but never shouts.

export const gala = {
  key: "gala",
  name: "Gala",
  category: "occasion",
  description:
    "Serif type in one narrow column, the evening set as a running order, guests, and a quiet RSVP. Black tie on a page.",
  tags: ["Serif", "Narrow column", "Running order"],
  theme: {
    base: "dark",
    font: { heading: "playfair", body: "sans", scale: "lg" },
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
        "Invitation",
        [
          cmp("hero-centered", {
            eyebrow: "{{event.type | fallback:You are invited}}",
            title: "{{event.name}}",
            subtitle:
              "{{event.startsAt | date:long}} · {{venue.full | fallback:Location on request}}",
            buttons: [{ label: "RSVP", url: "#tickets", style: "outline" }],
          }),
        ],
        {
          layout: { paddingY: "2xl", maxWidth: "content" },
          style: { textAlign: "center" },
          background: accentWash(12, 0, 180),
        },
      ),

      band("Divider", [cmp("divider", {})], {
        layout: { paddingY: "none", maxWidth: "narrow" },
      }),

      band(
        "The evening",
        [
          cmp("richtext", {
            text: "## The evening\n\nDrinks on arrival, dinner served at eight, and the room to ourselves until late. Black tie.",
          }),
        ],
        { layout: { paddingY: "xl", maxWidth: "narrow" } },
      ),

      band(
        "Running order",
        [
          cmp("table", {
            head: "Time, Moment",
            rows: [
              { cells: "19:00, Champagne reception" },
              { cells: "20:00, Dinner is served" },
              { cells: "21:30, Speeches and the auction" },
              { cells: "22:30, Dancing" },
            ],
          }),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),

      band("Guests", [cmp("heading", { text: "Joining us" }), cmp("guests", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
      }),

      band(
        "RSVP",
        [
          cmp("register", {}),
          cmp("pricing", {
            title: "Tables and seats",
            buttonLabel: "RSVP",
            url: "#tickets",
            highlight: "",
            showRemaining: false,
          }),
        ],
        {
          layout: { paddingY: "xl", maxWidth: "content" },
          anchor: "tickets",
          background: accentTint(8),
        },
      ),

      section(
        "Details",
        [
          row([
            col(6, [cmp("location", {})]),
            col(6, [cmp("guidelines", {}), cmp("goodtoknow", {})]),
          ]),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),
    ]),
};

export const retreat = {
  key: "retreat",
  name: "Retreat",
  category: "occasion",
  description:
    "Image and text alternating down the page, the days set out as an itinerary, and what's included spelled out plainly.",
  tags: ["Alternating bands", "Itinerary", "What's included"],
  theme: {
    base: "light",
    font: { heading: "playfair", body: "sans", scale: "md" },
    headingWeight: "medium",
    headingUpper: false,
    radius: "rounded",
    button: "solid",
    elevation: "flat",
    width: "standard",
    density: "spacious",
    cover: "gradient",
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
                "{{event.startsAt | date:long}} · {{venue.name | fallback:Somewhere quiet}}",
              imageUrl: "{{event.coverUrl}}",
              overlay: 30,
              height: "lg",
              align: "left",
              buttons: [{ label: "Reserve a place", url: "#tickets", style: "solid" }],
            },
            { maxWidth: "full" },
          ),
        ],
        { layout: { maxWidth: "wide", paddingX: "sm", paddingY: "lg" } },
      ),

      section(
        "Why come",
        [
          row(
            [
              col(6, [cmp("image", { url: "{{event.coverUrl}}", caption: "" })]),
              col(6, [
                cmp("richtext", {
                  text: "## Time away from the noise\n\nA few days with nothing scheduled before nine and nothing expected after six. Walks, long meals, and enough space to think.",
                }),
              ]),
            ],
            { vAlign: "center", gap: "lg" },
          ),
        ],
        { layout: { paddingY: "xl" } },
      ),

      section(
        "How it runs",
        [
          row(
            [
              col(6, [
                cmp("richtext", {
                  text: "## Unhurried by design\n\nMornings are yours. Afternoons we gather. Evenings are long, shared and entirely optional.",
                }),
              ]),
              col(6, [cmp("expect", {})]),
            ],
            { vAlign: "center", gap: "lg", reverseOnMobile: true },
          ),
        ],
        { layout: { paddingY: "xl" }, background: accentTint(8) },
      ),

      band("Itinerary", [cmp("heading", { text: "The days" }), cmp("schedule", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
      }),

      band(
        "Included",
        [
          cmp("heading", { text: "What's included" }),
          cmp("icon-list", {
            columns: "2",
            items: [
              { icon: "coffee", title: "All meals", detail: "Cooked on site, eaten together." },
              { icon: "star", title: "Your room", detail: "Private, quiet, made up daily." },
              { icon: "users", title: "Every session", detail: "Nothing costs extra once you're there." },
              { icon: "car", title: "Transfers", detail: "From the nearest station, both ways." },
            ],
          }),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
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
        { layout: { paddingY: "lg", maxWidth: "wide" } },
      ),

      band(
        "In their words",
        [
          cmp("testimonials", {
            title: "In their words",
            columns: "3",
            items: [],
          }),
        ],
        { layout: { paddingY: "lg" } },
      ),

      withRail(
        "Reserve",
        7,
        [cmp("about", {}), cmp("location", {})],
        [cmp("register", {}), cmp("goodtoknow", {}), cmp("guidelines", {})],
        { layout: { paddingY: "xl" }, anchor: "tickets" },
      ),
    ]),
};

export const fundraiser = {
  key: "fundraiser",
  name: "Fundraiser",
  category: "occasion",
  description:
    "Leads with the impact, tells the story once, and repeats the ask. Supporters get a wall of their own.",
  tags: ["Impact stats", "Story", "Supporters"],
  theme: {
    base: "light",
    font: { heading: "sans", body: "sans", scale: "md" },
    headingWeight: "bold",
    headingUpper: false,
    radius: "rounded",
    button: "solid",
    elevation: "subtle",
    width: "standard",
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
              eyebrow: "{{event.startsAt | date:long}}",
              title: "{{event.name}}",
              subtitle:
                "{{event.tagline | fallback:One night, one cause, and a room willing to help.}}",
              imageUrl: "{{event.coverUrl}}",
              overlay: 45,
              height: "md",
              align: "left",
              buttons: [{ label: "Take part", url: "#tickets", style: "solid" }],
            },
            { maxWidth: "full" },
          ),
        ],
        { layout: { maxWidth: "wide", paddingX: "sm", paddingY: "lg" } },
      ),

      band(
        "Impact",
        [
          cmp("stats", {
            items: [
              { value: "{{counts.going | number}}", label: "Coming" },
              { value: "{{counts.guests}}", label: "Speaking" },
              { value: "100%", label: "To the cause" },
            ],
          }),
        ],
        {
          layout: { paddingY: "lg" },
          style: { textAlign: "center" },
          background: accentWash(20, 4),
        },
      ),

      section(
        "The story",
        [
          row(
            [
              col(7, [cmp("about", {}), cmp("expect", {})]),
              col(5, [cmp("image", { url: "{{event.coverUrl}}", caption: "" })]),
            ],
            { vAlign: "start", gap: "lg" },
          ),
        ],
        { layout: { paddingY: "xl" } },
      ),

      band(
        "The ask",
        [
          cmp("cta", {
            title: "Every seat sold pays for the work",
            label: "Take a seat",
            url: "#tickets",
          }),
        ],
        {
          layout: { paddingY: "lg", maxWidth: "content" },
          style: { textAlign: "center" },
          background: accentTint(12),
        },
      ),

      band(
        "Supporters",
        [
          cmp("logo-wall", {
            title: "With thanks to",
            align: "center",
            muted: true,
            items: [],
          }),
        ],
        { layout: { paddingY: "lg" }, style: { textAlign: "center" } },
      ),

      withRail(
        "Take part",
        7,
        [
          cmp("pricing", {
            title: "Take part",
            buttonLabel: "Take a seat",
            url: "#tickets",
            highlight: "",
            showRemaining: true,
          }),
          cmp("schedule", {}),
        ],
        [cmp("register", {}), cmp("goodtoknow", {})],
        { layout: { paddingY: "lg" }, anchor: "tickets" },
      ),

      section(
        "Practicalities",
        [
          row([
            col(7, [cmp("faq", {})]),
            col(5, [cmp("location", {}), cmp("guidelines", {})]),
          ]),
        ],
        { layout: { paddingY: "lg" } },
      ),

      band(
        "Stay close",
        [
          cmp("email-capture", {
            title: "Can't come, still want to help?",
            subtitle: "We'll write when there's something worth telling you.",
            placeholder: "you@example.com",
            buttonLabel: "Keep me posted",
            action: "",
            successText: "Thank you — we'll be in touch.",
          }),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),
    ]),
};
