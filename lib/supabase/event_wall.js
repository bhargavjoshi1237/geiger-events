"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Event Wall — the public page listing every
// listable event. events.event_wall is a singleton table; WALL_ID is the
// stable seeded row (supabase/sqls/event_wall.sql), so callers never need to
// look up an id first. Pure: validate, console.error on failure, return
// null/false — never throw, never toast (the screen owns UX).

const TABLE = "event_wall";
export const WALL_ID = "44444444-4444-4444-8444-000000000001";

// DB row -> camelCase view model. `metadata` is the expansion bag: theme
// (reuses lib/events/theme.js), filters ({ status, sortBy }), and featured
// (an ordered array of pinned event ids) surface as first-class fields.
export function normalizeWall(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
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

export async function getWall() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", WALL_ID)
      .maybeSingle();
    if (error) {
      console.error("[eventWall.get]", error.message);
      return null;
    }
    return normalizeWall(data);
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

export async function updateWall(patch) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", WALL_ID)
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
// featured), same pattern as updateEventMeta.
export async function updateWallMeta(patch) {
  if (!patch) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("event_wall_merge_meta", {
      p_id: WALL_ID,
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
