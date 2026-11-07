// Turns an engine outcome into the staff-facing feedback line: { kind, title, detail }.
// kind is one of the scanner FEEDBACK states: success | already | capacity | exit | error.

import { blockedMessage } from "../scan.js";

export const formatClock = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
};

const zoneLabel = (zone) => zone || "The venue";

export function capacityLine(o) {
  if (o?.cap === null || o?.cap === undefined || o?.occupancy === null || o?.occupancy === undefined) return "";
  return `${o.zone || "Venue"} ${Number(o.occupancy).toLocaleString("en-US")} / ${Number(o.cap).toLocaleString("en-US")}`;
}

// True when a capped scope has crossed its warning threshold.
export function nearCapacity(o) {
  if (!o?.cap || o.occupancy === null || o.occupancy === undefined) return false;
  return (o.occupancy / o.cap) * 100 >= (o.warnPct || 85);
}

export function describeOutcome(o) {
  const name = o?.name || "Attendee";
  const party = o?.party > 1 ? ` (party of ${o.party})` : "";
  const offline = o?.offline ? (o.stored === false ? "Saved in this tab only — keep it open until it syncs" : "Saved on this device — will sync") : "";
  switch (o?.kind) {
    case "success":
      return {
        kind: "success",
        title: `Admitted ${o?.name || "attendee"}${party}`,
        detail: [
          o.reentry ? "Re-entry" : "",
          o.override ? "Capacity override recorded" : "",
          capacityLine(o),
          nearCapacity(o) ? "Near capacity" : "",
          offline,
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "exit":
      return {
        kind: "exit",
        title: `Exited ${o?.name || "attendee"}${party}`,
        detail: [capacityLine(o), offline].filter(Boolean).join(" · "),
      };
    case "already": {
      const where = [
        o.firstAt ? `In at ${formatClock(o.firstAt)}` : "",
        o.firstGate || "",
        o.firstDevice ? (o.sameDevice ? "this device" : "another device") : "",
      ].filter(Boolean);
      return {
        kind: "already",
        title:
          o.reason === "no_reentry"
            ? `${name} already used this ticket — re-entry isn't allowed`
            : `${name} is already checked in`,
        detail: [where.join(" · "), o.offline ? "Checked against this device's list" : ""].filter(Boolean).join(" — "),
      };
    }
    case "notInside":
      return { kind: "already", title: `${name} isn't checked in here`, detail: o.offline ? "Checked against this device's list" : "" };
    case "capacity":
      if (o.reason === "offline_capped") {
        return {
          kind: "capacity",
          title: `${zoneLabel(o.zone)} has a hard cap`,
          detail: "Offline admits are off for capped areas — wait for signal or use a connected device",
        };
      }
      return {
        kind: "capacity",
        title: `${zoneLabel(o.zone)} is full`,
        detail: [
          `${Number(o.occupancy || 0).toLocaleString("en-US")} / ${Number(o.cap || 0).toLocaleString("en-US")} inside`,
          o.party > 1 ? `party of ${o.party}` : "",
          o.canOverride ? "A supervisor can override" : "",
        ]
          .filter(Boolean)
          .join(" · "),
      };
    case "blocked":
      return { kind: "error", title: blockedMessage(o.reason, o.name), detail: o.offline ? "Checked against this device's list" : "" };
    default:
      return { kind: "error", title: o?.message || "Couldn't record the check-in", detail: "" };
  }
}
