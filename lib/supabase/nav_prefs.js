"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data access for events.user_nav_prefs — the sidebar entries a user has hidden
// in Settings → Navigation, one row per (project, user).
//
// This layer only records the choice. Which titles may be hidden, and what
// depends on what, is declared in geiger-ui.config.js and enforced by
// @geiger/ui — never here.
//
// DB is snake_case, the UI is camelCase; map at this boundary. Pure: validate,
// console.error on failure, return null/false — never throw, never toast.

const TABLE = "user_nav_prefs";

export function normalizeNavPrefs(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    userId: row.user_id ?? null,
    hidden: Array.isArray(row.hidden) ? row.hidden.filter((t) => typeof t === "string") : [],
  };
}

// This user's row for the project. `null` means unconfigured, a failed read, or
// simply no row yet — the caller treats all three as "nothing hidden".
export async function getNavPrefs(projectId, userId = null) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let query = sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null);
    query = userId ? query.eq("user_id", userId) : query.is("user_id", null);

    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error("[nav_prefs.get]", error.message);
      return null;
    }
    return normalizeNavPrefs(data);
  } catch (e) {
    console.error("[nav_prefs.get]", e);
    return null;
  }
}

// Create-or-update this user's single live row. The whole hidden list is written
// at once — it is small, and a partial patch would need a read-modify-write
// round trip for no benefit. The unique index on (project_id, user_id) where
// deleted_at is null is the upsert target.
export async function saveNavPrefs(projectId, userId, hidden) {
  if (!projectId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(TABLE).upsert(
      {
        project_id: projectId,
        user_id: userId || null,
        hidden: Array.isArray(hidden) ? hidden : [],
        created_by: userId || null,
      },
      { onConflict: "project_id,user_id" },
    );
    if (error) {
      console.error("[nav_prefs.save]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[nav_prefs.save]", e);
    return false;
  }
}
