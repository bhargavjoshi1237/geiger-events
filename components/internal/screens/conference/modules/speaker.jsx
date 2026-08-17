"use client";

import { Mic, User, SquarePen, Presentation, Link2 } from "lucide-react";

import { SpeakerHero, SpeakerTitleBadges } from "../detail_fields";
import {
  avatarNameCol,
  statusCol,
  textCol,
  count,
  distinct,
  statusFilter,
  nameField,
  statusField,
  c,
} from "@/components/internal/shared/records/builders";
import { SPEAKER_STATUS_MAP } from "../constants";
import { mediaSection } from "./shared";

// -------------------------------------------------------------- Speakers ---
export const SPEAKER_MODULE = {
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
    { label: "Speakers", value: String(records.length), footer: "All Statuses" },
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
    // The strip is display-only, so the header keeps the name/status and adds
    // the Featured badge beside them.
    hero: SpeakerHero,
    heroOwnsTitle: false,
    titleBadges: SpeakerTitleBadges,
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
};
