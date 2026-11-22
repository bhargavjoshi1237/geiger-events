import { BADGE_STATUSES, BADGE_TARGETS } from "./constants.js";
import { ApiError } from "../../staff_access/errors.js";

// View models for leads and smart badges, plus the badge status change the app may ask for.

const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export function leadView(row, eventName = "") {
  const contact = obj(row.contact);
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    eventName,
    exhibitor: row.exhibitor ?? "",
    name: row.attendee_name ?? "",
    email: String(contact.email ?? ""),
    phone: String(contact.phone ?? ""),
    company: String(contact.company ?? ""),
    title: String(contact.title ?? ""),
    notes: String(contact.notes ?? ""),
    capturedAt: row.captured_at ?? null,
  };
}

export function badgeView(row) {
  const meta = obj(row.metadata);
  const holder = obj(meta.holder);
  const status = BADGE_STATUSES.includes(row.status) ? row.status : row.active === false ? "revoked" : "active";
  return {
    id: row.id,
    serial: row.serial ?? "",
    label: row.label ?? "",
    uid: row.nfc_uid ?? "",
    status,
    holderName: String(holder.name ?? ""),
    holderEmail: String(holder.email ?? ""),
    notes: row.notes ?? "",
    issuedAt: row.issued_at ?? row.created_at ?? null,
  };
}

// The status moves the dashboard's badge drawer offers: mark lost or revoked, or reactivate a lost or revoked badge.
export function parseBadgeStatus(body, current) {
  const status = body?.status;
  if (!BADGE_TARGETS.includes(status)) throw new ApiError("invalid_input", 400, "Status must be active, lost or revoked.");
  if (status === "active" && !["lost", "revoked"].includes(current)) {
    throw new ApiError("invalid_state", 409, "Only a lost or revoked badge can be reactivated.");
  }
  if (status === current) throw new ApiError("invalid_state", 409, `This badge is already ${current}.`);
  // As the drawer offers them: an active badge can be lost, and a live, spare or lost badge can be revoked.
  const from = status === "lost" ? ["active"] : status === "revoked" ? ["active", "unassigned", "lost"] : [];
  if (status !== "active" && !from.includes(current)) {
    throw new ApiError("invalid_state", 409, `This badge is ${current}, so it can't be marked ${status}.`);
  }
  return { status, reason: String(body?.reason ?? "").trim().slice(0, 300) };
}

export function badgeCounts(rows) {
  const counts = Object.fromEntries(BADGE_STATUSES.map((s) => [s, 0]));
  for (const row of rows) counts[badgeView(row).status] += 1;
  return counts;
}
