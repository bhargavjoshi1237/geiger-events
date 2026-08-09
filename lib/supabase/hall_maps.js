"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalizeBackground, normalizeField } from "./seat_maps";

// Data-access layer for exhibitor hall TEMPLATES. The only place that talks to
// events.hall_maps and events.hall_booths. Keeps actions pure: validate,
// console.error on failure, and return null / false / [] — never throw, never
// toast (the screen owns UX). DB is snake_case; the UI is camelCase, mapped at
// this boundary.
//
// A hall map is one named exhibitor-floor configuration of a venue, built once
// and reused by many events — the same relationship seat maps have to seating.
// Per-event booth state lives in lib/supabase/expo.js, not here.
//
// Unlike a seat map section, a booth has no interior to generate: the booth IS
// the unit of sale, so its geometry is authored directly rather than computed.

const MAPS = "hall_maps";
const BOOTHS = "hall_booths";

// A hall floor has no pitch or stage by default — it's an open room.
const DEFAULT_HALL_CONFIG = { aspect: "4/3", field: { shape: "none" } };

export function normalizeHallMap(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  const config = row.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    venueId: row.venue_id ?? null,
    name: row.name ?? "",
    status: row.status ?? "Draft",
    config,
    aspect: config.aspect || DEFAULT_HALL_CONFIG.aspect,
    // Halls share the seat map's field and background shape, so the same canvas
    // and the same editor controls serve both.
    field: normalizeField(config.field ? config : DEFAULT_HALL_CONFIG),
    background: normalizeBackground(config),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

export function normalizeBooth(row) {
  if (!row) return null;
  return {
    id: row.id,
    hallMapId: row.hall_map_id ?? null,
    code: row.code ?? "",
    name: row.name ?? "",
    kind: row.kind ?? "booth",
    hall: row.hall ?? "",
    sizeClass: row.size_class ?? "Standard",
    price: Number(row.price ?? 0),
    x: Number(row.x ?? 0),
    y: Number(row.y ?? 0),
    width: Number(row.width ?? 0),
    height: Number(row.height ?? 0),
    rotation: Number(row.rotation ?? 0),
    amenities: row.amenities && typeof row.amenities === "object" ? row.amenities : {},
    metadata: row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    active: row.active !== false,
    sortOrder: Number(row.sort_order ?? 0),
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

function toBoothRow(input) {
  const row = {};
  const map = {
    hallMapId: "hall_map_id",
    code: "code",
    name: "name",
    kind: "kind",
    hall: "hall",
    sizeClass: "size_class",
    amenities: "amenities",
    metadata: "metadata",
    active: "active",
    sortOrder: "sort_order",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  for (const key of ["x", "y", "width", "height", "rotation"]) {
    if (key in input) row[key] = Number(input[key]) || 0;
  }
  if ("price" in input) row.price = Math.max(0, Number(input.price) || 0);
  return row;
}

// ---------------------------------------------------------------------------
// Hall maps
// ---------------------------------------------------------------------------

// Hall configurations for a venue, newest first. Pass no venue to list every
// hall in the project — the event editor picks from all of them, because an
// event's hall need not belong to the venue it is held at.
export async function listHallMaps(venueId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let query = sb.from(MAPS).select("*").is("deleted_at", null);
    if (venueId) query = query.eq("venue_id", venueId);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) {
      console.error("[hall_maps.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeHallMap);
  } catch (e) {
    console.error("[hall_maps.list]", e);
    return null;
  }
}

// A hall map with its booths, for the editor and the box office.
export async function getHallMap(id) {
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
      console.error("[hall_maps.get]", error.message);
      return null;
    }
    const booths = await listBooths(id);
    return { map: normalizeHallMap(data), booths: booths ?? [] };
  } catch (e) {
    console.error("[hall_maps.get]", e);
    return null;
  }
}

export async function createHallMap(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toMapRow({ config: DEFAULT_HALL_CONFIG, ...input });
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(MAPS).insert(payload).select("*").single();
    if (error) {
      console.error("[hall_maps.create]", error.message);
      return null;
    }
    return normalizeHallMap(data);
  } catch (e) {
    console.error("[hall_maps.create]", e);
    return null;
  }
}

export async function updateHallMap(id, patch) {
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
      console.error("[hall_maps.update]", error.message);
      return null;
    }
    return normalizeHallMap(data);
  } catch (e) {
    console.error("[hall_maps.update]", e);
    return null;
  }
}

export async function softDeleteHallMap(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(MAPS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[hall_maps.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[hall_maps.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Booths
// ---------------------------------------------------------------------------

export async function listBooths(hallMapId) {
  if (!hallMapId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(BOOTHS)
      .select("*")
      .eq("hall_map_id", hallMapId)
      .order("sort_order", { ascending: true });
    if (error) {
      console.error("[hall_maps.listBooths]", error.message);
      return null;
    }
    return (data || []).map(normalizeBooth);
  } catch (e) {
    console.error("[hall_maps.listBooths]", e);
    return null;
  }
}

export async function createBooth(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toBoothRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(BOOTHS).insert(payload).select("*").single();
    if (error) {
      console.error("[hall_maps.createBooth]", error.message);
      return null;
    }
    return normalizeBooth(data);
  } catch (e) {
    console.error("[hall_maps.createBooth]", e);
    return null;
  }
}

export async function updateBooth(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(BOOTHS)
      .update(toBoothRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[hall_maps.updateBooth]", error.message);
      return null;
    }
    return normalizeBooth(data);
  } catch (e) {
    console.error("[hall_maps.updateBooth]", e);
    return null;
  }
}

export async function deleteBooth(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(BOOTHS).delete().eq("id", id);
    if (error) {
      console.error("[hall_maps.deleteBooth]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[hall_maps.deleteBooth]", e);
    return false;
  }
}

// Lay a block of identical booths out in a grid in one insert. Authoring 120
// stalls one rectangle at a time is the thing this exists to avoid; the
// organiser then drags the few that don't fit the real hall.
//
// `startAt` is the number the codes count from, so a second block can continue
// where the first left off.
export async function createBoothGrid(
  hallMapId,
  {
    rows = 4,
    columns = 6,
    prefix = "A",
    startAt = 1,
    sizeClass = "Standard",
    price = 0,
    hall = "",
    x = 8,
    y = 12,
    width = 8,
    height = 6,
    gapX = 3,
    gapY = 4,
    sortFrom = 0,
  } = {},
) {
  if (!hallMapId || !isSupabaseConfigured()) return null;
  const rowCount = Math.max(1, Math.round(rows));
  const colCount = Math.max(1, Math.round(columns));

  try {
    const sb = createClient();
    const drafts = [];
    let n = 0;
    for (let r = 0; r < rowCount; r += 1) {
      for (let c = 0; c < colCount; c += 1) {
        const code = `${prefix}${startAt + n}`;
        drafts.push(
          toBoothRow({
            hallMapId,
            code,
            name: code,
            kind: "booth",
            hall,
            sizeClass,
            price,
            x: x + c * (width + gapX),
            y: y + r * (height + gapY),
            width,
            height,
            rotation: 0,
            sortOrder: sortFrom + n,
          }),
        );
        n += 1;
      }
    }

    const { data, error } = await sb.from(BOOTHS).insert(drafts).select("*");
    if (error) {
      console.error("[hall_maps.createBoothGrid]", error.message);
      return null;
    }
    return (data || []).map(normalizeBooth);
  } catch (e) {
    console.error("[hall_maps.createBoothGrid]", e);
    return null;
  }
}
