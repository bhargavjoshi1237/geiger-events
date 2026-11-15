import { randomUUID } from "node:crypto";
import { ApiError } from "../../staff_access/errors.js";
import { PORTAL_DB_MESSAGES } from "../portal/contracts.js";

const MAX_BYTES = 2_097_152;
const headers = { "Cache-Control": "private, no-store" };

export async function readJson(request) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new ApiError("unsupported_media_type", 415, "Send JSON content.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new ApiError("invalid_json", 400, "Send a JSON object.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new ApiError("payload_too_large", 413, "That's too much to send at once.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks.map((part) => Buffer.from(part))).toString("utf8"));
  } catch {
    throw new ApiError("invalid_json", 400, "Send a JSON object.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError("invalid_json", 400, "Send a JSON object.");
  }
  return input;
}

// Plain-language versions of the database's refusal reasons (raised with SQLSTATE 22023).
export const DB_MESSAGES = {
  "Workspace required": "Set up the workspace for this event first.",
  "Workspace exists": "This event already has a workspace.",
  "Unknown object": "That list no longer exists.",
  "Unknown field": "That field no longer exists.",
  "Unknown record": "That record no longer exists.",
  "Unknown view": "That view no longer exists.",
  "Unknown change": "That change can't be found.",
  "Change cannot be undone": "That change can't be undone.",
  "Object key taken": "Another list already uses that name.",
  "Field key taken": "Another field already uses that name.",
  "Object limit reached": "A workspace can have up to 50 lists.",
  "Field limit reached": "A list can have up to 150 fields.",
  "Field not on object": "A value was sent for a field that isn't on this list.",
  "Read-only field": "That field is calculated and can't be edited.",
  "Link target out of scope": "A linked item doesn't belong to this event.",
  "Link target wrong list": "A linked record is from a different list than the field allows.",
  "Single link only": "That field takes one linked item.",
  "Object deleted": "That list is in the trash. Restore it first.",
  "Too many rows": "Import up to 500 rows at a time.",
  "Values too large": "This record holds too much data.",
  "Unknown approval": "That approval no longer exists.",
  "Approval decided": "This approval has already been decided.",
  ...PORTAL_DB_MESSAGES,
};

export async function handleWorkspaceRequest(work, { log = console.error } = {}) {
  try {
    const result = await work();
    return Response.json(result, { headers });
  } catch (error) {
    return errorResponse(error, log);
  }
}

export function errorResponse(error, log = console.error) {
  const json = (status, body) => Response.json({ error: body }, { status, headers });
  if (error instanceof ApiError) {
    return json(error.status, { code: error.code, message: error.message, ...(error.fields ? { fields: error.fields } : {}) });
  }
  switch (error?.code) {
    case "40001":
      return json(409, { code: "revision_conflict", message: "Someone else changed this. Reload to see their changes — your edits are kept." });
    case "42501":
      return json(403, { code: "forbidden", message: "You don't have permission to change this workspace." });
    case "22023":
      return json(422, { code: "invalid_input", message: DB_MESSAGES[error.message] ?? "Some of the details aren't valid. Check them and try again." });
    case "23505":
      return error.message?.startsWith("Command ID")
        ? json(409, { code: "command_conflict", message: "That change was already sent with different details. Reload and try again." })
        : json(409, { code: "duplicate", message: uniqueMessage(error) });
    case "23503":
      return json(409, { code: "revision_conflict", message: "Something this depends on changed. Reload and try again." });
    default: {
      const requestId = randomUUID();
      log("[workspace]", requestId, error);
      return json(500, { code: "internal_error", message: "Couldn't complete the request.", requestId });
    }
  }
}

function uniqueMessage(error) {
  const match = /^Unique value: (.+)$/.exec(error?.message ?? "");
  return match ? `Another record already has this ${match[1]}.` : "That already exists.";
}
