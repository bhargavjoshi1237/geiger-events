import { WorkspaceError } from "../errors.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { formatDuration } from "../schema/types/time.js";

const bad = (message) => { throw new WorkspaceError("invalid_template", 422, message); };
const PLACEHOLDER = /\{\{\s*([^{}]{1,160}?)\s*\}\}/g;
const RESERVED = new Set(["record.number", "record.title", "record.status", "record.link", "event.name", "today", "now"]);
// Only documents can use these: they're filled when a certificate is issued.
const DOCUMENT_ONLY = new Set(["certificate.code", "certificate.url"]);

export const DOCUMENT_PLACEHOLDERS = Object.freeze([
  { key: "certificate.code", label: "Certificate code" },
  { key: "certificate.url", label: "Certificate check link" },
]);

// Placeholders every template can use, whatever the list.
export const SYSTEM_PLACEHOLDERS = Object.freeze([
  { key: "record.number", label: "Record number" },
  { key: "record.title", label: "Record title" },
  { key: "record.status", label: "Status" },
  { key: "record.link", label: "Portal link to the record" },
  { key: "event.name", label: "Event name" },
  { key: "today", label: "Today's date" },
  { key: "now", label: "Date and time now" },
]);

export const placeholderPaths = (text) => [...String(text ?? "").matchAll(PLACEHOLDER)].map((match) => match[1].trim());

