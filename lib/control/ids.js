import { OperationsError } from "../operations/errors.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// A malformed id is a plain 404 rather than a Postgres cast failure surfacing as 503.
export function requireId(value) {
  if (typeof value !== "string" || !UUID.test(value)) throw new OperationsError("not_found", 404, "Not found.");
  return value;
}
