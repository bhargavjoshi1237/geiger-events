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
} from "lucide-react";

import { CoverImageCard } from "@/components/internal/shared/records/record_fields";
import { uploadConferenceImage } from "@/lib/supabase/storage";
import {
  nameCol,
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
  TIER_MAP,
} from "./constants";

// The eight Conference modules, expressed declaratively. The shared kit
// (conference_kit.jsx) renders the list (columns/stats/filters/create) and the
// adaptive detail (rich = section nav + fields/render; light = field panels).
// Every module is backed by events.conference_records, discriminated by `key`.

// --- Builders ----------------------------------------------------------------
// Column/stat/filter/field factories are shared (see records/builders.jsx).
// Only the media section (uses this area's uploader) is local.

const mediaSection = (label, title, aspect) => ({
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
      nameCol((r) => [r.config.title, r.config.company].filter(Boolean).join(" · ")),
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
      statusField(SPEAKER_STATUS_MAP),
    ],
    detail: {
      depth: "rich",
      nav: [
        {
          key: "profile",
          label: "Profile",
          icon: User,
          desc: "Name, role, status, and contact details.",
          fields: [
            nameField("Full name"),
            statusField(SPEAKER_STATUS_MAP),
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
        mediaSection("Headshot", "Headshot", "aspect-[4/3]"),
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
      depth: "light",
      panels: [
        {
          title: "Venue lead",
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
          title: "Contact & notes",
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
      depth: "light",
      panels: [
        {
          title: "Option details",
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
          title: "Inventory",
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
      "The on-demand library — session recordings with their video link, status, and viewing stats.",
    createLabel: "Add recording",
    searchPlaceholder: "Search recordings, sessions…",
    search: (r) => `${r.name} ${r.config.session || ""}`,
    statusMap: RECORDING_STATUS_MAP,
    filters: [statusFilter(RECORDING_STATUS_MAP)],
    columns: [
      nameCol((r) => r.config.session),
      textCol("duration", "Duration", (r) => r.config.duration),
      textCol("views", "Views", (r) => (Number(r.config.views) || 0).toLocaleString()),
      statusCol(RECORDING_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Recordings", value: String(records.length), footer: "In the library" },
      { label: "Published", value: String(count(records, (r) => r.status === "Published")), footer: "Live to watch" },
      { label: "Processing", value: String(count(records, (r) => r.status === "Processing")), footer: "Being encoded" },
      { label: "Total views", value: String(sum(records, (r) => r.config.views)), footer: "All recordings" },
    ],
    defaults: {
      status: "Draft",
      config: { session: "", videoUrl: "", duration: "", views: 0, description: "" },
    },
    createFields: [
      nameField("Title", "e.g. Opening Keynote"),
      c("session", "Session", "text", { placeholder: "e.g. Main Stage · Day 1" }),
      c("videoUrl", "Video URL", "text", { placeholder: "https://…" }),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Recording details",
          fields: [
            nameField("Title"),
            statusField(RECORDING_STATUS_MAP),
            c("session", "Session"),
            c("videoUrl", "Video URL", "text", { placeholder: "https://…" }),
            c("duration", "Duration", "text", { placeholder: "e.g. 42:15" }),
            c("views", "Views", "number", { placeholder: "e.g. 1200" }),
          ],
        },
        { title: "Description", fields: [c("description", "Description", "textarea", { placeholder: "Summary shown in the library…" })] },
      ],
    },
  },
};

export const MODULE_LIST = Object.values(MODULES);
