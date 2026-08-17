"use client";

import { CalendarClock } from "lucide-react";

import {
  nameCol,
  statusCol,
  textCol,
  count,
  distinct,
  statusFilter,
  nameField,
  statusField,
  c,
} from "@/components/internal/shared/records/builders";
import { SESSION_STATUS_MAP } from "../constants";

// ---------------------------------------------------------- Agenda Builder ---
export const SESSION_MODULE = {
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
};
