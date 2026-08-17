"use client";

import { Presentation, Users, Wifi, Network, ListChecks } from "lucide-react";

import BreakoutAssign from "../breakout_assign";
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
  sum,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  refField,
  optionsFrom,
  pct,
} from "@/components/internal/shared/records/builders";
import { BREAKOUT_KIND_MAP, BREAKOUT_STATUS_MAP } from "../constants";
import { presenceSum, accessSection } from "./shared";

// ---------------------------------------------------------- Breakout Rooms ---
export const BREAKOUT_MODULE = {
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
    configFilter("kind", ["Discussion", "Workshop", "Networking", "Roundtable"], "All Types"),
  ],
  columns: [
    nameCol((r) => r.config.topic),
    pillCol("kind", "Type", (r) => r.config.kind, BREAKOUT_KIND_MAP),
    textCol("access", "Access", (r) => accessSummary(r.config.access)),
    textCol("facilitator", "Facilitator", (r) => r.config.facilitator),
    textCol("seats", "Seats", (r) => `${r._presence?.liveNow || 0} / ${Number(r.config.capacity) || 0}`),
    statusCol(BREAKOUT_STATUS_MAP),
  ],
  usesPresence: true,
  stats: (records, { presence = {} } = {}) => {
    const cap = sum(records, (r) => r.config.capacity);
    // Participants are measured from presence, never typed in.
    const inRooms = presenceSum(records, presence, "liveNow");
    return [
      { label: "Rooms", value: String(records.length), footer: "All Types" },
      { label: "Open", value: String(count(records, (r) => r.status === "Open")), footer: "Accepting people" },
      { label: "Participants", value: String(inRooms), footer: "In rooms now" },
      { label: "Fill", value: pct(cap ? (inRooms / cap) * 100 : 0), footer: "Of capacity" },
    ];
  },
  defaults: {
    status: "Draft",
    config: {
      kind: "Discussion", topic: "", facilitator: "", parentSession: "",
      parentSessionId: "", capacity: 0, duration: "", joinUrl: "",
      autoAssign: false, assigned: [], description: "", access: DEFAULT_ACCESS,
    },
  },
  createFields: [
    nameField("Room Name", "e.g. Table 4 — Scaling Teams"),
    c("kind", "Type", "select", { options: optionsFrom(["Discussion", "Workshop", "Networking", "Roundtable"]) }),
    c("facilitator", "Facilitator", "text", { placeholder: "Who leads the room" }),
    c("access", "Access", "access", { hint: "Choose how attendees unlock this room." }),
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
          nameField("Room Name"),
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
          refField("parentSessionId", "Parent session", "session", {
            placeholder: "The main session this splits from",
            hint: "Sibling rooms sharing this session are assigned and timed together.",
          }),
        ],
      },
      {
        key: "capacity",
        label: "Capacity",
        icon: Users,
        desc: "How many people the room holds and how they're placed.",
        fields: [
          c("capacity", "Capacity", "number", { placeholder: "e.g. 12" }),
          c("autoAssign", "Auto-assign attendees", "switch", { hint: "Spread attendees across rooms automatically." }),
        ],
      },
      {
        key: "assign",
        label: "Rounds & roster",
        icon: ListChecks,
        desc: "Place entitled attendees across the sibling rooms, run the round clock, and broadcast to everyone.",
        render: ({ record }) => <BreakoutAssign record={record} />,
      },
      accessSection("How attendees unlock this room — free, membership, purchase, or rental."),
      {
        key: "notes",
        label: "Join & notes",
        icon: Wifi,
        desc: "The join link and any prep notes for the room.",
        fields: [
          c("joinUrl", "Join link", "text", { placeholder: "https://… (room URL)" }),
          c("description", "Notes", "textarea", { placeholder: "Prompt, format, materials…" }),
        ],
      },
    ],
  },
};
