"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { getUser } from "./user";

// Data access for events.project_addons — the per-project enablement, sidebar
// placement and settings of an installed addon. The addon CATALOG is code
// (addons/index.js); this table only records what a project turned on.
//
// DB is snake_case, the UI is camelCase; map at this boundary. Pure: validate,
// console.error on failure, return null/false/[] — never throw, never toast.

const TABLE = "project_addons";

export function normalizeProjectAddon(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    addonId: row.addon_id ?? "",
    enabled: Boolean(row.enabled),
    // null means "no override" — the manifest's own placement wins.
    position: Number.isInteger(row.position) ? row.position : null,
    config: row.config && typeof row.config === "object" ? row.config : {},
    createdBy: row.created_by ?? null,
  };
}

function toRow(input) {
  const row = {};
  if ("addonId" in input) row.addon_id = input.addonId;
  if ("projectId" in input) row.project_id = input.projectId || null;
  if ("enabled" in input) row.enabled = Boolean(input.enabled);
  if ("position" in input) {
    row.position = Number.isInteger(input.position) ? input.position : null;
  }
  if ("config" in input) {
    row.config = input.config && typeof input.config === "object" ? input.config : {};
  }
  return row;
}

// Every addon row for a project. `[]` is a real answer (nothing enabled yet);
// `null` means unconfigured or a failed read.
export async function listProjectAddons(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (error) {
      console.error("[project_addons.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeProjectAddon);
  } catch (e) {
    console.error("[project_addons.list]", e);
    return null;
  }
}

// Create-or-update the single live row for (project, addon). Callers patch one
// concern at a time (enable, position, config); the unique index on
// (project_id, addon_id) where deleted_at is null is the upsert target.
export async function upsertProjectAddon(projectId, addonId, patch) {
  if (!projectId || !addonId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const user = await getUser();
    const payload = {
      ...toRow({ ...patch, projectId, addonId }),
      created_by: user?.id ?? null,
    };
    const { data, error } = await sb
      .from(TABLE)
      .upsert(payload, { onConflict: "project_id,addon_id" })
      .select("*")
      .single();
    if (error) {
      console.error("[project_addons.upsert]", error.message);
      return null;
    }
    return normalizeProjectAddon(data);
  } catch (e) {
    console.error("[project_addons.upsert]", e);
    return null;
  }
}
