"use client";

import { createClient } from "./client";

// Data-access layer for the Events area. The only place that talks to the
// `public.flow_events` table. Keeps actions pure: validate, console.error on
// failure, and return null / false / [] — never throw, never toast (the screen
// owns UX). DB is snake_case; the UI is camelCase, mapped at this boundary.

const TABLE = "flow_events";

// The dashboard renders before the table exists (and works against bundled
// sample data when Supabase isn't configured). Guard every call so a missing
// env or missing table degrades to "no DB" rather than crashing.
export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// DB row -> camelCase view model the screens render directly.
export function normalizeEvent(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name ?? "",
    status: row.status ?? "Draft",
    type: row.type ?? "In-person",
    date: row.event_date ?? "",
    time: row.event_time ?? "",
    venue: row.venue ?? "",
    address: row.address ?? "",
    city: row.city ?? "",
    timezone: row.timezone ?? "Europe/London",
    capacity: row.capacity ?? 0,
    sold: row.sold ?? 0,
    revenue: Number(row.revenue ?? 0),
    visibility: row.visibility ?? "Public",
    organizer: row.organizer ?? "",
    summary: row.summary ?? "",
    coverUrl: row.cover_url ?? "",
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    // The series this event belongs to (null = standalone). See series.js.
    seriesId: row.series_id ?? null,
    createdBy: row.created_by ?? null,
    // Expansion-bag keys surface as first-class fields on the view model.
    ...meta,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one updateEvent() serves both a full-form save and a
// single-field inline edit (`{ status }`, `{ visibility }`…).
function toRow(input) {
  const row = {};
  const map = {
    name: "name",
    status: "status",
    type: "type",
    date: "event_date",
    time: "event_time",
    venue: "venue",
    address: "address",
    city: "city",
    timezone: "timezone",
    visibility: "visibility",
    organizer: "organizer",
    summary: "summary",
    coverUrl: "cover_url",
    // Series membership. `null` un-groups the event; the column accepts it.
    seriesId: "series_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("gallery" in input) {
    row.gallery = Array.isArray(input.gallery) ? input.gallery : [];
  }
  // Dates/times empty-string -> null so the date column stays valid.
  if ("date" in input) row.event_date = input.date || null;
  if ("time" in input) row.event_time = input.time || null;
  if ("capacity" in input) row.capacity = Number(input.capacity) || 0;
  if ("sold" in input) row.sold = Number(input.sold) || 0;
  if ("revenue" in input) row.revenue = Number(input.revenue) || 0;
  return row;
}

export async function listEvents() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[events.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeEvent);
  } catch (e) {
    console.error("[events.list]", e);
    return null;
  }
}

// All events belonging to a series, newest first. Powers the series editor's
// member list. Returns null when the DB is absent so the screen can fall back
// to sample data.
export async function listEventsBySeries(seriesId) {
  if (!seriesId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("series_id", seriesId)
      .is("deleted_at", null)
      .order("event_date", { ascending: true });
    if (error) {
      console.error("[events.listBySeries]", error.message);
      return null;
    }
    return (data || []).map(normalizeEvent);
  } catch (e) {
    console.error("[events.listBySeries]", e);
    return null;
  }
}

export async function getEvent(id) {
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
      console.error("[events.get]", error.message);
      return null;
    }
    return normalizeEvent(data);
  } catch (e) {
    console.error("[events.get]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createEvent(input) {
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
      console.error("[events.create]", error.message);
      return null;
    }
    return normalizeEvent(data);
  } catch (e) {
    console.error("[events.create]", e);
    return null;
  }
}

export async function updateEvent(id, patch) {
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
      console.error("[events.update]", error.message);
      return null;
    }
    return normalizeEvent(data);
  } catch (e) {
    console.error("[events.update]", e);
    return null;
  }
}

// Shallow-merge a config patch into the event's metadata bag (one top-level key
// per editor section). Returns true on success, false on error, or null when
// Supabase isn't configured (local-only mode — the caller treats that as a
// successful local update).
export async function updateEventMeta(eventId, patch) {
  if (!eventId || !patch) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("flow_event_merge_meta", {
      p_id: eventId,
      p_patch: patch,
    });
    if (error) {
      console.error("[events.mergeMeta]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[events.mergeMeta]", e);
    return false;
  }
}

// Soft delete — sets deleted_at; lists filter it out.
export async function softDeleteEvent(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[events.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[events.delete]", e);
    return false;
  }
}
