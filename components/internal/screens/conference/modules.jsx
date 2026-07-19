"use client";

import React from "react";
import {
  Mic,
  Handshake,
  Package,
  Store,
  MapPin,
  Plane,
  FileText,
  Award,
  User,
  SquarePen,
  Presentation,
  Link2,
  Image as ImageIcon,
  Contact,
  Gift,
  BookOpen,
  ClipboardList,
  CalendarClock,
  Video,
  Clapperboard,
  Radio,
  Users,
  Building2,
  Share2,
  StickyNote,
  Wifi,
  PlayCircle,
  CalendarDays,
  MonitorPlay,
  Network,
  CirclePlay,
  Captions,
  ClipboardCheck,
  CalendarCheck,
  ListChecks,
  Target,
  Send,
} from "lucide-react";

import { CoverImageCard } from "@/components/internal/shared/records/record_fields";
import { uploadConferenceImage } from "@/lib/supabase/storage";
import {
  EventLinkField,
  EventMultiField,
  RecordingVideoField,
  RecordingShareField,
  SpeakerHero,
  PortalProgressHero,
  SessionMultiField,
  AgendaAssignHero,
} from "./detail_fields";
import { describeSpec } from "@/lib/audience/resolve";
import { accessSummary, DEFAULT_ACCESS } from "@/components/internal/shared/records/access_control";
import {
  nameCol,
  avatarNameCol,
  statusCol,
  pillCol,
  textCol,
  moneyCol,
  count,
  sum,
  distinct,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  optionsFrom,
  currency,
  pct,
} from "@/components/internal/shared/records/builders";
import {
  SPEAKER_STATUS_MAP,
  SPONSOR_STATUS_MAP,
  PACKAGE_STATUS_MAP,
  BOOTH_STATUS_MAP,
  VENUE_LEAD_STATUS_MAP,
  HOUSING_STATUS_MAP,
  PAPER_STATUS_MAP,
  CERTIFICATE_STATUS_MAP,
  SESSION_STATUS_MAP,
  RECORDING_STATUS_MAP,
  BACKSTAGE_STATUS_MAP,
  ROOM_STATUS_MAP,
  ROOM_KIND_MAP,
  TIER_MAP,
  WEBINAR_STATUS_MAP,
  BREAKOUT_STATUS_MAP,
  BREAKOUT_KIND_MAP,
  SPONSOR_ROOM_STATUS_MAP,
  SPONSOR_ROOM_KIND_MAP,
  PORTAL_STATUS_MAP,
  SIMULIVE_STATUS_MAP,
  SIMULIVE_MODE_MAP,
  CAPTION_STATUS_MAP,
  CAPTION_MODE_MAP,
  AGENDA_ASSIGN_STATUS_MAP,
  AGENDA_DELIVERY_OPTIONS,
} from "./constants";

// The Conference modules, expressed declaratively. The shared records kit
// (records_kit.jsx) renders the list (columns/stats/filters/create) and the
// adaptive detail (rich = section nav + fields/render; light = field panels).
// Every module is backed by events.conference_records, discriminated by `key`.
// Bespoke screens (Agenda Builder, Floor Plan & Booths, Mobile Event App) live in
// their own files. Assign Agenda is a module here that reuses the "session"
// records; Floor Plan reuses the "booth" records.

// --- Builders ----------------------------------------------------------------
// Column/stat/filter/field factories are shared (see records/builders.jsx).
// Only the media section (uses this area's uploader) is local.

const mediaSection = (label, title, aspect, frameClassName) => ({
  key: "media",
  label,
  icon: ImageIcon,
  desc: `The ${title.toLowerCase()} shown for this record.`,
  render: ({ record, commit }) => (
    <CoverImageCard
      record={record}
      commit={commit}
      upload={uploadConferenceImage}
      title={title}
      aspect={aspect}
      frameClassName={frameClassName}
    />
  ),
});

const TIER_VALUES = Object.keys(TIER_MAP);

// --- Modules -----------------------------------------------------------------

