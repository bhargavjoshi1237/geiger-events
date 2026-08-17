"use client";

import { Radio, Building2, Wifi, CalendarDays } from "lucide-react";

import { EventLinkField } from "../detail_fields";
import LiveControl from "../live_control";
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
  optionsFrom,
} from "@/components/internal/shared/records/builders";
import { ROOM_KIND_MAP, ROOM_STATUS_MAP } from "../constants";
import { scheduleLabel, presenceSum, accessSection } from "./shared";

// --------------------------------------------------------- Livestream Rooms ---
export const ROOM_MODULE = {
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
    configFilter("kind", ["Digital", "On-site", "Hybrid"], "All Types"),
  ],
  columns: [
    nameCol((r) => r.config.location || r.config.streamProvider),
    pillCol("kind", "Type", (r) => r.config.kind, ROOM_KIND_MAP),
    textCol("access", "Access", (r) => accessSummary(r.config.access)),
    textCol("scheduledFor", "Scheduled", scheduleLabel),
    textCol("watching", "Watching", (r) => String(r._presence?.liveNow || 0)),
    statusCol(ROOM_STATUS_MAP),
  ],
  usesPresence: true,
  stats: (records, { presence = {} } = {}) => [
    { label: "Rooms", value: String(records.length), footer: "On-site & digital" },
    { label: "Live now", value: String(count(records, (r) => r.status === "Live")), footer: "Streaming" },
    { label: "Watching", value: String(presenceSum(records, presence, "liveNow")), footer: "Attendees in rooms" },
    { label: "Unique viewers", value: String(presenceSum(records, presence, "uniqueViewers")), footer: "All time" },
  ],
  defaults: {
    status: "Offline",
    config: {
      kind: "Digital", eventId: "", capacity: 0, location: "", scheduledFor: "",
      streamProvider: "", streamUrl: "", watchUrl: "", description: "",
      access: DEFAULT_ACCESS,
    },
  },
  createFields: [
    nameField("Room Name", "e.g. Main Stage"),
    c("kind", "Type", "select", { options: optionsFrom(["Digital", "On-site", "Hybrid"]) }),
    c("capacity", "Capacity", "number", { placeholder: "e.g. 500" }),
    c("access", "Access", "access", { hint: "Choose how attendees unlock this room." }),
  ],
  detail: {
    depth: "rich",
    nav: [
      {
        key: "room",
        label: "Room",
        icon: Radio,
        desc: "What kind of room this is and when it runs.",
        bare: true,
        fields: [
          nameField("Room Name"),
          statusField(ROOM_STATUS_MAP),
          c("kind", "Type", "select", { options: optionsFrom(["Digital", "On-site", "Hybrid"]) }),
          c("capacity", "Capacity", "number", { placeholder: "e.g. 500" }),
          dateTimeField("startsAt", "Starts at", { hint: "Attendees can open the room 15 minutes before this." }),
          dateTimeField("endsAt", "Ends at", { hint: "Leave empty to keep the room open until you end it." }),
        ],
      },
      {
        key: "live",
        label: "Live",
        icon: Radio,
        desc: "Go live, end the room, and watch who's in it.",
        render: ({ record, commit }) => <LiveControl record={record} commit={commit} />,
      },
      accessSection("How attendees unlock this room — free, membership, purchase, or rental."),
      {
        key: "event",
        label: "Event",
        icon: CalendarDays,
        desc: "Link this room to its event.",
        render: ({ record, commit }) => (
          <EventLinkField record={record} commit={commit} />
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
};
