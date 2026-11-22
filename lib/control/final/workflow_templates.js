// Workflow templates, ported as data from components/internal/screens/workflows/constants.js (that file imports
// lucide-react icons, so it can't load on the server). final.test.js fails if an id, trigger or name drifts.

export const TEMPLATE_SOURCE = "components/internal/screens/workflows/constants.js";

export const TEMPLATE_CATEGORIES = ["Ticketing", "Engagement", "Operations", "Reminders"];

export const TRIGGER_LABELS = {
  "ticket.purchased": "Ticket purchased",
  "payment.failed": "Payment failed",
  "attendee.checked_in": "Attendee checked in",
  "waitlist.joined": "Waitlist joined",
  "event.starting_soon": "Event starting soon",
};

export const WORKFLOW_TEMPLATES = [
  {
    id: "tmpl_vip_welcome",
    name: "VIP welcome on purchase",
    description: "When a VIP buys a ticket, send them a tailored welcome email right away.",
    category: "Ticketing",
    trigger: "ticket.purchased",
    steps: [
      { kind: "trigger", type: "ticket.purchased", config: {} },
      { kind: "condition", type: "if.buyer_attribute", config: { attribute: "Is VIP" } },
      { kind: "action", type: "send.email", config: { subject: "Welcome, VIP!", template: "Welcome" } },
    ],
  },
  {
    id: "tmpl_checkin_thanks",
    name: "Thank-you after check-in",
    description: "Email attendees a thank-you the moment they're checked in at the door.",
    category: "Engagement",
    trigger: "attendee.checked_in",
    steps: [
      { kind: "trigger", type: "attendee.checked_in", config: {} },
      { kind: "action", type: "send.email", config: { subject: "Thanks for coming!", template: "Thank you" } },
    ],
  },
  {
    id: "tmpl_waitlist_notify",
    name: "Waitlist notification",
    description: "Text someone as soon as they join the waitlist and tag them for follow-up.",
    category: "Operations",
    trigger: "waitlist.joined",
    steps: [
      { kind: "trigger", type: "waitlist.joined", config: {} },
      { kind: "action", type: "send.sms", config: { message: "You're on the waitlist — we'll be in touch soon." } },
      { kind: "action", type: "tag.add", config: { tag: "Waitlisted" } },
    ],
  },
  {
    id: "tmpl_event_reminder",
    name: "Event reminder",
    description: "Send a reminder email to registrants shortly before the event starts.",
    category: "Reminders",
    trigger: "event.starting_soon",
    steps: [
      { kind: "trigger", type: "event.starting_soon", config: {} },
      { kind: "action", type: "send.email", config: { subject: "Starting soon", template: "Reminder" } },
    ],
  },
  {
    id: "tmpl_failed_payment",
    name: "Failed payment recovery",
    description: "Nudge the buyer to retry a failed payment and alert your team to follow up.",
    category: "Ticketing",
    trigger: "payment.failed",
    steps: [
      { kind: "trigger", type: "payment.failed", config: {} },
      { kind: "action", type: "send.email", config: { subject: "Payment didn't go through", template: "Custom" } },
      { kind: "action", type: "staff.notify", config: { channel: "#payments", message: "A payment failed — check the order." } },
    ],
  },
  {
    id: "tmpl_big_spender",
    name: "Big-spender alert",
    description: "Flag high-value orders to your team and tag the buyer for VIP treatment.",
    category: "Operations",
    trigger: "ticket.purchased",
    steps: [
      { kind: "trigger", type: "ticket.purchased", config: {} },
      { kind: "condition", type: "if.order_amount", config: { operator: "greater than", amount: "250" } },
      { kind: "action", type: "staff.notify", config: { channel: "#events", message: "High-value order just came in." } },
      { kind: "action", type: "tag.add", config: { tag: "High value" } },
    ],
  },
];

export function templateView(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    category: t.category,
    trigger: t.trigger,
    triggerLabel: TRIGGER_LABELS[t.trigger] || t.trigger,
    // The dashboard counts the steps after the trigger.
    steps: Math.max(0, (t.steps?.length || 1) - 1),
  };
}

// The workflows row the dashboard's "Use template" inserts: a Draft with real step ids and canvas positions.
export function workflowFromTemplate(template, { projectId, userId, newId }) {
  return {
    id: newId(),
    name: template.name,
    description: template.description,
    status: "Draft",
    trigger: template.trigger,
    scope: "workspace",
    event_id: null,
    steps: template.steps.map((s, i) => ({
      id: `step_${newId()}`,
      kind: s.kind,
      type: s.type,
      config: { ...(s.config || {}) },
      position: { x: 0, y: i * 140 },
    })),
    graph: {},
    view_mode: "canvas",
    run_count: 0,
    last_run_at: null,
    created_by: userId,
    project_id: projectId,
  };
}
