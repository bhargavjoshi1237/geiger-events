// Events and their workspace furniture: the event rows (with the metadata bag the editor and
// public page read), series, templates, the public Event Wall and organiser profile, and the
// people following it.

import { PEOPLE, STUDIO, personId } from "../cast.js";
import { EVENTS, SERIES, VENUE_BY_ID, eventDate } from "./catalog.js";
import { TALLIES } from "./orders.js";
import { GUESTS } from "./people.js";
import { coverArt } from "./art.js";
import { PROJECT_ID, daysAgo, hoursAgo, pick, sid } from "./helpers.js";

// How long ago each event was created; the live workshop is the newest so it leads every list.
const CREATED = {
  brandWorkshop: 46, gala: 50, meridian: 55, meetupOct: 58, webinar: 60, motion: 62,
  kestrel: 70, atlasLab: 75, meetupSep: 80, solace: 115, summit: 120,
};

const PAGE_GUESTS = {
  summit: [
    [1, "Opening keynote · Day 1"], [3, "Brand systems that scale"], [7, "Motion as identity"],
    [10, "Launching in public"], [8, "Strategy you can draw"],
  ],
  kestrel: [[1, "Host"], [7, "Brand film director"]],
  motion: [[7, "Instructor"]],
  brandWorkshop: [[3, "Instructor"], [5, "Teaching assistant"]],
  atlasLab: [[3, "Workshop lead"]],
  webinar: [[1, "Speaker"], [10, "Speaker"]],
};

const SCHEDULES = {
  summit: [
    ["08:30", "Doors & coffee", "Registration opens in the Main Hall foyer."],
    ["09:30", "Opening keynote — Alex Rivera", "Ten years of Halcyon, and what we got wrong."],
    ["11:00", "Brand systems that scale", "Jonas Weber on tokens, templates and governance."],
    ["13:00", "Lunch in the courtyard", ""],
    ["14:30", "Workshops", "Six parallel rooms — ballot results emailed a week before."],
    ["18:00", "Closing party", "DJ set on the river terrace."],
  ],
  kestrel: [
    ["19:00", "Doors & test rides", "Rides leave every 15 minutes from the IJ loop."],
    ["20:00", "Brand film premiere", "Aero: the film, on the big screen."],
    ["20:30", "Q&A with the Kestrel team", ""],
    ["21:00", "After-party", "DJ set until 01:00."],
  ],
  brandWorkshop: [
    ["09:30", "Welcome & audit", "Bring one brand you know well."],
    ["11:00", "Tokens and type", ""],
    ["13:00", "Lunch", ""],
    ["14:00", "Templates that hold up", ""],
    ["16:30", "Crit & wrap", ""],
  ],
  meetupOct: [
    ["18:30", "Doors & pizza", ""],
    ["19:00", "Lightning talks", "Five talks, five minutes each."],
    ["20:00", "Portfolio reviews", "Sign up at the door."],
  ],
};

const FAQ = [
  { q: "Can I transfer my ticket?", a: "Yes — up to 48 hours before doors, from the link in your confirmation email." },
  { q: "Is the venue accessible?", a: "Step-free access throughout. Tell us about any access needs when you book and we'll be in touch." },
  { q: "Will talks be recorded?", a: "Main-stage talks are recorded and shared with ticket holders within a week." },
];

function eventMetadata(def) {
  const tally = TALLIES[def.id] ?? { ticketSold: {} };
  const meta = {
    tags: def.tags,
    storyline: def.storyline || undefined,
    description: `## ${def.name}\n\n${def.summary}\n\nHosted by ${STUDIO.name}.`,
    tickets: def.tickets.map(({ id, name, price, qty, groupId, description }) => ({ id, name, price, qty, groupId, description })),
    ticketSold: tally.ticketSold,
    ticketRules: { bundles: def.key === "summit", donation: def.key === "meetupOct", earlybird: def.key === "summit", groupPurchase: def.key === "summit", reservedSeating: def.key === "gala" },
    rsvp: { waitlist: Boolean(def.rsvps?.waitlisted), requireApproval: def.key === "meridian", blockWaitlistedRebook: false },
    regSettings: { showRemaining: def.key !== "meridian" },
    waitlistRules: { autoPromote: def.key === "meetupOct", claimWindowHours: 24, notify: true },
    capacityBuffer: def.key === "summit" ? 40 : 0,
    faq: def.tickets.length ? FAQ : FAQ.slice(1),
    organizerAvatar: "",
    highlights: def.key === "summit"
      ? [
          { id: "h1", title: "24 speakers", detail: "Studio leads and guests from Kestrel, Atlas and Solace." },
          { id: "h2", title: "6 workshop rooms", detail: "Hands-on sessions across brand, motion and launch." },
          { id: "h3", title: "Closing party", detail: "On the river terrace at LX Factory." },
        ]
      : [],
  };
  if (SCHEDULES[def.key]) {
    meta.schedule = SCHEDULES[def.key].map(([time, title, description], i) => ({ id: `s${i + 1}`, time, title, description, by: "", layout: "timeline", frame: "card", spacing: "normal" }));
  }
  if (PAGE_GUESTS[def.key]) {
    meta.guests = PAGE_GUESTS[def.key].map(([n, role], i) => {
      const p = PEOPLE.find((x) => x.n === n);
      return { id: `g${i + 1}`, name: p.name, role, bio: `${p.title} at ${STUDIO.name}.`, image: "" };
    });
  }
  if (def.key === "brandWorkshop" || def.key === "summit") {
    meta.checkinSessions = {
      sessions: (SCHEDULES[def.key] || []).filter(([, title]) => !/lunch|doors/i.test(title)).map(([time, title], i) => ({ id: `cs${i + 1}`, name: title, startsAt: `${eventDate(def)}T${time}:00` })),
    };
  }
  return meta;
}

