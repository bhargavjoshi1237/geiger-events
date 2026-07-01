"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Venues area. The only place that talks to the
// `events.venues` table. Keeps actions pure: validate, console.error on
// failure, and return null / false / [] — never throw, never toast (the screen
// owns UX). DB is snake_case; the UI is camelCase, mapped at this boundary.
//
// A venue is a reusable place an event is held at. Events link to one via
// events.events.venue_id (owned by events.js) and keep a text snapshot for
// display; the public event page loads the full detail through getVenue().

const TABLE = "venues";

// DB row -> camelCase view model the screens render directly.
export function normalizeVenue(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    name: row.name ?? "",
    type: row.type ?? "Indoor",
    status: row.status ?? "Active",
    description: row.description ?? "",
    // Location
    address: row.address ?? "",
    city: row.city ?? "",
    region: row.region ?? "",
    postcode: row.postcode ?? "",
    country: row.country ?? "",
    timezone: row.timezone ?? "Europe/London",
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    parkingNotes: row.parking_notes ?? "",
    transitNotes: row.transit_notes ?? "",
    // Capacity & amenities
    seatedCapacity: row.seated_capacity ?? 0,
    standingCapacity: row.standing_capacity ?? 0,
    spaces: row.spaces ?? 1,
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    // Contact
    contactName: row.contact_name ?? "",
    contactEmail: row.contact_email ?? "",
    contactPhone: row.contact_phone ?? "",
    website: row.website ?? "",
    // Media
    coverUrl: row.cover_url ?? "",
    gallery: Array.isArray(row.gallery) ? row.gallery : [],
    projectId: row.project_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    // Expansion-bag keys surface as first-class fields on the view model.
    ...meta,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one updateVenue() serves both a full-form save and a
// single-field inline edit (`{ status }`, `{ city }`…).
function toRow(input) {
  const row = {};
  const map = {
    name: "name",
    type: "type",
    status: "status",
    description: "description",
    address: "address",
    city: "city",
    region: "region",
    postcode: "postcode",
    country: "country",
    timezone: "timezone",
    parkingNotes: "parking_notes",
    transitNotes: "transit_notes",
    contactName: "contact_name",
    contactEmail: "contact_email",
    contactPhone: "contact_phone",
    website: "website",
    coverUrl: "cover_url",
    projectId: "project_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("amenities" in input) {
    row.amenities = Array.isArray(input.amenities) ? input.amenities : [];
  }
  if ("gallery" in input) {
    row.gallery = Array.isArray(input.gallery) ? input.gallery : [];
  }
  // Numerics coerced; empty-string coordinates -> null so the column stays valid.
  if ("seatedCapacity" in input) row.seated_capacity = Number(input.seatedCapacity) || 0;
  if ("standingCapacity" in input) row.standing_capacity = Number(input.standingCapacity) || 0;
  if ("spaces" in input) row.spaces = Number(input.spaces) || 0;
  if ("latitude" in input) {
    row.latitude = input.latitude === "" || input.latitude === null ? null : Number(input.latitude);
  }
  if ("longitude" in input) {
    row.longitude = input.longitude === "" || input.longitude === null ? null : Number(input.longitude);
  }
  return row;
}

// Venues in a project, newest first. Requires a project id — without one there
// is nothing to scope to, so we return null (the screen keeps its empty state).
export async function listVenues(projectId) {
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
      console.error("[venues.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeVenue);
  } catch (e) {
    console.error("[venues.list]", e);
    return null;
  }
}

export async function getVenue(id) {
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
      console.error("[venues.get]", error.message);
      return null;
    }
    return normalizeVenue(data);
  } catch (e) {
    console.error("[venues.get]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createVenue(input) {
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
      console.error("[venues.create]", error.message);
      return null;
    }
    return normalizeVenue(data);
  } catch (e) {
    console.error("[venues.create]", e);
    return null;
  }
}

export async function updateVenue(id, patch) {
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
      console.error("[venues.update]", error.message);
      return null;
    }
    return normalizeVenue(data);
  } catch (e) {
    console.error("[venues.update]", e);
    return null;
  }
}

// Shallow-merge a config patch into the venue's metadata bag (one top-level key
// per editor section). Returns true on success, false on error, or null when
// Supabase isn't configured (local-only mode — the caller treats that as a
// successful local update).
export async function mergeVenueMeta(id, patch) {
  if (!id || !patch) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { error } = await sb.rpc("venue_merge_meta", {
      p_id: id,
      p_patch: patch,
    });
    if (error) {
      console.error("[venues.mergeMeta]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[venues.mergeMeta]", e);
    return false;
  }
}

// Soft delete — sets deleted_at; lists filter it out. Any events linked to the
// venue keep their text snapshot (the FK is ON DELETE SET NULL on hard delete).
export async function softDeleteVenue(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[venues.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[venues.delete]", e);
    return false;
  }
}