export const MODULES = {
  // -------------------------------------------------------------- Speakers ---
  speaker: {
    key: "speaker",
    title: "Speakers",
    singular: "Speaker",
    icon: Mic,
    description:
      "Everyone presenting at your events — track invites, confirmations, bios, and the sessions they cover.",
    createLabel: "Add speaker",
    searchPlaceholder: "Search speakers, companies, topics…",
    search: (r) =>
      `${r.name} ${r.config.company || ""} ${(r.config.topics || []).join(" ")}`,
    statusMap: SPEAKER_STATUS_MAP,
    filters: [statusFilter(SPEAKER_STATUS_MAP)],
    columns: [
      avatarNameCol((r) => [r.config.title, r.config.company].filter(Boolean).join(" · ")),
      statusCol(SPEAKER_STATUS_MAP),
      textCol("topics", "Topics", (r) => (r.config.topics || []).slice(0, 3).join(", ")),
      textCol("featured", "Featured", (r) => (r.config.featured ? "★ Featured" : "")),
    ],
    stats: (records) => [
      { label: "Speakers", value: String(records.length), footer: "All statuses" },
      { label: "Confirmed", value: String(count(records, (r) => r.status === "Confirmed")), footer: "Locked in" },
      { label: "Featured", value: String(count(records, (r) => r.config.featured)), footer: "Highlighted" },
      { label: "Companies", value: String(distinct(records, (r) => r.config.company)), footer: "Represented" },
    ],
    defaults: {
      status: "Invited",
      config: { title: "", company: "", email: "", phone: "", bio: "", topics: [], featured: false, twitter: "", linkedin: "", website: "", sessions: [] },
    },
    createFields: [
      nameField("Full name", "e.g. Ada Lovelace"),
      c("title", "Title / role", "text", { placeholder: "e.g. Principal Engineer" }),
      c("company", "Company", "text", { placeholder: "e.g. Analytical Engines" }),
      { ...statusField(SPEAKER_STATUS_MAP), type: "tabs" },
    ],
    detail: {
      depth: "rich",
      hero: SpeakerHero,
      nav: [
        {
          key: "profile",
          label: "Profile",
          icon: User,
          desc: "Name, role, status, and contact details.",
          fields: [
            nameField("Full name"),
            { ...statusField(SPEAKER_STATUS_MAP), type: "tabs" },
            c("title", "Title / role"),
            c("company", "Company"),
            c("email", "Email", "email", { placeholder: "name@example.com" }),
            c("phone", "Phone"),
          ],
        },
        {
          key: "bio",
          label: "Bio & topics",
          icon: SquarePen,
          desc: "A short biography, speaking topics, and whether to feature them.",
          fields: [
            c("bio", "Biography", "textarea", { rows: 6, placeholder: "A few sentences about this speaker…" }),
            c("topics", "Topics", "list", { placeholder: "Add a topic…" }),
            c("featured", "Featured speaker", "switch", { hint: "Highlight on speaker listings." }),
          ],
        },
        {
          key: "sessions",
          label: "Sessions",
          icon: Presentation,
          desc: "The sessions this speaker is presenting.",
          fields: [c("sessions", "Sessions", "list", { placeholder: "Add a session title…" })],
        },
        {
          key: "links",
          label: "Links",
          icon: Link2,
          desc: "Social profiles and personal site.",
          fields: [
            c("twitter", "X / Twitter", "text", { placeholder: "@handle" }),
            c("linkedin", "LinkedIn", "text", { placeholder: "linkedin.com/in/…" }),
            c("website", "Website", "text", { placeholder: "https://…" }),
          ],
        },
        mediaSection("Headshot", "Headshot", "aspect-square", "max-w-[200px]"),
      ],
    },
  },

  // -------------------------------------------------------------- Sponsors ---
  sponsor: {
    key: "sponsor",
    title: "Sponsors",
    singular: "Sponsor",
    icon: Handshake,
    description:
      "Companies backing your events — track tiers, amounts, contacts, and the benefits they receive.",
    createLabel: "Add sponsor",
    searchPlaceholder: "Search sponsors, contacts…",
    search: (r) => `${r.name} ${r.config.contactName || ""} ${r.config.tier || ""}`,
    statusMap: SPONSOR_STATUS_MAP,
    filters: [
      statusFilter(SPONSOR_STATUS_MAP),
      configFilter("tier", TIER_VALUES, "All tiers"),
    ],
    columns: [
      nameCol((r) => r.config.contactName),
      pillCol("tier", "Tier", (r) => r.config.tier, TIER_MAP),
      statusCol(SPONSOR_STATUS_MAP),
      moneyCol("amount", "Amount", (r) => r.config.amount),
    ],
    stats: (records) => [
      { label: "Sponsors", value: String(records.length), footer: "All statuses" },
      { label: "Confirmed", value: String(count(records, (r) => r.status === "Confirmed")), footer: "Signed on" },
      { label: "Sponsorship", value: currency(sum(records, (r) => r.config.amount)), footer: "Total committed" },
      { label: "Platinum", value: String(count(records, (r) => r.config.tier === "Platinum")), footer: "Top tier" },
    ],
    defaults: {
      status: "Prospect",
      config: { tier: "Gold", amount: 0, contactName: "", contactEmail: "", website: "", description: "", benefits: [] },
    },
    createFields: [
      nameField("Company name", "e.g. Northwind Labs"),
      c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
      statusField(SPONSOR_STATUS_MAP),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "details",
          label: "Details",
          icon: SquarePen,
          desc: "Tier, status, and the committed amount.",
          fields: [
            nameField("Company name"),
            c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
            statusField(SPONSOR_STATUS_MAP),
            c("amount", "Amount", "number", { placeholder: "e.g. 15000" }),
          ],
        },
        {
          key: "contact",
          label: "Contact",
          icon: Contact,
          desc: "Who to reach and where to find them.",
          fields: [
            c("contactName", "Contact name"),
            c("contactEmail", "Email", "email", { placeholder: "name@example.com" }),
            c("website", "Website", "text", { placeholder: "https://…" }),
          ],
        },
        {
          key: "benefits",
          label: "Benefits",
          icon: Gift,
          desc: "What this sponsorship includes.",
          fields: [
            c("description", "Description", "textarea", { placeholder: "What this sponsor gets…" }),
            c("benefits", "Benefits", "list", { placeholder: "Add a benefit…" }),
          ],
        },
        mediaSection("Logo", "Logo", "aspect-[16/9]"),
      ],
    },
  },

  // -------------------------------------------------- Sponsorship Packages ---
  package: {
    key: "package",
    title: "Sponsorship Packages",
    singular: "Package",
    icon: Package,
    description:
      "Reusable sponsorship tiers you sell — price, available slots, and the benefits each includes.",
    createLabel: "Add package",
    searchPlaceholder: "Search packages…",
    search: (r) => `${r.name} ${r.config.tier || ""}`,
    statusMap: PACKAGE_STATUS_MAP,
    filters: [
      statusFilter(PACKAGE_STATUS_MAP),
      configFilter("tier", TIER_VALUES, "All tiers"),
    ],
    columns: [
      nameCol((r) => r.config.tier),
      pillCol("tier", "Tier", (r) => r.config.tier, TIER_MAP),
      moneyCol("price", "Price", (r) => r.config.price),
      textCol("slots", "Slots", (r) => `${Number(r.config.sold) || 0} / ${Number(r.config.slots) || 0}`),
      statusCol(PACKAGE_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Packages", value: String(records.length), footer: "All statuses" },
      { label: "Total value", value: currency(sum(records, (r) => (Number(r.config.price) || 0) * (Number(r.config.slots) || 0))), footer: "If fully sold" },
      { label: "Slots sold", value: String(sum(records, (r) => r.config.sold)), footer: "Across packages" },
      { label: "Available", value: String(count(records, (r) => r.status === "Available")), footer: "On sale" },
    ],
    defaults: {
      status: "Draft",
      config: { tier: "Gold", price: 0, slots: 0, sold: 0, benefits: [], description: "" },
    },
    createFields: [
      nameField("Package name", "e.g. Gold Sponsor"),
      c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
      c("price", "Price", "number", { placeholder: "e.g. 10000" }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Package details",
          fields: [
            nameField("Package name"),
            statusField(PACKAGE_STATUS_MAP),
            c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
            c("price", "Price", "number", { placeholder: "e.g. 10000" }),
            c("slots", "Total slots", "number", { placeholder: "e.g. 4" }),
            c("sold", "Slots sold", "number", { placeholder: "e.g. 2" }),
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
    },
  },

  // ------------------------------------------------------------ Expo Booths ---
  booth: {
    key: "booth",
    title: "Expo Booths",
    singular: "Booth",
    icon: Store,
    description:
      "The exhibitor floor — booths, their hall and size, who's assigned, and what they cost.",
    createLabel: "Add booth",
    searchPlaceholder: "Search booths, halls, exhibitors…",
    search: (r) => `${r.name} ${r.config.hall || ""} ${r.config.exhibitor || ""}`,
    statusMap: BOOTH_STATUS_MAP,
    filters: [
      statusFilter(BOOTH_STATUS_MAP),
      configFilter("size", ["Standard", "Large", "Premium"], "All sizes"),
    ],
    columns: [
      nameCol((r) => r.config.hall),
      textCol("size", "Size", (r) => r.config.size),
      textCol("exhibitor", "Exhibitor", (r) => r.config.exhibitor),
      moneyCol("price", "Price", (r) => r.config.price),
      statusCol(BOOTH_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Booths", value: String(records.length), footer: "On the floor" },
      { label: "Occupied", value: String(count(records, (r) => r.status === "Occupied")), footer: "Assigned" },
      { label: "Available", value: String(count(records, (r) => r.status === "Available")), footer: "Open to book" },
      { label: "Revenue", value: currency(sum(records, (r) => (r.status === "Occupied" ? r.config.price : 0))), footer: "From occupied" },
    ],
    defaults: {
      status: "Available",
      config: { hall: "", size: "Standard", exhibitor: "", price: 0, notes: "" },
    },
    createFields: [
      nameField("Booth name / number", "e.g. Booth A12"),
      c("hall", "Hall / zone", "text", { placeholder: "e.g. Hall 1" }),
      c("size", "Size", "select", { options: optionsFrom(["Standard", "Large", "Premium"]) }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Booth details",
          fields: [
            nameField("Booth name / number"),
            statusField(BOOTH_STATUS_MAP),
            c("hall", "Hall / zone"),
            c("size", "Size", "select", { options: optionsFrom(["Standard", "Large", "Premium"]) }),
            c("exhibitor", "Exhibitor"),
            c("price", "Price", "number", { placeholder: "e.g. 2500" }),
          ],
        },
        { title: "Notes", fields: [c("notes", "Notes", "textarea", { placeholder: "Setup, power, neighbours…" })] },
      ],
    },
  },

  // --------------------------------------------------------- Venue Sourcing ---
  venue_lead: {
    key: "venue_lead",
    title: "Venue Sourcing",
    singular: "Venue lead",
    icon: MapPin,
    description:
      "Prospective venues under evaluation — track the pipeline from shortlist to booked, with quotes and contacts.",
    createLabel: "Add venue lead",
    searchPlaceholder: "Search venues, cities, contacts…",
    search: (r) => `${r.name} ${r.config.city || ""} ${r.config.contactName || ""}`,
    statusMap: VENUE_LEAD_STATUS_MAP,
    filters: [statusFilter(VENUE_LEAD_STATUS_MAP)],
    columns: [
      nameCol((r) => r.config.city),
      textCol("capacity", "Capacity", (r) => (Number(r.config.capacity) || 0).toLocaleString()),
      moneyCol("quotedPrice", "Quote", (r) => r.config.quotedPrice),
      textCol("rating", "Rating", (r) => (r.config.rating ? `${r.config.rating}/5` : "")),
      statusCol(VENUE_LEAD_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Leads", value: String(records.length), footer: "In pipeline" },
      { label: "Shortlisted", value: String(count(records, (r) => r.status === "Shortlisted")), footer: "Under review" },
      { label: "Booked", value: String(count(records, (r) => r.status === "Booked")), footer: "Secured" },
      { label: "Avg quote", value: currency(records.length ? sum(records, (r) => r.config.quotedPrice) / records.length : 0), footer: "Across leads" },
    ],
    defaults: {
      status: "Shortlisted",
      config: { city: "", capacity: 0, quotedPrice: 0, contactName: "", contactEmail: "", rating: "", notes: "" },
    },
    createFields: [
      nameField("Venue name", "e.g. Riverside Hall"),
      c("city", "City", "text", { placeholder: "e.g. Berlin" }),
      statusField(VENUE_LEAD_STATUS_MAP),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "details",
          label: "Details",
          icon: SquarePen,
          desc: "Location, capacity, status, and the quoted price.",
          fields: [
            nameField("Venue name"),
            statusField(VENUE_LEAD_STATUS_MAP),
            c("city", "City"),
            c("capacity", "Capacity", "number", { placeholder: "e.g. 800" }),
            c("quotedPrice", "Quoted price", "number", { placeholder: "e.g. 20000" }),
            c("rating", "Rating", "select", { options: optionsFrom(["1", "2", "3", "4", "5"]) }),
          ],
        },
        {
          key: "contact",
          label: "Contact & notes",
          icon: Contact,
          desc: "Who to reach and any notes on this lead.",
          fields: [
            c("contactName", "Contact name"),
            c("contactEmail", "Email", "email", { placeholder: "name@example.com" }),
            c("notes", "Notes", "textarea", { placeholder: "Availability, catering, AV, terms…" }),
          ],
        },
      ],
    },
  },

  // -------------------------------------------------------- Housing & Travel ---
  housing: {
    key: "housing",
    title: "Housing & Travel",
    singular: "Option",
    icon: Plane,
    description:
      "Hotel room blocks and travel options for attendees — rates, inventory, and booking links.",
    createLabel: "Add option",
    searchPlaceholder: "Search hotels, cities…",
    search: (r) => `${r.name} ${r.config.city || ""} ${r.config.kind || ""}`,
    statusMap: HOUSING_STATUS_MAP,
    filters: [
      statusFilter(HOUSING_STATUS_MAP),
      configFilter("kind", ["Hotel", "Apartment", "Transport"], "All types"),
    ],
    columns: [
      nameCol((r) => r.config.city),
      textCol("kind", "Type", (r) => r.config.kind),
      moneyCol("ratePerNight", "Rate / night", (r) => r.config.ratePerNight),
      textCol("rooms", "Rooms", (r) => `${Number(r.config.roomsBooked) || 0} / ${Number(r.config.roomsBlocked) || 0}`),
      statusCol(HOUSING_STATUS_MAP),
    ],
    stats: (records) => {
      const blocked = sum(records, (r) => r.config.roomsBlocked);
      const booked = sum(records, (r) => r.config.roomsBooked);
      return [
        { label: "Options", value: String(records.length), footer: "Hotels & travel" },
        { label: "Rooms blocked", value: String(blocked), footer: "Total held" },
        { label: "Rooms booked", value: String(booked), footer: "Claimed" },
        { label: "Occupancy", value: pct(blocked ? (booked / blocked) * 100 : 0), footer: "Of blocked rooms" },
      ];
    },
    defaults: {
      status: "Available",
      config: { kind: "Hotel", city: "", address: "", ratePerNight: 0, roomsBlocked: 0, roomsBooked: 0, bookingLink: "", notes: "" },
    },
    createFields: [
      nameField("Name", "e.g. Grand Central Hotel"),
      c("kind", "Type", "select", { options: optionsFrom(["Hotel", "Apartment", "Transport"]) }),
      c("city", "City", "text", { placeholder: "e.g. Amsterdam" }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "details",
          label: "Option details",
          icon: SquarePen,
          desc: "Type, location, status, and the nightly rate.",
          fields: [
            nameField("Name"),
            statusField(HOUSING_STATUS_MAP),
            c("kind", "Type", "select", { options: optionsFrom(["Hotel", "Apartment", "Transport"]) }),
            c("city", "City"),
            c("address", "Address"),
            c("ratePerNight", "Rate / night", "number", { placeholder: "e.g. 180" }),
          ],
        },
        {
          key: "inventory",
          label: "Inventory",
          icon: ClipboardList,
          desc: "Rooms held vs. booked, plus the booking link.",
          fields: [
            c("roomsBlocked", "Rooms blocked", "number", { placeholder: "e.g. 40" }),
            c("roomsBooked", "Rooms booked", "number", { placeholder: "e.g. 12" }),
            c("bookingLink", "Booking link", "text", { placeholder: "https://…" }),
            c("notes", "Notes", "textarea", { placeholder: "Cut-off date, group code…" }),
          ],
        },
      ],
    },
  },

  // --------------------------------------------------------- Call for Papers ---
  paper: {
    key: "paper",
    title: "Call for Papers",
    singular: "Submission",
    icon: FileText,
    description:
      "Session proposals submitted for review — score them, track status, and accept the best.",
    createLabel: "Add submission",
    searchPlaceholder: "Search titles, authors, tracks…",
    search: (r) => `${r.name} ${r.config.authorName || ""} ${r.config.track || ""}`,
    statusMap: PAPER_STATUS_MAP,
    filters: [
      statusFilter(PAPER_STATUS_MAP),
      configFilter("format", ["Talk", "Workshop", "Panel"], "All formats"),
    ],
    columns: [
      nameCol((r) => r.config.authorName),
      textCol("track", "Track", (r) => r.config.track),
      textCol("format", "Format", (r) => r.config.format),
      textCol("score", "Score", (r) => (r.config.score ? `${r.config.score}/5` : "")),
      statusCol(PAPER_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Submissions", value: String(records.length), footer: "Received" },
      { label: "Accepted", value: String(count(records, (r) => r.status === "Accepted")), footer: "On the agenda" },
      { label: "Under review", value: String(count(records, (r) => r.status === "Under review")), footer: "Being scored" },
      { label: "Accept rate", value: pct(records.length ? (count(records, (r) => r.status === "Accepted") / records.length) * 100 : 0), footer: "Of submissions" },
    ],
    defaults: {
      status: "Submitted",
      config: { authorName: "", email: "", track: "", format: "Talk", abstract: "", score: "", reviewerNotes: "", topics: [] },
    },
    createFields: [
      nameField("Title", "e.g. Scaling Realtime Systems"),
      c("authorName", "Author", "text", { placeholder: "e.g. Grace Hopper" }),
      c("format", "Format", "select", { options: optionsFrom(["Talk", "Workshop", "Panel"]) }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "submission",
          label: "Submission",
          icon: FileText,
          desc: "Title, author, track, format, and status.",
          fields: [
            nameField("Title"),
            statusField(PAPER_STATUS_MAP),
            c("authorName", "Author"),
            c("email", "Email", "email", { placeholder: "name@example.com" }),
            c("track", "Track", "text", { placeholder: "e.g. Engineering" }),
            c("format", "Format", "select", { options: optionsFrom(["Talk", "Workshop", "Panel"]) }),
          ],
        },
        {
          key: "abstract",
          label: "Abstract",
          icon: BookOpen,
          desc: "The proposed session's abstract and topics.",
          fields: [
            c("abstract", "Abstract", "textarea", { rows: 8, placeholder: "The full session abstract…" }),
            c("topics", "Topics", "list", { placeholder: "Add a topic…" }),
          ],
        },
        {
          key: "review",
          label: "Review",
          icon: ClipboardList,
          desc: "Reviewer score and notes.",
          fields: [
            c("score", "Score", "select", { options: optionsFrom(["1", "2", "3", "4", "5"]) }),
            c("reviewerNotes", "Reviewer notes", "textarea", { placeholder: "Strengths, concerns, recommendation…" }),
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------ CEU & Certificates ---
  certificate: {
    key: "certificate",
    title: "CEU & Certificates",
    singular: "Certificate",
    icon: Award,
    description:
      "Certificates and continuing-education credits attendees can earn — credit hours, accreditation, and linked sessions.",
    createLabel: "Add certificate",
    searchPlaceholder: "Search certificates, bodies…",
    search: (r) => `${r.name} ${r.config.accreditingBody || ""} ${r.config.kind || ""}`,
    statusMap: CERTIFICATE_STATUS_MAP,
    filters: [
      statusFilter(CERTIFICATE_STATUS_MAP),
      configFilter("kind", ["Certificate", "CEU credit"], "All types"),
    ],
    columns: [
      nameCol((r) => r.config.kind),
      textCol("creditHours", "Credit hours", (r) => r.config.creditHours),
      textCol("accreditingBody", "Accrediting body", (r) => r.config.accreditingBody),
      statusCol(CERTIFICATE_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Templates", value: String(records.length), footer: "Certificates & CEUs" },
      { label: "Active", value: String(count(records, (r) => r.status === "Active")), footer: "Issuable now" },
      { label: "Credit hours", value: String(sum(records, (r) => r.config.creditHours)), footer: "Total offered" },
      { label: "Bodies", value: String(distinct(records, (r) => r.config.accreditingBody)), footer: "Accrediting" },
    ],
    defaults: {
      status: "Draft",
      config: { kind: "Certificate", creditHours: 0, accreditingBody: "", sessions: [], description: "" },
    },
    createFields: [
      nameField("Certificate name", "e.g. Certified Attendee"),
      c("kind", "Type", "select", { options: optionsFrom(["Certificate", "CEU credit"]) }),
      c("creditHours", "Credit hours", "number", { placeholder: "e.g. 8" }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Certificate details",
          fields: [
            nameField("Certificate name"),
            statusField(CERTIFICATE_STATUS_MAP),
            c("kind", "Type", "select", { options: optionsFrom(["Certificate", "CEU credit"]) }),
            c("creditHours", "Credit hours", "number", { placeholder: "e.g. 8" }),
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
    },
  },

  // ---------------------------------------------------------- Agenda Builder ---
  session: {
    key: "session",
    title: "Agenda Builder",
    singular: "Session",
    icon: CalendarClock,
    description:
      "Build the schedule — sessions with their track, room, time, and speaker. Sequence the whole agenda from here.",
    createLabel: "Add session",
    searchPlaceholder: "Search sessions, tracks, speakers…",
    search: (r) => `${r.name} ${r.config.track || ""} ${r.config.speaker || ""}`,
    statusMap: SESSION_STATUS_MAP,
    filters: [statusFilter(SESSION_STATUS_MAP)],
    columns: [
      nameCol((r) => [r.config.day, r.config.startTime].filter(Boolean).join(" · ")),
      textCol("track", "Track", (r) => r.config.track),
      textCol("room", "Room", (r) => r.config.room),
      textCol("speaker", "Speaker", (r) => r.config.speaker),
      statusCol(SESSION_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Sessions", value: String(records.length), footer: "On the agenda" },
      { label: "Scheduled", value: String(count(records, (r) => r.status === "Scheduled")), footer: "Confirmed slots" },
      { label: "Tracks", value: String(distinct(records, (r) => r.config.track)), footer: "Parallel tracks" },
      { label: "Rooms", value: String(distinct(records, (r) => r.config.room)), footer: "In use" },
    ],
    defaults: {
      status: "Draft",
      config: { track: "", room: "", day: "", startTime: "", endTime: "", speaker: "", description: "" },
    },
    createFields: [
      nameField("Session title", "e.g. Keynote: The Road Ahead"),
      c("track", "Track", "text", { placeholder: "e.g. Main Stage" }),
      c("speaker", "Speaker", "text", { placeholder: "e.g. Ada Lovelace" }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Session details",
          fields: [
            nameField("Session title"),
            statusField(SESSION_STATUS_MAP),
            c("track", "Track"),
            c("room", "Room", "text", { placeholder: "e.g. Room 2B" }),
            c("day", "Day", "text", { placeholder: "e.g. Day 1 · Tue" }),
            c("speaker", "Speaker"),
            c("startTime", "Start time", "text", { placeholder: "e.g. 09:00" }),
            c("endTime", "End time", "text", { placeholder: "e.g. 09:45" }),
          ],
        },
        { title: "Description", fields: [c("description", "Description", "textarea", { placeholder: "What this session covers…" })] },
      ],
    },
  },

  // ------------------------------------------------------ Recordings & Replay ---
  recording: {
    key: "recording",
    title: "Recordings & Replay",
    singular: "Recording",
    icon: Video,
    description:
      "The on-demand library — a journal of session recordings. Attach the events they came from, drop in an external video link, and publish a shareable replay page.",
    createLabel: "Add recording",
    searchPlaceholder: "Search recordings, sessions, speakers…",
    search: (r) => `${r.name} ${r.config.session || ""} ${r.config.speaker || ""}`,
    statusMap: RECORDING_STATUS_MAP,
    filters: [statusFilter(RECORDING_STATUS_MAP)],
    columns: [
      nameCol((r) => [r.config.session, r.config.speaker].filter(Boolean).join(" · ")),
      textCol("duration", "Duration", (r) => r.config.duration),
      textCol("views", "Views", (r) => (Number(r.config.views) || 0).toLocaleString()),
      textCol("shared", "Sharing", (r) => (r.config.public ? "Public link" : "Private")),
      statusCol(RECORDING_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Recordings", value: String(records.length), footer: "In the library" },
      { label: "Published", value: String(count(records, (r) => r.status === "Published")), footer: "Live to watch" },
      { label: "Public links", value: String(count(records, (r) => r.config.public)), footer: "Shared replays" },
      { label: "Total views", value: String(sum(records, (r) => r.config.views)), footer: "All recordings" },
    ],
    defaults: {
      status: "Draft",
      config: {
        session: "", speaker: "", videoUrl: "", duration: "", views: 0,
        recordedAt: "", description: "", eventIds: [], tags: [], public: false,
      },
    },
    createFields: [
      nameField("Title", "e.g. Opening Keynote"),
      c("session", "Session", "text", { placeholder: "e.g. Main Stage · Day 1" }),
      c("videoUrl", "Video URL", "text", { placeholder: "https://…" }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "details",
          label: "Details",
          icon: SquarePen,
          desc: "Title, status, and the session this recording captured.",
          fields: [
            nameField("Title"),
            statusField(RECORDING_STATUS_MAP),
            c("session", "Session"),
            c("speaker", "Speaker"),
            c("recordedAt", "Recorded on", "text", { placeholder: "e.g. 2026-07-18" }),
            c("duration", "Duration", "text", { placeholder: "e.g. 42:15" }),
            c("views", "Views", "number", { placeholder: "e.g. 1200" }),
            c("tags", "Tags", "list", { placeholder: "Add a tag…" }),
            c("description", "Description", "textarea", { placeholder: "Summary shown in the library and on the public page…" }),
          ],
        },
        {
          key: "video",
          label: "Video",
          icon: PlayCircle,
          desc: "The external video link — Geiger plays it client-side and never hosts it.",
          render: ({ record, commit }) => <RecordingVideoField record={record} commit={commit} />,
        },
        {
          key: "events",
          label: "Events",
          icon: CalendarDays,
          desc: "Which events this recording belongs to.",
          render: ({ record, commit }) => <EventMultiField record={record} commit={commit} />,
        },
        {
          key: "sharing",
          label: "Sharing",
          icon: Share2,
          desc: "Publish a public replay page anyone can open with the link.",
          render: ({ record, commit }) => <RecordingShareField record={record} commit={commit} />,
        },
        mediaSection("Thumbnail", "Thumbnail", "aspect-video"),
      ],
    },
  },

  // -------------------------------------------------------- Speaker Backstage ---
  backstage: {
    key: "backstage",
    title: "Speaker Backstage",
    singular: "Backstage room",
    icon: Clapperboard,
    description:
      "The green room for each session — line up speakers, run tech checks, and keep the run-of-show handy so nobody goes live unprepared.",
    createLabel: "Add backstage room",
    searchPlaceholder: "Search sessions, speakers, stage managers…",
    search: (r) => `${r.name} ${r.config.sessionTitle || ""} ${(r.config.speakers || []).join(" ")} ${r.config.stageManager || ""}`,
    statusMap: BACKSTAGE_STATUS_MAP,
    filters: [statusFilter(BACKSTAGE_STATUS_MAP)],
    columns: [
      nameCol((r) => r.config.sessionTitle),
      textCol("speakers", "Speakers", (r) => (r.config.speakers || []).length || ""),
      textCol("callTime", "Call time", (r) => r.config.callTime),
      textCol("ready", "Tech check", (r) => {
        const checks = ["techMic", "techCamera", "techScreen", "techInternet"];
        const done = checks.filter((k) => r.config[k]).length;
        return `${done}/4`;
      }),
      statusCol(BACKSTAGE_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Rooms", value: String(records.length), footer: "Green rooms" },
      { label: "Standing by", value: String(count(records, (r) => r.status === "Standing by")), footer: "Ready to go live" },
      { label: "On air", value: String(count(records, (r) => r.status === "On air")), footer: "Live now" },
      { label: "Speakers", value: String(sum(records, (r) => (r.config.speakers || []).length)), footer: "Backstage" },
    ],
    defaults: {
      status: "Green room",
      config: {
        eventId: "", sessionTitle: "", callTime: "", stageManager: "", joinUrl: "",
        speakers: [], techMic: false, techCamera: false, techScreen: false,
        techInternet: false, runOfShow: "", producerNotes: "",
      },
    },
    createFields: [
      nameField("Room name", "e.g. Main Stage — Backstage"),
      c("sessionTitle", "Session", "text", { placeholder: "e.g. Opening Keynote" }),
      c("callTime", "Call time", "text", { placeholder: "e.g. 08:30" }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "room",
          label: "Room",
          icon: Clapperboard,
          desc: "The session this backstage covers and who's running it.",
          fields: [
            nameField("Room name"),
            statusField(BACKSTAGE_STATUS_MAP),
            c("sessionTitle", "Session"),
            c("callTime", "Call time", "text", { placeholder: "e.g. 08:30" }),
            c("stageManager", "Stage manager", "text", { placeholder: "Who's calling the show" }),
          ],
        },
        {
          key: "event",
          label: "Event",
          icon: CalendarDays,
          desc: "Link this backstage to its event.",
          render: ({ record, commit }) => (
            <EventLinkField record={record} commit={commit} description="The event this session runs at." />
          ),
        },
        {
          key: "lineup",
          label: "Line-up",
          icon: Users,
          desc: "Speakers backstage and the private join link they use.",
          fields: [
            c("speakers", "Speakers on deck", "list", { placeholder: "Add a speaker…" }),
            c("joinUrl", "Backstage join link", "text", { placeholder: "https://… (private green-room URL)" }),
          ],
        },
        {
          key: "tech",
          label: "Tech check",
          icon: Wifi,
          desc: "Confirm each speaker's setup before they go live.",
          fields: [
            c("techMic", "Microphone tested", "switch"),
            c("techCamera", "Camera tested", "switch"),
            c("techScreen", "Screen share tested", "switch"),
            c("techInternet", "Connection stable", "switch"),
          ],
        },
        {
          key: "runofshow",
          label: "Run of show",
          icon: StickyNote,
          desc: "The beat-by-beat plan and any private producer notes.",
          fields: [
            c("runOfShow", "Run of show", "textarea", { rows: 8, placeholder: "00:00 Intro · 02:00 Keynote · 32:00 Q&A…" }),
            c("producerNotes", "Producer notes", "textarea", { placeholder: "Cues, reminders, backup plans…" }),
          ],
        },
      ],
    },
  },

  // --------------------------------------------------------- Livestream Rooms ---
  room: {
    key: "room",
    title: "Livestream Rooms",
    singular: "Room",
    icon: Radio,
    description:
      "Where sessions stream from — an on-site room, a digital broadcast, or both. Track capacity, the stream source, and the watch link.",
    createLabel: "Add room",
    searchPlaceholder: "Search rooms, locations, providers…",
    search: (r) => `${r.name} ${r.config.location || ""} ${r.config.streamProvider || ""}`,
    statusMap: ROOM_STATUS_MAP,
    filters: [
      statusFilter(ROOM_STATUS_MAP),
      configFilter("kind", ["Digital", "On-site", "Hybrid"], "All types"),
    ],
    columns: [
      nameCol((r) => r.config.location || r.config.streamProvider),
      pillCol("kind", "Type", (r) => r.config.kind, ROOM_KIND_MAP),
      textCol("capacity", "Capacity", (r) => (Number(r.config.capacity) || 0).toLocaleString()),
      textCol("scheduledFor", "Scheduled", (r) => r.config.scheduledFor),
      statusCol(ROOM_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Rooms", value: String(records.length), footer: "On-site & digital" },
      { label: "Live now", value: String(count(records, (r) => r.status === "Live")), footer: "Streaming" },
      { label: "Digital", value: String(count(records, (r) => r.config.kind === "Digital" || r.config.kind === "Hybrid")), footer: "Broadcasting" },
      { label: "Seats", value: String(sum(records, (r) => r.config.capacity)), footer: "Total capacity" },
    ],
    defaults: {
      status: "Offline",
      config: {
        kind: "Digital", eventId: "", capacity: 0, location: "", scheduledFor: "",
        streamProvider: "", streamUrl: "", watchUrl: "", description: "",
      },
    },
    createFields: [
      nameField("Room name", "e.g. Main Stage"),
      c("kind", "Type", "select", { options: optionsFrom(["Digital", "On-site", "Hybrid"]) }),
      c("capacity", "Capacity", "number", { placeholder: "e.g. 500" }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "room",
          label: "Room",
          icon: Radio,
          desc: "What kind of room this is and when it runs.",
          fields: [
            nameField("Room name"),
            statusField(ROOM_STATUS_MAP),
            c("kind", "Type", "select", { options: optionsFrom(["Digital", "On-site", "Hybrid"]) }),
            c("capacity", "Capacity", "number", { placeholder: "e.g. 500" }),
            c("scheduledFor", "Scheduled for", "text", { placeholder: "e.g. Day 1 · 09:00" }),
          ],
        },
        {
          key: "event",
          label: "Event",
          icon: CalendarDays,
          desc: "Link this room to its event.",
          render: ({ record, commit }) => (
            <EventLinkField record={record} commit={commit} description="The event streaming from this room." />
          ),
        },
        {
          key: "location",
          label: "Location",
          icon: Building2,
          desc: "For on-site or hybrid rooms — where the physical room is.",
          fields: [
            c("location", "Location", "text", { placeholder: "e.g. Hall B, Level 2" }),
          ],
        },
        {
          key: "stream",
          label: "Stream",
          icon: Wifi,
          desc: "The broadcast source and the public watch link.",
          fields: [
            c("streamProvider", "Provider", "text", { placeholder: "e.g. YouTube Live, Zoom, RTMP" }),
            c("streamUrl", "Stream / ingest URL", "text", { placeholder: "rtmp://… or the studio link" }),
            c("watchUrl", "Watch link", "text", { placeholder: "https://… (what attendees open)" }),
            c("description", "Notes", "textarea", { placeholder: "AV setup, backup stream, moderator…" }),
          ],
        },
      ],
    },
  },

  // ----------------------------------------------------------- Webinar Rooms ---
  webinar: {
    key: "webinar",
    title: "Webinar Rooms",
    singular: "Webinar",
    icon: MonitorPlay,
    description:
      "Scheduled virtual sessions with registration, a live stream, and an on-demand replay — the online counterpart to a stage.",
    createLabel: "Add webinar",
    searchPlaceholder: "Search webinars, presenters, platforms…",
    search: (r) => `${r.name} ${r.config.presenter || ""} ${r.config.platform || ""}`,
    statusMap: WEBINAR_STATUS_MAP,
    filters: [
      statusFilter(WEBINAR_STATUS_MAP),
      configFilter("platform", ["Zoom", "YouTube Live", "Google Meet", "Teams", "Custom"], "All platforms"),
    ],
    columns: [
      nameCol((r) => [r.config.platform, r.config.presenter].filter(Boolean).join(" · ")),
      textCol("scheduledFor", "Scheduled", (r) => r.config.scheduledFor),
      textCol("registration", "Registered", (r) => `${Number(r.config.registered) || 0} / ${Number(r.config.capacity) || 0}`),
      statusCol(WEBINAR_STATUS_MAP),
    ],
    stats: (records) => {
      const registered = sum(records, (r) => r.config.registered);
      const attended = sum(records, (r) => r.config.attended);
      return [
        { label: "Webinars", value: String(records.length), footer: "All statuses" },
        { label: "Live now", value: String(count(records, (r) => r.status === "Live")), footer: "Streaming" },
        { label: "Registered", value: String(registered), footer: "Across webinars" },
        { label: "Show rate", value: pct(registered ? (attended / registered) * 100 : 0), footer: "Attended vs registered" },
      ];
    },
    defaults: {
      status: "Draft",
      config: {
        platform: "Zoom", presenter: "", eventId: "", scheduledFor: "", duration: "",
        capacity: 0, registered: 0, attended: 0, requiresRegistration: true,
        registrationUrl: "", joinUrl: "", replayUrl: "", description: "",
      },
    },
    createFields: [
      nameField("Webinar title", "e.g. Product Deep-Dive"),
      c("platform", "Platform", "select", { options: optionsFrom(["Zoom", "YouTube Live", "Google Meet", "Teams", "Custom"]) }),
      c("presenter", "Presenter", "text", { placeholder: "e.g. Ada Lovelace" }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "overview",
          label: "Overview",
          icon: MonitorPlay,
          desc: "What this webinar is, when it runs, and who's presenting.",
          fields: [
            nameField("Webinar title"),
            statusField(WEBINAR_STATUS_MAP),
            c("platform", "Platform", "select", { options: optionsFrom(["Zoom", "YouTube Live", "Google Meet", "Teams", "Custom"]) }),
            c("presenter", "Presenter"),
            c("scheduledFor", "Scheduled for", "text", { placeholder: "e.g. Day 1 · 14:00" }),
            c("duration", "Duration", "text", { placeholder: "e.g. 60 min" }),
            c("capacity", "Capacity", "number", { placeholder: "e.g. 500" }),
            c("description", "Description", "textarea", { placeholder: "What attendees will learn…" }),
          ],
        },
        {
          key: "registration",
          label: "Registration",
          icon: ClipboardCheck,
          desc: "Whether attendees register up front and how many have.",
          fields: [
            c("requiresRegistration", "Requires registration", "switch", { hint: "Attendees sign up before they can join." }),
            c("registrationUrl", "Registration link", "text", { placeholder: "https://…" }),
            c("registered", "Registered", "number", { placeholder: "e.g. 320" }),
            c("attended", "Attended", "number", { placeholder: "e.g. 210" }),
          ],
        },
        {
          key: "stream",
          label: "Stream & replay",
          icon: Wifi,
          desc: "The live join link and the on-demand replay.",
          fields: [
            c("joinUrl", "Join link", "text", { placeholder: "https://… (live room)" }),
            c("replayUrl", "Replay link", "text", { placeholder: "https://… (on-demand)" }),
          ],
        },
        {
          key: "event",
          label: "Event",
          icon: CalendarDays,
          desc: "Link this webinar to its event.",
          render: ({ record, commit }) => (
            <EventLinkField record={record} commit={commit} description="The event this webinar belongs to." />
          ),
        },
        mediaSection("Cover", "Cover image", "aspect-video"),
      ],
    },
  },

  // ---------------------------------------------------------- Breakout Rooms ---
  breakout: {
    key: "breakout",
    title: "Breakout Rooms",
    singular: "Breakout room",
    icon: Network,
    description:
      "Small-group spaces that run alongside a main session — discussions, workshops, and networking tables with their own facilitator.",
    createLabel: "Add breakout room",
    searchPlaceholder: "Search rooms, topics, facilitators…",
    search: (r) => `${r.name} ${r.config.topic || ""} ${r.config.facilitator || ""} ${r.config.parentSession || ""}`,
    statusMap: BREAKOUT_STATUS_MAP,
    filters: [
      statusFilter(BREAKOUT_STATUS_MAP),
      configFilter("kind", ["Discussion", "Workshop", "Networking", "Roundtable"], "All types"),
    ],
    columns: [
      nameCol((r) => r.config.topic),
      pillCol("kind", "Type", (r) => r.config.kind, BREAKOUT_KIND_MAP),
      textCol("facilitator", "Facilitator", (r) => r.config.facilitator),
      textCol("seats", "Seats", (r) => `${Number(r.config.joined) || 0} / ${Number(r.config.capacity) || 0}`),
      statusCol(BREAKOUT_STATUS_MAP),
    ],
    stats: (records) => {
      const cap = sum(records, (r) => r.config.capacity);
      const joined = sum(records, (r) => r.config.joined);
      return [
        { label: "Rooms", value: String(records.length), footer: "All types" },
        { label: "Open", value: String(count(records, (r) => r.status === "Open")), footer: "Accepting people" },
        { label: "Participants", value: String(joined), footer: "Across rooms" },
        { label: "Fill", value: pct(cap ? (joined / cap) * 100 : 0), footer: "Of capacity" },
      ];
    },
    defaults: {
      status: "Draft",
      config: {
        kind: "Discussion", topic: "", facilitator: "", parentSession: "", capacity: 0,
        joined: 0, duration: "", joinUrl: "", autoAssign: false, description: "",
      },
    },
    createFields: [
      nameField("Room name", "e.g. Table 4 — Scaling Teams"),
      c("kind", "Type", "select", { options: optionsFrom(["Discussion", "Workshop", "Networking", "Roundtable"]) }),
      c("facilitator", "Facilitator", "text", { placeholder: "Who leads the room" }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "room",
          label: "Room",
          icon: Network,
          desc: "What this room is about and how long it runs.",
          fields: [
            nameField("Room name"),
            statusField(BREAKOUT_STATUS_MAP),
            c("kind", "Type", "select", { options: optionsFrom(["Discussion", "Workshop", "Networking", "Roundtable"]) }),
            c("topic", "Topic", "text", { placeholder: "What this room discusses" }),
            c("duration", "Duration", "text", { placeholder: "e.g. 25 min" }),
          ],
        },
        {
          key: "facilitator",
          label: "Facilitator & session",
          icon: Presentation,
          desc: "Who leads the room and the main session it splits from.",
          fields: [
            c("facilitator", "Facilitator", "text", { placeholder: "Who leads the room" }),
            c("parentSession", "Parent session", "text", { placeholder: "The main session this splits from" }),
          ],
        },
        {
          key: "capacity",
          label: "Capacity",
          icon: Users,
          desc: "How many people the room holds and how they're placed.",
          fields: [
            c("capacity", "Capacity", "number", { placeholder: "e.g. 12" }),
            c("joined", "Joined", "number", { placeholder: "e.g. 8" }),
            c("autoAssign", "Auto-assign attendees", "switch", { hint: "Spread attendees across rooms automatically." }),
          ],
        },
        {
          key: "access",
          label: "Access & notes",
          icon: Wifi,
          desc: "The join link and any prep notes for the room.",
          fields: [
            c("joinUrl", "Join link", "text", { placeholder: "https://… (room URL)" }),
            c("description", "Notes", "textarea", { placeholder: "Prompt, format, materials…" }),
          ],
        },
      ],
    },
  },

  // ----------------------------------------------------------- Sponsor Rooms ---
  sponsor_room: {
    key: "sponsor_room",
    title: "Sponsor Rooms",
    singular: "Sponsor room",
    icon: Building2,
    description:
      "A sponsor's branded virtual space — a booth, lounge, or demo room with reps on hand, downloadable resources, and a call-to-action that captures leads.",
    createLabel: "Add sponsor room",
    searchPlaceholder: "Search rooms, sponsors…",
    search: (r) => `${r.name} ${r.config.sponsor || ""} ${r.config.tier || ""} ${r.config.kind || ""}`,
    statusMap: SPONSOR_ROOM_STATUS_MAP,
    filters: [
      statusFilter(SPONSOR_ROOM_STATUS_MAP),
      configFilter("tier", TIER_VALUES, "All tiers"),
    ],
    columns: [
      nameCol((r) => r.config.sponsor),
      pillCol("tier", "Tier", (r) => r.config.tier, TIER_MAP),
      pillCol("kind", "Type", (r) => r.config.kind, SPONSOR_ROOM_KIND_MAP),
      textCol("leads", "Leads", (r) => (Number(r.config.leadsCaptured) || 0).toLocaleString()),
      statusCol(SPONSOR_ROOM_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Rooms", value: String(records.length), footer: "All sponsors" },
      { label: "Live", value: String(count(records, (r) => r.status === "Live")), footer: "Open now" },
      { label: "Leads", value: String(sum(records, (r) => r.config.leadsCaptured)), footer: "Captured" },
      { label: "Visits", value: String(sum(records, (r) => r.config.visits)), footer: "Total traffic" },
    ],
    defaults: {
      status: "Draft",
      config: {
        sponsor: "", tier: "Gold", kind: "Virtual booth", eventId: "", reps: [], resources: [],
        ctaLabel: "", ctaUrl: "", videoUrl: "", leadsCaptured: 0, visits: 0, description: "",
      },
    },
    createFields: [
      nameField("Room name", "e.g. Northwind Labs Lounge"),
      c("sponsor", "Sponsor", "text", { placeholder: "e.g. Northwind Labs" }),
      c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "details",
          label: "Details",
          icon: SquarePen,
          desc: "The sponsor, their tier, and what kind of room this is.",
          fields: [
            nameField("Room name"),
            statusField(SPONSOR_ROOM_STATUS_MAP),
            c("sponsor", "Sponsor"),
            c("tier", "Tier", "select", { options: optionsFrom(TIER_VALUES) }),
            c("kind", "Type", "select", { options: optionsFrom(["Virtual booth", "Lounge", "Demo room", "Meeting room"]) }),
          ],
        },
        {
          key: "content",
          label: "Booth content",
          icon: Gift,
          desc: "The pitch, downloadable resources, and the call-to-action.",
          fields: [
            c("description", "Description", "textarea", { placeholder: "What this sponsor offers attendees…" }),
            c("resources", "Resources", "list", { placeholder: "Add a resource link or title…" }),
            c("ctaLabel", "CTA label", "text", { placeholder: "e.g. Book a demo" }),
            c("ctaUrl", "CTA link", "text", { placeholder: "https://…" }),
          ],
        },
        {
          key: "reps",
          label: "Reps & leads",
          icon: Users,
          desc: "Who's staffing the room and how it's performing.",
          fields: [
            c("reps", "Reps on hand", "list", { placeholder: "Add a rep…" }),
            c("leadsCaptured", "Leads captured", "number", { placeholder: "e.g. 48" }),
            c("visits", "Visits", "number", { placeholder: "e.g. 1200" }),
          ],
        },
        {
          key: "video",
          label: "Video",
          icon: PlayCircle,
          desc: "A looping promo or demo video for the room.",
          render: ({ record, commit }) => <RecordingVideoField record={record} commit={commit} />,
        },
        {
          key: "event",
          label: "Event",
          icon: CalendarDays,
          desc: "Link this room to its event.",
          render: ({ record, commit }) => (
            <EventLinkField record={record} commit={commit} description="The event this sponsor room runs at." />
          ),
        },
        mediaSection("Banner", "Banner", "aspect-[16/9]"),
      ],
    },
  },

  // ----------------------------------------------------------- Speaker Portal ---
  portal_invite: {
    key: "portal_invite",
    title: "Speaker Portal",
    singular: "Portal invite",
    icon: Contact,
    description:
      "Invite speakers to a self-service portal where they submit their bio, headshot, slides, A/V form, and availability — track every submission to done.",
    createLabel: "Invite speaker",
    searchPlaceholder: "Search speakers, sessions…",
    search: (r) => `${r.name} ${r.config.email || ""} ${r.config.sessionTitle || ""}`,
    statusMap: PORTAL_STATUS_MAP,
    filters: [statusFilter(PORTAL_STATUS_MAP)],
    columns: [
      avatarNameCol((r) => r.config.sessionTitle),
      textCol("progress", "Progress", (r) => {
        const keys = ["bioSubmitted", "headshotSubmitted", "slidesSubmitted", "avFormSubmitted", "availabilityConfirmed"];
        return `${keys.filter((k) => r.config[k]).length}/5`;
      }),
      textCol("deadline", "Deadline", (r) => r.config.deadline),
      statusCol(PORTAL_STATUS_MAP),
    ],
    stats: (records) => {
      const keys = ["bioSubmitted", "headshotSubmitted", "slidesSubmitted", "avFormSubmitted", "availabilityConfirmed"];
      const totalTasks = records.length * keys.length;
      const doneTasks = sum(records, (r) => keys.filter((k) => r.config[k]).length);
      return [
        { label: "Invites", value: String(records.length), footer: "Speakers invited" },
        { label: "Approved", value: String(count(records, (r) => r.status === "Approved")), footer: "Fully done" },
        { label: "Overdue", value: String(count(records, (r) => r.status === "Overdue")), footer: "Past deadline" },
        { label: "Completion", value: pct(totalTasks ? (doneTasks / totalTasks) * 100 : 0), footer: "Of all tasks" },
      ];
    },
    defaults: {
      status: "Not started",
      config: {
        email: "", sessionTitle: "", deadline: "", portalUrl: "",
        bioSubmitted: false, headshotSubmitted: false, slidesSubmitted: false,
        avFormSubmitted: false, availabilityConfirmed: false, bioText: "", notes: "",
      },
    },
    createFields: [
      nameField("Speaker name", "e.g. Grace Hopper"),
      c("email", "Email", "email", { placeholder: "name@example.com" }),
      c("sessionTitle", "Session", "text", { placeholder: "e.g. Keynote" }),
    ],
    detail: {
      depth: "rich",
      hero: PortalProgressHero,
      nav: [
        {
          key: "invite",
          label: "Invite",
          icon: Contact,
          desc: "Who's invited, their session, and the submission deadline.",
          fields: [
            nameField("Speaker name"),
            { ...statusField(PORTAL_STATUS_MAP), type: "tabs" },
            c("email", "Email", "email", { placeholder: "name@example.com" }),
            c("sessionTitle", "Session"),
            c("deadline", "Deadline", "text", { placeholder: "e.g. 2026-06-01" }),
            c("portalUrl", "Portal link", "text", { placeholder: "https://… (their private portal)" }),
          ],
        },
        {
          key: "checklist",
          label: "Checklist",
          icon: ClipboardCheck,
          desc: "Tick each item off as the speaker submits it.",
          fields: [
            c("bioSubmitted", "Bio submitted", "switch"),
            c("headshotSubmitted", "Headshot submitted", "switch"),
            c("slidesSubmitted", "Slides submitted", "switch"),
            c("avFormSubmitted", "A/V form submitted", "switch"),
            c("availabilityConfirmed", "Availability confirmed", "switch"),
          ],
        },
        {
          key: "materials",
          label: "Materials",
          icon: BookOpen,
          desc: "The bio they provided and any coordination notes.",
          fields: [
            c("bioText", "Speaker bio", "textarea", { rows: 6, placeholder: "The bio the speaker submitted…" }),
            c("notes", "Notes", "textarea", { placeholder: "Follow-ups, missing items, reminders…" }),
          ],
        },
        mediaSection("Headshot", "Headshot", "aspect-square", "max-w-[200px]"),
      ],
    },
  },

  // ------------------------------------------------------ Simulive & On-demand ---
  simulive: {
    key: "simulive",
    title: "Simulive & On-demand",
    singular: "Broadcast",
    icon: CirclePlay,
    description:
      "Pre-recorded content that plays as if it were live at a set premiere time, plus the on-demand library attendees can watch any time.",
    createLabel: "Add broadcast",
    searchPlaceholder: "Search broadcasts, sessions, speakers…",
    search: (r) => `${r.name} ${r.config.session || ""} ${r.config.speaker || ""} ${r.config.mode || ""}`,
    statusMap: SIMULIVE_STATUS_MAP,
    filters: [
      statusFilter(SIMULIVE_STATUS_MAP),
      configFilter("mode", ["Simulive", "On-demand", "Encore"], "All modes"),
    ],
    columns: [
      nameCol((r) => [r.config.session, r.config.speaker].filter(Boolean).join(" · ")),
      pillCol("mode", "Mode", (r) => r.config.mode, SIMULIVE_MODE_MAP),
      textCol("access", "Access", (r) => accessSummary(r.config.access)),
      textCol("premiereAt", "Premiere", (r) => r.config.premiereAt),
      textCol("views", "Views", (r) => (Number(r.config.views) || 0).toLocaleString()),
      statusCol(SIMULIVE_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Broadcasts", value: String(records.length), footer: "All modes" },
      { label: "Premiering", value: String(count(records, (r) => r.status === "Premiering")), footer: "As-live now" },
      { label: "Available", value: String(count(records, (r) => r.status === "Available")), footer: "On demand" },
      { label: "Total views", value: String(sum(records, (r) => r.config.views)), footer: "Across broadcasts" },
    ],
    defaults: {
      status: "Draft",
      config: {
        mode: "Simulive", videoUrl: "", premiereAt: "", duration: "", gated: false,
        views: 0, session: "", speaker: "", eventId: "", captionsOn: false, description: "",
        access: DEFAULT_ACCESS,
      },
    },
    createFields: [
      nameField("Title", "e.g. Opening Keynote (Encore)"),
      c("mode", "Mode", "select", { options: optionsFrom(["Simulive", "On-demand", "Encore"]) }),
      c("videoUrl", "Content", "text", {
        placeholder: "https://… (YouTube, Vimeo, or .mp4)",
        hint: "Geiger streams the content from this link — it isn't re-hosted.",
      }),
      c("access", "Access", "access", { hint: "Choose how attendees unlock this content." }),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "details",
          label: "Details",
          icon: SquarePen,
          desc: "What plays, in which mode, and when it premieres.",
          fields: [
            nameField("Title"),
            statusField(SIMULIVE_STATUS_MAP),
            c("mode", "Mode", "select", { options: optionsFrom(["Simulive", "On-demand", "Encore"]) }),
            c("session", "Session", "text", { placeholder: "e.g. Main Stage · Day 1" }),
            c("speaker", "Speaker"),
            c("premiereAt", "Premiere time", "text", { placeholder: "e.g. Day 2 · 10:00" }),
            c("duration", "Duration", "text", { placeholder: "e.g. 42:15" }),
            c("description", "Description", "textarea", { placeholder: "Shown alongside the player…" }),
          ],
        },
        {
          key: "video",
          label: "Video",
          icon: PlayCircle,
          desc: "The external video link — Geiger plays it client-side and never hosts it.",
          render: ({ record, commit }) => <RecordingVideoField record={record} commit={commit} />,
        },
        {
          key: "access",
          label: "Access",
          icon: ClipboardCheck,
          desc: "How attendees unlock this content — free, membership, purchase, or rental.",
          fields: [
            c("access", "Access model", "access"),
            c("captionsOn", "Captions available", "switch", { hint: "Show closed captions on the player." }),
            c("views", "Views", "number", { placeholder: "e.g. 1200" }),
          ],
        },
        {
          key: "event",
          label: "Event",
          icon: CalendarDays,
          desc: "Link this broadcast to its event.",
          render: ({ record, commit }) => (
            <EventLinkField record={record} commit={commit} description="The event this broadcast belongs to." />
          ),
        },
        mediaSection("Thumbnail", "Thumbnail", "aspect-video"),
      ],
    },
  },

  // ------------------------------------------------- Captions & Transcription ---
  caption: {
    key: "caption",
    title: "Captions & Transcription",
    singular: "Caption job",
    icon: Captions,
    description:
      "Live captions and transcripts for each session — the language coverage, the provider, and the finished transcript to download.",
    createLabel: "Add caption job",
    searchPlaceholder: "Search sessions, providers, languages…",
    search: (r) => `${r.name} ${r.config.session || ""} ${r.config.provider || ""} ${(r.config.languages || []).join(" ")}`,
    statusMap: CAPTION_STATUS_MAP,
    filters: [
      statusFilter(CAPTION_STATUS_MAP),
      configFilter("mode", ["Live CART", "AI auto", "Post-edited"], "All modes"),
    ],
    columns: [
      nameCol((r) => r.config.session),
      pillCol("mode", "Mode", (r) => r.config.mode, CAPTION_MODE_MAP),
      textCol("languages", "Languages", (r) => (r.config.languages || []).length || ""),
      textCol("accuracy", "Accuracy", (r) => (r.config.accuracy ? `${r.config.accuracy}%` : "")),
      statusCol(CAPTION_STATUS_MAP),
    ],
    stats: (records) => {
      const langs = new Set(
        records.flatMap((r) => (r.config.languages || []).map((l) => l.trim().toLowerCase())).filter(Boolean),
      );
      return [
        { label: "Jobs", value: String(records.length), footer: "All sessions" },
        { label: "Live", value: String(count(records, (r) => r.status === "Live")), footer: "Captioning now" },
        { label: "Ready", value: String(count(records, (r) => r.status === "Ready")), footer: "Transcripts done" },
        { label: "Languages", value: String(langs.size), footer: "Covered" },
      ];
    },
    defaults: {
      status: "Requested",
      config: {
        session: "", mode: "AI auto", provider: "", sourceLanguage: "English",
        languages: [], accuracy: "", wordCount: 0, transcriptUrl: "",
        downloadable: false, eventId: "", notes: "",
      },
    },
    createFields: [
      nameField("Job name", "e.g. Keynote — Live captions"),
      c("session", "Session", "text", { placeholder: "e.g. Opening Keynote" }),
      c("mode", "Mode", "select", { options: optionsFrom(["Live CART", "AI auto", "Post-edited"]) }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Caption job",
          fields: [
            nameField("Job name"),
            statusField(CAPTION_STATUS_MAP),
            c("session", "Session"),
            c("mode", "Mode", "select", { options: optionsFrom(["Live CART", "AI auto", "Post-edited"]) }),
            c("provider", "Provider", "text", { placeholder: "e.g. Verbit, Otter, in-house" }),
          ],
        },
        {
          title: "Languages & quality",
          fields: [
            c("sourceLanguage", "Source language", "text", { placeholder: "e.g. English" }),
            c("languages", "Caption languages", "list", { placeholder: "Add a language…" }),
            c("accuracy", "Accuracy", "number", { placeholder: "e.g. 98" }),
          ],
        },
        {
          title: "Output",
          fields: [
            c("transcriptUrl", "Transcript link", "text", { placeholder: "https://…" }),
            c("wordCount", "Word count", "number", { placeholder: "e.g. 8400" }),
            c("downloadable", "Downloadable by attendees", "switch", { hint: "Let attendees download the transcript." }),
            c("notes", "Notes", "textarea", { placeholder: "Glossary, speaker names, corrections…" }),
          ],
        },
      ],
    },
  },

  // ------------------------------------------------------------ Assign Agenda ---
  agenda_assignment: {
    key: "agenda_assignment",
    title: "Assign Agenda",
    singular: "Agenda",
    icon: CalendarCheck,
    description:
      "Curate a set of sessions and assign it to a controlled group of guests — everyone or a subset by segment, tag, ticket, offering, add-on, status, or specific people, just like Community.",
    createLabel: "Create agenda",
    searchPlaceholder: "Search agendas…",
    search: (r) => `${r.name} ${r.config.description || ""}`,
    statusMap: AGENDA_ASSIGN_STATUS_MAP,
    filters: [statusFilter(AGENDA_ASSIGN_STATUS_MAP)],
    columns: [
      nameCol((r) => r.config.description),
      textCol("sessions", "Sessions", (r) => (r.config.sessionIds || []).length || ""),
      textCol("audience", "Audience", (r) => describeSpec(r.config.audience)),
      statusCol(AGENDA_ASSIGN_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Agendas", value: String(records.length), footer: "All statuses" },
      { label: "Published", value: String(count(records, (r) => r.status === "Published")), footer: "Assigned live" },
      { label: "Sessions assigned", value: String(sum(records, (r) => (r.config.sessionIds || []).length)), footer: "Across agendas" },
      { label: "Drafts", value: String(count(records, (r) => r.status === "Draft")), footer: "Not yet live" },
    ],
    defaults: {
      status: "Draft",
      config: {
        sessionIds: [],
        audience: { eventId: "", emails: [] },
        description: "",
        deliverVia: "In-app",
        scheduledFor: "",
        notify: false,
      },
    },
    createFields: [
      nameField("Agenda name", "e.g. VIP Track"),
      c("audience", "Audience", "audience", {
        hint: "Everyone, or a subset — by event, ticket, offering, add-on, tag, segment, status, or specific people.",
        full: true,
      }),
    ],
    detail: {
      depth: "rich",
      hero: AgendaAssignHero,
      nav: [
        {
          key: "details",
          label: "Agenda",
          icon: SquarePen,
          desc: "Name it, set where it is in its lifecycle, and describe what it's for.",
          fields: [
            nameField("Agenda name"),
            { ...statusField(AGENDA_ASSIGN_STATUS_MAP), type: "tabs" },
            c("description", "Description", "textarea", { placeholder: "What this agenda is and who it's for…" }),
          ],
        },
        {
          key: "sessions",
          label: "Sessions",
          icon: ListChecks,
          desc: "Curate the sessions this agenda includes.",
          render: ({ record, commit }) => <SessionMultiField record={record} commit={commit} />,
        },
        {
          key: "audience",
          label: "Audience",
          icon: Target,
          desc: "Choose the controlled group this agenda is assigned to.",
          fields: [c("audience", "", "audience", { full: true })],
        },
        {
          key: "delivery",
          label: "Delivery",
          icon: Send,
          desc: "How and when assigned guests receive this agenda.",
          fields: [
            c("deliverVia", "Deliver via", "select", { options: optionsFrom(AGENDA_DELIVERY_OPTIONS) }),
            c("scheduledFor", "Send at", "text", { placeholder: "e.g. 2026-06-01 09:00 (leave blank to send now)" }),
            c("notify", "Notify guests when published", "switch", { hint: "Push a notification when this agenda goes live." }),
          ],
        },
      ],
    },
  },
};

export const MODULE_LIST = Object.values(MODULES);
