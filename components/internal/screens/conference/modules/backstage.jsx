"use client";

import {
  Clapperboard,
  Users,
  StickyNote,
  Wifi,
  CalendarDays,
} from "lucide-react";

import { EventLinkField } from "../detail_fields";
import {
  nameCol,
  statusCol,
  textCol,
  count,
  sum,
  statusFilter,
  nameField,
  statusField,
  c,
} from "@/components/internal/shared/records/builders";
import { BACKSTAGE_STATUS_MAP } from "../constants";

// -------------------------------------------------------- Speaker Backstage ---
export const BACKSTAGE_MODULE = {
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
    nameField("Room Name", "e.g. Main Stage — Backstage"),
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
          nameField("Room Name"),
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
          <EventLinkField record={record} commit={commit} />
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
};
