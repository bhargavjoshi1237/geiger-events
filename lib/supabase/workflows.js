"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Workflows area. The only place that talks to the
// `events.workflows` table. Keeps actions pure: validate, console.error on
// failure, and return null / false / [] — never throw, never toast (the screen
// owns UX). DB is snake_case; the UI is camelCase, mapped at this boundary.
//
// A workflow is an automation: a `trigger` feeding an ordered chain of
// condition/action `steps`. `steps` is the canonical logic; `graph` carries the
// drag-drop canvas layout (node positions + connectors) over the same steps.

const TABLE = "workflows";

// DB row -> camelCase view model the screens render directly.
export function normalizeWorkflow(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Draft",
    trigger: row.trigger ?? "",
    scope: row.scope ?? "workspace",
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    steps: Array.isArray(row.steps) ? row.steps : [],
    graph:
      row.graph && typeof row.graph === "object" && !Array.isArray(row.graph)
        ? row.graph
        : {},
    viewMode: row.view_mode ?? "list",
    runCount: Number(row.run_count ?? 0),
    lastRunAt: row.last_run_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
    // Expansion-bag keys surface as first-class fields on the view model.
    ...meta,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one updateWorkflow() serves a full save and a
// single-field inline edit (`{ status }`, `{ steps, graph, viewMode }`…).
function toRow(input) {
  const row = {};
  const map = {
    name: "name",
    description: "description",
    status: "status",
    trigger: "trigger",
    scope: "scope",
    viewMode: "view_mode",
    projectId: "project_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  // Event scoping: empty string -> null so the FK stays valid.
  if ("eventId" in input) row.event_id = input.eventId || null;
  if ("steps" in input) {
    row.steps = Array.isArray(input.steps) ? input.steps : [];
  }
  if ("graph" in input) {
    row.graph =
      input.graph && typeof input.graph === "object" ? input.graph : {};
  }
  if ("runCount" in input) row.run_count = Number(input.runCount) || 0;
  if ("lastRunAt" in input) row.last_run_at = input.lastRunAt || null;
  return row;
}

export async function listWorkflows(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[workflows.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeWorkflow);
  } catch (e) {
    console.error("[workflows.list]", e);
    return null;
  }
}

export async function getWorkflow(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[workflows.get]", error.message);
      return null;
    }
    return normalizeWorkflow(data);
  } catch (e) {
    console.error("[workflows.get]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createWorkflow(input) {
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
      console.error("[workflows.create]", error.message);
      return null;
    }
    return normalizeWorkflow(data);
  } catch (e) {
    console.error("[workflows.create]", e);
    return null;
  }
}

export async function updateWorkflow(id, patch) {
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
      console.error("[workflows.update]", error.message);
      return null;
    }
    return normalizeWorkflow(data);
  } catch (e) {
    console.error("[workflows.update]", e);
    return null;
  }
}

// Soft delete — sets deleted_at; lists filter it out.
export async function softDeleteWorkflow(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[workflows.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[workflows.delete]", e);
    return false;
  }
}
