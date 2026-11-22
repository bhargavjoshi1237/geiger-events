import { evaluateAll } from "@geiger/rbac";

import { authorizeEventAction, authorizeProjectAction, evaluationInput } from "../staff_access/access.js";
import { ApiError } from "../staff_access/errors.js";
import { controlBoundary, userDb } from "./boundary.js";
import { requireId } from "./ids.js";

// Every Control action: RBAC decides on the server, then the user-scoped client does the work so RLS applies too.

// A failed query as a safe error: an RLS/permission refusal is a 403, anything else is logged and a 503.
export function must(result, label) {
  if (!result.error) return result.data;
  if (result.error.code === "42501") throw new ApiError("forbidden", 403, "You don't have permission to do that.");
  console.error(`[control.${label}]`, result.error.message);
  throw new ApiError("service_unavailable", 503, "Couldn't reach the server. Try again.");
}

export async function projectScope({ principal, token }, projectId, permission) {
  requireId(projectId);
  const boundary = await controlBoundary();
  await authorizeProjectAction(principal, projectId, permission, boundary);
  return { projectId, db: userDb(token), boundary, principal };
}

// Several project-level keys decided from one load of the user's roles and grants.
export async function projectPermissions({ principal, token }, projectId, keys) {
  requireId(projectId);
  const boundary = await controlBoundary();
  if (!(await boundary.isProjectMember(projectId, principal.id))) throw new ApiError("not_found", 404, "Project not found.");
  const [roleRows, grantRows] = await Promise.all([boundary.loadRoles(projectId), boundary.loadGrants(projectId, principal.id)]);
  const { roles, grants } = evaluationInput(projectId, principal.id, roleRows, grantRows);
  const decisions = evaluateAll(keys, { config: boundary.config, roles, grants, actorId: principal.id });
  return { projectId, db: userDb(token), boundary, allowed: (key) => Boolean(decisions[key]?.allowed) };
}

export async function eventScope({ principal, token }, eventId, permission, { also = [] } = {}) {
  requireId(eventId);
  const boundary = await controlBoundary();
  const auth = await authorizeEventAction(principal, eventId, permission, boundary, { also });
  return { projectId: auth.projectId, eventId, allowed: auth.allowed, db: userDb(token), boundary, principal };
}

// Child records (orders, registrations) authorise against their event; one the user can't read is simply not found.
export async function recordScope(ctx, { table, id, columns, permission, notFound, also = [] }) {
  requireId(id);
  const db = userDb(ctx.token);
  const row = must(await db.from(table).select(columns).eq("id", id).maybeSingle(), `${table}.load`);
  if (!row?.event_id) throw new ApiError("not_found", 404, notFound);
  const scope = await eventScope(ctx, row.event_id, permission, { also });
  return { ...scope, row };
}

// Inbox threads are project-level; a thread the user can't read is not found.
export async function threadScope(ctx, threadId, permission) {
  requireId(threadId);
  const db = userDb(ctx.token);
  const row = must(await db.from("portal_threads").select("*").eq("id", threadId).maybeSingle(), "thread.load");
  if (!row?.project_id) throw new ApiError("not_found", 404, "Conversation not found.");
  const scope = await projectScope(ctx, row.project_id, permission);
  return { ...scope, row };
}

// Who to credit in order timelines; the token was already verified by resolveStaffPrincipal, so its claims are trusted.
export function actorOf(token) {
  try {
    const claims = JSON.parse(Buffer.from(String(token).split(".")[1], "base64url").toString("utf8"));
    return typeof claims.email === "string" && claims.email ? claims.email : "Control app";
  } catch {
    return "Control app";
  }
}

export async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    throw new ApiError("invalid_json", 400, "Send a JSON body.");
  }
}
