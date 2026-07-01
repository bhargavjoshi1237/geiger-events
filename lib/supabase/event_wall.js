"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Event Wall — the public page listing a project's
// listable events. events.event_wall now holds one row per project (see
// zz_project_access.sql); the dashboard resolves it by project id (creating it
// on first open), while the public route resolves it by slug. Pure: validate,
// console.error on failure, return null/false — never throw, never toast (the
// screen owns UX).

const TABLE = "event_wall";

// DB row -> camelCase view model. `metadata` is the expansion bag: theme
// (reuses lib/events/theme.js), filters ({ status, sortBy }), and featured
// (an ordered array of pinned event ids) surface as first-class fields.
export function normalizeWall(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "Our Events",
    tagline: row.tagline ?? "",
    logoUrl: row.logo_url ?? "",
    slug: row.slug ?? "events",
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = { name: "name", tagline: "tagline", logoUrl: "logo_url", slug: "slug" };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  return row;
}

// Resolve a project's wall, creating it on first open. One wall per project
// (unique project_id); the slug is seeded unique from the project id so the
// public /w/<slug> route never collides across projects — the user can rename
// it later (custom_url tab).
export async function getWall(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("[eventWall.get]", error.message);
      return null;
    }
    if (data) return normalizeWall(data);

    // No wall yet for this project — create one (member RLS lets the caller
    // insert into a project they belong to).
    const { data: created, error: createError } = await sb
      .from(TABLE)
      .insert({ project_id: projectId, slug: `events-${projectId.slice(0, 8)}` })
      .select("*")
      .single();
    if (createError) {
      console.error("[eventWall.create]", createError.message);
      return null;
    }
    return normalizeWall(created);
  } catch (e) {
    console.error("[eventWall.get]", e);
    return null;
  }
}

// The public route (/w/<slug>) resolves by slug, not the fixed id — a visitor
// only ever knows the human-readable URL.
export async function getWallBySlug(slug) {
  if (!slug || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.error("[eventWall.getBySlug]", error.message);
      return null;
    }
    return normalizeWall(data);
  } catch (e) {
    console.error("[eventWall.getBySlug]", e);
    return null;
  }
}

export async function updateWall(projectId, patch) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("project_id", projectId)
      .select("*")
      .single();
    if (error) {
      console.error("[eventWall.update]", error.message);
      return null;
    }
    return normalizeWall(data);
  } catch (e) {
    console.error("[eventWall.update]", e);
    return null;
  }
}

// Shallow-merge a config patch into the wall's metadata bag (theme/filters/
// featured), same pattern as updateEventMeta. Keyed by the wall's own id.
export async function updateWallMeta(wallId, patch) {
  if (!wallId || !patch) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("event_wall_merge_meta", {
      p_id: wallId,
      p_patch: patch,
    });
    if (error) {
      console.error("[eventWall.mergeMeta]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[eventWall.mergeMeta]", e);
    return false;
  }
}
