import { randomUUID } from "node:crypto";

import { ApiError } from "../staff_access/errors.js";
import { fieldValue } from "./records_engine.js";

// Control's settings engine: one settings slice per descriptor, validated against its fields and merged into what's stored.
// Shapes: "object" (default) is a bag of keys; "value" is a single stored value (its one field's key is the setting key);
// "list" is an array of items edited one at a time, each merged onto the stored item so dashboard-only keys survive.

const READ_ONLY = new Set(["audience", "access", "readonly"]);
const MAX_ITEMS = 200;

export const SETTINGS_STORES = {
  // One row per project; each feature is a slice of config, written through the checkin_settings_merge RPC.
  checkin: { table: "checkin_settings" },
  // One row per (project, module), upserted whole.
  ticketing: { table: "ticketing_settings" },
  // One key of an event's metadata bag, merged through event_merge_meta like the dashboard's event editor.
  event: { table: "events" },
};

export function settingShape(descriptor) {
  return descriptor.shape || "object";
}

export function settingFields(descriptor) {
  return descriptor.panels.flatMap((panel) => panel.fields);
}

const isObject = (value) => Boolean(value) && typeof value === "object" && !Array.isArray(value);

function validated(descriptor, fields, incoming) {
  const out = {};
  for (const [key, value] of Object.entries(incoming)) {
    const field = fields.get(key);
    if (!field) throw new ApiError("invalid_input", 400, `${key} isn't a setting here.`, { [key]: "Unknown setting." });
    if (READ_ONLY.has(field.type)) throw new ApiError("invalid_input", 400, `${field.label || key} is changed on the dashboard.`, { [key]: "Read-only." });
    out[key] = fieldValue(field, value, descriptor);
  }
  return out;
}

// What the app shows: defaults then stored, limited to the fields; list items carry their stored index as `_i`.
export function settingsView(descriptor, stored) {
  const fields = settingFields(descriptor);
  const shape = settingShape(descriptor);
  if (shape === "list") {
    const items = Array.isArray(stored) ? stored : Array.isArray(descriptor.defaults) ? descriptor.defaults : [];
    return {
      items: items.filter(isObject).map((item, i) => {
        const view = { _i: i };
        if (item.id != null) view.id = item.id;
        for (const field of fields) if (field.key in item) view[field.key] = item[field.key];
        return view;
      }),
    };
  }
  if (shape === "value") {
    const key = fields[0].key;
    return { [key]: stored ?? descriptor.defaults?.[key] ?? null };
  }
  const merged = { ...(isObject(descriptor.defaults) ? descriptor.defaults : {}), ...(isObject(stored) ? stored : {}) };
  const values = {};
  for (const field of fields) if (field.key in merged) values[field.key] = merged[field.key];
  return values;
}

// The app's body → the full value to store. Objects merge over what's stored; list items merge onto the stored item
// with the same id (or, for id-less lists, the same original index), so keys the app doesn't show survive.
export function parseSettingsPatch(descriptor, body, stored) {
  const fields = new Map(settingFields(descriptor).map((f) => [f.key, f]));
  const shape = settingShape(descriptor);

  if (shape === "list") {
    if (!Array.isArray(body?.items)) throw new ApiError("invalid_input", 400, "Send the full list.");
    if (body.items.length > MAX_ITEMS) throw new ApiError("invalid_input", 400, `A list can hold at most ${MAX_ITEMS} items.`);
    const current = Array.isArray(stored) ? stored.filter(isObject) : [];
    const byId = new Map(current.filter((item) => item.id != null).map((item) => [String(item.id), item]));
    return body.items.map((raw) => {
      if (!isObject(raw)) throw new ApiError("invalid_input", 400, "Each item must be an object.");
      const { id, _i, ...rest } = raw;
      const base = (id != null && byId.get(String(id))) || (Number.isInteger(_i) && current[_i]) || null;
      const item = { ...(base || descriptor.itemDefaults || {}), ...validated(descriptor, fields, rest) };
      if (item.id == null && descriptor.itemIds !== false) item.id = id ?? `${descriptor.itemIdPrefix || "item"}_${randomUUID().slice(0, 8)}`;
      return item;
    });
  }

  const incoming = isObject(body?.config) ? body.config : null;
  if (!incoming || !Object.keys(incoming).length) throw new ApiError("invalid_input", 400, "Send the settings to change.");
  const patch = validated(descriptor, fields, incoming);
  if (shape === "value") return patch[settingFields(descriptor)[0].key];
  return { ...(isObject(descriptor.defaults) ? descriptor.defaults : {}), ...(isObject(stored) ? stored : {}), ...patch };
}

export function publicSetting(descriptor) {
  const { source: _source, ...rest } = descriptor;
  return { ...rest, shape: settingShape(descriptor) };
}
