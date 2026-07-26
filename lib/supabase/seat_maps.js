"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { generateSeats } from "@/lib/seating/generate";

// Data-access layer for seat map TEMPLATES. The only place that talks to
// events.seat_maps, events.seat_map_sections and events.seats. Keeps actions
// pure: validate, console.error on failure, and return null / false / [] —
// never throw, never toast (the screen owns UX). DB is snake_case; the UI is
// camelCase, mapped at this boundary.
//
// A seat map is one named configuration of a venue (end-stage concert,
// in-the-round, banquet rounds). It is built once and reused by many events;
// per-event seat state lives in lib/supabase/seating.js, not here.
//
// Seat coordinates are always COMPUTED by lib/seating/generate.js — nothing
// upstream supplies them.

const MAPS = "seat_maps";
const SECTIONS = "seat_map_sections";
const SEATS = "seats";

// DB row -> camelCase view model the screens render directly.
export function normalizeSeatMap(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    venueId: row.venue_id ?? null,
    name: row.name ?? "",
    status: row.status ?? "Draft",
    config: row.config && typeof row.config === "object" ? row.config : {},
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

export function normalizeSection(row) {
  if (!row) return null;
  return {
    id: row.id,
    seatMapId: row.seat_map_id ?? null,
    name: row.name ?? "",
    kind: row.kind ?? "seated",
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    rotation: Number(row.rotation ?? 0),
    layout: row.layout && typeof row.layout === "object" ? row.layout : {},
    capacity: Number(row.capacity ?? 0),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

export function normalizeSeat(row) {
  if (!row) return null;
  return {
    id: row.id,
    seatMapId: row.seat_map_id ?? null,
    sectionId: row.section_id ?? null,
    rowLabel: row.row_label ?? "",
    seatLabel: row.seat_label ?? "",
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    kind: row.kind ?? "standard",
    companionOf: row.companion_of ?? null,
    active: row.active !== false,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one update* serves a full save and an inline edit.
function toMapRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    venueId: "venue_id",
    name: "name",
    status: "status",
    config: "config",
    createdBy: "created_by",
    metadata: "metadata",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  return row;
}

function toSectionRow(input) {
  const row = {};
  const map = {
    seatMapId: "seat_map_id",
    name: "name",
    kind: "kind",
    rotation: "rotation",
    layout: "layout",
    sortOrder: "sort_order",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  for (const key of ["x", "y", "width", "height"]) {
    if (key in input) row[key] = Number(input[key]) || 0;
  }
  if ("capacity" in input) row.capacity = Math.max(0, Number(input.capacity) || 0);
  return row;
}

function toSeatRow(input) {
  const row = {};
  const map = {
    seatMapId: "seat_map_id",
    sectionId: "section_id",
    rowLabel: "row_label",
    seatLabel: "seat_label",
    kind: "kind",
    companionOf: "companion_of",
    active: "active",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  for (const key of ["x", "y"]) if (key in input) row[key] = Number(input[key]) || 0;
  return row;
}

// ---------------------------------------------------------------------------
// Seat maps
// ---------------------------------------------------------------------------

// Configurations for a venue, newest first.
export async function listSeatMaps(venueId) {
  if (!venueId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(MAPS)
      .select("*")
      .eq("venue_id", venueId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[seat_maps.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeSeatMap);
  } catch (e) {
    console.error("[seat_maps.list]", e);
    return null;
  }
}

// A configuration with its sections and seats — everything the editor needs.
export async function getSeatMap(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(MAPS)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[seat_maps.get]", error.message);
      return null;
    }
    const [sections, seats] = await Promise.all([listSections(id), listSeats(id)]);
    return {
      ...normalizeSeatMap(data),
      sections: sections ?? [],
      seats: seats ?? [],
    };
  } catch (e) {
    console.error("[seat_maps.get]", e);
    return null;
  }
}

export async function createSeatMap(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toMapRow(input);
    if (input.id) payload.id = input.id; // honour the optimistic UUID
    const { data, error } = await sb.from(MAPS).insert(payload).select("*").single();
    if (error) {
      console.error("[seat_maps.create]", error.message);
      return null;
    }
    return normalizeSeatMap(data);
  } catch (e) {
    console.error("[seat_maps.create]", e);
    return null;
  }
}

export async function updateSeatMap(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(MAPS)
      .update(toMapRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[seat_maps.update]", error.message);
      return null;
    }
    return normalizeSeatMap(data);
  } catch (e) {
    console.error("[seat_maps.update]", e);
    return null;
  }
}

export async function softDeleteSeatMap(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(MAPS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[seat_maps.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seat_maps.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

export async function listSections(seatMapId) {
  if (!seatMapId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SECTIONS)
      .select("*")
      .eq("seat_map_id", seatMapId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[seat_maps.listSections]", error.message);
      return null;
    }
    return (data || []).map(normalizeSection);
  } catch (e) {
    console.error("[seat_maps.listSections]", e);
    return null;
  }
}

export async function createSection(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toSectionRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(SECTIONS).insert(payload).select("*").single();
    if (error) {
      console.error("[seat_maps.createSection]", error.message);
      return null;
    }
    return normalizeSection(data);
  } catch (e) {
    console.error("[seat_maps.createSection]", e);
    return null;
  }
}

export async function updateSection(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SECTIONS)
      .update(toSectionRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[seat_maps.updateSection]", error.message);
      return null;
    }
    return normalizeSection(data);
  } catch (e) {
    console.error("[seat_maps.updateSection]", e);
    return null;
  }
}

// Deleting a section cascades to its seats (FK on delete cascade).
export async function deleteSection(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(SECTIONS).delete().eq("id", id);
    if (error) {
      console.error("[seat_maps.deleteSection]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seat_maps.deleteSection]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

export async function listSeats(seatMapId) {
  if (!seatMapId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SEATS)
      .select("*")
      .eq("seat_map_id", seatMapId);
    if (error) {
      console.error("[seat_maps.listSeats]", error.message);
      return null;
    }
    return (data || []).map(normalizeSeat);
  } catch (e) {
    console.error("[seat_maps.listSeats]", e);
    return null;
  }
}

export async function updateSeat(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SEATS)
      .update(toSeatRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[seat_maps.updateSeat]", error.message);
      return null;
    }
    return normalizeSeat(data);
  } catch (e) {
    console.error("[seat_maps.updateSeat]", e);
    return null;
  }
}

// Rebuild a section's chairs from its layout parameters. Replaces the section's
// seats wholesale in one delete + one bulk insert — never a per-seat round trip.
// Returns the new seat count, or false when the write fails.
export async function regenerateSectionSeats(section) {
  if (!section?.id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error: delError } = await sb.from(SEATS).delete().eq("section_id", section.id);
    if (delError) {
      console.error("[seat_maps.regenerate]", delError.message);
      return false;
    }

    const generated = generateSeats(section);
    if (generated.length === 0) return 0;

    const rows = generated.map((seat) => ({
      seat_map_id: section.seatMapId,
      section_id: section.id,
      row_label: seat.rowLabel,
      seat_label: seat.seatLabel,
      x: seat.x,
      y: seat.y,
      kind: seat.kind,
    }));
    const { error } = await sb.from(SEATS).insert(rows);
    if (error) {
      console.error("[seat_maps.regenerate]", error.message);
      return false;
    }
    return rows.length;
  } catch (e) {
    console.error("[seat_maps.regenerate]", e);
    return false;
  }
}

// Create sections + seats from a parsed CSV manifest (lib/seating/csv.js).
// The manifest owns the LABELS; generate.js owns the POSITIONS. Sections stack
// down the canvas and a short row is centred against the widest row so a ragged
// export still reads as a room.
export async function importManifest(seatMapId, parsed) {
  if (!seatMapId || !parsed?.sections?.length || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const count = parsed.sections.length;
    const bandHeight = 80 / count;
    let sectionCount = 0;
    let seatCount = 0;

    for (let i = 0; i < count; i += 1) {
      const parsedSection = parsed.sections[i];
      const created = await createSection({
        seatMapId,
        name: parsedSection.name,
        kind: "seated",
        x: 10,
        y: 10 + bandHeight * i,
        width: 80,
        height: bandHeight * 0.8,
        layout: parsedSection.layout,
        sortOrder: i,
      });
      if (!created) continue;
      sectionCount += 1;

      // Positions for a full rows x seatsPerRow grid, then take the middle
      // slice of each row so shorter rows sit centred rather than left-aligned.
      const grid = generateSeats(created);
      const perRow = created.layout.seatsPerRow || 0;
      const rows = [];
      parsedSection.rows.forEach((row, rowIndex) => {
        const offset = Math.floor((perRow - row.seats.length) / 2);
        row.seats.forEach((seat, seatIndex) => {
          const pos = grid[rowIndex * perRow + offset + seatIndex];
          if (!pos) return;
          rows.push({
            seat_map_id: seatMapId,
            section_id: created.id,
            row_label: seat.rowLabel,
            seat_label: seat.seatLabel,
            x: pos.x,
            y: pos.y,
            kind: seat.kind,
          });
        });
      });

      if (rows.length) {
        const { error } = await sb.from(SEATS).insert(rows);
        if (error) {
          console.error("[seat_maps.import]", error.message);
          continue;
        }
        seatCount += rows.length;
      }
    }

    return { sections: sectionCount, seats: seatCount };
  } catch (e) {
    console.error("[seat_maps.import]", e);
    return null;
  }
}
