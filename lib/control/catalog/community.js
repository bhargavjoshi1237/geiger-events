import { c, nameField, options, statusField, statuses } from "./builders.js";

// Community records (events.community_records), ported from components/internal/screens/community/modules.jsx.

const SOURCE = "components/internal/screens/community/modules.jsx";
const CHANNELS = options(["In-app", "Email", "Push", "SMS"]);
const AUDIENCE_HINT = "Who sees it is set on the dashboard's audience picker.";

export const COMMUNITY_MODULES = [
  {
    id: "community.poll",
    store: "community",
    module: "poll",
    section: "community",
    title: "Polls",
    singular: "Poll",
    icon: "vote",
    description: "Quick live polls for your audience — options, votes, and open/closed state.",
    createLabel: "Add poll",
    statuses: statuses({ Draft: { variant: "neutral" }, Live: { variant: "success" }, Closed: { variant: "warning" } }),
    defaults: { status: "Draft", config: { options: [], votes: 0, event: "", audience: { eventId: "", emails: [] } } },
    summary: ["votes"],
    create: ["name"],
    panels: [
      { title: "Poll", fields: [nameField("Question", "e.g. Which topic next?"), statusField(), c("votes", "Votes", "number", { min: 0 })] },
      { title: "Options", fields: [c("options", "Options", "list", { placeholder: "Add an option…" })] },
      { title: "Audience", fields: [c("audience", "Audience", "audience", { hint: AUDIENCE_HINT })] },
    ],
    source: SOURCE,
  },
  {
    id: "community.survey",
    store: "community",
    module: "survey",
    section: "community",
    title: "Surveys",
    singular: "Survey",
    icon: "clipboard-list",
    description: "Longer feedback forms — questions, audience, and collected responses.",
    createLabel: "Add survey",
    statuses: statuses({ Draft: { variant: "neutral" }, Open: { variant: "success" }, Closed: { variant: "warning" } }),
    defaults: { status: "Draft", config: { questions: [], responses: 0, audience: { eventId: "", emails: [] } } },
    summary: ["responses"],
    create: ["name"],
    panels: [
      {
        title: "Survey",
        fields: [nameField("Survey title", "e.g. Post-event feedback"), statusField(), c("responses", "Responses", "number", { min: 0 })],
      },
      { title: "Questions", fields: [c("questions", "Questions", "list", { placeholder: "Add a question…" })] },
      { title: "Audience", fields: [c("audience", "Audience", "audience", { hint: AUDIENCE_HINT })] },
    ],
    source: SOURCE,
  },
  {
    id: "community.announcement",
    store: "community",
    module: "announcement",
    section: "community",
    title: "Announcements",
    singular: "Announcement",
    icon: "megaphone",
    description: "Broadcast updates to your audience — message, channel, and delivery status.",
    createLabel: "Add announcement",
    statuses: statuses({ Draft: { variant: "neutral" }, Scheduled: { variant: "info" }, Sent: { variant: "success" } }),
    defaults: { status: "Draft", config: { body: "", audience: { eventId: "", emails: [] }, channel: "In-app", scheduledFor: "" } },
    summary: ["channel"],
    create: ["name", "channel"],
    panels: [
      {
        title: "Announcement",
        fields: [
          nameField("Title", "e.g. Doors open at 9am"),
          statusField(),
          c("channel", "Channel", "select", { options: CHANNELS }),
          c("scheduledFor", "Scheduled for", "text", { placeholder: "e.g. 2026-07-12 09:00" }),
        ],
      },
      { title: "Message", fields: [c("body", "Message", "textarea", { placeholder: "What do you want to tell everyone?" })] },
      { title: "Audience", fields: [c("audience", "Audience", "audience", { hint: AUDIENCE_HINT })] },
    ],
    source: SOURCE,
  },
];
