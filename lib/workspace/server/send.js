import { createHash, randomUUID } from "node:crypto";

const requestHash = (body) => createHash("sha256").update(JSON.stringify(body)).digest("hex");

// Sends one action to events.workspace_command; the same commandId + body replays the stored response.
export function commandSender(store) {
  return (context, action, payload, commandId = randomUUID()) =>
    store.command(context, { action, commandId, requestHash: requestHash({ action, ...payload }), ...payload });
}

// A stable UUID derived from parts, so re-running a copy job reuses the ids it chose the first time.
export function stableId(...parts) {
  const hex = createHash("sha256").update(parts.join(":")).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${"89ab"[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}
