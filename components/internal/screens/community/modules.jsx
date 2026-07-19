"use client";

import { Vote, ClipboardList, Megaphone } from "lucide-react";

import {
  nameCol,
  statusCol,
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
import { describeSpec } from "@/lib/audience/resolve";

// Community modules (backed by events.community_records). Simple engagement
// records — created here, surfaced on the event page / app. Real-time surfaces
// (chat, DMs, boards) are separate and not part of this record set.

const POLL_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Live: { label: "Live", variant: "success", dotClass: "bg-emerald-400" },
  Closed: { label: "Closed", variant: "warning", dotClass: "bg-amber-400" },
};
const SURVEY_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Open: { label: "Open", variant: "success", dotClass: "bg-emerald-400" },
  Closed: { label: "Closed", variant: "warning", dotClass: "bg-amber-400" },
};
const ANNOUNCEMENT_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  Scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  Sent: { label: "Sent", variant: "success", dotClass: "bg-emerald-400" },
};

const CHANNELS = ["In-app", "Email", "Push", "SMS"];

// The audience picker, shared by every module's create dialog + editor. Pick an
// event to unlock ticket/offering/add-on targeting, or keep it project-wide.
const AUDIENCE_HINT =
  "Everyone, or a subset — by event, ticket type, offering, add-on, tag, segment, or specific people.";
const audienceField = (hint = AUDIENCE_HINT) =>
  c("audience", "Audience", "audience", { hint, full: true });

// Summarize a record's config.audience (an audience spec, or legacy
// { eventId, emails } / string) for the list column.
function audienceLabel(aud) {
  if (!aud) return "Everyone";
  return describeSpec(aud);
}

export const MODULES = {
  poll: {
    key: "poll",
    title: "Polls",
    singular: "Poll",
    icon: Vote,
    description: "Quick live polls for your audience — options, votes, and open/closed state.",
    createLabel: "Add poll",
    searchPlaceholder: "Search polls…",
    search: (r) => `${r.name} ${(r.config.options || []).join(" ")}`,
    statusMap: POLL_STATUS_MAP,
    filters: [statusFilter(POLL_STATUS_MAP)],
    columns: [
      nameCol((r) => `${(r.config.options || []).length} options`),
      textCol("votes", "Votes", (r) => (Number(r.config.votes) || 0).toLocaleString()),
      statusCol(POLL_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Polls", value: String(records.length), footer: "All statuses" },
      { label: "Live", value: String(count(records, (r) => r.status === "Live")), footer: "Open now" },
      { label: "Total votes", value: String(sum(records, (r) => r.config.votes)), footer: "Across polls" },
      { label: "Closed", value: String(count(records, (r) => r.status === "Closed")), footer: "Finished" },
    ],
    defaults: {
      status: "Draft",
      config: { options: [], votes: 0, event: "", audience: { eventId: "", emails: [] } },
    },
    createFields: [
      nameField("Question", "e.g. Which topic next?"),
      audienceField(),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Poll",
          fields: [
            nameField("Question"),
            statusField(POLL_STATUS_MAP),
            c("votes", "Votes", "number", { placeholder: "e.g. 0" }),
          ],
        },
        { title: "Options", fields: [c("options", "Options", "list", { placeholder: "Add an option…" })] },
        {
          title: "Audience",
          description: "Who can see and vote on this poll.",
          fields: [c("audience", "", "audience", { full: true })],
        },
      ],
    },
  },

  survey: {
    key: "survey",
    title: "Surveys",
    singular: "Survey",
    icon: ClipboardList,
    description: "Longer feedback forms — questions, audience, and collected responses.",
    createLabel: "Add survey",
    searchPlaceholder: "Search surveys…",
    search: (r) => r.name,
    statusMap: SURVEY_STATUS_MAP,
    filters: [statusFilter(SURVEY_STATUS_MAP)],
    columns: [
      nameCol((r) => audienceLabel(r.config.audience)),
      textCol("questions", "Questions", (r) => (r.config.questions || []).length || ""),
      textCol("responses", "Responses", (r) => (Number(r.config.responses) || 0).toLocaleString()),
      statusCol(SURVEY_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Surveys", value: String(records.length), footer: "All statuses" },
      { label: "Open", value: String(count(records, (r) => r.status === "Open")), footer: "Collecting" },
      { label: "Responses", value: String(sum(records, (r) => r.config.responses)), footer: "Across surveys" },
      { label: "Closed", value: String(count(records, (r) => r.status === "Closed")), footer: "Finished" },
    ],
    defaults: {
      status: "Draft",
      config: { questions: [], responses: 0, audience: { eventId: "", emails: [] } },
    },
    createFields: [nameField("Survey title", "e.g. Post-event feedback"), audienceField()],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Survey",
          fields: [
            nameField("Survey title"),
            statusField(SURVEY_STATUS_MAP),
            c("responses", "Responses", "number", { placeholder: "e.g. 0" }),
          ],
        },
        {
          title: "Audience",
          description: "Who this survey targets.",
          fields: [c("audience", "", "audience", { full: true })],
        },
        { title: "Questions", fields: [c("questions", "Questions", "list", { placeholder: "Add a question…" })] },
      ],
    },
  },

  announcement: {
    key: "announcement",
    title: "Announcements",
    singular: "Announcement",
    icon: Megaphone,
    description: "Broadcast updates to your audience — message, channel, and delivery status.",
    createLabel: "Add announcement",
    searchPlaceholder: "Search announcements…",
    search: (r) => `${r.name} ${r.config.body || ""}`,
    statusMap: ANNOUNCEMENT_STATUS_MAP,
    filters: [
      statusFilter(ANNOUNCEMENT_STATUS_MAP),
      configFilter("channel", CHANNELS, "All channels"),
    ],
    columns: [
      nameCol((r) => audienceLabel(r.config.audience)),
      textCol("channel", "Channel", (r) => r.config.channel),
      statusCol(ANNOUNCEMENT_STATUS_MAP),
    ],
    stats: (records) => [
      { label: "Announcements", value: String(records.length), footer: "All statuses" },
      { label: "Sent", value: String(count(records, (r) => r.status === "Sent")), footer: "Delivered" },
      { label: "Scheduled", value: String(count(records, (r) => r.status === "Scheduled")), footer: "Queued" },
      { label: "Draft", value: String(count(records, (r) => r.status === "Draft")), footer: "Unsent" },
    ],
    defaults: {
      status: "Draft",
      config: { body: "", audience: { eventId: "", emails: [] }, channel: "In-app", scheduledFor: "" },
    },
    createFields: [
      nameField("Title", "e.g. Doors open at 9am"),
      c("channel", "Channel", "select", { options: optionsFrom(CHANNELS) }),
      audienceField("Who receives this announcement — everyone or a targeted subset."),
    ],
    detail: {
      depth: "light",
      panels: [
        {
          title: "Announcement",
          fields: [
            nameField("Title"),
            statusField(ANNOUNCEMENT_STATUS_MAP),
            c("channel", "Channel", "select", { options: optionsFrom(CHANNELS) }),
            c("scheduledFor", "Scheduled for", "text", { placeholder: "e.g. 2026-07-12 09:00" }),
          ],
        },
        {
          title: "Audience",
          description: "Who receives this announcement.",
          fields: [c("audience", "", "audience", { full: true })],
        },
        { title: "Message", fields: [c("body", "Message", "textarea", { rows: 6, placeholder: "What do you want to tell everyone?" })] },
      ],
    },
  },
};
