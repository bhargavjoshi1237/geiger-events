import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import rbacConfig from "@/geiger-rbac.config";

// Data-access layer for authorization. The only place that talks to
// public.roles and events.role_grants. Pure: validate, console.error on
// failure, return null / false / [] — never throw, never toast (the screen owns
// UX). DB is snake_case; the UI is camelCase, mapped at this boundary.
//
// Two clients, because the two tables live in different schemas: roles are
// SHARED suite-wide (public.roles) so a role named "Manager" means one thing
// everywhere, while grants are per-product (events.role_grants) so adopting
// this app never changes anyone's access in another.

const ROLES_TABLE = "roles";
const GRANTS_TABLE = "role_grants";

// public.roles sits outside this app's schema; the base client is pinned to
// `events`, so roles need an explicitly public-scoped view of it.
function publicClient() {
  return createClient().schema("public");
}

export function normalizeRole(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    key: row.key ?? meta.key ?? null,
    name: row.name ?? "",
    description: row.description ?? "",
    color: row.color ?? "slate",
    permissions: Array.isArray(row.permissions) ? row.permissions : [],
    isSystem: row.is_system ?? false,
    sort: row.sort ?? 0,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

export function normalizeGrant(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    userId: row.user_id ?? null,
    roleId: row.role_id ?? null,
    scope: row.scope && typeof row.scope === "object" ? row.scope : {},
    status: row.status ?? "active",
    grantedBy: row.granted_by ?? null,
    createdAt: row.created_at ?? null,
    deletedAt: row.deleted_at ?? null,
    ...meta,
  };
}

function roleToRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    key: "key",
    name: "name",
    description: "description",
    color: "color",
    isSystem: "is_system",
    sort: "sort",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("permissions" in input) {
    row.permissions = Array.isArray(input.permissions) ? input.permissions : [];
  }
  return row;
}

// --- Roles -----------------------------------------------------------------

export async function listRoles(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await publicClient()
      .from(ROLES_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("is_system", { ascending: false })
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[rbac.listRoles]", error.message);
      return null;
    }
    return (data || []).map(normalizeRole);
  } catch (e) {
    console.error("[rbac.listRoles]", e);
    return null;
  }
}

export async function createRole(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const payload = roleToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await publicClient()
      .from(ROLES_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[rbac.createRole]", error.message);
      return null;
    }
    return normalizeRole(data);
  } catch (e) {
    console.error("[rbac.createRole]", e);
    return null;
  }
}

export async function updateRole(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await publicClient()
      .from(ROLES_TABLE)
      .update(roleToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[rbac.updateRole]", error.message);
      return null;
    }
    return normalizeRole(data);
  } catch (e) {
    console.error("[rbac.updateRole]", e);
    return null;
  }
}

export async function softDeleteRole(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const { error } = await publicClient()
      .from(ROLES_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[rbac.softDeleteRole]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[rbac.softDeleteRole]", e);
    return false;
  }
}

// Seed the system roles a project is missing, from the catalog in
// geiger-rbac.config.js. Idempotent per key, so it can run on every load of the
// Roles screen and only ever fills gaps.
//
// Owner is seeded by the adopt_rbac migration (its "*" is stable); the rest live
// in the config so the catalog stays their single source of truth.
export async function ensureSystemRoles(projectId, createdBy = null) {
  if (!projectId || !isSupabaseConfigured()) return [];
  try {
    const existing = await listRoles(projectId);
    if (existing === null) return [];
    const have = new Set(existing.map((r) => r.key).filter(Boolean));

    const missing = rbacConfig.systemRoles.filter((r) => !have.has(r.key));
    if (missing.length === 0) return existing;

    const payload = missing.map((role) => ({
      project_id: projectId,
      key: role.key,
      name: role.name,
      description: role.description,
      color: role.color,
      permissions: [...role.permissions],
      is_system: true,
      sort: role.sort,
      created_by: createdBy,
      metadata: { key: role.key },
    }));

    const { error } = await publicClient().from(ROLES_TABLE).insert(payload);
    if (error) {
      console.error("[rbac.ensureSystemRoles]", error.message);
      return existing;
    }
    return (await listRoles(projectId)) ?? existing;
  } catch (e) {
    console.error("[rbac.ensureSystemRoles]", e);
    return [];
  }
}

// --- Grants ----------------------------------------------------------------

// Every grant in the project (the Team screen's view).
export async function listGrants(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(GRANTS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (error) {
      console.error("[rbac.listGrants]", error.message);
      return null;
    }
    return (data || []).map(normalizeGrant);
  } catch (e) {
    console.error("[rbac.listGrants]", e);
    return null;
  }
}

// One user's grants — what the provider resolves decisions against.
export async function listUserGrants(projectId, userId) {
  if (!projectId || !userId || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(GRANTS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .eq("user_id", userId)
      .is("deleted_at", null);
    if (error) {
      console.error("[rbac.listUserGrants]", error.message);
      return null;
    }
    return (data || []).map(normalizeGrant);
  } catch (e) {
    console.error("[rbac.listUserGrants]", e);
    return null;
  }
}

// Assign a role. Upserts on (project, user, role) so re-granting an existing
// pair updates its scope rather than failing the unique index.
export async function grantRole({
  id,
  projectId,
  userId,
  roleId,
  scope = {},
  grantedBy = null,
}) {
  if (!projectId || !userId || !roleId || !isSupabaseConfigured()) return null;
  try {
    const payload = {
      project_id: projectId,
      user_id: userId,
      role_id: roleId,
      scope: scope || {},
      status: "active",
      granted_by: grantedBy,
    };
    if (id) payload.id = id;
    const { data, error } = await createClient()
      .from(GRANTS_TABLE)
      .upsert(payload, { onConflict: "project_id,user_id,role_id" })
      .select("*")
      .single();
    if (error) {
      console.error("[rbac.grantRole]", error.message);
      return null;
    }
    return normalizeGrant(data);
  } catch (e) {
    console.error("[rbac.grantRole]", e);
    return null;
  }
}

// Narrow (or widen) an existing grant. Scope is the one part of authorization
// customers own, so this is the write the Team screen makes most.
export async function updateGrantScope(id, scope) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const { data, error } = await createClient()
      .from(GRANTS_TABLE)
      .update({ scope: scope || {} })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[rbac.updateGrantScope]", error.message);
      return null;
    }
    return normalizeGrant(data);
  } catch (e) {
    console.error("[rbac.updateGrantScope]", e);
    return null;
  }
}

export async function revokeGrant(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const { error } = await createClient()
      .from(GRANTS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[rbac.revokeGrant]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[rbac.revokeGrant]", e);
    return false;
  }
}

// Replace a member's role in one project: revoke what they hold, grant the new
// one. Used by the Team screen's role picker.
export async function setMemberRole({
  projectId,
  userId,
  roleId,
  scope = {},
  grantedBy = null,
  currentGrants = [],
}) {
  if (!projectId || !userId || !roleId) return null;
  const stale = currentGrants.filter(
    (g) => g.userId === userId && g.roleId !== roleId,
  );
  for (const g of stale) {
    await revokeGrant(g.id);
  }
  return grantRole({ projectId, userId, roleId, scope, grantedBy });
}
