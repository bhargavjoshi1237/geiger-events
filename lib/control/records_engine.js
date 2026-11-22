import { ApiError } from "../staff_access/errors.js";
import { ROOT_COLUMNS, STORES } from "./catalog/stores.js";

// Control's generic records engine: every catalog module reads and writes through these, validated against its own fields.

// The dashboard's audience and access pickers have no phone equivalent yet, so they travel read-only.
const READ_ONLY = new Set(["audience", "access", "readonly"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message, key) {
  return new ApiError("invalid_input", 400, message, key ? { [key]: message } : undefined);
}

export function moduleFields(descriptor) {
  return descriptor.panels.flatMap((panel) => panel.fields);
}

function shapeOf(descriptor) {
  const store = STORES[descriptor.store];
  if (!store) throw new Error(`Unknown store ${descriptor.store}`);
  return store.shape;
}

function text(value, field, max) {
  if (value == null) return "";
  if (typeof value !== "string") throw invalid(`${field.label} must be text.`, field.key);
  const trimmed = value.trim();
  if (trimmed.length > max) throw invalid(`${field.label} must be ${max} characters or fewer.`, field.key);
  return trimmed;
}

// One field's value, checked against its type; throws a 400 naming the field when it doesn't fit.
export function fieldValue(field, value, descriptor) {
  const label = field.label || field.key;
  const named = { ...field, label };
  switch (field.type) {
    case "text":
      return text(value, named, field.max ?? 500);
    case "textarea":
      return text(value, named, field.max ?? 10000);
    case "email": {
      const email = text(value, named, 254).toLowerCase();
      if (email && !EMAIL.test(email)) throw invalid(`${label} must be an email address.`, field.key);
      return email;
    }
    case "url":
    case "image": {
      const url = text(value, named, 2000);
      if (url && !/^https?:\/\/\S+$/i.test(url)) throw invalid(`${label} must be a web address.`, field.key);
      return url;
    }
    case "number": {
      if (value === "" || value == null) return null;
      const n = typeof value === "string" ? Number(value) : value;
      if (typeof n !== "number" || !Number.isFinite(n)) throw invalid(`${label} must be a number.`, field.key);
      if (field.min != null && n < field.min) throw invalid(`${label} must be at least ${field.min}.`, field.key);
      if (field.max != null && n > field.max) throw invalid(`${label} must be at most ${field.max}.`, field.key);
      return n;
    }
    case "select":
    case "tabs": {
      if ((value === "" || value == null) && !field.required) return "";
      if (!(field.options || []).some((o) => o.value === value)) throw invalid(`${label} isn't one of the choices.`, field.key);
      return value;
    }
    case "status": {
      if (!(descriptor.statuses || []).some((s) => s.value === value)) throw invalid("That status isn't one of the choices.", field.key);
      return value;
    }
    case "switch":
      if (typeof value !== "boolean") throw invalid(`${label} must be on or off.`, field.key);
      return value;
    case "list": {
      if (!Array.isArray(value)) throw invalid(`${label} must be a list.`, field.key);
      if (value.length > 200) throw invalid(`${label} can hold at most 200 items.`, field.key);
      return value.map((item) => text(item, named, 500)).filter(Boolean);
    }
    case "ref": {
      if (value === "" || value == null) return "";
      if (typeof value !== "string" || !UUID.test(value)) throw invalid(`${label} must point at a record.`, field.key);
      return value;
    }
    case "date": {
      const date = text(value, named, 10);
      if (date && !DATE.test(date)) throw invalid(`${label} must be YYYY-MM-DD.`, field.key);
      return date;
    }
    case "time": {
      const time = text(value, named, 5);
      if (time && !TIME.test(time)) throw invalid(`${label} must be HH:MM.`, field.key);
      return time;
    }
    case "datetime": {
      if (value === "" || value == null) return null;
      const at = typeof value === "string" ? Date.parse(value) : NaN;
      if (Number.isNaN(at)) throw invalid(`${label} must be a date and time.`, field.key);
      return new Date(at).toISOString();
    }
    default:
      throw invalid(`${label} can't be changed here.`, field.key);
  }
}

// The app's body → a row to insert or update. Config changes merge into the stored config, so dashboard-only keys survive.
export function parseRecordInput(descriptor, body, { current = null } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw invalid("Send the fields to change.");
  const shape = shapeOf(descriptor);
  const columns = ROOT_COLUMNS[shape];
  const incomingConfig = body.config && typeof body.config === "object" && !Array.isArray(body.config) ? body.config : {};
  const row = {};
  const configPatch = {};

  for (const field of moduleFields(descriptor)) {
    const root = field.scope === "root";
    const present = root ? field.key in body : field.key in incomingConfig;
    if (!present) continue;
    if (READ_ONLY.has(field.type)) throw invalid(`${field.label || field.key} is edited on the dashboard.`, field.key);
    const value = fieldValue(field, root ? body[field.key] : incomingConfig[field.key], descriptor);
    if (root) {
      const column = columns[field.key];
      if (!column) throw invalid(`${field.label || field.key} can't be changed here.`, field.key);
      row[column] = value;
    } else {
      configPatch[field.key] = value;
    }
  }

  if (!current) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) throw invalid("Give it a name.", "name");
    row.name = name.slice(0, 500);
    if (shape === "ticketing") {
      const kinds = descriptor.kinds || [];
      const kind = kinds.find((k) => k.value === body.kind) || kinds[0] || null;
      row.kind = kind?.value ?? null;
      if (!("active" in row)) row.active = descriptor.defaults?.active ?? true;
      row.config = { ...(kind?.config || {}), ...(descriptor.defaults?.config || {}), ...configPatch };
    } else {
      if (!("status" in row)) row.status = descriptor.defaults?.status ?? descriptor.statuses?.[0]?.value ?? "Draft";
      row.config = { ...(descriptor.defaults?.config || {}), ...configPatch };
    }
    row.module = descriptor.module;
    return row;
  }

  if (Object.keys(configPatch).length) {
    const stored = current.config && typeof current.config === "object" ? current.config : {};
    row.config = { ...stored, ...configPatch };
  }
  if ("name" in row && !row.name) throw invalid("Give it a name.", "name");
  if (!Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}

// A row → what the app shows: root fields plus only the config keys this module's fields and summary name.
export function recordView(descriptor, row) {
  const shape = shapeOf(descriptor);
  const config = row.config && typeof row.config === "object" ? row.config : {};
  const keys = new Set([
    ...moduleFields(descriptor).filter((f) => f.scope !== "root").map((f) => f.key),
    ...(descriptor.summary || []),
  ]);
  const picked = {};
  for (const key of keys) if (key in config) picked[key] = config[key];
  const base = { id: row.id, name: row.name || "Untitled", config: picked, createdAt: row.created_at ?? null };
  if (shape === "ticketing") return { ...base, kind: row.kind ?? null, active: row.active !== false };
  return {
    ...base,
    status: row.status ?? null,
    coverUrl: row.cover_url ?? "",
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
  };
}

// The catalog entry the app receives: everything but the dashboard source path.
export function publicModule(descriptor) {
  const { source: _source, permission: _permission, ...rest } = descriptor;
  return { ...rest, shape: shapeOf(descriptor) };
}
