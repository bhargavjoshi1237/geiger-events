import {
  Mail,
  MessageSquare,
  MessageCircle,
  BellRing,
} from "lucide-react";

export const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
};

export const CHANNEL_MAP = {
  email: { label: "Email", icon: Mail, variant: "info", dotClass: "bg-sky-400" },
  sms: { label: "SMS", icon: MessageSquare, variant: "success", dotClass: "bg-emerald-400" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, variant: "success", dotClass: "bg-teal-400" },
  push: { label: "Push", icon: BellRing, variant: "purple", dotClass: "bg-violet-400" },
};

export const CHANNEL_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "sms", label: "SMS" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "push", label: "Push notification" },
];

export const CHANNEL_FILTER_OPTIONS = [
  { value: "all", label: "All channels" },
  ...CHANNEL_OPTIONS,
];

export const TYPE_MAP = {
  newsletter: { label: "Newsletter", variant: "neutral" },
  invite: { label: "Invite", variant: "purple" },
  reminder: { label: "Reminder", variant: "warning" },
  blast: { label: "Blast", variant: "info" },
  announcement: { label: "Announcement", variant: "neutral" },
};

export const TYPE_OPTIONS = [
  { value: "newsletter", label: "Newsletter" },
  { value: "invite", label: "Invite" },
  { value: "reminder", label: "Reminder" },
  { value: "blast", label: "Blast" },
  { value: "announcement", label: "Announcement" },
];

export const CAMPAIGN_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  scheduled: { label: "Scheduled", variant: "warning", dotClass: "bg-amber-400" },
  sending: { label: "Sending", variant: "info", dotClass: "bg-sky-400" },
  sent: { label: "Sent", variant: "success", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", variant: "outline", dotClass: "bg-zinc-600" },
};

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "sent", label: "Sent" },
  { value: "paused", label: "Paused" },
];

export const defaultContent = (channel = "email") => {
  const base = { templateId: "", sequenceId: "" };
  if (channel === "email")
    return { ...base, subject: "", previewText: "", body: "" };
  if (channel === "push") return { ...base, pushTitle: "", body: "" };
  return { ...base, body: "" };
};

export const defaultAb = () => ({
  enabled: false,
  metric: "opens",
  split: 50,
  variantB: { subject: "", body: "" },
  winner: "",
});

export const defaultMetrics = () => ({
  recipients: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  unsubscribed: 0,
});

export const defaultDeliverability = () => ({
  fromName: "",
  fromEmail: "",
  replyTo: "",
  sendingDomain: "",
  domainVerified: false,
  dkim: false,
  spf: false,
  footerAddress: "",
  unsubscribeText: "Unsubscribe from these emails",
  smsSenderId: "",
  dailyCap: 0,
});

export const defaultPersonalization = () => ({
  greeting: "Hi {{first_name}},",
  fallbackName: "there",
  tone: "friendly",
  includeUnsubscribe: true,
  timezoneAware: true,
});

export const SETTINGS_DEFAULTS = {
  deliverability: defaultDeliverability,
  personalization: defaultPersonalization,
};

export const withSettingsDefaults = (config, feature) => ({
  ...(SETTINGS_DEFAULTS[feature]?.() || {}),
  ...(config?.[feature] || {}),
});

export const TONE_OPTIONS = [
  { value: "friendly", label: "Friendly" },
  { value: "formal", label: "Formal" },
  { value: "playful", label: "Playful" },
];

export const AB_METRIC_OPTIONS = [
  { value: "opens", label: "Open rate" },
  { value: "clicks", label: "Click rate" },
];

export const MERGE_TAGS = [
  { tag: "{{first_name}}", label: "First name" },
  { tag: "{{last_name}}", label: "Last name" },
  { tag: "{{full_name}}", label: "Full name" },
  { tag: "{{email}}", label: "Email" },
  { tag: "{{event_name}}", label: "Event name" },
  { tag: "{{event_date}}", label: "Event date" },
  { tag: "{{venue}}", label: "Venue" },
  { tag: "{{ticket_type}}", label: "Ticket type" },
  { tag: "{{organizer}}", label: "Organizer" },
];

export const defaultTemplateConfig = () => ({
  subject: "",
  previewText: "",
  body: "",
  category: "general",
});

export const defaultSequenceConfig = () => ({
  trigger: "registration",
  steps: [
    { id: "s1", channel: "email", delayDays: 0, subject: "", body: "" },
  ],
});

export const TEMPLATE_CATEGORY_OPTIONS = [
  { value: "general", label: "General" },
  { value: "invite", label: "Invite" },
  { value: "reminder", label: "Reminder" },
  { value: "receipt", label: "Receipt" },
  { value: "announcement", label: "Announcement" },
];

export const SEQUENCE_TRIGGER_OPTIONS = [
  { value: "registration", label: "On registration" },
  { value: "rsvp", label: "On RSVP" },
  { value: "date", label: "Relative to event date" },
  { value: "manual", label: "Manual enrolment" },
];

export const LENS = {
  Newsletters: {
    channel: "email",
    type: "newsletter",
    lockChannel: true,
    title: "Newsletters",
    description:
      "Broadcast email updates to your audience — announcements, recaps, and regular sends.",
  },
  "Email Invites": {
    channel: "email",
    type: "invite",
    lockChannel: true,
    title: "Email Invites",
    description: "Invite contacts to an event by email with a personal RSVP link.",
  },
  "SMS Invites": {
    channel: "sms",
    type: "invite",
    lockChannel: true,
    title: "SMS Invites",
    description: "Short, high-open-rate text invites straight to your contacts' phones.",
  },
  "WhatsApp Invites": {
    channel: "whatsapp",
    type: "invite",
    lockChannel: true,
    title: "WhatsApp Invites",
    description: "Rich WhatsApp invites with your event details and a one-tap RSVP.",
  },
  "Text Blasts": {
    channel: "sms",
    type: "blast",
    lockChannel: true,
    title: "Text Blasts",
    description: "Send a single SMS to a whole segment at once — reminders, alerts, day-of updates.",
  },
  "Automated Reminders": {
    type: "reminder",
    title: "Automated Reminders",
    description:
      "Scheduled reminders that go out before an event — pick the channel, audience, and timing.",
    banner:
      "Reminders are scheduled campaigns of type “Reminder”. Set the send time on each reminder’s Schedule; recurring, per-event automation lives in Workflows.",
  },
  "Push Notifications": {
    channel: "push",
    type: "announcement",
    lockChannel: true,
    title: "Push Notifications",
    description: "Send app push notifications to attendees — session alerts, updates, and nudges.",
  },
  "A/B Testing": {
    abOnly: true,
    title: "A/B Testing",
    description:
      "Campaigns running an A/B test. Compare two variants and pick a winner by open or click rate.",
    banner:
      "A/B testing is configured per campaign — open any email or SMS campaign and turn on the A/B section to add a second variant and a split.",
  },
  "Send Scheduling": {
    scheduledOnly: true,
    title: "Send Scheduling",
    description: "Everything queued to go out — your upcoming scheduled sends, soonest first.",
    banner:
      "Scheduling is set on each campaign’s Schedule section. This view lists every campaign with a future send time.",
  },
};