export function eventRows() {
  return EVENTS.map((def) => {
    const venue = VENUE_BY_ID[def.venueId];
    const tally = TALLIES[def.id];
    const rsvpSold = def.rsvps ? def.rsvps.confirmed : 0;
    return {
      id: def.id,
      project_id: PROJECT_ID,
      name: def.name,
      status: def.status,
      type: def.type,
      event_date: eventDate(def),
      event_time: def.time,
      venue: venue.name,
      venue_id: venue.id,
      address: venue.address,
      city: venue.city,
      timezone: venue.timezone,
      capacity: def.capacity,
      sold: tally ? tally.sold : rsvpSold,
      revenue: tally ? Math.round(tally.revenue * 100) / 100 : 0,
      visibility: def.visibility,
      organizer: STUDIO.name,
      summary: def.summary,
      cover_url: coverArt(def.key, def.palette),
      gallery: [],
      series_id: def.seriesId ?? null,
      is_listable: def.visibility === "Public" && def.status !== "Draft",
      created_by: personId(def.key === "kestrel" || def.key === "webinar" ? 10 : def.key === "summit" ? 1 : 11),
      metadata: eventMetadata(def),
      created_at: daysAgo(CREATED[def.key] ?? 60),
      updated_at: hoursAgo(2 + (CREATED[def.key] ?? 60) % 40),
      deleted_at: null,
    };
  });
}

const TEMPLATES = [
  ["Studio Meetup", "Talks + portfolio reviews, free RSVP, waitlist on.", "Community", "Users", 14, { type: "In-person", capacity: 120, visibility: "Public", timezone: "America/New_York", summary: "Lightning talks, portfolio reviews and pizza." }],
  ["Hands-on Workshop", "Limited seats, one paid ticket, lunch included.", "Education", "GraduationCap", 22, { type: "In-person", capacity: 36, visibility: "Public", timezone: "Europe/Lisbon", summary: "A practical day with one of the studio leads." }],
  ["Client Launch Night", "Tiered tickets, press list, test-ride or demo slots.", "Social", "PartyPopper", 6, { type: "In-person", capacity: 450, visibility: "Public", timezone: "Europe/Amsterdam", summary: "Premiere, demos and an after-party." }],
  ["Conference (2-day)", "Passes, day tickets, agenda, sponsors and livestream.", "Conference", "Presentation", 3, { type: "Hybrid", capacity: 1200, visibility: "Public", timezone: "Europe/Lisbon", summary: "Two days of talks and workshops." }],
  ["Webinar", "Free registration, live captions, 30-day replay.", "Online", "Video", 31, { type: "Online", capacity: 500, visibility: "Public", timezone: "Europe/Lisbon", summary: "A live session with Q&A." }],
  ["Rooftop Session", "Day and weekend tickets, VIP cabanas, sunset start.", "Music", "Music", 4, { type: "In-person", capacity: 600, visibility: "Public", timezone: "Europe/Madrid", summary: "Live sets and food at sunset." }],
  ["Private Client Breakfast", "Unlisted, approval required, small capacity.", "Social", "Coffee", 9, { type: "In-person", capacity: 60, visibility: "Unlisted", timezone: "America/New_York", summary: "A private preview for a client's team." }],
  ["Studio Open House", "Free RSVP, tours every 30 minutes.", "Community", "DoorOpen", 2, { type: "In-person", capacity: 200, visibility: "Public", timezone: "Europe/Lisbon", summary: "Come and see where the work happens." }],
];

