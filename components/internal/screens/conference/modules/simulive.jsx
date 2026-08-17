"use client";

import {
  SquarePen,
  Video,
  PlayCircle,
  CalendarDays,
  CirclePlay,
  Captions,
  ClipboardCheck,
} from "lucide-react";

import { EventLinkField, RecordingVideoField } from "../detail_fields";
import {
  accessSummary,
  DEFAULT_ACCESS,
} from "@/components/internal/shared/records/access_control";
import {
  nameCol,
  statusCol,
  pillCol,
  textCol,
  count,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  dateTimeField,
  refField,
  optionsFrom,
} from "@/components/internal/shared/records/builders";
import { SIMULIVE_MODE_MAP, SIMULIVE_STATUS_MAP } from "../constants";
import { mediaSection, scheduleLabel, presenceSum } from "./shared";

// ------------------------------------------------------ Simulive & On-demand ---
export const SIMULIVE_MODULE = {
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
    textCol("premiereAt", "Premiere", scheduleLabel),
    textCol("viewers", "Viewers", (r) => (r._presence?.uniqueViewers || 0).toLocaleString("en-US")),
    statusCol(SIMULIVE_STATUS_MAP),
  ],
  usesPresence: true,
  stats: (records, { presence = {} } = {}) => [
    { label: "Broadcasts", value: String(records.length), footer: "All modes" },
    { label: "Premiering", value: String(count(records, (r) => r.status === "Premiering")), footer: "As-live now" },
    { label: "Available", value: String(count(records, (r) => r.status === "Available")), footer: "On demand" },
    { label: "Viewers", value: String(presenceSum(records, presence, "uniqueViewers")), footer: "Measured, all time" },
  ],
  defaults: {
    status: "Draft",
    config: {
      mode: "Simulive", videoUrl: "", premiereAt: "", duration: "", gated: false,
      session: "", speaker: "", sessionId: "", speakerId: "", eventId: "",
      captionsOn: false, description: "", access: DEFAULT_ACCESS,
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
          refField("sessionId", "Session", "session"),
          refField("speakerId", "Speaker", "speaker"),
          dateTimeField("startsAt", "Premiere time", { hint: "When the pre-recorded content plays as-live." }),
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
        ],
      },
      {
        key: "event",
        label: "Event",
        icon: CalendarDays,
        desc: "Link this broadcast to its event.",
        render: ({ record, commit }) => (
          <EventLinkField record={record} commit={commit} />
        ),
      },
      mediaSection("Thumbnail", "Thumbnail", "aspect-video"),
    ],
  },
};
