import { UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { authorizeEventAction } from "../../staff_access/access.js";
import { resolveStaffPrincipal } from "../../staff_access/identity.js";
import { handleWorkspaceRequest } from "./http.js";

export const WORKSPACE_KEYS = Object.freeze({
  view: "events.workspace.view",
  configure: "events.workspace.configure",
  create: "events.workspace.record_create",
  update: "events.workspace.record_update",
  delete: "events.workspace.record_delete",
});

// Signs the staff member in and checks the permission for this event; `also` reports extra keys without failing.
export async function workspaceContext(request, eventId, permission = WORKSPACE_KEYS.view, { also = [] } = {}) {
  if (!UUID.test(eventId ?? "")) throw new WorkspaceError("invalid_path", 400, "That event link isn't valid.");
  const principal = await resolveStaffPrincipal(request);
  return authorizeEventAction(principal, eventId.toLowerCase(), permission, null, { also });
}

// Wraps a route handler: awaits params, renders WorkspaceErrors and database errors as plain JSON.
export function workspaceRoute(handler) {
  return (request, ctx) => handleWorkspaceRequest(async () => handler(request, (await ctx?.params) ?? {}));
}

export function requireUuid(value, message = "That link isn't valid.") {
  if (!UUID.test(value ?? "")) throw new WorkspaceError("invalid_input", 400, message);
  return value.toLowerCase();
}
