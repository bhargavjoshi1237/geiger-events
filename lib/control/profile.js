import { evaluateAll } from "@geiger/rbac";

import { authorizeEventAction, evaluationInput } from "../operations/server/access.js";
import { OperationsError } from "../operations/errors.js";
import { requireId } from "./ids.js";
import { toControlEvent } from "./events.js";

// The Control tools and the permission each needs; the app only offers a tool its key grants.
export const CONTROL_CAPABILITIES = {
  events: "events.events.view",
  checkIn: "events.check_in.view",
  guests: "events.guests.view",
  orders: "events.orders.view",
  analytics: "events.analytics.view",
  operations: "events.operations.view",
};

const KEYS = Object.values(CONTROL_CAPABILITIES);

// Without an event to check, a grant scoped to some events still means "this tool exists for you here".
export function capabilityMap(decisions, { scoped = true } = {}) {
  return Object.fromEntries(
    Object.entries(CONTROL_CAPABILITIES).map(([name, key]) => {
      const decision = decisions[key];
      return [name, decision.allowed || (scoped && decision.code === "missing_scope_target")];
    }),
  );
}

async function grantsFor(project, principal, boundary, ensureMembership) {
  const [roleRows, firstGrants] = await Promise.all([
    boundary.loadRoles(project.id),
    boundary.loadGrants(project.id, principal.id),
  ]);
  let grantRows = firstGrants;
  // The dashboard mints a first grant on first visit; do the same, but only for users with no grant ever (the RPC returns null otherwise).
  if (grantRows.length === 0) {
    const minted = await ensureMembership(project.id);
    if (minted) grantRows = await boundary.loadGrants(project.id, principal.id);
  }
  return evaluationInput(project.id, principal.id, roleRows, grantRows);
}

function roleOf(roles, grants) {
  const active = grants.find((g) => g.status === "active" && !g.deletedAt);
  const role = active ? roles.find((r) => r.id === active.roleId) : null;
  return role ? { key: role.key, name: role.name } : null;
}

export async function loadControlProfile({ principal, boundary, ensureMembership }) {
  if (principal?.kind !== "staff" || !principal.id) throw new OperationsError("unauthenticated", 401, "Sign in to continue.");
  const projects = await boundary.listProjects(principal.id);
  return {
    projects: await Promise.all(
      projects.map(async (project) => {
        const { roles, grants } = await grantsFor(project, principal, boundary, ensureMembership);
        const decisions = evaluateAll(KEYS, { config: boundary.config, roles, grants, actorId: principal.id });
        return {
          id: project.id,
          name: project.name,
          organizationName: project.organizationName,
          role: roleOf(roles, grants),
          can: capabilityMap(decisions),
        };
      }),
    ),
  };
}

export async function loadControlEvent({ principal, eventId, boundary, now = new Date() }) {
  requireId(eventId);
  const { projectId } = await authorizeEventAction(principal, eventId, CONTROL_CAPABILITIES.events, boundary);
  const [row, roleRows, grantRows] = await Promise.all([
    boundary.loadEventRow(eventId),
    boundary.loadRoles(projectId),
    boundary.loadGrants(projectId, principal.id),
  ]);
  if (!row) throw new OperationsError("not_found", 404, "Event not found.");
  const { roles, grants } = evaluationInput(projectId, principal.id, roleRows, grantRows);
  const decisions = evaluateAll(KEYS, { config: boundary.config, roles, grants, actorId: principal.id, scopeId: eventId });
  return { event: toControlEvent(row, now), projectId, can: capabilityMap(decisions, { scoped: false }) };
}
