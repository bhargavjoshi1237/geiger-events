"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { syncHallBooths } from "./hall_maps";
import {
  cloneObjects,
  hallBoothsFromPlan,
  normaliseObjects,
  normaliseOutline,
  normaliseSetupStyle,
  planContent,
  planToSvg,
  PLAN_KINDS,
  PLAN_STATUSES,
} from "@/lib/event_design";

// Data-access layer for events.floor_plans — plans, room templates and venue library diagrams (one table, `kind`).
// Content saves are versioned: saveFloorPlan() only lands on the version it started from. Never throws.

const TABLE = "floor_plans";

const num = (v, fallback = null) => {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export function normalizeFloorPlan(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    venueId: row.venue_id ?? null,
    venueSpaceId: row.venue_space_id ?? null,
    eventId: row.event_id ?? null,
    sourcePlanId: row.source_plan_id ?? null,
    hallMapId: row.hall_map_id ?? null,
    name: row.name ?? "",
    kind: PLAN_KINDS.includes(row.kind) ? row.kind : "plan",
    status: PLAN_STATUSES.includes(row.status) ? row.status : "draft",
    widthM: num(row.width_m, 20),
    lengthM: num(row.length_m, 15),
    unit: row.unit === "ft" ? "ft" : "m",
    outline: normaliseOutline(row.outline),
    setupStyle: normaliseSetupStyle(row.setup_style),
    objects: normaliseObjects(row.objects),
    templateCategory: row.template_category ?? "",
    notes: row.notes ?? "",
    thumbnail: row.thumbnail ?? "",
    version: Number(row.version ?? 1),
    metadata: obj(row.metadata),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// camelCase → columns, only for keys present (so one function serves full saves and single-field edits).
function floorPlanToRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId || null;
  if ("venueId" in input) row.venue_id = input.venueId || null;
  if ("venueSpaceId" in input) row.venue_space_id = input.venueSpaceId || null;
  if ("eventId" in input) row.event_id = input.eventId || null;
  if ("sourcePlanId" in input) row.source_plan_id = input.sourcePlanId || null;
  if ("hallMapId" in input) row.hall_map_id = input.hallMapId || null;
  if ("createdBy" in input) row.created_by = input.createdBy || null;
  if ("name" in input) row.name = String(input.name || "").trim() || "Untitled plan";
  if ("kind" in input) row.kind = PLAN_KINDS.includes(input.kind) ? input.kind : "plan";
  if ("status" in input) row.status = PLAN_STATUSES.includes(input.status) ? input.status : "draft";
  if ("widthM" in input) row.width_m = num(input.widthM, 20);
  if ("lengthM" in input) row.length_m = num(input.lengthM, 15);
  if ("unit" in input) row.unit = input.unit === "ft" ? "ft" : "m";
  if ("outline" in input) row.outline = normaliseOutline(input.outline);
  if ("setupStyle" in input) row.setup_style = normaliseSetupStyle(input.setupStyle);
  if ("objects" in input) row.objects = normaliseObjects(input.objects);
  if ("templateCategory" in input) row.template_category = input.templateCategory || "";
  if ("notes" in input) row.notes = input.notes || "";
  if ("thumbnail" in input) row.thumbnail = input.thumbnail || "";
  if ("metadata" in input) row.metadata = obj(input.metadata);
  return row;
}

// Content columns + a fresh thumbnail, from a plan-shaped object.
function contentRow(plan) {
  const content = planContent(plan);
  return {
    ...floorPlanToRow(content),
    thumbnail: planToSvg({ ...content, name: plan?.name }),
  };
}

// Plans of one kind ("plan" | "template" | "library" | "all"), optionally narrowed to a venue, space or event.
export async function listFloorPlans(projectId, { kind = "plan", venueId, venueSpaceId, eventId } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let query = sb.from(TABLE).select("*").eq("project_id", projectId).is("deleted_at", null);
    if (kind && kind !== "all") query = query.eq("kind", kind);
    if (venueId) query = query.eq("venue_id", venueId);
    if (venueSpaceId) query = query.eq("venue_space_id", venueSpaceId);
    if (eventId) query = query.eq("event_id", eventId);
    const { data, error } = await query.order("updated_at", { ascending: false });
    if (error) {
      console.error("[floor_plans.listFloorPlans]", error.message);
      return null;
    }
    return (data || []).map(normalizeFloorPlan);
  } catch (e) {
    console.error("[floor_plans.listFloorPlans]", e);
    return null;
  }
}

