"use client";

import {
  SquarePen,
  Video,
  Share2,
  PlayCircle,
  CalendarDays,
} from "lucide-react";

import {
  EventMultiField,
  RecordingVideoField,
  RecordingShareField,
} from "../detail_fields";
import {
  nameCol,
  statusCol,
  textCol,
  count,
  statusFilter,
  nameField,
  statusField,
  c,
  refField,
} from "@/components/internal/shared/records/builders";
import { RECORDING_STATUS_MAP } from "../constants";
import { mediaSection, presenceSum } from "./shared";

// ------------------------------------------------------ Recordings & Replay ---
export const RECORDING_MODULE = {
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
    textCol("viewers", "Viewers", (r) => (r._presence?.uniqueViewers || 0).toLocaleString("en-US")),
    textCol("shared", "Sharing", (r) => (r.config.public ? "Public link" : "Private")),
    statusCol(RECORDING_STATUS_MAP),
  ],
  usesPresence: true,
  stats: (records, { presence = {} } = {}) => [
    { label: "Recordings", value: String(records.length), footer: "In the library" },
    { label: "Published", value: String(count(records, (r) => r.status === "Published")), footer: "Live to watch" },
    { label: "Public links", value: String(count(records, (r) => r.config.public)), footer: "Shared replays" },
    { label: "Viewers", value: String(presenceSum(records, presence, "uniqueViewers")), footer: "Measured, all time" },
  ],
  defaults: {
    status: "Draft",
    config: {
      session: "", speaker: "", sessionId: "", speakerId: "", videoUrl: "",
      duration: "", recordedAt: "", description: "", eventIds: [], tags: [],
      public: false,
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
          refField("sessionId", "Session", "session"),
          refField("speakerId", "Speaker", "speaker"),
          c("recordedAt", "Recorded on", "text", { placeholder: "e.g. 2026-07-18" }),
          c("duration", "Duration", "text", { placeholder: "e.g. 42:15" }),
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
};
