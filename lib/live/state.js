// Pure room-state resolution. A room's state comes from its schedule unless the
// organiser has forced one; no I/O so the portal, the organiser screens and the
// tests all agree on the same answer.

// How long before startsAt a room advertises itself as about to open.
export const OPENING_SOON_MS = 15 * 60 * 1000;

// Forced states an organiser can pin via config.manualState.
const MANUAL_STATES = new Set(["Live", "Ended", "Scheduled"]);

// Parse to epoch ms, or null. Legacy rows hold display text ("Day 1 · 09:00")
// which is relative to an event day and deliberately yields null.
function instant(value) {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
}

export function resolveRoomState(record, now = Date.now()) {
  const startsAt = instant(record?.startsAt);
  const endsAt = instant(record?.endsAt);
  const forced = record?.config?.manualState;
  const secondsUntilStart =
    startsAt && startsAt > now ? Math.round((startsAt - now) / 1000) : null;

  if (MANUAL_STATES.has(forced)) {
    return { state: forced, startsAt, endsAt, secondsUntilStart };
  }
  // No parseable schedule: the organiser drives this room by hand.
  if (!startsAt) return { state: "Manual", startsAt, endsAt, secondsUntilStart: null };

  if (endsAt && now >= endsAt) return { state: "Ended", startsAt, endsAt, secondsUntilStart: null };
  if (now >= startsAt) return { state: "Live", startsAt, endsAt, secondsUntilStart: null };
  if (startsAt - now <= OPENING_SOON_MS) {
    return { state: "Opening soon", startsAt, endsAt, secondsUntilStart };
  }
  return { state: "Scheduled", startsAt, endsAt, secondsUntilStart };
}

// True when attendees should be able to open the room at all.
export function isOpenToAttendees(state) {
  return state === "Live" || state === "Opening soon";
}
