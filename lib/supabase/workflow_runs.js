"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Run History area. The only place that talks to the
// `events.workflow_runs` table. Pure: validate, console.error on failure, and
// return null / [] — never throw, never toast (the screen owns UX). DB is
// snake_case; the UI is camelCase, mapped at this boundary.
//
// A run is the outcome of one workflow execution: the trigger that fired, its
// status, timing, and a per-step log. There is no execution runner yet, so the
// table is empty until one lands — reads simply return [].

const TABLE = "workflow_runs";

// DB row -> camelCase view model the screen renders directly.
export function normalizeRun(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    workflowId: row.workflow_id ?? null,
    projectId: row.project_id ?? null,
    trigger: row.trigger ?? "",
    status: row.status ?? "Success",
    startedAt: row.started_at ?? null,
    finishedAt: row.finished_at ?? null,
    durationMs: Number(row.duration_ms ?? 0),
    stepsTotal: Number(row.steps_total ?? 0),
    stepsCompleted: Number(row.steps_completed ?? 0),
    error: row.error ?? "",
    context:
      row.context && typeof row.context === "object" && !Array.isArray(row.context)
        ? row.context
        : {},
    stepsLog: Array.isArray(row.steps_log) ? row.steps_log : [],
    createdAt: row.created_at ?? null,
    // Expansion-bag keys surface as first-class fields on the view model.
    ...meta,
  };
}

// List a project's runs, newest first. Returns null when unconfigured / on
// error (screen shows empty state), or [] when configured with no rows.
export async function listWorkflowRuns(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(500);
    if (error) {
      console.error("[workflow_runs.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeRun);
  } catch (e) {
    console.error("[workflow_runs.list]", e);
    return null;
  }
}

export async function getWorkflowRun(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.error("[workflow_runs.get]", error.message);
      return null;
    }
    return normalizeRun(data);
  } catch (e) {
    console.error("[workflow_runs.get]", e);
    return null;
  }
}
