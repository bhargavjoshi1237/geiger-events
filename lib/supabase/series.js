"use client";

import { createClient } from "./client";
import {
  isSupabaseConfigured,
  listEventsBySeries,
  updateEvent,
} from "./events";

// Data-access layer for the Event Series area. Owns the
// `events.event_series` table. The event<->series link itself lives on
// `events.events.series_id` (owned by events.js), so membership reads/writes
// here delegate to that module — one table, one owner. Pure: validate,
// console.error on failure, return null / false / [] — the screen owns UX.
//
// Shared settings (defaults applied to new events, recurrence, member order,
// follow page) live in the `settings` jsonb bag and are shallow-merged a tab at
// a time via the series_merge_settings RPC.

const TABLE = "event_series";

// DB row -> camelCase view model the screens render directly.
export function normalizeSeries(row) {
  if (!row) return null;
  const settings =
    row.settings && typeof row.settings === "object" ? row.settings : {};
  return {
    id: row.id,
    name: row.name ?? "",
    description: row.description ?? "",
    status: row.status ?? "Draft",
    cadence: row.cadence ?? "Monthly",
    visibility: row.visibility ?? "Public",
    // Structured config, kept whole (not spread) — tabs read/write nested keys.
    settings: {
      defaults: settings.defaults && typeof settings.defaults === "object"
        ? settings.defaults
        : {},
      recurrence: settings.recurrence && typeof settings.recurrence === "object"
        ? settings.recurrence
        : {},
      eventOrder: Array.isArray(settings.eventOrder) ? settings.eventOrder : [],
      followPage: Boolean(settings.followPage),
    },
    createdBy: row.created_by ?? null,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present, so one helper serves a full create and a partial inline update.
function toRow(input) {
  const row = {};
  const map = {
    name: "name",
    description: "description",
    status: "status",
    cadence: "cadence",
    visibility: "visibility",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  // Wholesale settings write (rare — prefer mergeSeriesSettings per tab).
  if ("settings" in input) row.settings = input.settings || {};
  return row;
}

export async function listSeries() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[series.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeSeries);
  } catch (e) {
    console.error("[series.list]", e);
    return null;
  }
}

export async function getSeries(id) {
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
      console.error("[series.get]", error.message);
      return null;
    }
    return normalizeSeries(data);
  } catch (e) {
    console.error("[series.get]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` for optimistic rendering.
export async function createSeries(input) {
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
      console.error("[series.create]", error.message);
      return null;
    }
    return normalizeSeries(data);
  } catch (e) {
    console.error("[series.create]", e);
    return null;
  }
}

export async function updateSeries(id, patch) {
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
      console.error("[series.update]", error.message);
      return null;
    }
    return normalizeSeries(data);
  } catch (e) {
    console.error("[series.update]", e);
    return null;
  }
}

// Shallow-merge a settings patch (one top-level key per editor tab: defaults,
// recurrence, eventOrder, followPage). Returns true on success, false on error,
// null when the DB is absent (caller treats that as a successful local update).
export async function mergeSeriesSettings(id, patch) {
  if (!id || !patch) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("series_merge_settings", {
      p_id: id,
      p_patch: patch,
    });
    if (error) {
      console.error("[series.mergeSettings]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[series.mergeSettings]", e);
    return false;
  }
}

// Soft delete — sets deleted_at; the events' series_id is left intact here and
// cleared by the ON DELETE SET NULL FK if the row is ever hard-deleted. For a
// soft delete the caller should detach members first (detachAllFromSeries).
export async function softDeleteSeries(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[series.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[series.delete]", e);
    return false;
  }
}

// --- Membership (delegates to events.js — flow_events owns the link) ---------

// Events in a series, ordered by date. Mirrors listEventsBySeries so callers
// import one module for all series concerns.
export function listSeriesEvents(seriesId) {
  return listEventsBySeries(seriesId);
}

// Attach an event to (or, with seriesId=null, detach it from) a series.
export function setEventSeries(eventId, seriesId) {
  return updateEvent(eventId, { seriesId: seriesId || null });
}
