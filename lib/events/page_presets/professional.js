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

// Presets for events people expense — the programme, the people speaking, and
// the price have to be answerable without scrolling twice.

export const conference = {
  key: "conference",
  name: "Conference",
  category: "professional",
  description:
    "A sticky title bar, split hero, sponsor wall, speakers and programme, then tiers side by side. The full microsite shape.",
  tags: ["Sticky nav", "Sponsors", "Speakers", "Programme"],
  theme: {
    base: "dark",
    font: { heading: "grotesk", body: "sans", scale: "md" },
    headingWeight: "semibold",
    headingUpper: false,
    radius: "rounded",
    button: "solid",
    elevation: "subtle",
    width: "wide",
    density: "comfortable",
    cover: "gradient",
  },
  build: () =>
    tree([
      band(
        "Title bar",
        [
          cmp("titlebar", {
            title: "{{event.name}}",
            meta: "{{event.startsAt | date:medium}} · {{venue.city}}",
            label: "Get tickets",
            url: "#tickets",
            sticky: true,
          }),
        ],
        { layout: { paddingY: "sm" } },
      ),

      band(
        "Hero",
        [
          cmp("hero-split", {
            eyebrow: "{{event.startsAt | date:long}}",
            title: "{{event.name}}",
            subtitle:
              "{{event.tagline | fallback:Two days of the people building what comes next.}}",
            imageUrl: "{{event.coverUrl}}",
            imagePosition: "right",
            buttons: [
              { label: "Get tickets", url: "#tickets", style: "solid" },
              { label: "See the programme", url: "#programme", style: "outline" },
            ],
          }),
        ],
        { layout: { paddingY: "xl" } },
      ),

      band(
        "Sponsors",
        [
          cmp("logo-wall", {
            title: "Backed by",
            align: "center",
            muted: true,
            items: [],
          }),
        ],
        { layout: { paddingY: "lg" }, style: { textAlign: "center" } },
      ),

      band(
        "Numbers",
        [
          cmp("stats", {
            items: [
              { value: "{{counts.sessions}}", label: "Sessions" },
              { value: "{{counts.guests}}", label: "Speakers" },
              { value: "{{counts.going | number}}", label: "Attending" },
            ],
          }),
        ],
        { layout: { paddingY: "lg" }, background: accentTint(10) },
      ),

      band(
        "Speakers",
        [
          cmp("heading", { text: "Speaking" }),
          cmp("speakers", {
            title: "",
            source: "event",
            columns: "3",
            showBio: true,
            items: [],
          }),
        ],
        { layout: { paddingY: "xl" } },
      ),

      band(
        "Programme",
        [cmp("heading", { text: "Programme" }), cmp("schedule", {})],
        { layout: { paddingY: "lg" }, anchor: "programme" },
      ),

      withRail(
        "Tickets",
        8,
        [
          cmp("pricing", {
            title: "Tickets",
            buttonLabel: "Get tickets",
            url: "#tickets",
            highlight: "",
            showRemaining: true,
          }),
        ],
        [cmp("register", {}), cmp("atregistration", {})],
        {
          layout: { paddingY: "xl" },
          anchor: "tickets",
          background: accentWash(14, 2),
        },
      ),

      section(
        "Practicalities",
        [
          row([
            col(7, [cmp("about", {}), cmp("faq", {})]),
            col(5, [cmp("location", {}), cmp("goodtoknow", {})]),
          ]),
        ],
        { layout: { paddingY: "lg" } },
      ),

      band(
        "Stay in touch",
        [
          cmp("email-capture", {
            title: "Can't make it this year?",
            subtitle: "We'll tell you when the next dates are announced.",
            placeholder: "you@work.com",
            buttonLabel: "Notify me",
            action: "",
            successText: "Thanks — we'll be in touch.",
          }),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),
    ]),
};

export const workshop = {
  key: "workshop",
  name: "Workshop",
  category: "professional",
  description:
    "Sells on outcomes: what you'll leave knowing, the curriculum opened row by row, who's teaching, one price.",
  tags: ["Outcomes", "Curriculum", "Single price"],
  theme: {
    base: "light",
    font: { heading: "sans", body: "sans", scale: "md" },
    headingWeight: "semibold",
    headingUpper: false,
    radius: "rounded",
    button: "solid",
    elevation: "flat",
    width: "standard",
    density: "comfortable",
    cover: "solid",
  },
  build: () =>
    tree([
      band(
        "Hero",
        [
          cmp("hero-split", {
            eyebrow: "{{event.type | fallback:Workshop}}",
            title: "{{event.name}}",
            subtitle:
              "{{event.tagline | fallback:A working session, not a lecture. Bring a laptop and a problem.}}",
            imageUrl: "{{event.coverUrl}}",
            imagePosition: "left",
            buttons: [{ label: "Book a place", url: "#tickets", style: "solid" }],
          }),
        ],
        { layout: { paddingY: "xl" } },
      ),

      band(
        "Outcomes",
        [
          cmp("heading", { text: "What you'll leave with" }),
          cmp("icon-list", {
            columns: "2",
            items: [
              { icon: "check", title: "A working setup", detail: "Configured on your own machine, not a sandbox." },
              { icon: "zap", title: "The shortcuts", detail: "The handful of moves that do most of the work." },
              { icon: "users", title: "People to ask", detail: "A room of others solving the same thing." },
              { icon: "star", title: "Something finished", detail: "You leave with a thing that runs." },
            ],
          }),
        ],
        { layout: { paddingY: "lg" }, background: accentTint(8) },
      ),

      band(
        "Curriculum",
        [
          cmp("heading", { text: "The curriculum" }),
          cmp("accordion", {
            title: "",
            items: [
              { q: "Session one — foundations", a: "What we cover first, and what you need before you arrive." },
              { q: "Session two — building", a: "The main working block. You'll be typing, not watching." },
              { q: "Session three — shipping", a: "Taking it the last mile, and what to do on Monday." },
            ],
          }),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),

      band(
        "Teaching",
        [
          cmp("heading", { text: "Who's teaching" }),
          cmp("speakers", {
            title: "",
            source: "event",
            columns: "2",
            showBio: true,
            items: [],
          }),
        ],
        { layout: { paddingY: "lg", maxWidth: "content" } },
      ),

      withRail(
        "Book",
        7,
        [cmp("about", {}), cmp("expect", {}), cmp("schedule", {})],
        [
          cmp("register", {}),
          cmp("goodtoknow", {}),
          cmp("checkout-button", {
            label: "Book a place — {{tickets.priceRange | fallback:free}}",
            url: "#tickets",
            fullWidth: true,
            note: "Places are limited by the size of the room.",
          }),
        ],
        { layout: { paddingY: "lg" }, anchor: "tickets" },
      ),

      band("Questions", [cmp("faq", {}), cmp("guidelines", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
      }),
    ]),
};

export const launch = {
  key: "launch",
  name: "Launch",
  category: "professional",
  description:
    "A countdown under a centred headline, the film, the numbers, and the call to action repeated the whole way down.",
  tags: ["Countdown", "Video", "Repeated CTA"],
  theme: {
    base: "dark",
    font: { heading: "grotesk", body: "sans", scale: "lg" },
    headingWeight: "bold",
    headingUpper: false,
    radius: "pill",
    button: "solid",
    elevation: "lifted",
    width: "standard",
    density: "comfortable",
    cover: "accent",
  },
  build: () =>
    tree([
      band(
        "Opening",
        [
          cmp("hero-centered", {
            eyebrow: "{{event.startsAt | date:long}}",
            title: "{{event.name}}",
            subtitle:
              "{{event.tagline | fallback:The thing we've been building. Doors open once.}}",
            buttons: [
              { label: "Reserve a seat", url: "#tickets", style: "solid" },
              { label: "Watch the film", url: "#film", style: "outline" },
            ],
          }),
          cmp("countdown", {
            title: "Live in",
            target: "{{event.startsAt}}",
            showSeconds: true,
            endedText: "It's live.",
          }),
        ],
        {
          layout: { paddingY: "2xl", maxWidth: "content" },
          style: { textAlign: "center", minHeight: "70vh" },
          background: accentWash(24, 2, 180),
        },
      ),

      band("Film", [cmp("video", { url: "" })], {
        layout: { paddingY: "lg", maxWidth: "wide" },
        anchor: "film",
      }),

      band(
        "Numbers",
        [
          cmp("stats", {
            items: [
              { value: "{{counts.going | number}}", label: "Registered" },
              { value: "{{counts.daysUntil}}", label: "Days to go" },
              { value: "{{tickets.remaining}}", label: "Seats left" },
            ],
          }),
        ],
        { layout: { paddingY: "lg" }, background: accentTint(12) },
      ),

      band("The story", [cmp("about", {}), cmp("expect", {})], {
        layout: { paddingY: "lg", maxWidth: "content" },
      }),

      withRail(
        "Reserve",
        7,
        [
          cmp("pricing", {
            title: "Reserve a seat",
            buttonLabel: "Reserve",
            url: "#tickets",
            highlight: "",
            showRemaining: true,
          }),
          cmp("urgency", {
            title: "{count} seats left",
            soldOutText: "Fully booked",
            showPercent: true,
            threshold: 0,
          }),
        ],
        [cmp("register", {})],
        { layout: { paddingY: "lg" }, anchor: "tickets" },
      ),

      band("Where", [cmp("location", {}), cmp("faq", {})], {
        layout: { paddingY: "lg" },
      }),

      band(
        "Waitlist",
        [
          cmp("email-capture", {
            title: "Not this time?",
            subtitle: "Get the recording and the next date first.",
            placeholder: "you@work.com",
            buttonLabel: "Keep me posted",
            action: "",
            successText: "You're on the list.",
          }),
        ],
        {
          layout: { paddingY: "xl", maxWidth: "content" },
          style: { textAlign: "center" },
          background: accentTint(10),
        },
      ),

      band(
        "Buy bar",
        [
          cmp("sticky-cta", {
            title: "{{event.name}}",
            note: "{{event.startsAt | date:medium}}",
            label: "Reserve a seat",
            url: "#tickets",
            position: "bottom",
          }),
        ],
        { layout: { paddingY: "none", paddingX: "none", maxWidth: "full" } },
      ),
    ]),
};
