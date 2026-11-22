import { randomInt } from "node:crypto";

import { ApiError } from "../../staff_access/errors.js";

// Staff scanning roles (events.checkin_staff_roles), as the dashboard's Staff Scanning Roles screen edits them.

// Issue-desk roles belong to Inventory's Issuing Staff, so Control's check-in list keeps to the door and kiosk.
export const ROLE_TYPES = ["staff", "kiosk"];
const CODE = /^[A-Za-z0-9]{4,12}$/;

function invalid(message, key) {
  return new ApiError("invalid_input", 400, message, key ? { [key]: message } : undefined);
}

export function defaultPermissions() {
  return { canScan: true, canSell: false, canOverride: false, gates: [], zones: [] };
}

// Six digits, the same shape the dashboard generates, so staff can type it on any keypad.
export function generateCode() {
  return String(randomInt(100000, 1000000));
}

function idList(value, key) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > 100) throw invalid(`${key} must be a list.`, key);
  return [...new Set(value.map((v) => String(v ?? "").trim()).filter(Boolean).map((v) => v.slice(0, 100)))];
}

function bool(value, key) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") throw invalid(`${key} must be on or off.`, key);
  return value;
}

export function roleView(row) {
  const p = row.permissions && typeof row.permissions === "object" ? row.permissions : {};
  return {
    id: row.id,
    name: row.name || "Untitled role",
    type: ROLE_TYPES.includes(row.type) ? row.type : "staff",
    accessCode: row.access_code || "",
    active: row.active !== false,
    permissions: {
      canScan: p.canScan !== false,
      canSell: Boolean(p.canSell),
      canOverride: Boolean(p.canOverride),
      gates: Array.isArray(p.gates) ? p.gates.map(String) : [],
      zones: Array.isArray(p.zones) ? p.zones.map(String) : [],
    },
    createdAt: row.created_at ?? null,
  };
}

// The app's body → a row; permissions merge over what's stored so flags the app doesn't show survive.
export function parseRole(body, { current = null } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid("Send the role to save.");
  const row = {};
  if ("name" in body || !current) {
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 120) throw invalid("Give the role a name of up to 120 characters.", "name");
    row.name = name;
  }
  if ("type" in body || !current) {
    const type = body.type ?? "staff";
    if (!ROLE_TYPES.includes(type)) throw invalid("Type must be staff or kiosk.", "type");
    row.type = type;
  }
  if ("accessCode" in body) {
    const code = String(body.accessCode ?? "").trim();
    if (!CODE.test(code)) throw invalid("The access code must be 4–12 letters or digits.", "accessCode");
    row.access_code = code;
  } else if (!current) {
    row.access_code = generateCode();
  }
  if ("active" in body) row.active = bool(body.active, "active");
  if (body.permissions !== undefined) {
    const p = body.permissions;
    if (!p || typeof p !== "object" || Array.isArray(p)) throw invalid("Permissions must be an object.", "permissions");
    const stored = current?.permissions && typeof current.permissions === "object" ? current.permissions : defaultPermissions();
    const next = { ...stored };
    for (const key of ["canScan", "canSell", "canOverride"]) {
      const value = bool(p[key], key);
      if (value !== undefined) next[key] = value;
    }
    for (const key of ["gates", "zones"]) {
      const list = idList(p[key], key);
      if (list !== undefined) next[key] = list;
    }
    row.permissions = next;
  } else if (!current) {
    row.permissions = defaultPermissions();
  }
  if (current && !Object.keys(row).length) throw invalid("Send at least one change.");
  return row;
}
