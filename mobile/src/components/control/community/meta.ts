import type { StatusMeta } from "@/lib/status";
import type { BoardTopicStatus, MeetingStatus } from "@/types/control_community";

// Status labels and tones, matching the dashboard's community status maps.

export const TOPIC_STATUS_META: Record<BoardTopicStatus, StatusMeta> = {
  published: { label: "Published", tone: "success" },
  pending: { label: "Awaiting approval", tone: "warning" },
  hidden: { label: "Hidden", tone: "neutral" },
};

export const MEETING_STATUS_META: Record<MeetingStatus, StatusMeta> = {
  scheduled: { label: "Scheduled", tone: "info" },
  completed: { label: "Completed", tone: "success" },
  no_show: { label: "No-show", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export const REQUEST_STATUS_META: Record<string, StatusMeta> = {
  pending: { label: "Pending", tone: "warning" },
  accepted: { label: "Accepted", tone: "success" },
  declined: { label: "Declined", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  expired: { label: "Expired", tone: "neutral" },
};
