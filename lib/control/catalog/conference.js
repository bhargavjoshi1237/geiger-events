import { DEFAULT_ACCESS } from "../../live/access.js";
import { c, dateTimeField, imageField, nameField, options, refField, statusField, statuses } from "./builders.js";

// Conference records (events.conference_records), ported from components/internal/screens/conference/modules/*.jsx.
// Live controls, event links, rosters and session pickers are dashboard-only renders and aren't carried here.

const MODULES_DIR = "components/internal/screens/conference/modules";
const src = (file) => `${MODULES_DIR}/${file}.jsx`;

const TIERS = options(["Platinum", "Gold", "Silver", "Bronze", "Community"]);
const SCORES = options(["1", "2", "3", "4", "5"]);
const ACCESS_HINT = "Free, membership, purchase or rental — set on the dashboard.";
const accessPanel = (extra = []) => ({ title: "Access", fields: [c("access", "Access model", "access", { hint: ACCESS_HINT }), ...extra] });

export const CONFERENCE_MODULES = [
  {
    id: "conference.speaker",
    store: "conference",
    module: "speaker",
    section: "speakers",
    title: "Speakers",
    singular: "Speaker",
    icon: "mic",
    description: "Everyone presenting at your events — track invites, confirmations, bios, and the sessions they cover.",
    createLabel: "Add speaker",
    statuses: statuses({
      Confirmed: { variant: "success" },
      Invited: { variant: "info" },
      Tentative: { variant: "warning" },
      Declined: { variant: "neutral" },
    }),
    defaults: {
      status: "Invited",
      config: { title: "", company: "", email: "", phone: "", bio: "", topics: [], featured: false, twitter: "", linkedin: "", website: "", sessions: [] },
    },
    summary: ["title", "company"],
    create: ["name", "title", "company", "status"],
    panels: [
      {
        title: "Profile",
        fields: [
          nameField("Full name", "e.g. Ada Lovelace"),
          statusField(),
          c("title", "Title / role", "text", { placeholder: "e.g. Principal Engineer" }),
          c("company", "Company", "text", { placeholder: "e.g. Analytical Engines" }),
          c("email", "Email", "email", { placeholder: "name@example.com" }),
          c("phone", "Phone"),
        ],
      },
      {
        title: "Bio & topics",
        fields: [
          c("bio", "Biography", "textarea", { placeholder: "A few sentences about this speaker…" }),
          c("topics", "Topics", "list", { placeholder: "Add a topic…" }),
          c("featured", "Featured speaker", "switch", { hint: "Highlight on speaker listings." }),
        ],
      },
      { title: "Sessions", fields: [c("sessions", "Sessions", "list", { placeholder: "Add a session title…" })] },
      {
        title: "Links",
        fields: [
          c("twitter", "X / Twitter", "text", { placeholder: "@handle" }),
          c("linkedin", "LinkedIn", "text", { placeholder: "linkedin.com/in/…" }),
          c("website", "Website", "text", { placeholder: "https://…" }),
        ],
      },
      { title: "Headshot", fields: [imageField("Headshot")] },
    ],
    source: src("speaker"),
  },
  {
    id: "conference.sponsor",
    store: "conference",
    module: "sponsor",
    section: "sponsors",
    title: "Sponsors",
    singular: "Sponsor",
    icon: "handshake",
    description: "Companies backing your events — their logo, a short description, the amount committed, and who to contact.",
    createLabel: "Add sponsor",
    // Sponsors carry no status on the dashboard; the NOT NULL column is held constant.
    defaults: { status: "Active", config: { amount: 0, contactName: "", contactEmail: "", website: "", description: "", benefits: [] } },
    summary: ["contactName", "amount"],
    create: ["name", "description"],
    panels: [
      {
        title: "Details",
        fields: [
          nameField("Company name", "e.g. Northwind Labs"),
          c("amount", "Amount", "number", { placeholder: "e.g. 15000", min: 0 }),
          c("description", "Description", "textarea", { placeholder: "What they do, and what the sponsorship covers…" }),
        ],
      },
      {
        title: "Contact",
        fields: [
          c("contactName", "Contact name"),
          c("contactEmail", "Email", "email", { placeholder: "name@example.com" }),
          c("website", "Website", "text", { placeholder: "https://…" }),
        ],
      },
      { title: "Benefits", fields: [c("benefits", "Benefits", "list", { placeholder: "Add a benefit…" })] },
      { title: "Logo", fields: [imageField("Logo", "Shown on the event page and in sponsor reporting.")] },
    ],
    source: src("sponsor"),
  },
  {
    id: "conference.package",
    store: "conference",
    module: "package",
    section: "sponsors",
    title: "Sponsorship Packages",
    singular: "Package",
    icon: "package",
    description: "Reusable sponsorship tiers you sell — price, available slots, and the benefits each includes.",
    createLabel: "Add package",
    statuses: statuses({ Available: { variant: "success" }, "Sold out": { variant: "warning" }, Draft: { variant: "neutral" } }),
    defaults: { status: "Draft", config: { tier: "Gold", price: 0, slots: 0, sold: 0, benefits: [], description: "" } },
    summary: ["tier", "price"],
    create: ["name", "tier", "price"],
    panels: [
      {
        title: "Package details",
        fields: [
          nameField("Package name", "e.g. Gold Sponsor"),
          statusField(),
          c("tier", "Tier", "select", { options: TIERS }),
          c("price", "Price", "number", { placeholder: "e.g. 10000", min: 0 }),
          c("slots", "Total slots", "number", { placeholder: "e.g. 4", min: 0 }),
          c("sold", "Slots sold", "number", { placeholder: "e.g. 2", min: 0 }),
        ],
      },
      {
        title: "Benefits",
        fields: [
          c("description", "Description", "textarea", { placeholder: "What this package includes…" }),
          c("benefits", "Benefits", "list", { placeholder: "Add a benefit…" }),
        ],
      },
    ],
    source: src("package"),
  },
  {
    id: "conference.venue_lead",
    store: "conference",
    module: "venue_lead",
    section: "sourcing",
    title: "Venue Sourcing",
    singular: "Venue lead",
    icon: "map-pin",
    description: "Prospective venues under evaluation — track the pipeline from shortlist to booked, with quotes and contacts.",
    createLabel: "Add venue lead",
    statuses: statuses({
      Shortlisted: { variant: "info" },
      Contacted: { variant: "purple" },
      Quoted: { variant: "warning" },
      Booked: { variant: "success" },
      Rejected: { variant: "neutral" },
    }),
    defaults: { status: "Shortlisted", config: { city: "", capacity: 0, quotedPrice: 0, contactName: "", contactEmail: "", rating: "", notes: "" } },
    summary: ["city", "capacity"],
    create: ["name", "city", "status"],
    panels: [
      {
        title: "Details",
        fields: [
          nameField("Venue name", "e.g. Riverside Hall"),
          statusField(),
          c("city", "City", "text", { placeholder: "e.g. Berlin" }),
          c("capacity", "Capacity", "number", { placeholder: "e.g. 800", min: 0 }),
          c("quotedPrice", "Quoted price", "number", { placeholder: "e.g. 20000", min: 0 }),
          c("rating", "Rating", "select", { options: SCORES }),
        ],
      },
      {
        title: "Contact & notes",
        fields: [
          c("contactName", "Contact name"),
          c("contactEmail", "Email", "email", { placeholder: "name@example.com" }),
          c("notes", "Notes", "textarea", { placeholder: "Availability, catering, AV, terms…" }),
        ],
      },
    ],
    source: src("venue_lead"),
  },
  {
    id: "conference.housing",
    store: "conference",
    module: "housing",
    section: "sourcing",
    title: "Housing & Travel",
    singular: "Option",
    icon: "plane",
    description: "Hotel room blocks and travel options for attendees — rates, inventory, and booking links.",
    createLabel: "Add option",
    statuses: statuses({ Available: { variant: "success" }, Booked: { variant: "info" }, Full: { variant: "warning" } }),
    defaults: {
      status: "Available",
      config: { kind: "Hotel", city: "", address: "", ratePerNight: 0, roomsBlocked: 0, roomsBooked: 0, bookingLink: "", notes: "" },
    },
    summary: ["kind", "city"],
    create: ["name", "kind", "city"],
    panels: [
      {
        title: "Option details",
        fields: [
          nameField("Name", "e.g. Grand Central Hotel"),
          statusField(),
          c("kind", "Type", "select", { options: options(["Hotel", "Apartment", "Transport"]) }),
          c("city", "City", "text", { placeholder: "e.g. Amsterdam" }),
          c("address", "Address"),
          c("ratePerNight", "Rate / night", "number", { placeholder: "e.g. 180", min: 0 }),
        ],
      },
      {
        title: "Inventory",
        fields: [
          c("roomsBlocked", "Rooms blocked", "number", { placeholder: "e.g. 40", min: 0 }),
          c("roomsBooked", "Rooms booked", "number", { placeholder: "e.g. 12", min: 0 }),
          c("bookingLink", "Booking link", "text", { placeholder: "https://…" }),
          c("notes", "Notes", "textarea", { placeholder: "Cut-off date, group code…" }),
        ],
      },
    ],
    source: src("housing"),
  },
  {
    id: "conference.paper",
    store: "conference",
    module: "paper",
    section: "program",
    title: "Call for Papers",
    singular: "Submission",
    icon: "file-text",
    description: "Session proposals submitted for review — score them, track status, and accept the best.",
    createLabel: "Add submission",
    statuses: statuses({
      Submitted: { variant: "neutral" },
      "Under review": { variant: "info" },
      Accepted: { variant: "success" },
      Waitlisted: { variant: "warning" },
      Rejected: { variant: "danger" },
    }),
    defaults: {
      status: "Submitted",
      config: { authorName: "", email: "", track: "", format: "Talk", abstract: "", score: "", reviewerNotes: "", topics: [] },
    },
    summary: ["authorName", "format"],
    create: ["name", "authorName", "format"],
    panels: [
      {
        title: "Submission",
        fields: [
          nameField("Title", "e.g. Scaling Realtime Systems"),
          statusField(),
          c("authorName", "Author", "text", { placeholder: "e.g. Grace Hopper" }),
          c("email", "Email", "email", { placeholder: "name@example.com" }),
          c("track", "Track", "text", { placeholder: "e.g. Engineering" }),
          c("format", "Format", "select", { options: options(["Talk", "Workshop", "Panel"]) }),
        ],
      },
      {
        title: "Abstract",
        fields: [
          c("abstract", "Abstract", "textarea", { placeholder: "The full session abstract…" }),
          c("topics", "Topics", "list", { placeholder: "Add a topic…" }),
        ],
      },
      {
        title: "Review",
        fields: [
          c("score", "Score", "select", { options: SCORES }),
          c("reviewerNotes", "Reviewer notes", "textarea", { placeholder: "Strengths, concerns, recommendation…" }),
        ],
      },
    ],
    source: src("paper"),
  },
  {
    id: "conference.certificate",
    store: "conference",
    module: "certificate",
    section: "program",
    title: "CEU & Certificates",
    singular: "Certificate",
    icon: "award",
    description: "Certificates and continuing-education credits attendees can earn — credit hours, accreditation, and linked sessions.",
    createLabel: "Add certificate",
    statuses: statuses({ Active: { variant: "success" }, Draft: { variant: "neutral" }, Archived: { variant: "outline" } }),
    defaults: { status: "Draft", config: { kind: "Certificate", creditHours: 0, accreditingBody: "", sessions: [], description: "" } },
    summary: ["kind", "creditHours"],
    create: ["name", "kind", "creditHours"],
    panels: [
      {
        title: "Certificate details",
        fields: [
          nameField("Certificate name", "e.g. Certified Attendee"),
          statusField(),
          c("kind", "Type", "select", { options: options(["Certificate", "CEU credit"]) }),
          c("creditHours", "Credit hours", "number", { placeholder: "e.g. 8", min: 0 }),
          c("accreditingBody", "Accrediting body", "text", { placeholder: "e.g. IACET" }),
        ],
      },
      {
        title: "Content",
        fields: [
          c("sessions", "Linked sessions", "list", { placeholder: "Add a session…" }),
          c("description", "Description", "textarea", { placeholder: "What earning this certificate involves…" }),
        ],
      },
    ],
    source: src("certificate"),
  },
  {
    id: "conference.session",
    store: "conference",
    module: "session",
    section: "program",
    title: "Agenda Builder",
    singular: "Session",
    icon: "calendar-clock",
    description: "Build the schedule — sessions with their track, room, time, and speaker. Sequence the whole agenda from here.",
    createLabel: "Add session",
    statuses: statuses({ Scheduled: { variant: "info" }, Live: { variant: "success" }, Draft: { variant: "neutral" }, Cancelled: { variant: "danger" } }),
    defaults: { status: "Draft", config: { track: "", room: "", day: "", startTime: "", endTime: "", speaker: "", description: "" } },
    summary: ["track", "room"],
    create: ["name", "track", "speaker"],
    panels: [
      {
        title: "Session details",
        fields: [
          nameField("Session title", "e.g. Keynote: The Road Ahead"),
          statusField(),
          c("track", "Track", "text", { placeholder: "e.g. Main Stage" }),
          c("room", "Room", "text", { placeholder: "e.g. Room 2B" }),
          c("day", "Day", "text", { placeholder: "e.g. Day 1 · Tue" }),
          c("speaker", "Speaker", "text", { placeholder: "e.g. Ada Lovelace" }),
          c("startTime", "Start time", "time"),
          c("endTime", "End time", "time"),
        ],
      },
      { title: "Description", fields: [c("description", "Description", "textarea", { placeholder: "What this session covers…" })] },
    ],
    source: src("session"),
  },
  {
    id: "conference.recording",
    store: "conference",
    module: "recording",
    section: "broadcast",
    title: "Recordings & Replay",
    singular: "Recording",
    icon: "video",
    description:
      "The on-demand library — a journal of session recordings. Attach the events they came from, drop in an external video link, and publish a shareable replay page.",
    createLabel: "Add recording",
    statuses: statuses({ Published: { variant: "success" }, Processing: { variant: "warning" }, Draft: { variant: "neutral" } }),
    defaults: {
      status: "Draft",
      config: {
        session: "", speaker: "", sessionId: "", speakerId: "", videoUrl: "",
        duration: "", recordedAt: "", description: "", eventIds: [], tags: [],
        public: false,
      },
    },
    summary: ["session", "duration"],
    create: ["name", "session", "videoUrl"],
    panels: [
      {
        title: "Details",
        fields: [
          nameField("Title", "e.g. Opening Keynote"),
          statusField(),
          c("session", "Session", "text", { placeholder: "e.g. Main Stage · Day 1" }),
          refField("sessionId", "Linked session", "conference.session"),
          refField("speakerId", "Speaker", "conference.speaker"),
          c("recordedAt", "Recorded on", "text", { placeholder: "e.g. 2026-07-18" }),
          c("duration", "Duration", "text", { placeholder: "e.g. 42:15" }),
          c("tags", "Tags", "list", { placeholder: "Add a tag…" }),
          c("description", "Description", "textarea", { placeholder: "Summary shown in the library and on the public page…" }),
        ],
      },
      {
        title: "Video & sharing",
        fields: [
          c("videoUrl", "Video URL", "text", { placeholder: "https://…", hint: "Geiger plays it from this link and never hosts it." }),
          c("public", "Public replay page", "switch", { hint: "Anyone with the link can watch the replay." }),
        ],
      },
      { title: "Thumbnail", fields: [imageField("Thumbnail")] },
    ],
    source: src("recording"),
  },
  {
    id: "conference.backstage",
    store: "conference",
    module: "backstage",
    section: "speakers",
    title: "Speaker Backstage",
    singular: "Backstage room",
    icon: "presentation",
    description:
      "The green room for each session — line up speakers, run tech checks, and keep the run-of-show handy so nobody goes live unprepared.",
    createLabel: "Add backstage room",
    statuses: statuses({
      "Green room": { variant: "neutral" },
      "Tech check": { variant: "info" },
      "Standing by": { variant: "warning" },
      "On air": { variant: "success" },
      Wrapped: { variant: "outline" },
    }),
    defaults: {
      status: "Green room",
      config: {
        eventId: "", sessionTitle: "", callTime: "", stageManager: "", joinUrl: "",
        speakers: [], techMic: false, techCamera: false, techScreen: false,
        techInternet: false, runOfShow: "", producerNotes: "",
      },
    },
    summary: ["sessionTitle", "callTime"],
    create: ["name", "sessionTitle", "callTime"],
    panels: [
      {
        title: "Room",
        fields: [
          nameField("Room name", "e.g. Main Stage — Backstage"),
          statusField(),
          c("sessionTitle", "Session", "text", { placeholder: "e.g. Opening Keynote" }),
          c("callTime", "Call time", "text", { placeholder: "e.g. 08:30" }),
          c("stageManager", "Stage manager", "text", { placeholder: "Who's calling the show" }),
        ],
      },
      {
        title: "Line-up",
        fields: [
          c("speakers", "Speakers on deck", "list", { placeholder: "Add a speaker…" }),
          c("joinUrl", "Backstage join link", "text", { placeholder: "https://… (private green-room URL)" }),
        ],
      },
      {
        title: "Tech check",
        fields: [
          c("techMic", "Microphone tested", "switch"),
          c("techCamera", "Camera tested", "switch"),
          c("techScreen", "Screen share tested", "switch"),
          c("techInternet", "Connection stable", "switch"),
        ],
      },
      {
        title: "Run of show",
        fields: [
          c("runOfShow", "Run of show", "textarea", { placeholder: "00:00 Intro · 02:00 Keynote · 32:00 Q&A…" }),
          c("producerNotes", "Producer notes", "textarea", { placeholder: "Cues, reminders, backup plans…" }),
        ],
      },
    ],
    source: src("backstage"),
  },
  {
    id: "conference.room",
    store: "conference",
    module: "room",
    section: "broadcast",
    title: "Livestream Rooms",
    singular: "Room",
    icon: "radio",
    description:
      "Where sessions stream from — an on-site room, a digital broadcast, or both. Track capacity, the stream source, and the watch link.",
    createLabel: "Add room",
    statuses: statuses({ Offline: { variant: "neutral" }, Scheduled: { variant: "info" }, Live: { variant: "success" }, Ended: { variant: "outline" } }),
    defaults: {
      status: "Offline",
      config: {
        kind: "Digital", eventId: "", capacity: 0, location: "", scheduledFor: "",
        streamProvider: "", streamUrl: "", watchUrl: "", description: "",
        access: DEFAULT_ACCESS,
      },
    },
    summary: ["kind", "capacity"],
    create: ["name", "kind", "capacity"],
    panels: [
      {
        title: "Room",
        fields: [
          nameField("Room name", "e.g. Main Stage"),
          statusField(),
          c("kind", "Type", "select", { options: options(["Digital", "On-site", "Hybrid"]) }),
          c("capacity", "Capacity", "number", { placeholder: "e.g. 500", min: 0 }),
          dateTimeField("startsAt", "Starts at", { hint: "Attendees can open the room 15 minutes before this." }),
          dateTimeField("endsAt", "Ends at", { hint: "Leave empty to keep the room open until you end it." }),
        ],
      },
      { title: "Location", fields: [c("location", "Location", "text", { placeholder: "e.g. Hall B, Level 2" })] },
      {
        title: "Stream",
        fields: [
          c("streamProvider", "Provider", "text", { placeholder: "e.g. YouTube Live, Zoom, RTMP" }),
          c("streamUrl", "Stream / ingest URL", "text", { placeholder: "rtmp://… or the studio link" }),
          c("watchUrl", "Watch link", "text", { placeholder: "https://… (what attendees open)" }),
          c("description", "Notes", "textarea", { placeholder: "AV setup, backup stream, moderator…" }),
        ],
      },
      accessPanel(),
    ],
    source: src("room"),
  },
  {
    id: "conference.webinar",
    store: "conference",
    module: "webinar",
    section: "broadcast",
    title: "Webinar Rooms",
    singular: "Webinar",
    icon: "monitor-play",
    description:
      "Scheduled virtual sessions with registration, a live stream, and an on-demand replay — the online counterpart to a stage.",
    createLabel: "Add webinar",
    statuses: statuses({
      Draft: { variant: "neutral" },
      Scheduled: { variant: "info" },
      Live: { variant: "success" },
      Ended: { variant: "outline" },
      Cancelled: { variant: "danger" },
    }),
    defaults: {
      status: "Draft",
      config: {
        platform: "Zoom", presenter: "", eventId: "", scheduledFor: "", duration: "",
        capacity: 0, registered: 0, requiresRegistration: true,
        registrationUrl: "", joinUrl: "", replayUrl: "", description: "",
        access: DEFAULT_ACCESS,
      },
    },
    summary: ["platform", "presenter"],
    create: ["name", "platform", "presenter"],
    panels: [
      {
        title: "Overview",
        fields: [
          nameField("Webinar title", "e.g. Product Deep-Dive"),
          statusField(),
          c("platform", "Platform", "select", { options: options(["Zoom", "YouTube Live", "Google Meet", "Teams", "Custom"]) }),
          c("presenter", "Presenter", "text", { placeholder: "e.g. Ada Lovelace" }),
          dateTimeField("startsAt", "Starts at", { hint: "Attendees can join 15 minutes before this." }),
          dateTimeField("endsAt", "Ends at", { hint: "Leave empty to keep the room open until you end it." }),
          c("duration", "Duration", "text", { placeholder: "e.g. 60 min" }),
          c("capacity", "Capacity", "number", { placeholder: "e.g. 500", min: 0 }),
          c("description", "Description", "textarea", { placeholder: "What attendees will learn…" }),
        ],
      },
      {
        title: "Registration",
        fields: [
          c("requiresRegistration", "Requires registration", "switch", { hint: "Attendees sign up before they can join." }),
          c("registrationUrl", "Registration link", "text", { placeholder: "https://…" }),
          c("registered", "Registered (manual)", "number", {
            placeholder: "e.g. 320",
            min: 0,
            hint: "Entered by hand until registration ships. Attendance is measured from presence.",
          }),
        ],
      },
      {
        title: "Stream & replay",
        fields: [
          c("joinUrl", "Join link", "text", { placeholder: "https://… (live room)" }),
          c("replayUrl", "Replay link", "text", { placeholder: "https://… (on-demand)" }),
        ],
      },
      accessPanel(),
      { title: "Cover", fields: [imageField("Cover image")] },
    ],
    source: src("webinar"),
  },
  {
    id: "conference.breakout",
    store: "conference",
    module: "breakout",
    section: "broadcast",
    title: "Breakout Rooms",
    singular: "Breakout room",
    icon: "users-round",
    description:
      "Small-group spaces that run alongside a main session — discussions, workshops, and networking tables with their own facilitator.",
    createLabel: "Add breakout room",
    statuses: statuses({
      Draft: { variant: "neutral" },
      Open: { variant: "success" },
      "In progress": { variant: "info" },
      Full: { variant: "warning" },
      Closed: { variant: "outline" },
    }),
    defaults: {
      status: "Draft",
      config: {
        kind: "Discussion", topic: "", facilitator: "", parentSession: "",
        parentSessionId: "", capacity: 0, duration: "", joinUrl: "",
        autoAssign: false, assigned: [], description: "", access: DEFAULT_ACCESS,
      },
    },
    summary: ["kind", "facilitator"],
    create: ["name", "kind", "facilitator"],
    panels: [
      {
        title: "Room",
        fields: [
          nameField("Room name", "e.g. Table 4 — Scaling Teams"),
          statusField(),
          c("kind", "Type", "select", { options: options(["Discussion", "Workshop", "Networking", "Roundtable"]) }),
          c("topic", "Topic", "text", { placeholder: "What this room discusses" }),
          c("duration", "Duration", "text", { placeholder: "e.g. 25 min" }),
        ],
      },
      {
        title: "Facilitator & session",
        fields: [
          c("facilitator", "Facilitator", "text", { placeholder: "Who leads the room" }),
          refField("parentSessionId", "Parent session", "conference.session", {
            placeholder: "The main session this splits from",
            hint: "Sibling rooms sharing this session are assigned and timed together.",
          }),
        ],
      },
      {
        title: "Capacity",
        fields: [
          c("capacity", "Capacity", "number", { placeholder: "e.g. 12", min: 0 }),
          c("autoAssign", "Auto-assign attendees", "switch", { hint: "Spread attendees across rooms automatically." }),
        ],
      },
      {
        title: "Join & notes",
        fields: [
          c("joinUrl", "Join link", "text", { placeholder: "https://… (room URL)" }),
          c("description", "Notes", "textarea", { placeholder: "Prompt, format, materials…" }),
        ],
      },
      accessPanel(),
    ],
    source: src("breakout"),
  },
  {
    id: "conference.sponsor_room",
    store: "conference",
    module: "sponsor_room",
    section: "sponsors",
    title: "Sponsor Rooms",
    singular: "Sponsor room",
    icon: "building-2",
    description:
      "A sponsor's branded virtual space — a booth, lounge, or demo room with reps on hand, downloadable resources, and a call-to-action that captures leads.",
    createLabel: "Add sponsor room",
    statuses: statuses({ Draft: { variant: "neutral" }, Scheduled: { variant: "info" }, Live: { variant: "success" }, Archived: { variant: "outline" } }),
    defaults: {
      status: "Draft",
      config: {
        sponsor: "", tier: "Gold", kind: "Virtual booth", eventId: "", reps: [], resources: [],
        ctaLabel: "", ctaUrl: "", videoUrl: "", leadsCaptured: 0, visits: 0, description: "",
      },
    },
    summary: ["sponsor", "tier"],
    create: ["name", "sponsor", "tier"],
    panels: [
      {
        title: "Details",
        fields: [
          nameField("Room name", "e.g. Northwind Labs Lounge"),
          statusField(),
          c("sponsor", "Sponsor", "text", { placeholder: "e.g. Northwind Labs" }),
          c("tier", "Tier", "select", { options: TIERS }),
          c("kind", "Type", "select", { options: options(["Virtual booth", "Lounge", "Demo room", "Meeting room"]) }),
        ],
      },
      {
        title: "Booth content",
        fields: [
          c("description", "Description", "textarea", { placeholder: "What this sponsor offers attendees…" }),
          c("resources", "Resources", "list", { placeholder: "Add a resource link or title…" }),
          c("ctaLabel", "CTA label", "text", { placeholder: "e.g. Book a demo" }),
          c("ctaUrl", "CTA link", "text", { placeholder: "https://…" }),
          c("videoUrl", "Promo video", "text", { placeholder: "https://…" }),
        ],
      },
      {
        title: "Reps & leads",
        fields: [
          c("reps", "Reps on hand", "list", { placeholder: "Add a rep…" }),
          c("leadsCaptured", "Leads captured", "number", { placeholder: "e.g. 48", min: 0 }),
          c("visits", "Visits", "number", { placeholder: "e.g. 1200", min: 0 }),
        ],
      },
      { title: "Banner", fields: [imageField("Banner")] },
    ],
    source: src("sponsor_room"),
  },
  {
    id: "conference.portal_invite",
    store: "conference",
    module: "portal_invite",
    section: "speakers",
    title: "Speaker Portal",
    singular: "Portal invite",
    icon: "contact",
    description:
      "Invite speakers to a self-service portal where they submit their bio, headshot, slides, A/V form, and availability — track every submission to done.",
    createLabel: "Invite speaker",
    statuses: statuses({
      "Not started": { variant: "neutral" },
      "In progress": { variant: "info" },
      Submitted: { variant: "warning" },
      Approved: { variant: "success" },
      Overdue: { variant: "danger" },
    }),
    defaults: {
      status: "Not started",
      config: {
        email: "", sessionTitle: "", deadline: "", portalUrl: "",
        bioSubmitted: false, headshotSubmitted: false, slidesSubmitted: false,
        avFormSubmitted: false, availabilityConfirmed: false, bioText: "", notes: "",
      },
    },
    summary: ["sessionTitle", "deadline"],
    create: ["name", "email", "sessionTitle"],
    panels: [
      {
        title: "Invite",
        fields: [
          nameField("Speaker name", "e.g. Grace Hopper"),
          statusField(),
          c("email", "Email", "email", { placeholder: "name@example.com" }),
          c("sessionTitle", "Session", "text", { placeholder: "e.g. Keynote" }),
          c("deadline", "Deadline", "text", { placeholder: "e.g. 2026-06-01" }),
          c("portalUrl", "Portal link", "text", { placeholder: "https://… (their private portal)" }),
        ],
      },
      {
        title: "Checklist",
        fields: [
          c("bioSubmitted", "Bio submitted", "switch"),
          c("headshotSubmitted", "Headshot submitted", "switch"),
          c("slidesSubmitted", "Slides submitted", "switch"),
          c("avFormSubmitted", "A/V form submitted", "switch"),
          c("availabilityConfirmed", "Availability confirmed", "switch"),
        ],
      },
      {
        title: "Materials",
        fields: [
          c("bioText", "Speaker bio", "textarea", { placeholder: "The bio the speaker submitted…" }),
          c("notes", "Notes", "textarea", { placeholder: "Follow-ups, missing items, reminders…" }),
        ],
      },
      { title: "Headshot", fields: [imageField("Headshot")] },
    ],
    source: src("portal_invite"),
  },
  {
    id: "conference.simulive",
    store: "conference",
    module: "simulive",
    section: "broadcast",
    title: "Simulive & On-demand",
    singular: "Broadcast",
    icon: "circle-play",
    description:
      "Pre-recorded content that plays as if it were live at a set premiere time, plus the on-demand library attendees can watch any time.",
    createLabel: "Add broadcast",
    statuses: statuses({
      Draft: { variant: "neutral" },
      Scheduled: { variant: "info" },
      Premiering: { variant: "success" },
      Available: { variant: "purple" },
      Ended: { variant: "outline" },
    }),
    defaults: {
      status: "Draft",
      config: {
        mode: "Simulive", videoUrl: "", premiereAt: "", duration: "", gated: false,
        session: "", speaker: "", sessionId: "", speakerId: "", eventId: "",
        captionsOn: false, description: "", access: DEFAULT_ACCESS,
      },
    },
    summary: ["mode", "duration"],
    create: ["name", "mode", "videoUrl"],
    panels: [
      {
        title: "Details",
        fields: [
          nameField("Title", "e.g. Opening Keynote (Encore)"),
          statusField(),
          c("mode", "Mode", "select", { options: options(["Simulive", "On-demand", "Encore"]) }),
          refField("sessionId", "Session", "conference.session"),
          refField("speakerId", "Speaker", "conference.speaker"),
          dateTimeField("startsAt", "Premiere time", { hint: "When the pre-recorded content plays as-live." }),
          c("duration", "Duration", "text", { placeholder: "e.g. 42:15" }),
          c("description", "Description", "textarea", { placeholder: "Shown alongside the player…" }),
        ],
      },
      {
        title: "Video",
        fields: [
          c("videoUrl", "Content", "text", {
            placeholder: "https://… (YouTube, Vimeo, or .mp4)",
            hint: "Geiger streams the content from this link — it isn't re-hosted.",
          }),
        ],
      },
      accessPanel([c("captionsOn", "Captions available", "switch", { hint: "Show closed captions on the player." })]),
      { title: "Thumbnail", fields: [imageField("Thumbnail")] },
    ],
    source: src("simulive"),
  },
  {
    id: "conference.caption",
    store: "conference",
    module: "caption",
    section: "broadcast",
    title: "Captions & Transcription",
    singular: "Caption job",
    icon: "captions",
    description:
      "Live captions and transcripts for each session — the language coverage, the provider, and the finished transcript to download.",
    createLabel: "Add caption job",
    statuses: statuses({
      Requested: { variant: "neutral" },
      Scheduled: { variant: "info" },
      Live: { variant: "success" },
      Processing: { variant: "warning" },
      Ready: { variant: "purple" },
      Failed: { variant: "danger" },
    }),
    defaults: {
      status: "Requested",
      config: {
        session: "", mode: "AI auto", provider: "", sourceLanguage: "English",
        languages: [], accuracy: "", wordCount: 0, transcriptUrl: "",
        downloadable: false, eventId: "", notes: "",
      },
    },
    summary: ["session", "mode"],
    create: ["name", "session", "mode"],
    panels: [
      {
        title: "Caption job",
        fields: [
          nameField("Job name", "e.g. Keynote — Live captions"),
          statusField(),
          c("session", "Session", "text", { placeholder: "e.g. Opening Keynote" }),
          c("mode", "Mode", "select", { options: options(["Live CART", "AI auto", "Post-edited"]) }),
          c("provider", "Provider", "text", { placeholder: "e.g. Verbit, Otter, in-house" }),
        ],
      },
      {
        title: "Languages & quality",
        fields: [
          c("sourceLanguage", "Source language", "text", { placeholder: "e.g. English" }),
          c("languages", "Caption languages", "list", { placeholder: "Add a language…" }),
          c("accuracy", "Accuracy", "number", { placeholder: "e.g. 98", min: 0, max: 100 }),
        ],
      },
      {
        title: "Output",
        fields: [
          c("transcriptUrl", "Transcript link", "text", { placeholder: "https://…" }),
          c("wordCount", "Word count", "number", { placeholder: "e.g. 8400", min: 0 }),
          c("downloadable", "Downloadable by attendees", "switch", { hint: "Let attendees download the transcript." }),
          c("notes", "Notes", "textarea", { placeholder: "Glossary, speaker names, corrections…" }),
        ],
      },
    ],
    source: src("caption"),
  },
  {
    id: "conference.agenda_assignment",
    store: "conference",
    module: "agenda_assignment",
    section: "program",
    title: "Assign Agenda",
    singular: "Agenda",
    icon: "calendar-check",
    description:
      "Curate a set of sessions and assign it to a controlled group of guests — everyone or a subset by segment, tag, ticket, offering, add-on, status, or specific people.",
    createLabel: "Create agenda",
    statuses: statuses({ Draft: { variant: "neutral" }, Scheduled: { variant: "info" }, Published: { variant: "success" }, Archived: { variant: "outline" } }),
    defaults: {
      status: "Draft",
      config: { sessionIds: [], audience: { eventId: "", emails: [] }, description: "", deliverVia: "In-app", scheduledFor: "", notify: false },
    },
    summary: ["deliverVia"],
    create: ["name"],
    panels: [
      {
        title: "Agenda",
        fields: [
          nameField("Agenda name", "e.g. VIP Track"),
          statusField(),
          c("description", "Description", "textarea", { placeholder: "What this agenda is and who it's for…" }),
        ],
      },
      {
        title: "Delivery",
        fields: [
          c("deliverVia", "Deliver via", "select", { options: options(["In-app", "Email", "Push", "Calendar invite"]) }),
          c("scheduledFor", "Send at", "text", { placeholder: "e.g. 2026-06-01 09:00 (leave blank to send now)" }),
          c("notify", "Notify guests when published", "switch", { hint: "Push a notification when this agenda goes live." }),
        ],
      },
      { title: "Audience", fields: [c("audience", "Audience", "audience", { hint: "Who gets this agenda is set on the dashboard's audience picker." })] },
    ],
    source: src("agenda_assignment"),
  },
];
