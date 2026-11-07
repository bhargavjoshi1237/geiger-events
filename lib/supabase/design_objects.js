"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for events.design_objects — the Event Design object library. project_id null rows are the seeded
// global catalog (read-only); project rows are custom objects. Never throws: console.error and return null / false.

const TABLE = "design_objects";

const CATEGORIES = ["tables", "seating", "staging", "bars_catering", "dance_entertainment", "av", "decor", "structure"];
const SHAPES = ["rect", "round", "oval", "custom"];

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));
const obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : {});

export function normalizeDesignObject(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    key: row.key ?? "",
    name: row.name ?? "",
    category: CATEGORIES.includes(row.category) ? row.category : "decor",
    shape: SHAPES.includes(row.shape) ? row.shape : "rect",
    widthM: num(row.width_m) ?? 1,
    depthM: num(row.depth_m) ?? 1,
    heightM: num(row.height_m),
    seats: Number(row.seats ?? 0),
    chairLayout: obj(row.chair_layout),
    color: row.color ?? "",
    icon: row.icon ?? "",
    description: row.description ?? "",
    sortOrder: Number(row.sort_order ?? 0),
    config: obj(row.config),
    isStandard: !row.project_id,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function designObjectToRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId || null;
  if ("createdBy" in input) row.created_by = input.createdBy || null;
  if ("key" in input) row.key = input.key || null;
  if ("name" in input) row.name = String(input.name || "").trim() || "Untitled object";
  if ("category" in input) row.category = CATEGORIES.includes(input.category) ? input.category : "decor";
  if ("shape" in input) row.shape = SHAPES.includes(input.shape) ? input.shape : "rect";
  if ("widthM" in input) row.width_m = Math.max(0.01, num(input.widthM) || 1);
  if ("depthM" in input) row.depth_m = Math.max(0.01, num(input.depthM) || 1);
  if ("heightM" in input) row.height_m = num(input.heightM);
  if ("seats" in input) row.seats = Math.max(0, Math.floor(Number(input.seats) || 0));
  if ("chairLayout" in input) row.chair_layout = obj(input.chairLayout);
  if ("color" in input) row.color = input.color || "";
  if ("icon" in input) row.icon = input.icon || "";
  if ("description" in input) row.description = input.description || "";
  if ("sortOrder" in input) row.sort_order = Number(input.sortOrder) || 0;
  if ("config" in input) row.config = obj(input.config);
  return row;
}

// The global catalog plus the project's custom objects (callers pass the result through resolveCatalog()).
export async function listDesignObjects(projectId) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let query = sb.from(TABLE).select("*").is("deleted_at", null);
    query = projectId
      ? query.or(`project_id.is.null,project_id.eq.${projectId}`)
      : query.is("project_id", null);
    const { data, error } = await query
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      console.error("[design_objects.listDesignObjects]", error.message);
      return null;
    }
    return (data || []).map(normalizeDesignObject);
  } catch (e) {
    console.error("[design_objects.listDesignObjects]", e);
    return null;
  }
}

export async function createDesignObject(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = designObjectToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb.from(TABLE).insert(payload).select("*").single();
    if (error) {
      console.error("[design_objects.createDesignObject]", error.message);
      return null;
    }
    return normalizeDesignObject(data);
  } catch (e) {
    console.error("[design_objects.createDesignObject]", e);
    return null;
  }
}

export async function updateDesignObject(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(designObjectToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[design_objects.updateDesignObject]", error.message);
      return null;
    }
    return normalizeDesignObject(data);
  } catch (e) {
    console.error("[design_objects.updateDesignObject]", e);
    return null;
  }
}

export async function softDeleteDesignObject(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[design_objects.softDeleteDesignObject]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[design_objects.softDeleteDesignObject]", e);
    return false;
  }
}
