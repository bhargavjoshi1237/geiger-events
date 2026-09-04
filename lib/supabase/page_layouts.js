"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for saved page layouts. The only place that talks to the
// `events.page_layouts` table. Pure: validate, console.error on failure, return
// null / false / [] — never throw, never toast (the screen owns UX). DB is
// snake_case; the UI is camelCase, mapped at this boundary.
//
// A layout carries the builder's `tree` and the `theme` it was designed
// against, so applying one restores both the arrangement and its look.

const TABLE = "page_layouts";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : null;
}

// DB row -> camelCase view model the screens render directly.
export function normalizeLayout(row) {
  if (!row) return null;
  const tree = asObject(row.tree);
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    category: row.category ?? "Saved",
    // Always a usable tree or null, so callers never apply an empty layout.
    tree: tree?.sections?.length ? tree : null,
    theme: asObject(row.theme),
    uses: row.uses ?? 0,
    projectId: row.project_id ?? null,
    createdBy: row.created_by ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present, so one helper serves a full create and a partial update.
function toRow(input) {
  const row = {};
  const map = {
    name: "name",
    description: "description",
    category: "category",
    projectId: "project_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("uses" in input) row.uses = Number(input.uses) || 0;
  if ("tree" in input) row.tree = input.tree || {};
  if ("theme" in input) row.theme = input.theme || {};
  return row;
}

export async function listLayouts(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
    if (error) {
      console.error("[page_layouts.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeLayout);
  } catch (e) {
    console.error("[page_layouts.list]", e);
    return null;
  }
}

export async function createLayout(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .insert(toRow(input))
      .select("*")
      .single();
    if (error) {
      console.error("[page_layouts.create]", error.message);
      return null;
    }
    return normalizeLayout(data);
  } catch (e) {
    console.error("[page_layouts.create]", e);
    return null;
  }
}

export async function updateLayout(id, patch) {
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
      console.error("[page_layouts.update]", error.message);
      return null;
    }
    return normalizeLayout(data);
  } catch (e) {
    console.error("[page_layouts.update]", e);
    return null;
  }
}

// Bump the use counter when a layout is applied to a page. Best-effort: returns
// the new count, or null when the DB is absent / on error.
export async function incrementLayoutUses(id, current = 0) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const next = Number(current) + 1;
    const { data, error } = await sb
      .from(TABLE)
      .update({ uses: next })
      .eq("id", id)
      .select("uses")
      .single();
    if (error) {
      console.error("[page_layouts.incrementUses]", error.message);
      return null;
    }
    return data?.uses ?? next;
  } catch (e) {
    console.error("[page_layouts.incrementUses]", e);
    return null;
  }
}

// Soft delete — sets deleted_at; lists filter it out.
export async function softDeleteLayout(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[page_layouts.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[page_layouts.delete]", e);
    return false;
  }
}
