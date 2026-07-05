"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Tickets global modules. The only place that talks
// to the `events.ticketing_records` table — one uniform store shared by every
// module (Discounts, Payments & Methods, Payouts, Dynamic Pricing, Order
// Policies, Invoices), discriminated by `module`. Pure: validate, console.error
// on failure, return null / false / [] — never throw, never toast (the screen
// owns UX). DB is snake_case; the UI is camelCase, mapped at this boundary.
//
// A record is reusable: created/managed on its module screen, then attached to
// an event from the event editor (the event stores attached ids in its metadata
// bag), so one record can apply to many events.

const TABLE = "ticketing_records";

// DB row -> camelCase view model the screens render directly.
export function normalizeRecord(row) {
  if (!row) return null;
  const config =
    row.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row.id,
    module: row.module ?? "",
    kind: row.kind ?? "",
    name: row.name ?? "",
    active: row.active ?? true,
    config,
    projectId: row.project_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one updateRecord() serves both a full save and a
// single-field inline edit (`{ active }`, `{ name }`).
function toRow(input) {
  const row = {};
  if ("module" in input) row.module = input.module;
  if ("kind" in input) row.kind = input.kind || null;
  if ("name" in input) row.name = input.name || "Untitled";
  if ("active" in input) row.active = Boolean(input.active);
  if ("config" in input) {
    row.config =
      input.config && typeof input.config === "object" ? input.config : {};
  }
  if ("projectId" in input) row.project_id = input.projectId;
  if ("createdBy" in input) row.created_by = input.createdBy;
  return row;
}

// Records for a project + module, newest first. Requires a project id — without
// one there is nothing to scope to, so we return null (the screen keeps its
// empty state). RLS additionally guarantees only the caller's projects return.
export async function listRecords(projectId, module) {
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
      console.error("[ticketing.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeRecord);
  } catch (e) {
    console.error("[ticketing.list]", e);
    return null;
  }
}

// Records for a project across several modules at once. Powers the event-editor
// attachment panel (fetch every attachable record in one query, group by
// module). Returns a flat list of view models.
export async function listRecordsByModules(projectId, modules) {
  if (!projectId || !Array.isArray(modules) || !modules.length) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .in("module", modules)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[ticketing.listByModules]", error.message);
      return null;
    }
    return (data || []).map(normalizeRecord);
  } catch (e) {
    console.error("[ticketing.listByModules]", e);
    return null;
  }
}

// Records fetched by an explicit id list, for resolving an event's attached
// records on the public page. Order is not guaranteed — the caller re-orders to
// match its id array. RLS governs visibility.
export async function listRecordsByIds(ids) {
  if (!Array.isArray(ids) || !ids.length || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .in("id", ids)
      .is("deleted_at", null);
    if (error) {
      console.error("[ticketing.listByIds]", error.message);
      return null;
    }
    return (data || []).map(normalizeRecord);
  } catch (e) {
    console.error("[ticketing.listByIds]", e);
    return null;
  }
}

export async function getRecord(id) {
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
      console.error("[ticketing.get]", error.message);
      return null;
    }
    return normalizeRecord(data);
  } catch (e) {
    console.error("[ticketing.get]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createRecord(input) {
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
      console.error("[ticketing.create]", error.message);
      return null;
    }
    return normalizeRecord(data);
  } catch (e) {
    console.error("[ticketing.create]", e);
    return null;
  }
}

export async function updateRecord(id, patch) {
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
      console.error("[ticketing.update]", error.message);
      return null;
    }
    return normalizeRecord(data);
  } catch (e) {
    console.error("[ticketing.update]", e);
    return null;
  }
}

// Soft delete — sets deleted_at; lists filter it out.
export async function softDeleteRecord(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[ticketing.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[ticketing.delete]", e);
    return false;
  }
}
