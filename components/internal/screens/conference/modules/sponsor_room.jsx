"use client";

import {
  SquarePen,
  Gift,
  Video,
  Users,
  Building2,
  PlayCircle,
  CalendarDays,
} from "lucide-react";

import { EventLinkField, RecordingVideoField } from "../detail_fields";
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
  optionsFrom,
} from "@/components/internal/shared/records/builders";
import {
  SPONSOR_ROOM_KIND_MAP,
  SPONSOR_ROOM_STATUS_MAP,
  TIER_MAP,
} from "../constants";
import { mediaSection, TIER_VALUES } from "./shared";

// ----------------------------------------------------------- Sponsor Rooms ---
export const SPONSOR_ROOM_MODULE = {
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
    textCol("leads", "Leads", (r) => (Number(r.config.leadsCaptured) || 0).toLocaleString("en-US")),
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
    nameField("Room Name", "e.g. Northwind Labs Lounge"),
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
          nameField("Room Name"),
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
          <EventLinkField record={record} commit={commit} />
        ),
      },
      mediaSection("Banner", "Banner", "aspect-[16/9]"),
    ],
  },
};
