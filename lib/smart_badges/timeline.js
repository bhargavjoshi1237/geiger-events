// Merge a badge's taps and history rows into one newest-first activity timeline. Pure.

export const PURPOSES = ["gate", "session", "lead", "payment", "info"];

const REJECT_REASONS = {
  UNASSIGNED: "badge not bound to anyone",
  LOST: "badge reported lost",
  REVOKED: "badge revoked",
  REPLACED: "badge was replaced",
  TICKET_INVALID: "ticket cancelled or refunded",
  CAPACITY_FULL: "area at capacity",
};

const STATUS_WORDS = {
  active: "active",
  unassigned: "spare",
  lost: "lost",
  revoked: "revoked",
  replaced: "replaced",
};

function tapTitle(tap, pointName) {
  const at = pointName || "a reader";
  const session = tap.sessionName || "a session";
  const exhibitor = tap.exhibitor || at;
  switch (tap.outcome) {
    case "admitted":
      return `Admitted at ${at}`;
    case "already_in":
      return tap.purpose === "session" ? `Re-tap in ${session}` : `Re-entry tap at ${at}`;
    case "checked_in":
      return `Checked into ${session}`;
    case "lead_captured":
      return `Lead captured by ${exhibitor}`;
    case "lead_repeat":
      return `Visited ${exhibitor} again`;
    case "charged":
      return `Charged at ${at}`;
    default:
      if (tap.purpose === "payment") return `Tap at ${at}`;
      if (tap.purpose === "session") return `Tapped in ${session}`;
      if (tap.purpose === "lead") return `Tapped at ${exhibitor}`;
      return `Tapped at ${at}`;
  }
}

function historyTitle(row) {
  switch (row.kind) {
    case "issued":
      return row.reason === "Chip UID recorded" ? "Chip UID recorded" : "Badge issued";
    case "bound":
      return `Bound to ${row.holderName || "an attendee"}`;
    case "rebound":
      return `Moved to ${row.holderName || "another attendee"}`;
    case "unbound":
      return `Unbound from ${row.holderName || "its holder"}`;
    case "replaced":
      return "Replaced by a new badge";
    case "deleted":
      return "Badge deleted";
    case "status":
      if (row.toStatus === "active" && (row.fromStatus === "lost" || row.fromStatus === "revoked")) return "Reactivated";
      return `Marked ${STATUS_WORDS[row.toStatus] || row.toStatus}`;
    case "tap_rejected":
      return `Refused at ${row.pointName || "a reader"}`;
    default:
      return row.kind;
  }
}

// taps: normalized nfc_taps rows; history: normalized smart_badge_events rows; points: Map(id -> point).
export function buildTimeline({ taps = [], history = [], points = new Map() } = {}) {
  const entries = [];
  for (const t of taps) {
    const point = points.get(t.entryPointId);
    const pointName = t.pointName || point?.name || "";
    entries.push({
      id: `tap:${t.id}`,
      at: t.tappedAt,
      type: "tap",
      purpose: t.purpose || "gate",
      outcome: t.outcome || (t.attendanceId ? "admitted" : "logged"),
      title: tapTitle(t, pointName),
      detail: [t.location || point?.location, t.purpose === "lead" && t.exhibitor ? pointName : ""]
        .filter(Boolean)
        .join(" · "),
      amountCents: t.amountCents,
      currency: t.currency,
      chargeStatus: t.status,
      leadId: t.leadId,
    });
  }
  for (const h of history) {
    const point = points.get(h.entryPointId);
    entries.push({
      id: `log:${h.id}`,
      at: h.occurredAt,
      type: h.kind === "tap_rejected" ? "rejected" : "history",
      kind: h.kind,
      title: historyTitle({ ...h, pointName: h.pointName || point?.name }),
      detail:
        h.kind === "tap_rejected"
          ? REJECT_REASONS[h.reason] || h.reason || ""
          : h.kind === "issued" && h.reason === "Chip UID recorded"
            ? h.uid || ""
            : h.reason || (h.kind === "rebound" && h.previousHolder ? `from ${h.previousHolder}` : ""),
    });
  }
  return entries.sort((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
}

// Headline numbers for the drawer.
export function summarizeTimeline(taps = []) {
  const sessions = new Set();
  const exhibitors = new Set();
  let entries = 0;
  let spentCents = 0;
  for (const t of taps) {
    if (t.outcome === "admitted") entries += 1;
    if (t.purpose === "session" && (t.outcome === "checked_in" || t.outcome === "already_in")) {
      sessions.add(t.sessionId || t.sessionName);
    }
    if (t.leadId) exhibitors.add(t.exhibitor || t.leadId);
    if (t.status === "pending" || t.status === "settled") spentCents += Number(t.amountCents) || 0;
  }
  return { taps: taps.length, entries, sessions: sessions.size, leads: exhibitors.size, spentCents };
}
