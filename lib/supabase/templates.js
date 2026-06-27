"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Templates area. The only place that talks to the
// `public.flow_event_templates` table. Pure: validate, console.error on failure,
// return null / false / [] — never throw, never toast (the screen owns UX). DB
// is snake_case; the UI is camelCase, mapped at this boundary.
//
// A template carries a `blueprint` (in the metadata bag): the event defaults
// applied when you "Use" it. `uses` counts events spun up from it.

const TABLE = "flow_event_templates";

// DB row -> camelCase view model the screens render directly.
export function normalizeTemplate(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    category: row.category ?? "Community",
    icon: row.icon ?? "Sparkles",
    uses: row.uses ?? 0,
    // The event defaults applied on use; always an object so callers can spread.
    blueprint: meta.blueprint && typeof meta.blueprint === "object"
      ? meta.blueprint
      : {},
    createdBy: row.created_by ?? null,
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
    icon: "icon",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("uses" in input) row.uses = Number(input.uses) || 0;
  // The blueprint lives under a single top-level metadata key.
  if ("blueprint" in input) {
    row.metadata = { blueprint: input.blueprint || {} };
  }
  return row;
}

export async function listTemplates() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[templates.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeTemplate);
  } catch (e) {
    console.error("[templates.list]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createTemplate(input) {
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
      console.error("[templates.create]", error.message);
      return null;
    }
    return normalizeTemplate(data);
  } catch (e) {
    console.error("[templates.create]", e);
    return null;
  }
}

export async function updateTemplate(id, patch) {
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
      console.error("[templates.update]", error.message);
      return null;
    }
    return normalizeTemplate(data);
  } catch (e) {
    console.error("[templates.update]", e);
    return null;
  }
}

// Bump the use counter when an event is created from the template. Best-effort:
// returns the new count, or null when the DB is absent / on error.
export async function incrementTemplateUses(id, current = 0) {
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
      console.error("[templates.incrementUses]", error.message);
      return null;
    }
    return data?.uses ?? next;
  } catch (e) {
    console.error("[templates.incrementUses]", e);
    return null;
  }
}

// Soft delete — sets deleted_at; lists filter it out.
export async function softDeleteTemplate(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[templates.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[templates.delete]", e);
    return false;
  }
}
