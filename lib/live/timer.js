// Pure breakout countdown. One clock lives on the parent session so every child
// room agrees on when the round ends.

export function breakoutTimer(record, now = Date.now()) {
  const raw = record?.config?.timerEndsAt;
  const endsAt = raw ? new Date(raw).getTime() : NaN;
  if (!Number.isFinite(endsAt)) return { running: false, secondsRemaining: 0, endsAt: null };
  const remaining = Math.max(0, Math.round((endsAt - now) / 1000));
  return {
    running: remaining > 0,
    secondsRemaining: remaining,
    endsAt: new Date(endsAt).toISOString(),
  };
}

// mm:ss for the attendee-facing countdown.
export function formatCountdown(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