export function eventsSeed() {
  const events = eventRows();

  const event_series = [
    { id: SERIES.meetups, name: "Brooklyn Creative Meetups", description: "Monthly talks and portfolio reviews at the Brooklyn studio.", status: "On Sale", cadence: "Monthly", visibility: "Public", created_by: personId(6),
      settings: { defaults: { type: "In-person", visibility: "Public", timezone: "America/New_York", organizer: STUDIO.name, capacity: 120 }, recurrence: { frequency: "monthly", weekday: "thursday", week: "first" }, eventOrder: events.filter((e) => e.series_id === SERIES.meetups).map((e) => e.id), followPage: true } },
    { id: SERIES.workshops, name: "Halcyon Workshops", description: "Limited-seat, hands-on days with the studio's leads in Lisbon and Brooklyn.", status: "On Sale", cadence: "Custom", visibility: "Public", created_by: personId(11),
      settings: { defaults: { type: "In-person", visibility: "Public", timezone: "Europe/Lisbon", organizer: STUDIO.name, capacity: 36 }, recurrence: {}, eventOrder: events.filter((e) => e.series_id === SERIES.workshops).map((e) => e.id), followPage: true } },
    { id: SERIES.summit, name: "Halcyon Creative Summit", description: "The studio's annual two-day conference in Lisbon.", status: "On Sale", cadence: "Custom", visibility: "Public", created_by: personId(1),
      settings: { defaults: { type: "Hybrid", visibility: "Public", timezone: "Europe/Lisbon", organizer: STUDIO.name }, recurrence: {}, eventOrder: [events[0].id], followPage: false } },
  ].map((row, i) => ({ ...row, project_id: PROJECT_ID, created_at: daysAgo(400 - i * 90), updated_at: daysAgo(3 + i), deleted_at: null }));

  const event_templates = TEMPLATES.map(([name, description, category, icon, uses, blueprint], i) => ({
    id: sid("template", i + 1), project_id: PROJECT_ID, name, description, category, icon, uses,
    created_by: personId(i % 2 ? 11 : 2), metadata: { blueprint }, created_at: daysAgo(300 - i * 20), updated_at: daysAgo(20 + i), deleted_at: null,
  }));

  const event_notes = EVENTS.filter((e) => ["summit", "kestrel", "brandWorkshop", "gala"].includes(e.key)).map((def, i) => ({
    event_id: def.id,
    notes: [
      { id: `n${i}a`, body: pick(["Confirm AV walkthrough with the venue.", "Badge print run goes Monday.", "Catering numbers due 7 days out."], i), createdAt: daysAgo(6 + i), createdBy: personId(11) },
      { id: `n${i}b`, body: pick(["Press list locked — 31 confirmed.", "Accessibility seating reserved in rows A–B.", "Volunteer briefing at 08:00."], i + 1), createdAt: daysAgo(2 + i), createdBy: personId(4) },
    ],
    created_at: daysAgo(30),
    updated_at: daysAgo(2 + i),
  }));

  const event_wall = [{
    id: sid("wall", 1), project_id: PROJECT_ID, name: "Halcyon Events", tagline: STUDIO.tagline, slug: "halcyon-studio",
    logo_url: "", header_bg_url: coverArt("halcyon-wall", 0),
    metadata: {
      cta: { label: "Follow Halcyon", style: "primary" },
      theme: { accent: STUDIO.brandColor, layout: "grid", base: "dark" },
      footer: { text: "Halcyon Studio · Lisbon & Brooklyn", links: [{ label: "halcyon.studio", url: "https://halcyon.studio" }] },
      filters: { status: "upcoming", sortBy: "date" },
      featured: [EVENTS[0].id, EVENTS[1].id],
    },
    created_at: daysAgo(380), updated_at: daysAgo(4),
  }];

  const organiser_profile = [{
    id: sid("organiserProfile", 1), project_id: PROJECT_ID, display_name: STUDIO.name, tagline: STUDIO.tagline,
    bio: "Halcyon is a 40-person creative studio in Lisbon and Brooklyn. We host the Creative Summit, run hands-on workshops and throw launch nights for the brands we build.",
    avatar_url: "", banner_url: coverArt("halcyon-banner", 1), website: "https://halcyon.studio", location: "Lisbon & Brooklyn",
    contact_email: "events@halcyon.studio",
    links: [{ label: "Instagram", url: "https://instagram.com/halcyon.studio" }, { label: "Newsletter", url: "https://halcyon.studio/newsletter" }],
    metadata: { verified: true }, created_by: personId(1), created_at: daysAgo(380), updated_at: daysAgo(12), deleted_at: null,
  }];

  const organiser_followers = GUESTS.filter((_, i) => i % 6 === 1).slice(0, 64).map((g, i) => ({
    id: sid("follower", i + 1), project_id: PROJECT_ID, email: g.email, name: g.name,
    source: pick(["wall", "wall", "event_page", "import"], i), metadata: {}, created_at: daysAgo(2 + i * 4.3),
  }));

  return { events, event_series, event_templates, event_notes, event_wall, organiser_profile, organiser_followers };
}
