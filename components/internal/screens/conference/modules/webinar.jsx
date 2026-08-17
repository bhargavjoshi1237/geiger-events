"use client";

import {
  Radio,
  Wifi,
  CalendarDays,
  MonitorPlay,
  ClipboardCheck,
} from "lucide-react";

import { EventLinkField } from "../detail_fields";
import LiveControl from "../live_control";
import {
  accessSummary,
  DEFAULT_ACCESS,
} from "@/components/internal/shared/records/access_control";
import {
  nameCol,
  statusCol,
  textCol,
  sum,
  statusFilter,
  configFilter,
  nameField,
  statusField,
  c,
  dateTimeField,
  optionsFrom,
  pct,
} from "@/components/internal/shared/records/builders";
import { WEBINAR_STATUS_MAP } from "../constants";
import {
  mediaSection,
  scheduleLabel,
  presenceSum,
  accessSection,
} from "./shared";

// ----------------------------------------------------------- Webinar Rooms ---
export const WEBINAR_MODULE = {
  key: "webinar",
  title: "Webinar Rooms",
  singular: "Webinar",
  icon: MonitorPlay,
  description:
    "Scheduled virtual sessions with registration, a live stream, and an on-demand replay — the online counterpart to a stage.",
  createLabel: "Add webinar",
  searchPlaceholder: "Search webinars, presenters, platforms…",
  search: (r) => `${r.name} ${r.config.presenter || ""} ${r.config.platform || ""}`,
  statusMap: WEBINAR_STATUS_MAP,
  filters: [
    statusFilter(WEBINAR_STATUS_MAP),
    configFilter("platform", ["Zoom", "YouTube Live", "Google Meet", "Teams", "Custom"], "All platforms"),
  ],
  columns: [
    nameCol((r) => [r.config.platform, r.config.presenter].filter(Boolean).join(" · ")),
    textCol("access", "Access", (r) => accessSummary(r.config.access)),
    textCol("scheduledFor", "Scheduled", scheduleLabel),
    textCol("registration", "Registered", (r) => `${Number(r.config.registered) || 0} / ${Number(r.config.capacity) || 0}`),
    textCol("attended", "Attended", (r) => String(r._presence?.uniqueViewers || 0)),
    statusCol(WEBINAR_STATUS_MAP),
  ],
  usesPresence: true,
  stats: (records, { presence = {} } = {}) => {
    const registered = sum(records, (r) => r.config.registered);
    // Attendance is measured from presence, never typed in.
    const attended = presenceSum(records, presence, "uniqueViewers");
    return [
      { label: "Webinars", value: String(records.length), footer: "All Statuses" },
      { label: "Watching", value: String(presenceSum(records, presence, "liveNow")), footer: "In rooms now" },
      { label: "Registered", value: String(registered), footer: "Across webinars" },
      { label: "Show rate", value: pct(registered ? (attended / registered) * 100 : 0), footer: "Attended vs registered" },
    ];
  },
  defaults: {
    status: "Draft",
    config: {
      platform: "Zoom", presenter: "", eventId: "", scheduledFor: "", duration: "",
      capacity: 0, registered: 0, requiresRegistration: true,
      registrationUrl: "", joinUrl: "", replayUrl: "", description: "",
      access: DEFAULT_ACCESS,
    },
  },
  createFields: [
    nameField("Webinar title", "e.g. Product Deep-Dive"),
    c("platform", "Platform", "select", { options: optionsFrom(["Zoom", "YouTube Live", "Google Meet", "Teams", "Custom"]) }),
    c("presenter", "Presenter", "text", { placeholder: "e.g. Ada Lovelace" }),
    c("access", "Access", "access", { hint: "Choose how attendees unlock this webinar." }),
  ],
  detail: {
    depth: "rich",
    nav: [
      {
        key: "overview",
        label: "Overview",
        icon: MonitorPlay,
        desc: "What this webinar is, when it runs, and who's presenting.",
        fields: [
          nameField("Webinar title"),
          statusField(WEBINAR_STATUS_MAP),
          c("platform", "Platform", "select", { options: optionsFrom(["Zoom", "YouTube Live", "Google Meet", "Teams", "Custom"]) }),
          c("presenter", "Presenter"),
          dateTimeField("startsAt", "Starts at", { hint: "Attendees can join 15 minutes before this." }),
          dateTimeField("endsAt", "Ends at", { hint: "Leave empty to keep the room open until you end it." }),
          c("duration", "Duration", "text", { placeholder: "e.g. 60 min" }),
          c("capacity", "Capacity", "number", { placeholder: "e.g. 500" }),
          c("description", "Description", "textarea", { placeholder: "What attendees will learn…" }),
        ],
      },
      {
        key: "live",
        label: "Live",
        icon: Radio,
        desc: "Go live, end the webinar, and watch who's in it.",
        render: ({ record, commit }) => <LiveControl record={record} commit={commit} />,
      },
      accessSection("How attendees unlock this webinar — free, membership, purchase, or rental."),
      {
        key: "registration",
        label: "Registration",
        icon: ClipboardCheck,
        desc: "Whether attendees register up front and how many have.",
        fields: [
          c("requiresRegistration", "Requires registration", "switch", { hint: "Attendees sign up before they can join." }),
          c("registrationUrl", "Registration link", "text", { placeholder: "https://…" }),
          c("registered", "Registered (manual)", "number", {
            placeholder: "e.g. 320",
            hint: "Entered by hand until registration ships. Attendance is measured from presence.",
          }),
        ],
      },
      {
        key: "stream",
        label: "Stream & replay",
        icon: Wifi,
        desc: "The live join link and the on-demand replay.",
        fields: [
          c("joinUrl", "Join link", "text", { placeholder: "https://… (live room)" }),
          c("replayUrl", "Replay link", "text", { placeholder: "https://… (on-demand)" }),
        ],
      },
      {
        key: "event",
        label: "Event",
        icon: CalendarDays,
        desc: "Link this webinar to its event.",
        render: ({ record, commit }) => (
          <EventLinkField record={record} commit={commit} />
        ),
      },
      mediaSection("Cover", "Cover image", "aspect-video"),
    ],
  },
};
