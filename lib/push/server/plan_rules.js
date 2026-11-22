import { eventStart } from "./time.js";

// Pure reminder planning: which reminders fall due in this planner window, as enqueue_rows payloads.

// The planner runs every 5 min; looking 10 min ahead and 15 min back means nothing falls between runs or a short outage.
export const AHEAD_MS = 10 * 60000;
export const GRACE_MS = 15 * 60000;

export function inWindow(fireAt, now) {
  const t = fireAt instanceof Date ? fireAt.getTime() : new Date(fireAt).getTime();
  const n = now.getTime();
  return Number.isFinite(t) && t >= n - GRACE_MS && t < n + AHEAD_MS;
}

// Offsets (minutes before start) of one event that fall due now; hour-level offsets need a real start time.
export function dueEventOffsets(event, offsets, now) {
  const { start, hasTime } = eventStart(event);
  if (!start || start.getTime() <= now.getTime()) return { start, due: [] };
  const due = (offsets || []).filter((m) => (hasTime || m >= 1440) && inWindow(new Date(start.getTime() - m * 60000), now));
  return { start, due };
}

// holders: [{ memberId, orderId|null }] (one entry per member). Keys carry the start, so a rescheduled event reminds again.
export function eventReminderRows(event, start, offset, holders) {
  const fireAt = new Date(start.getTime() - offset * 60000).toISOString();
  return holders.map((h) => ({
    member: h.memberId,
    project: event.project_id || null,
    event: event.id,
    type: "event_starting",
    ref: { eventId: event.id, offset, orderId: h.orderId || null },
    dedupe: `event_starting:${event.id}:${offset}:${start.toISOString()}:${h.memberId}`,
    sendAfter: fireAt,
    expiresAt: start.toISOString(),
  }));
}

export function meetingReminderRows(meeting, now) {
  const start = new Date(meeting.starts_at);
  const fireAt = new Date(start.getTime() - 10 * 60000);
  if (meeting.status !== "scheduled" || !inWindow(fireAt, now) || start.getTime() <= now.getTime()) return [];
  return (meeting.participants || []).map((memberId) => ({
    member: memberId,
    project: meeting.project_id || null,
    event: meeting.event_id || null,
    type: "meeting_soon",
    ref: { meetingId: meeting.id },
    dedupe: `meeting_soon:${meeting.id}:${start.toISOString()}:${memberId}`,
    sendAfter: fireAt.toISOString(),
    expiresAt: start.toISOString(),
  }));
}

// One membership row -> expiring (per lead day in the window) and expired rows for its member.
export function membershipReminderRows(membership, memberId, days, now) {
  if (!memberId || !membership.expires_at || membership.status !== "Active") return [];
  const expires = new Date(membership.expires_at);
  const rows = [];
  for (const d of days || []) {
    const fireAt = new Date(expires.getTime() - d * 86400000);
    if (!inWindow(fireAt, now) || expires.getTime() <= now.getTime()) continue;
    rows.push({
      member: memberId,
      project: membership.project_id || null,
      event: null,
      type: "membership_expiring",
      ref: { membershipMemberId: membership.id, days: d },
      dedupe: `membership_expiring:${membership.id}:${d}:${expires.toISOString()}:${memberId}`,
      sendAfter: fireAt.toISOString(),
      expiresAt: expires.toISOString(),
    });
  }
  if (expires.getTime() <= now.getTime() && now.getTime() - expires.getTime() < 86400000) {
    rows.push({
      member: memberId,
      project: membership.project_id || null,
      event: null,
      type: "membership_expired",
      ref: { membershipMemberId: membership.id },
      dedupe: `membership_expired:${membership.id}:${expires.toISOString()}:${memberId}`,
      sendAfter: expires.toISOString(),
      expiresAt: new Date(expires.getTime() + 2 * 86400000).toISOString(),
    });
  }
  return rows;
}

export function liveRoomRows(room, memberIds) {
  const start = new Date(room.starts_at);
  return memberIds.map((memberId) => ({
    member: memberId,
    project: room.project_id || null,
    event: null,
    type: "live_starting",
    ref: { roomId: room.id },
    dedupe: `live_starting:${room.id}:${start.toISOString()}:${memberId}`,
    sendAfter: start.toISOString(),
    expiresAt: new Date(start.getTime() + 30 * 60000).toISOString(),
  }));
}