export function escapeHtml(text) {
  return String(text ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const fold = (text) => String(text).trim().toLowerCase();
function fieldNamed(fields, ref) {
  const wanted = fold(ref);
  return fields.find((field) => field.key === ref) ?? fields.find((field) => fold(field.name) === wanted) ?? null;
}

const isSystem = (path) => RESERVED.has(path) || DOCUMENT_ONLY.has(path) || path.startsWith("payload.") || path === "payload";

// {{Field name}} / {{Link name.Field name}} → stored {{field_key}} / {{link_key.field_key}}; unknown names are refused.
export function templateToKeys(text, definition, objectId, { payload = false, document = false } = {}) {
  if (typeof text !== "string") return "";
  const fields = objectId ? liveFields(definition, objectId) : [];
  return text.replace(PLACEHOLDER, (_, raw) => {
    const path = raw.trim();
    if (RESERVED.has(path.toLowerCase())) return `{{${path.toLowerCase()}}}`;
    if (DOCUMENT_ONLY.has(path.toLowerCase())) {
      if (!document) bad(`{{${path}}} only works in documents.`);
      return `{{${path.toLowerCase()}}}`;
    }
    if (path.startsWith("payload")) {
      if (!payload) bad(`{{${path}}} only works with a webhook trigger.`);
      return `{{${path}}}`;
    }
    const [first, second, extra] = path.split(".");
    if (extra !== undefined) bad(`{{${path}}} goes too deep — use one link, like {{Authors.Email}}.`);
    const field = fieldNamed(fields, first);
    if (!field) bad(objectId ? `{{${path}}} isn't a field on this list.` : `{{${path}}} needs a list to read from.`);
    if (second === undefined) return `{{${field.key}}}`;
    if (field.type !== "link_record") bad(`{{${first}}} isn't a link, so {{${path}}} can't look through it.`);
    const target = fieldNamed(liveFields(definition, field.config.targetObjectId), second);
    if (!target) bad(`{{${path}}} isn't a field on the linked list.`);
    return `{{${field.key}.${target.key}}}`;
  });
}

// Stored keys back to the names organisers type.
export function templateToNames(text, definition, objectId) {
  if (typeof text !== "string") return "";
  const fields = objectId ? liveFields(definition, objectId) : [];
  return text.replace(PLACEHOLDER, (whole, raw) => {
    const path = raw.trim();
    if (isSystem(path)) return whole;
    const [first, second] = path.split(".");
    const field = fields.find((item) => item.key === first);
    if (!field) return whole;
    if (second === undefined) return `{{${field.name}}}`;
    const target = liveFields(definition, field.config.targetObjectId ?? "").find((item) => item.key === second);
    return target ? `{{${field.name}.${target.name}}}` : whole;
  });
}

// Fills placeholders; values are escaped when the template is HTML. Missing values render empty.
export function renderTemplate(text, resolve, { html = false } = {}) {
  return String(text ?? "").replace(PLACEHOLDER, (_, raw) => {
    let value;
    try { value = resolve(raw.trim()); } catch { value = ""; }
    const out = value === null || value === undefined ? "" : String(value);
    return html ? escapeHtml(out) : out;
  });
}

const DATE_FMT = { day: "numeric", month: "short", year: "numeric" };
export function formatDateText(value) {
  if (!value) return "";
  const date = new Date(`${String(value).slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? String(value) : new Intl.DateTimeFormat("en-GB", { ...DATE_FMT, timeZone: "UTC" }).format(date);
}
export function formatDateTimeText(value, timeZone = "UTC") {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  try {
    return new Intl.DateTimeFormat("en-GB", { ...DATE_FMT, hour: "2-digit", minute: "2-digit", timeZone }).format(date);
  } catch {
    return date.toISOString();
  }
}

// One field's value as plain text, the way people read it.
export function displayValue(field, record, { timeZone = "UTC" } = {}) {
  if (!field || !record) return "";
  const type = getType(field.type);
  if (type?.cast === "link") return (record.links?.[field.id] ?? []).map((link) => link.label ?? "").filter(Boolean).join(", ");
  const raw = field.type === "lookup" || field.type === "rollup" ? record.computed?.[field.id] : record.values?.[field.id];
  if (raw === null || raw === undefined || raw === "") return "";
  if (Array.isArray(raw) && field.type === "lookup") return raw.map((item) => (typeof item === "object" ? item?.label ?? "" : String(item))).filter(Boolean).join(", ");
  switch (field.type) {
    case "currency":
      try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: field.config.currency || "USD" }).format(raw); } catch { return String(raw); }
    case "percent": return `${raw}%`;
    case "duration": return formatDuration(raw);
    case "date": return formatDateText(raw);
    case "datetime": return formatDateTimeText(raw, timeZone);
    case "checkbox": return raw ? "Yes" : "No";
    case "rollup": return String(Math.round(Number(raw) * 100) / 100);
    case "formula":
      if (field.config.result === "boolean") return raw ? "Yes" : "No";
      if (field.config.result === "date") return formatDateText(raw);
      return String(raw);
    case "attachments": return (Array.isArray(raw) ? raw : []).map((file) => file?.name).filter(Boolean).join(", ");
    default: return type?.toText ? type.toText(raw, field.config) ?? "" : String(raw);
  }
}

function payloadAt(payload, path) {
  let value = payload;
  for (const part of path.split(".").slice(1)) {
    if (value === null || typeof value !== "object") return "";
    value = value[part];
  }
  if (value === undefined || value === null) return "";
  return typeof value === "object" ? JSON.stringify(value) : value;
}

// Resolves placeholders for one record: { record, linked: { <linkKey>: [records] }, object, event, timeZone, link, payload, now, certificate }.
export function templateResolver(definition, { object = null, record = null, linked = {}, event = null, timeZone = "UTC", link = "", payload = null, now = new Date(), certificate = null } = {}) {
  const fields = object ? liveFields(definition, object.id) : [];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  return (path) => {
    switch (path) {
      case "certificate.code": return certificate?.code ?? "";
      case "certificate.url": return certificate?.url ?? "";
      case "record.number": return record && object ? `${object.numberPrefix}-${record.number}` : "";
      case "record.title": return record?.title ?? "";
      case "record.status": return object?.statuses?.find((status) => status.key === record?.status)?.label ?? "";
      case "record.link": return link ?? "";
      case "event.name": return event?.name ?? "";
      case "today": return formatDateText(new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now));
      case "now": return formatDateTimeText(now.toISOString(), timeZone);
      default: break;
    }
    if (path === "payload" || path.startsWith("payload.")) return payload ? payloadAt(payload, path) : "";
    const [first, second] = path.split(".");
    const field = byKey.get(first);
    if (!field || !record) return "";
    if (second === undefined) return displayValue(field, record, { timeZone });
    const targets = linked[first] ?? [];
    const targetField = liveFields(definition, field.config.targetObjectId ?? "").find((item) => item.key === second);
    if (!targetField) return "";
    return targets.map((target) => displayValue(targetField, target, { timeZone })).filter(Boolean).join(", ");
  };
}

// Link fields a template looks through ({{link_key.field}}), so only those linked records are loaded.
export function linkedKeys(texts) {
  const keys = new Set();
  for (const text of texts) for (const path of placeholderPaths(text)) {
    if (isSystem(path)) continue;
    const [first, second] = path.split(".");
    if (second !== undefined) keys.add(first);
  }
  return keys;
}
