import { REENTRY_RULES_LIST } from "./constants.js";
import { ApiError } from "../../staff_access/errors.js";

// Capacity caps per area (events.checkin_capacity), validated the way the dashboard's saveCapacityRule normalises them.

function invalid(message, key) {
  return new ApiError("invalid_input", 400, message, key ? { [key]: message } : undefined);
}

export function parseCapacityRule(body) {
  if (!body || typeof body !== "object") throw invalid("Send the cap to save.");
  const zoneKey = String(body.zoneKey ?? "").slice(0, 200);
  const zoneName = String(body.zoneName ?? "").trim().slice(0, 200);
  let hardCap = null;
  if (body.hardCap !== null && body.hardCap !== undefined && body.hardCap !== "") {
    const n = Number(body.hardCap);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw invalid("The cap must be a whole number, 0 or more, or empty for no cap.", "hardCap");
    hardCap = Math.round(n);
  }
  const warn = body.warnPct === undefined ? 85 : Number(body.warnPct);
  if (!Number.isFinite(warn) || warn < 1 || warn > 100) throw invalid("The warning level must be 1–100%.", "warnPct");
  const reentry = body.reentry ?? "inherit";
  if (!REENTRY_RULES_LIST.includes(reentry)) throw invalid("Re-entry must be inherit, once or multi.", "reentry");
  return { zone_key: zoneKey, zone_name: zoneName, hard_cap: hardCap, warn_pct: Math.round(warn), reentry, deleted_at: null };
}

export function ruleFromRow(row) {
  return {
    id: row.id,
    zoneKey: row.zone_key ?? "",
    zoneName: row.zone_name ?? "",
    hardCap: row.hard_cap === null || row.hard_cap === undefined ? null : Number(row.hard_cap),
    warnPct: Number(row.warn_pct ?? 85),
    reentry: REENTRY_RULES_LIST.includes(row.reentry) ? row.reentry : "inherit",
    updatedAt: row.updated_at ?? null,
  };
}

export function occupancyFromRow(row) {
  return {
    nameKey: row.zone_key ?? "",
    zone: row.zone ?? "",
    admitted: Number(row.admitted ?? 0),
    exited: Number(row.exited ?? 0),
    occupancy: Number(row.occupancy ?? 0),
    overCapacityAdmits: Number(row.over_capacity_admits ?? 0),
    offlineAdmits: Number(row.offline_admits ?? 0),
    lastMovementAt: row.last_movement_at ?? null,
  };
}

// A zone card trimmed to what the phone draws; the rule's zone key is what a save must update.
export function cardView(card) {
  return {
    key: card.key,
    saveKey: card.rule?.zoneKey ?? card.key,
    name: card.name,
    venue: Boolean(card.venue),
    unlisted: Boolean(card.unlisted),
    cap: card.cap,
    warnPct: card.warnPct,
    reentry: card.reentry,
    occupancy: card.occupancy,
    admitted: card.admitted,
    exited: card.exited,
    overCapacityAdmits: card.overCapacityAdmits,
    level: card.level,
    pct: card.pct,
    lastMovementAt: card.lastMovementAt,
  };
}

export function overrideView(row) {
  return {
    id: row.id,
    zone: row.zone ?? "",
    attendeeName: row.attendee_name ?? "",
    partySize: Number(row.party_size ?? 1),
    occupancy: Number(row.occupancy ?? 0),
    cap: Number(row.cap ?? 0),
    reason: row.reason ?? "",
    roleName: row.role_name ?? "",
    staff: row.staff ?? "",
    createdAt: row.created_at ?? null,
  };
}
