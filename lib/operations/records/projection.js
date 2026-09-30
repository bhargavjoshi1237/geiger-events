import { OperationsError } from "../errors.js";

export function encodeCursor(context, filter, last) {
  return Buffer.from(JSON.stringify({ eventId: context.eventId, moduleKey: filter.moduleKey,
    state: filter.state ?? null, archived: filter.archived === true,
    at: last.createdAt, id: last.id })).toString("base64url");
}

export function decodeCursor(value, context, filter) {
  if (!value) return null;
  if (typeof value !== "string" || value.length > 600 || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new OperationsError("invalid_cursor", 400, "Invalid record cursor.");
  }
  let cursor;
  try { cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")); }
  catch { throw new OperationsError("invalid_cursor", 400, "Invalid record cursor."); }
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!cursor || Object.keys(cursor).sort().join(",") !==
    "archived,at,eventId,id,moduleKey,state" || cursor.eventId !== context.eventId ||
    cursor.moduleKey !== filter.moduleKey || cursor.state !== (filter.state ?? null) ||
    cursor.archived !== (filter.archived === true) || !uuid.test(cursor.id) ||
    typeof cursor.at !== "string" || Number.isNaN(Date.parse(cursor.at))) {
    throw new OperationsError("invalid_cursor", 400, "Invalid record cursor.");
  }
  return { at: cursor.at, id: cursor.id };
}
