// Booking RPC/trigger error codes -> words an attendee or organiser can act on.

const MESSAGES = {
  PERSON_BUSY: "One of you already has a meeting at that time.",
  PERSON_BLOCKED: "One of you has marked that time as unavailable.",
  LOCATION_FULL: "That location is fully booked at that time.",
  NO_LOCATION: "Every meeting location is booked at that time — pick another slot.",
  UNKNOWN_LOCATION: "That location no longer exists. Pick another one.",
  LIMIT_REACHED: "One of you has reached the meeting limit for this event.",
  MEETINGS_DISABLED: "Networking isn't open for this event.",
  NOT_PENDING: "This request has already been answered.",
  REQUEST_NOT_FOUND: "That request no longer exists.",
  MEETING_NOT_FOUND: "That meeting no longer exists.",
  NOT_SCHEDULED: "Only scheduled meetings can be moved.",
  INVALID_SLOT: "That time slot isn't valid.",
  NEED_TWO_PEOPLE: "Pick two different attendees.",
  UNKNOWN_ATTENDEE: "One of those attendees no longer has a portal account.",
  EVENT_NOT_FOUND: "That event no longer exists.",
  FORBIDDEN: "You can't do that.",
};

export function meetingErrorCode(error) {
  const text = String(error?.message || error || "");
  return Object.keys(MESSAGES).find((code) => text.includes(code)) || null;
}

export function meetingErrorMessage(error, fallback = "Something went wrong. Try again.") {
  const code = meetingErrorCode(error);
  return code ? MESSAGES[code] : fallback;
}
