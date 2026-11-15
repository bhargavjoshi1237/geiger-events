import { checkbox, multiSelect, singleSelect } from "./choice.js";
import { formula, lookup, rollup } from "./computed.js";
import { attachments, linkEvent, linkRecord } from "./links.js";
import { currency, number, percent, rating } from "./number.js";
import { richText } from "./rich_text.js";
import { email, longText, phone, shortText, url } from "./text.js";
import { date, datetime, duration } from "./time.js";

// Adding a field type: define it with defineType in one of these files and list it here.
const TYPES = [
  shortText, longText, richText, email, phone, url,
  number, currency, percent, rating,
  singleSelect, multiSelect, checkbox,
  date, datetime, duration,
  linkRecord, linkEvent,
  attachments,
  formula, lookup, rollup,
];

const BY_NAME = new Map(TYPES.map((type) => [type.type, type]));

export const FIELD_TYPES = Object.freeze(TYPES.map((type) => type.type));
export const TYPE_GROUPS = Object.freeze([...new Set(TYPES.map((type) => type.group))]
  .map((group) => ({ group, types: TYPES.filter((type) => type.group === group).map((type) => type.type) })));

export function getType(name) {
  return BY_NAME.get(name) ?? null;
}

// Converts a stored value between field types through its text form; { ok: false } means the value would be cleared.
export function convertValue(fromType, fromConfig, toType, toConfig, value) {
  if (value === null || value === undefined) return { ok: true, value: null };
  const from = getType(fromType);
  const to = getType(toType);
  if (!from || !to || !to.stored || !to.editable) return { ok: false };
  if (fromType === toType) {
    try { return { ok: true, value: to.normalise(value, toConfig) }; } catch { return { ok: false }; }
  }
  const text = from.toText(value, fromConfig);
  const next = to.fromText(text, toConfig);
  if (next === undefined) return { ok: false };
  try { return { ok: true, value: to.normalise(next, toConfig) }; } catch { return { ok: false }; }
}
