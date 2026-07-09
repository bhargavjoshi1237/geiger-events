"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Generic data-access layer for config-driven "record manager" areas — one
// shared table per area (events.<area>_records), discriminated by `module`.
// makeRecordsApi(table) returns the full CRUD surface bound to that table, so
// each area's data file is a one-liner. Mirrors lib/supabase/ticketing.js. Pure:
// validate, console.error on failure, return null / false / [] — never throw,
// never toast (the screen owns UX). DB is snake_case; the UI is camelCase.
//
// Module-specific fields live in the `config` jsonb bag; only name/status/cover
// are promoted columns.

// DB row -> camelCase view model.
export function normalizeRecord(row) {
  if (!row) return null;
  const config =
    row.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row.id,
    module: row.module ?? "",
    name: row.name ?? "",
    status: row.status ?? "Draft",
    coverUrl: row.cover_url ?? "",
    config,
    projectId: row.project_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one update serves a full save or a single-field edit.
function toRow(input) {
  const row = {};
  if ("module" in input) row.module = input.module;
  if ("name" in input) row.name = input.name || "Untitled";
  if ("status" in input) row.status = input.status || "Draft";
  if ("coverUrl" in input) row.cover_url = input.coverUrl || null;
  if ("config" in input) {
    row.config =
      input.config && typeof input.config === "object" ? input.config : {};
  }
  if ("projectId" in input) row.project_id = input.projectId;
  if ("createdBy" in input) row.created_by = input.createdBy;
  return row;
}

// Build the CRUD surface for one area's records table.
export function makeRecordsApi(TABLE) {
  async function list(projectId, module) {
    if (!projectId || !module || !isSupabaseConfigured()) return null;
    try {
      const sb = createClient();
      const { data, error } = await sb
        .from(TABLE)
        .select("*")
        .eq("project_id", projectId)
        .eq("module", module)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) {
        console.error(`[${TABLE}.list]`, error.message);
        return null;
      }
      return (data || []).map(normalizeRecord);
    } catch (e) {
      console.error(`[${TABLE}.list]`, e);
      return null;
    }
  }

  async function get(id) {
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
        console.error(`[${TABLE}.get]`, error.message);
        return null;
      }
      return normalizeRecord(data);
    } catch (e) {
      console.error(`[${TABLE}.get]`, e);
      return null;
    }
  }

  // Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
  // optimistic rendering) so the row and the optimistic list entry stay in sync.
  async function create(input) {
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
        console.error(`[${TABLE}.create]`, error.message);
        return null;
      }
      return normalizeRecord(data);
    } catch (e) {
      console.error(`[${TABLE}.create]`, e);
      return null;
    }
  }

  async function update(id, patch) {
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
        console.error(`[${TABLE}.update]`, error.message);
        return null;
      }
      return normalizeRecord(data);
    } catch (e) {
      console.error(`[${TABLE}.update]`, e);
      return null;
    }
  }

  // Soft delete — sets deleted_at; lists filter it out.
  async function remove(id) {
    if (!id || !isSupabaseConfigured()) return false;
    try {
      const sb = createClient();
      const { error } = await sb
        .from(TABLE)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id);
      if (error) {
        console.error(`[${TABLE}.delete]`, error.message);
        return false;
      }
      return true;
    } catch (e) {
      console.error(`[${TABLE}.delete]`, e);
      return false;
    }
  }

  return { list, get, create, update, remove };
}
