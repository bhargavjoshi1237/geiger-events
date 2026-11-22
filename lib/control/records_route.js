import { findModule, sectionOf, STORES } from "./catalog/index.js";
import { requireId } from "./ids.js";
import { searchTerm } from "./records.js";
import { must, projectScope } from "./scope.js";
import { userDb } from "./boundary.js";
import { ApiError } from "../staff_access/errors.js";

// Shared plumbing for the generic records routes: find the module, check its section's key, then work on its table.

export function moduleOrThrow(id) {
  const descriptor = findModule(String(id || ""));
  if (!descriptor) throw new ApiError("not_found", 404, "That isn't something Control can manage.");
  return { descriptor, table: STORES[descriptor.store].table, shape: STORES[descriptor.store].shape };
}

// A module may need a stricter key than its section's view key (payout accounts, payment methods).
export function modulePermission(descriptor) {
  return descriptor.permission || sectionOf(descriptor).permission;
}

export async function moduleScope(ctx, projectId, id) {
  const mod = moduleOrThrow(id);
  const scope = await projectScope(ctx, projectId, modulePermission(mod.descriptor));
  return { ...mod, ...scope };
}

// One record, read as the user first (RLS hides other projects), then authorised against its own project.
export async function recordScope(ctx, id, recordId) {
  const mod = moduleOrThrow(id);
  requireId(recordId);
  const row = must(
    await userDb(ctx.token)
      .from(mod.table)
      .select("*")
      .eq("id", recordId)
      .eq("module", mod.descriptor.module)
      .is("deleted_at", null)
      .maybeSingle(),
    `${mod.table}.load`,
  );
  if (!row?.project_id) throw new ApiError("not_found", 404, `${mod.descriptor.singular} not found.`);
  const scope = await projectScope(ctx, row.project_id, modulePermission(mod.descriptor));
  return { ...mod, ...scope, row };
}

// ?q= searches names; ?status= is a status value, or active/inactive for on/off records.
export function listQuery(db, { table, shape, descriptor }, projectId, params) {
  let query = db.from(table).select("*").eq("project_id", projectId).eq("module", descriptor.module).is("deleted_at", null);
  const term = searchTerm(params.get("q"));
  if (term) query = query.ilike("name", `%${term}%`);
  const status = params.get("status");
  if (shape === "ticketing" && (status === "active" || status === "inactive")) query = query.eq("active", status === "active");
  if (shape === "record" && status && (descriptor.statuses || []).some((s) => s.value === status)) query = query.eq("status", status);
  return query.order("created_at", { ascending: false }).limit(300);
}
