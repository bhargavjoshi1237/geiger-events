import type { IconName } from "@/components/ui/icons";
import type { PushCategoryKey } from "@/types/portal";

// Mirrors the category catalog in ../lib/push/types.js; the key is both the member's switch and the Android channel id.

export type PushCategory = {
  key: PushCategoryKey;
  label: string;
  description: string;
  // Android channel importance: community chatter is allowed to be quieter.
  urgent: boolean;
};

export const PUSH_CATEGORIES: readonly PushCategory[] = [
  {
    key: "tickets",
    label: "Tickets & orders",
    description: "Confirmations, cancellations, refunds, registrations and check-ins.",
    urgent: true,
  },
  {
    key: "reminders",
    label: "Reminders",
    description: "Before the event, meetings, live rooms and membership renewals.",
    urgent: true,
  },
  {
    key: "updates",
    label: "Event updates",
    description: "Time, venue and cancellation changes.",
    urgent: true,
  },
  {
    key: "messages",
    label: "Messages",
    description: "Organiser replies and announcements.",
    urgent: true,
  },
  {
    key: "community",
    label: "Community & Q&A",
    description: "Replies to you, organiser posts and answers to your questions.",
    urgent: false,
  },
  {
    key: "meetings",
    label: "Meetings",
    description: "Meeting requests, confirmations and changes.",
    urgent: true,
  },
];

export type PushPreferences = Record<PushCategoryKey, boolean>;

// A missing or non-boolean key means on, matching the server's normalizeCategories.
export function normalizePreferences(raw: unknown): PushPreferences {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.fromEntries(
    PUSH_CATEGORIES.map((c) => [c.key, src[c.key] !== false]),
  ) as PushPreferences;
}

// Feed icon per notification kind: a push type key, or announcement | meeting | board from their own sources.
const KIND_ICONS: Record<string, IconName> = {
  order_confirmed: "ticket",
  ticket_gifted: "gift",
  order_cancelled: "ticket-x",
  refund_update: "receipt",
  payment_failed: "credit-card",
  registration_update: "clipboard-check",
  checked_in: "scan-line",
  event_starting: "clock",
  meeting_soon: "calendar-clock",
  live_starting: "radio",
  membership_expiring: "id-card",
  membership_expired: "id-card",
  event_changed: "map-pin",
  event_cancelled: "calendar-x",
  thread_reply: "message-square",
  announcement: "geiger",
  chat_reply: "reply",
  chat_organiser_post: "megaphone",
  qa_answer: "message-circle-question-mark",
  meeting: "users",
  meeting_request: "users",
  meeting_declined: "calendar-x",
  meeting_confirmed: "calendar-check",
  meeting_cancelled: "calendar-x",
  meeting_rescheduled: "calendar-sync",
  board: "messages-square",
};

export function notificationIcon(kind: string | null | undefined): IconName {
  return (kind && KIND_ICONS[kind]) || "geiger";
}
