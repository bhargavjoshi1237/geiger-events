"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for events.venue_spaces — the rooms inside a venue that floor plans are drawn
// against and Instant Book books. Pure: console.error on failure, return null / false / [], never throw.
// Dimensions are stored in metres; `unit` is the display preference only.

const SPACES = "venue_spaces";

export const SPACE_KINDS = ["room", "hall", "ballroom", "outdoor", "suite", "other"];

export const METRES_PER_FOOT = 0.3048;

// Setup styles a space records a capacity for (keys of `capacities`).
export { SETUP_STYLES } from "@/lib/venue_booking/styles";

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

export function normalizeVenueSpace(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    venueId: row.venue_id ?? null,
    name: row.name ?? "",
    kind: row.kind ?? "room",
    floor: row.floor ?? "",
    widthM: num(row.width_m),
    lengthM: num(row.length_m),
    heightM: num(row.height_m),
    unit: row.unit === "ft" ? "ft" : "m",
    capacities: row.capacities && typeof row.capacities === "object" ? row.capacities : {},
    description: row.description ?? "",
    sortOrder: Number(row.sort_order ?? 0),
    config: row.config && typeof row.config === "object" ? row.config : {},
    // Instant Book setup (20261108110000_venue_bookings.sql).
    bookable: row.bookable === true,
    rateHourly: num(row.rate_hourly),
    rateHalfDay: num(row.rate_half_day),
    rateFullDay: num(row.rate_full_day),
    currency: row.rate_currency || "GBP",
    minHours: num(row.min_hours) ?? 0,
    bufferMinutes: Number(row.buffer_minutes ?? 0) || 0,
    openingHours:
      row.opening_hours && typeof row.opening_hours === "object" && !Array.isArray(row.opening_hours)
        ? row.opening_hours
        : {},
    blackoutDates: Array.isArray(row.blackout_dates) ? row.blackout_dates : [],
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function spaceToRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId || null;
  if ("venueId" in input) row.venue_id = input.venueId || null;
  if ("createdBy" in input) row.created_by = input.createdBy || null;
  if ("name" in input) row.name = input.name || "Untitled space";
  if ("kind" in input) row.kind = SPACE_KINDS.includes(input.kind) ? input.kind : "other";
  if ("floor" in input) row.floor = input.floor || "";
  if ("widthM" in input) row.width_m = num(input.widthM);
  if ("lengthM" in input) row.length_m = num(input.lengthM);
  if ("heightM" in input) row.height_m = num(input.heightM);
  if ("unit" in input) row.unit = input.unit === "ft" ? "ft" : "m";
  if ("capacities" in input) {
    row.capacities = input.capacities && typeof input.capacities === "object" ? input.capacities : {};
  }
  if ("description" in input) row.description = input.description || "";
  if ("sortOrder" in input) row.sort_order = Number(input.sortOrder) || 0;
  if ("config" in input) row.config = input.config && typeof input.config === "object" ? input.config : {};
  if ("bookable" in input) row.bookable = input.bookable === true;
  if ("rateHourly" in input) row.rate_hourly = num(input.rateHourly);
  if ("rateHalfDay" in input) row.rate_half_day = num(input.rateHalfDay);
  if ("rateFullDay" in input) row.rate_full_day = num(input.rateFullDay);
  if ("currency" in input) row.rate_currency = String(input.currency || "GBP").toUpperCase().slice(0, 3);
  if ("minHours" in input) row.min_hours = Math.max(0, num(input.minHours) ?? 0);
  if ("bufferMinutes" in input) row.buffer_minutes = Math.max(0, Math.round(Number(input.bufferMinutes) || 0));
  if ("openingHours" in input) {
    row.opening_hours =
      input.openingHours && typeof input.openingHours === "object" && !Array.isArray(input.openingHours)
        ? input.openingHours
        : {};
  }
  if ("blackoutDates" in input) row.blackout_dates = Array.isArray(input.blackoutDates) ? input.blackoutDates : [];
  return row;
}

// Every live space in the project, optionally narrowed to one venue.
export async function listVenueSpaces(projectId, { venueId } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let query = sb
      .from(SPACES)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (venueId) query = query.eq("venue_id", venueId);
    const { data, error } = await query
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[venue_spaces.listVenueSpaces]", error.message);
      return null;
    }
    return (data || []).map(normalizeVenueSpace);
  } catch (e) {
    console.error("[venue_spaces.listVenueSpaces]", e);
    return null;
  }
}

export async function getVenueSpace(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.from(SPACES).select("*").eq("id", id).maybeSingle();
    if (error) {
      console.error("[venue_spaces.getVenueSpace]", error.message);
      return null;
    }
    return normalizeVenueSpace(data);
  } catch (e) {
    console.error("[venue_spaces.getVenueSpace]", e);
    return null;
  }
}

export async function createVenueSpace(input) {
  if (!input?.projectId || !input?.venueId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = spaceToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(SPACES).insert(payload).select("*").single();
    if (error) {
      console.error("[venue_spaces.createVenueSpace]", error.message);
      return null;
    }
    return normalizeVenueSpace(data);
  } catch (e) {
    console.error("[venue_spaces.createVenueSpace]", e);
    return null;
  }
}

export async function updateVenueSpace(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SPACES)
      .update(spaceToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[venue_spaces.updateVenueSpace]", error.message);
      return null;
    }
    return normalizeVenueSpace(data);
  } catch (e) {
    console.error("[venue_spaces.updateVenueSpace]", e);
    return null;
  }
}

export async function softDeleteVenueSpace(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(SPACES)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[venue_spaces.softDeleteVenueSpace]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[venue_spaces.softDeleteVenueSpace]", e);
    return false;
  }
}

// Floor area in square metres, or null when either dimension is missing.
export function spaceAreaM2(space) {
  if (!space?.widthM || !space?.lengthM) return null;
  return Number(space.widthM) * Number(space.lengthM);
}
