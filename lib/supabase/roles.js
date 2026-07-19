import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { SYSTEM_ROLE_SEED } from "@/lib/rbac";

// Data-access layer for Roles & Permissions. The only place that talks to the
// `events.roles` table. Pure: validate, console.error on failure, return
// null / false / [] — never throw, never toast (the screen owns UX). DB is
// snake_case; the UI is camelCase, mapped at this boundary.

const TABLE = "roles";

// DB row -> camelCase view model the screen renders directly.
export function normalizeRole(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
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

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one updateRole() serves both a full save and a
// single-field inline edit (`{ permissions }`, `{ name }`).
function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
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

// Roles for a project, system roles first then by sort/name. Requires a project
// id — without one there is nothing to scope to (returns null).
export async function listRoles(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("is_system", { ascending: false })
      .order("sort", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[roles.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeRole);
  } catch (e) {
    console.error("[roles.list]", e);
    return null;
  }
}

export async function createRole(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[roles.create]", error.message);
      return null;
    }
    return normalizeRole(data);
  } catch (e) {
    console.error("[roles.create]", e);
    return null;
  }
}

export async function updateRole(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[roles.update]", error.message);
      return null;
    }
    return normalizeRole(data);
  } catch (e) {
    console.error("[roles.update]", e);
    return null;
  }
}

export async function softDeleteRole(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[roles.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[roles.delete]", e);
    return false;
  }
}

// Seed the five system roles for a project the first time it opens Roles &
// Permissions. Idempotent: inserts only when the project has no roles yet.
// Returns the seeded roles (or [] on no-op / failure).
export async function ensureSystemRoles(projectId, createdBy) {
  if (!projectId || !isSupabaseConfigured()) return [];
  try {
    const sb = createClient();
    const { data: existing, error: readErr } = await sb
      .from(TABLE)
      .select("id")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .limit(1);
    if (readErr) {
      console.error("[roles.ensureSystem]", readErr.message);
      return [];
    }
    if (existing && existing.length) return [];

    const payload = SYSTEM_ROLE_SEED.map((role, i) => ({
      project_id: projectId,
      name: role.name,
      description: role.description,
      color: role.color,
      permissions: role.permissions,
      is_system: true,
      sort: i,
      created_by: createdBy ?? null,
      metadata: { key: role.key },
    }));
    const { data, error } = await sb.from(TABLE).insert(payload).select("*");
    if (error) {
      console.error("[roles.ensureSystem]", error.message);
      return [];
    }
    return (data || []).map(normalizeRole);
  } catch (e) {
    console.error("[roles.ensureSystem]", e);
    return [];
  }
}