export async function getFloorPlan(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.from(TABLE).select("*").eq("id", id).is("deleted_at", null).maybeSingle();
    if (error) {
      console.error("[floor_plans.getFloorPlan]", error.message);
      return null;
    }
    return normalizeFloorPlan(data);
  } catch (e) {
    console.error("[floor_plans.getFloorPlan]", e);
    return null;
  }
}

export async function createFloorPlan(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = { ...floorPlanToRow(input), ...contentRow(input), version: 1 };
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[floor_plans.createFloorPlan]", error.message);
      return null;
    }
    const created = normalizeFloorPlan(data);
    if (created.kind === "expo" && created.hallMapId) {
      const { aspect, booths } = hallBoothsFromPlan(created);
      created.boothSync = (await syncHallBooths(created.hallMapId, booths, aspect)) === null ? "failed" : "ok";
    }
    return created;
  } catch (e) {
    console.error("[floor_plans.createFloorPlan]", e);
    return null;
  }
}

// Metadata edits (name, status, links, notes, template category) — does not touch content or version.
export async function updateFloorPlan(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(floorPlanToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[floor_plans.updateFloorPlan]", error.message);
      return null;
    }
    return normalizeFloorPlan(data);
  } catch (e) {
    console.error("[floor_plans.updateFloorPlan]", e);
    return null;
  }
}

// Saves editor content as version expectedVersion + 1 → the saved plan, "conflict" if a newer version landed first, or null; `force` overwrites.
export async function saveFloorPlan(id, plan, expectedVersion, { force = false } = {}) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let base = Number(expectedVersion) || 1;
    if (force) {
      const { data: current, error: readError } = await sb.from(TABLE).select("version").eq("id", id).maybeSingle();
      if (readError || !current) {
        console.error("[floor_plans.saveFloorPlan]", readError?.message || "plan not found");
        return null;
      }
      base = Number(current.version) || 1;
    }
    const meta = floorPlanToRow({
      ...("name" in plan ? { name: plan.name } : {}),
      ...("notes" in plan ? { notes: plan.notes } : {}),
      ...("venueId" in plan ? { venueId: plan.venueId } : {}),
      ...("venueSpaceId" in plan ? { venueSpaceId: plan.venueSpaceId } : {}),
      ...("eventId" in plan ? { eventId: plan.eventId } : {}),
    });
    const { data, error } = await sb
      .from(TABLE)
      .update({ ...meta, ...contentRow(plan), version: base + 1 })
      .eq("id", id)
      .eq("version", base)
      .select("*");
    if (error) {
      console.error("[floor_plans.saveFloorPlan]", error.message);
      return null;
    }
    if (!data?.length) return "conflict";
    const saved = normalizeFloorPlan(data[0]);
    // An expo hall's booths are what checkout sells, so every content save re-projects them; `boothSync` tells the caller.
    if (saved.kind === "expo" && saved.hallMapId) {
      const { aspect, booths } = hallBoothsFromPlan(saved);
      saved.boothSync = (await syncHallBooths(saved.hallMapId, booths, aspect)) === null ? "failed" : "ok";
    }
    return saved;
  } catch (e) {
    console.error("[floor_plans.saveFloorPlan]", e);
    return null;
  }
}

// New plan / template / library row copied from `source` (fresh instance ids, sourcePlanId set); `overrides` wins.
export async function copyFloorPlan(source, overrides = {}) {
  if (!source) return null;
  return createFloorPlan({
    projectId: source.projectId,
    venueId: source.venueId,
    venueSpaceId: source.venueSpaceId,
    eventId: null,
    name: source.name,
    kind: source.kind,
    status: "draft",
    widthM: source.widthM,
    lengthM: source.lengthM,
    unit: source.unit,
    outline: source.outline,
    setupStyle: source.setupStyle,
    templateCategory: source.templateCategory,
    notes: source.notes,
    metadata: {},
    sourcePlanId: source.id,
    ...overrides,
    objects: cloneObjects(overrides.objects || source.objects),
  });
}

export async function softDeleteFloorPlan(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(TABLE).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error("[floor_plans.softDeleteFloorPlan]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[floor_plans.softDeleteFloorPlan]", e);
    return false;
  }
}
