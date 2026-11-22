import { evaluateAll } from "@geiger/rbac";

import { evaluationInput } from "../../staff_access/access.js";
import { CONTROL_CAPABILITIES, capabilityMap } from "../profile.js";
import { must } from "../scope.js";

// Lookups the money routes share; every one runs on the user-scoped client so RLS applies.

export async function eventsById(db, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;
  const rows = must(await db.from("events").select("id,name,currency:metadata->payments->>currency").in("id", unique), "money.events");
  for (const row of rows) map.set(row.id, row);
  return map;
}

export async function ordersById(db, ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map();
  if (!unique.length) return map;
  const rows = must(await db.from("event_orders").select("id,buyer_name,buyer_email,ticket_name,event_id").in("id", unique), "money.orders");
  for (const row of rows) map.set(row.id, row);
  return map;
}

// What this role may do here, for showing or hiding actions; refund carries an order condition, so it counts as available until an order is named.
export async function moneyAccess(scope, principalId) {
  const { boundary, projectId } = scope;
  const [roleRows, grantRows] = await Promise.all([boundary.loadRoles(projectId), boundary.loadGrants(projectId, principalId)]);
  const { roles, grants } = evaluationInput(projectId, principalId, roleRows, grantRows);
  const decisions = evaluateAll(Object.values(CONTROL_CAPABILITIES), { config: boundary.config, roles, grants, actorId: principalId });
  return capabilityMap(decisions);
}
