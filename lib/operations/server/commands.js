import { randomUUID } from "node:crypto";
import { OperationsError } from "../errors.js";

const MAX_BYTES = 262_144;
const headers = { "Cache-Control": "private, no-store" };

export async function readOperationsJson(request) {
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") ?? "")) {
    throw new OperationsError("unsupported_media_type", 415, "Send JSON content.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new OperationsError("invalid_json", 400, "Send a JSON object.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new OperationsError("payload_too_large", 413, "Request exceeds 256 KB.");
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
    throw new OperationsError("invalid_json", 400, "Send a JSON object.");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new OperationsError("invalid_json", 400, "Send a JSON object.");
  }
  return input;
}

export async function handleOperationsRequest(work, { log = console.error } = {}) {
  try {
    const result = await work();
    return Response.json(result, { headers });
  } catch (error) {
    if (error instanceof OperationsError) {
      return Response.json({ error: { code: error.code, message: error.message,
        ...(error.fields ? { fields: error.fields } : {}) } }, { status: error.status, headers });
    }
    if (error?.code === "40001") {
      return Response.json({ error: { code: "revision_conflict", message: "This workspace changed. Reload and try again." } },
        { status: 409, headers });
    }
    if (error?.code === "22023") {
      return Response.json({ error: { code: "invalid_input", message: "Invalid operations input." } },
        { status: 422, headers });
    }
    if (error?.code === "23505") {
      return Response.json({ error: { code: "command_conflict", message: "This command ID was already used." } },
        { status: 409, headers });
    }
    const requestId = randomUUID();
    log("[operations]", requestId, error);
    return Response.json({ error: { code: "internal_error", message: "Couldn't complete the request.", requestId } },
      { status: 500, headers });
  }
}
