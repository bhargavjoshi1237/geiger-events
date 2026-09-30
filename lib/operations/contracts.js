export const OPERATIONS_LIMITS = Object.freeze({
  fields: 40, options: 100, modules: 30, page: 50, maxPage: 1000,
  title: 200, textarea: 10000,
});

export const FIELD_TYPES = Object.freeze([
  "text", "textarea", "email", "number", "boolean", "select", "date", "reference",
]);
export const RECORD_VIEWS = Object.freeze(["table", "board"]);
export const CAPABILITIES = Object.freeze([
  "records", "forms", "assignments", "scheduling", "resourceReservation",
  "attendance", "evaluation", "tasks", "notifications", "reporting",
]);
export const STABLE_KEY = /^[a-z][a-z0-9-]{0,62}$/;
export const RESERVED_KEYS = new Set(["__proto__", "prototype", "constructor"]);

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}
