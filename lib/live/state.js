
export const OPENING_SOON_MS = 15 * 60 * 1000;

const MANUAL_STATES = new Set(["Live", "Ended", "Scheduled"]);

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
  if (!startsAt) return { state: "Manual", startsAt, endsAt, secondsUntilStart: null };

  if (endsAt && now >= endsAt) return { state: "Ended", startsAt, endsAt, secondsUntilStart: null };
  if (now >= startsAt) return { state: "Live", startsAt, endsAt, secondsUntilStart: null };
  if (startsAt - now <= OPENING_SOON_MS) {
    return { state: "Opening soon", startsAt, endsAt, secondsUntilStart };
  }
  return { state: "Scheduled", startsAt, endsAt, secondsUntilStart };
}

export function isOpenToAttendees(state) {
  return state === "Live" || state === "Opening soon";
}
