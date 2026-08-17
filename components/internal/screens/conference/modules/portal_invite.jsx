"use client";

import { Contact, BookOpen, ClipboardCheck } from "lucide-react";

import { PortalProgressHero } from "../detail_fields";
import {
  avatarNameCol,
  statusCol,
  textCol,
  count,
  sum,
  statusFilter,
  nameField,
  statusField,
  c,
  pct,
} from "@/components/internal/shared/records/builders";
import { PORTAL_STATUS_MAP } from "../constants";
import { mediaSection } from "./shared";

// ----------------------------------------------------------- Speaker Portal ---
export const PORTAL_INVITE_MODULE = {
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
};
