import { defineNotificationTypes } from "@geiger/notify";

// Root-relative on the shared geiger.studio origin, where this app is mounted at /events.
const projectUrl = (d) => `/events/project/${d.projectId}`;
const eventUrl = (d) => `/events/project/${d.projectId}/allevents?event=${d.eventId}`;

// Every notification Events sends, declared once; send by key via ./client.js or ./server.js.
export const EVENTS_NOTIFICATION_TYPES = defineNotificationTypes({
  "event_team.added": {
    category: "assignment",
    icon: "UserPlus",
    tone: "info",
    title: (d) => `You're now ${d.role || "a member"} on ${d.eventName || "an event"}`,
    url: eventUrl,
  },
  "event_team.role_changed": {
    category: "update",
    icon: "ShieldCheck",
    tone: "info",
    title: (d) => `Your role on ${d.eventName || "an event"} is now ${d.role}`,
    url: eventUrl,
  },
  "event_team.removed": {
    category: "security",
    icon: "UserMinus",
    tone: "warning",
    title: (d) => `You were removed from ${d.eventName || "an event"}`,
  },
  "team.role_changed": {
    category: "update",
    icon: "ShieldCheck",
    tone: "info",
    title: (d) => `Your role in ${d.projectName || "an Events workspace"} is now ${d.role}`,
    url: projectUrl,
  },
  "team.removed": {
    category: "security",
    icon: "UserMinus",
    tone: "warning",
    title: (d) => `You were removed from ${d.projectName || "an Events workspace"}`,
    body: "You no longer have access to its events.",
  },
  "ticket.sold": {
    category: "update",
    icon: "Ticket",
    tone: "success",
    priority: "low",
    title: (d) => `${d.buyerName || "Someone"} bought ${d.quantity} ticket${d.quantity === 1 ? "" : "s"}`,
    body: (d) => [d.ticketName, d.eventName].filter(Boolean).join(" · "),
    url: eventUrl,
    groupKey: (d) => `event:${d.eventId}:sales`,
    // The Stripe webhook and the verify route can both fulfil an order; notify once.
    dedupeKey: (d) => `order:${d.orderId}`,
  },
  "registration.pending": {
    category: "alert",
    icon: "UserCheck",
    tone: "warning",
    priority: "high",
    title: (d) => `${d.name || "Someone"} is waiting for approval`,
    body: (d) => d.eventName,
    url: (d) => `/events/project/${d.projectId}/approvalgates`,
    dedupeKey: (d) => `registration:${d.registrationId}`,
    actions: (d) => [{ label: "Review", url: `/events/project/${d.projectId}/approvalgates`, variant: "primary" }],
  },
});
