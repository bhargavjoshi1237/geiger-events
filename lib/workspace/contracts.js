export const LIMITS = Object.freeze({
  objects: 50, fields: 150, options: 500, statuses: 50, views: 100,
  valuesBytes: 1_048_576, title: 200, shortText: 1000, longText: 100_000,
  fileBytes: 52_428_800, files: 20, formulaChars: 2000, formulaDepth: 32,
  pageSize: 200, importRows: 500, filterDepth: 3, filterItems: 50,
});

export const KEY = /^[a-z][a-z0-9_]{0,62}$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const OPTION_ID = /^opt_[a-z0-9]{1,24}$/;
export const COLORS = Object.freeze(["gray", "blue", "green", "amber", "red", "violet", "pink", "teal"]);

// What a "Link to event data" field can point at, and where that data lives.
export const EVENT_TARGETS = Object.freeze(["contact", "order", "ticket", "team_member", "venue_space"]);
export const TARGET_KINDS = Object.freeze(["record", ...EVENT_TARGETS]);

// Columns every record has; usable in filters and sorts alongside fields.
export const SYSTEM_COLUMNS = Object.freeze({
  number: "numeric", title: "text", status: "text", created_at: "timestamptz", updated_at: "timestamptz",
});

// Filter operators the query layer accepts for each storage cast; the database keeps the same list.
export const CAST_OPERATORS = Object.freeze({
  text: ["eq", "neq", "contains", "not_contains", "starts_with", "any_of", "none_of", "is_empty", "is_not_empty"],
  numeric: ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  boolean: ["is_true", "is_false"],
  date: ["eq", "before", "after", "on_or_before", "on_or_after", "is_empty", "is_not_empty"],
  timestamptz: ["before", "after", "on_or_before", "on_or_after", "is_empty", "is_not_empty"],
  "text[]": ["has_any", "has_all", "has_none", "is_empty", "is_not_empty"],
  link: ["has_any", "is_empty", "is_not_empty"],
  file: ["is_empty", "is_not_empty"],
});

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
