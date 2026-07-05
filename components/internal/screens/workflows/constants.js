// Constants & lookups for the Workflows area. Config only — no row data (that is
// fetched through lib/supabase/workflows.js). These catalogs drive BOTH the
// linear step-list builder and the drag-drop canvas palette, so a trigger/
// action/condition is defined once here and rendered by either view.

import {
  Ticket,
  ClipboardCheck,
  UserCheck,
  RotateCcw,
  CreditCard,
  ScanLine,
  Clock,
  Rocket,
  CalendarClock,
  UserX,
  Mail,
  MessageSquare,
  Tag,
  ListChecks,
  Bell,
  Timer,
  Webhook,
  PencilLine,
  CheckSquare,
  GitBranch,
} from "lucide-react";

// --- Status & scope lookups --------------------------------------------------

export const WORKFLOW_STATUS_MAP = {
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  Paused: { label: "Paused", variant: "warning", dotClass: "bg-amber-400" },
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const SCOPE_MAP = {
  workspace: { label: "Workspace", variant: "info" },
  event: { label: "Event", variant: "purple" },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Active", label: "Active" },
  { value: "Paused", label: "Paused" },
  { value: "Draft", label: "Draft" },
];

// --- Trigger catalog ---------------------------------------------------------
// key, label, icon, group, description. The trigger is always the first node of
// a workflow (steps[0], kind "trigger").

export const TRIGGER_CATALOG = [
  // Ticketing & registration
  {
    key: "ticket.purchased",
    label: "Ticket purchased",
    icon: Ticket,
    group: "Ticketing & registration",
    description: "An attendee completes a ticket purchase.",
  },
  {
    key: "registration.submitted",
    label: "Registration submitted",
    icon: ClipboardCheck,
    group: "Ticketing & registration",
    description: "Someone submits a registration form.",
  },
  {
    key: "rsvp.confirmed",
    label: "RSVP confirmed",
    icon: UserCheck,
    group: "Ticketing & registration",
    description: "A guest confirms their RSVP.",
  },
  {
    key: "refund.issued",
    label: "Refund issued",
    icon: RotateCcw,
    group: "Ticketing & registration",
    description: "A refund is issued on an order.",
  },
  {
    key: "payment.failed",
    label: "Payment failed",
    icon: CreditCard,
    group: "Ticketing & registration",
    description: "A payment attempt fails.",
  },
  // Attendance & lifecycle
  {
    key: "attendee.checked_in",
    label: "Attendee checked in",
    icon: ScanLine,
    group: "Attendance & lifecycle",
    description: "An attendee is checked in at the door.",
  },
  {
    key: "waitlist.joined",
    label: "Waitlist joined",
    icon: Clock,
    group: "Attendance & lifecycle",
    description: "Someone joins an event waitlist.",
  },
  {
    key: "event.published",
    label: "Event published",
    icon: Rocket,
    group: "Attendance & lifecycle",
    description: "An event goes live / is published.",
  },
  {
    key: "event.starting_soon",
    label: "Event starting soon",
    icon: CalendarClock,
    group: "Attendance & lifecycle",
    description: "A time-based trigger before an event begins.",
  },
  {
    key: "attendee.no_show",
    label: "Attendee no-show",
    icon: UserX,
    group: "Attendance & lifecycle",
    description: "A registered attendee did not check in.",
  },
];

// --- Condition catalog -------------------------------------------------------
// Branch steps (kind "condition"). `fields` describes the inline config the
// builder renders. Conditions split flow into yes / no branches.

export const CONDITION_CATALOG = [
  {
    key: "if.buyer_attribute",
    label: "If buyer attribute",
    icon: GitBranch,
    description: "Branch on a buyer attribute (VIP, returning, new…).",
    fields: [
      {
        key: "attribute",
        label: "Attribute",
        type: "select",
        options: ["Is VIP", "Is returning", "Is first-time", "Is member"],
        default: "Is VIP",
      },
    ],
  },
  {
    key: "if.order_amount",
    label: "If order amount",
    icon: GitBranch,
    description: "Branch on the order total.",
    fields: [
      {
        key: "operator",
        label: "Operator",
        type: "select",
        options: ["greater than", "less than", "equal to"],
        default: "greater than",
      },
      { key: "amount", label: "Amount", type: "number", default: "100" },
    ],
  },
  {
    key: "if.ticket_type",
    label: "If ticket type",
    icon: GitBranch,
    description: "Branch on the purchased ticket type.",
    fields: [
      {
        key: "ticketType",
        label: "Ticket type",
        type: "text",
        default: "VIP",
      },
    ],
  },
  {
    key: "if.has_tag",
    label: "If has tag",
    icon: GitBranch,
    description: "Branch on whether the contact has a tag.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
];

// --- Action catalog ----------------------------------------------------------
// Action steps (kind "action"). `fields` drives the inline config controls.

export const ACTION_CATALOG = [
  // Messaging & tagging
  {
    key: "send.email",
    label: "Send email",
    icon: Mail,
    group: "Messaging & tagging",
    description: "Send a templated email to the contact.",
    fields: [
      { key: "subject", label: "Subject", type: "text", default: "" },
      {
        key: "template",
        label: "Template",
        type: "select",
        options: ["Welcome", "Reminder", "Thank you", "Custom"],
        default: "Welcome",
      },
    ],
  },
  {
    key: "send.sms",
    label: "Send SMS",
    icon: MessageSquare,
    group: "Messaging & tagging",
    description: "Send a text message to the contact.",
    fields: [{ key: "message", label: "Message", type: "textarea", default: "" }],
  },
  {
    key: "tag.add",
    label: "Add tag",
    icon: Tag,
    group: "Messaging & tagging",
    description: "Add a tag to the contact.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "tag.remove",
    label: "Remove tag",
    icon: Tag,
    group: "Messaging & tagging",
    description: "Remove a tag from the contact.",
    fields: [{ key: "tag", label: "Tag", type: "text", default: "" }],
  },
  {
    key: "segment.add",
    label: "Add to segment",
    icon: ListChecks,
    group: "Messaging & tagging",
    description: "Add the contact to a segment.",
    fields: [{ key: "segment", label: "Segment", type: "text", default: "" }],
  },
  {
    key: "staff.notify",
    label: "Notify staff",
    icon: Bell,
    group: "Messaging & tagging",
    description: "Send an internal notification to your team.",
    fields: [
      { key: "channel", label: "Channel", type: "text", default: "#events" },
      { key: "message", label: "Message", type: "textarea", default: "" },
    ],
  },
  // Advanced
  {
    key: "flow.wait",
    label: "Wait / delay",
    icon: Timer,
    group: "Advanced",
    description: "Pause the workflow before the next step.",
    fields: [
      { key: "amount", label: "Amount", type: "number", default: "1" },
      {
        key: "unit",
        label: "Unit",
        type: "select",
        options: ["minutes", "hours", "days"],
        default: "hours",
      },
    ],
  },
  {
    key: "http.webhook",
    label: "Webhook",
    icon: Webhook,
    group: "Advanced",
    description: "Make an HTTP request to an external URL.",
    fields: [
      {
        key: "method",
        label: "Method",
        type: "select",
        options: ["POST", "GET", "PUT"],
        default: "POST",
      },
      { key: "url", label: "URL", type: "text", default: "https://" },
    ],
  },
  {
    key: "field.update",
    label: "Update field",
    icon: PencilLine,
    group: "Advanced",
    description: "Update a field on the contact or order.",
    fields: [
      { key: "field", label: "Field", type: "text", default: "" },
      { key: "value", label: "Value", type: "text", default: "" },
    ],
  },
  {
    key: "task.create",
    label: "Create task",
    icon: CheckSquare,
    group: "Advanced",
    description: "Create a follow-up task for your team.",
    fields: [
      { key: "title", label: "Task title", type: "text", default: "" },
      { key: "assignee", label: "Assignee", type: "text", default: "" },
    ],
  },
];

// --- Catalog helpers ---------------------------------------------------------

// Every catalog entry indexed by key, for O(1) lookup in renderers.
const ALL_ENTRIES = [
  ...TRIGGER_CATALOG,
  ...CONDITION_CATALOG,
  ...ACTION_CATALOG,
];
const ENTRY_BY_KEY = Object.fromEntries(ALL_ENTRIES.map((e) => [e.key, e]));

export function catalogEntry(key) {
  return ENTRY_BY_KEY[key] || null;
}

// Trigger filter options for the All Workflows toolbar (catalog + "all").
export const TRIGGER_FILTER_OPTIONS = [
  { value: "all", label: "All triggers" },
  ...TRIGGER_CATALOG.map((t) => ({ value: t.key, label: t.label })),
];

// Group an array of catalog entries by their `group` for grouped pickers.
export function groupByGroup(entries) {
  const groups = [];
  const index = new Map();
  for (const entry of entries) {
    const name = entry.group || "Other";
    if (!index.has(name)) {
      index.set(name, { group: name, items: [] });
      groups.push(index.get(name));
    }
    index.get(name).items.push(entry);
  }
  return groups;
}

// Default config for a freshly-added step: each field's `default`.
export function defaultConfig(entry) {
  const config = {};
  for (const field of entry?.fields || []) {
    config[field.key] = field.default ?? "";
  }
  return config;
}

// A short, human-readable one-line summary of a step's config — shown on canvas
// nodes and step cards. Falls back to the entry's description when empty.
export function summarizeConfig(entry, config) {
  if (!entry?.fields?.length) return entry?.description || "";
  const parts = entry.fields
    .map((f) => {
      const v = config?.[f.key];
      if (v === undefined || v === null || v === "") return null;
      return `${f.label}: ${v}`;
    })
    .filter(Boolean);
  return parts.length ? parts.join(" · ") : entry?.description || "Not configured";
}

// --- Template gallery --------------------------------------------------------
// Curated starter workflows shown on the Workflow Templates tab. Config, not row
// data — a fixed catalog (like the trigger/action catalogs above). "Use" mints a
// real workflow from `trigger` + `steps` and opens it in the builder. Each step
// is { kind, type, config }; the trigger is always steps[0]. Card icons come from
// the trigger's catalog entry, so templates never store their own icon.

export const WORKFLOW_TEMPLATE_CATEGORY_MAP = {
  Ticketing: { label: "Ticketing", variant: "info" },
  Engagement: { label: "Engagement", variant: "purple" },
  Operations: { label: "Operations", variant: "neutral" },
  Reminders: { label: "Reminders", variant: "warning" },
};

export const WORKFLOW_TEMPLATE_CATEGORY_OPTIONS = [
  { value: "all", label: "All categories" },
  { value: "Ticketing", label: "Ticketing" },
  { value: "Engagement", label: "Engagement" },
  { value: "Operations", label: "Operations" },
  { value: "Reminders", label: "Reminders" },
];

export const WORKFLOW_TEMPLATES = [
  {
    id: "tmpl_vip_welcome",
    name: "VIP welcome on purchase",
    description:
      "When a VIP buys a ticket, send them a tailored welcome email right away.",
    category: "Ticketing",
    trigger: "ticket.purchased",
    steps: [
      { kind: "trigger", type: "ticket.purchased", config: {} },
      {
        kind: "condition",
        type: "if.buyer_attribute",
        config: { attribute: "Is VIP" },
      },
      {
        kind: "action",
        type: "send.email",
        config: { subject: "Welcome, VIP!", template: "Welcome" },
      },
    ],
  },
  {
    id: "tmpl_checkin_thanks",
    name: "Thank-you after check-in",
    description:
      "Email attendees a thank-you the moment they're checked in at the door.",
    category: "Engagement",
    trigger: "attendee.checked_in",
    steps: [
      { kind: "trigger", type: "attendee.checked_in", config: {} },
      {
        kind: "action",
        type: "send.email",
        config: { subject: "Thanks for coming!", template: "Thank you" },
      },
    ],
  },
  {
    id: "tmpl_waitlist_notify",
    name: "Waitlist notification",
    description:
      "Text someone as soon as they join the waitlist and tag them for follow-up.",
    category: "Operations",
    trigger: "waitlist.joined",
    steps: [
      { kind: "trigger", type: "waitlist.joined", config: {} },
      {
        kind: "action",
        type: "send.sms",
        config: { message: "You're on the waitlist — we'll be in touch soon." },
      },
      { kind: "action", type: "tag.add", config: { tag: "Waitlisted" } },
    ],
  },
  {
    id: "tmpl_event_reminder",
    name: "Event reminder",
    description:
      "Send a reminder email to registrants shortly before the event starts.",
    category: "Reminders",
    trigger: "event.starting_soon",
    steps: [
      { kind: "trigger", type: "event.starting_soon", config: {} },
      {
        kind: "action",
        type: "send.email",
        config: { subject: "Starting soon", template: "Reminder" },
      },
    ],
  },
  {
    id: "tmpl_failed_payment",
    name: "Failed payment recovery",
    description:
      "Nudge the buyer to retry a failed payment and alert your team to follow up.",
    category: "Ticketing",
    trigger: "payment.failed",
    steps: [
      { kind: "trigger", type: "payment.failed", config: {} },
      {
        kind: "action",
        type: "send.email",
        config: { subject: "Payment didn't go through", template: "Custom" },
      },
      {
        kind: "action",
        type: "staff.notify",
        config: { channel: "#payments", message: "A payment failed — check the order." },
      },
    ],
  },
  {
    id: "tmpl_big_spender",
    name: "Big-spender alert",
    description:
      "Flag high-value orders to your team and tag the buyer for VIP treatment.",
    category: "Operations",
    trigger: "ticket.purchased",
    steps: [
      { kind: "trigger", type: "ticket.purchased", config: {} },
      {
        kind: "condition",
        type: "if.order_amount",
        config: { operator: "greater than", amount: "250" },
      },
      {
        kind: "action",
        type: "staff.notify",
        config: { channel: "#events", message: "High-value order just came in." },
      },
      { kind: "action", type: "tag.add", config: { tag: "High value" } },
    ],
  },
];

// --- Run history -------------------------------------------------------------
// Outcome of a single workflow execution. No runner exists yet, so the Run
// History screen reads an (empty) events.workflow_runs table and shows its empty
// state until executions land.

export const RUN_STATUS_MAP = {
  Success: { label: "Success", variant: "success", dotClass: "bg-emerald-400" },
  Failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
  Running: { label: "Running", variant: "info", dotClass: "bg-sky-400" },
  Skipped: { label: "Skipped", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const RUN_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Success", label: "Success" },
  { value: "Failed", label: "Failed" },
  { value: "Running", label: "Running" },
  { value: "Skipped", label: "Skipped" },
];

// --- Formatters --------------------------------------------------------------

export function formatRelativeDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Date + time, for run timestamps (runs are finer-grained than workflows).
export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Human-readable run duration from milliseconds.
export function formatDuration(ms) {
  const n = Number(ms);
  if (!n || Number.isNaN(n) || n < 0) return "—";
  if (n < 1000) return `${Math.round(n)}ms`;
  const s = n / 1000;
  if (s < 60) return `${s.toFixed(s < 10 ? 1 : 0)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}
