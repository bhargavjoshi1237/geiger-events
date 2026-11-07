"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { getFloorPlan, updateFloorPlan } from "./floor_plans";

// Data-access layer for Seating Charts (Event Design): guest seat assignments and seating rules per floor plan,
// plus the chart's menu stored on floor_plans.metadata.seatingChart. Not Reserved Seating (seat_maps / seating.js). Never throws.

const ASSIGNMENTS = "seating_chart_assignments";
const RULES = "seating_chart_rules";
const RULE_KINDS = ["together", "apart", "vip_table", "reserved_table"];
const GUEST_KINDS = ["order", "registration", "team", "speaker", "sponsor", "booth", "manual"];

const list = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x) : []);

export function normalizeChartAssignment(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    floorPlanId: row.floor_plan_id ?? null,
    itemId: row.item_id || null,
    seatIndex: row.seat_index === null || row.seat_index === undefined ? null : Number(row.seat_index),
    guestKind: GUEST_KINDS.includes(row.guest_kind) ? row.guest_kind : "manual",
    guestRef: row.guest_ref ?? null,
    guestKey: row.guest_key ?? "",
    guestName: row.guest_name ?? "",
    guestEmail: row.guest_email ?? "",
    party: row.party ?? "",
    meal: row.meal ?? "",
    dietary: row.dietary ?? "",
    vip: row.vip === true,
    notes: row.notes ?? "",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function normalizeChartRule(row) {
  if (!row) return null;
  return {
    id: row.id,
    floorPlanId: row.floor_plan_id ?? null,
    kind: RULE_KINDS.includes(row.kind) ? row.kind : "together",
    label: row.label ?? "",
    guests: list(row.guests),
    items: list(row.items),
    notes: row.notes ?? "",
    createdAt: row.created_at ?? null,
  };
}

// camelCase change → the RPC's row shape; only keys present are sent (the RPC leaves the rest alone).
function changeToRow(change) {
  const row = { guest_key: change.guestKey };
  if ("guestKind" in change) row.guest_kind = GUEST_KINDS.includes(change.guestKind) ? change.guestKind : "manual";
  if ("guestRef" in change) row.guest_ref = change.guestRef ? String(change.guestRef) : "";
  if ("guestName" in change) row.guest_name = change.guestName || "";
  if ("guestEmail" in change) row.guest_email = change.guestEmail || "";
  if ("party" in change) row.party = String(change.party || "").trim();
  if ("meal" in change) row.meal = change.meal || "";
  if ("dietary" in change) row.dietary = change.dietary || "";
  if ("vip" in change) row.vip = change.vip === true;
  if ("notes" in change) row.notes = change.notes || "";
  if ("itemId" in change) {
    row.item_id = change.itemId || "";
    row.seat_index = change.itemId && change.seatIndex !== null && change.seatIndex !== undefined ? Number(change.seatIndex) : "";
  }
  return row;
}

export async function listChartAssignments(planId) {
  if (!planId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSIGNMENTS)
      .select("*")
      .eq("floor_plan_id", planId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[seating_charts.listAssignments]", error.message);
      return null;
    }
    return (data || []).map(normalizeChartAssignment);
  } catch (e) {
    console.error("[seating_charts.listAssignments]", e);
    return null;
  }
}

// Upserts guests (by roster key) and moves seats atomically. changes: [{ guestKey, itemId?, seatIndex?, meal?, vip?… }] → rows | null.
export async function applyChartChanges(planId, changes) {
  if (!planId || !isSupabaseConfigured()) return null;
  const rows = (changes || []).filter((c) => c?.guestKey).map(changeToRow);
  if (!rows.length) return [];
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("seating_chart_apply", { p_plan: planId, p_rows: rows });
    if (error) {
      console.error("[seating_charts.apply]", error.message);
      return null;
    }
    return (data || []).map(normalizeChartAssignment);
  } catch (e) {
    console.error("[seating_charts.apply]", e);
    return null;
  }
}

// Soft-deletes guest rows (hand-added guests, or stale rows of cancelled tickets).
export async function deleteChartAssignments(ids) {
  const targets = (ids || []).filter(Boolean);
  if (!targets.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(ASSIGNMENTS).update({ deleted_at: new Date().toISOString() }).in("id", targets);
    if (error) {
      console.error("[seating_charts.deleteAssignments]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seating_charts.deleteAssignments]", e);
    return false;
  }
}

export async function listChartRules(planId) {
  if (!planId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(RULES)
      .select("*")
      .eq("floor_plan_id", planId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[seating_charts.listRules]", error.message);
      return null;
    }
    return (data || []).map(normalizeChartRule);
  } catch (e) {
    console.error("[seating_charts.listRules]", e);
    return null;
  }
}

export async function createChartRule({ projectId, planId, kind, label = "", guests = [], items = [], notes = "", createdBy = null }) {
  if (!projectId || !planId || !RULE_KINDS.includes(kind) || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(RULES)
      .insert({
        project_id: projectId,
        floor_plan_id: planId,
        kind,
        label: String(label || "").trim(),
        guests: list(guests),
        items: list(items),
        notes: notes || "",
        created_by: createdBy,
      })
      .select("*")
      .single();
    if (error) {
      console.error("[seating_charts.createRule]", error.message);
      return null;
    }
    return normalizeChartRule(data);
  } catch (e) {
    console.error("[seating_charts.createRule]", e);
    return null;
  }
}

export async function updateChartRule(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  const row = {};
  if ("label" in patch) row.label = String(patch.label || "").trim();
  if ("guests" in patch) row.guests = list(patch.guests);
  if ("items" in patch) row.items = list(patch.items);
  if ("notes" in patch) row.notes = patch.notes || "";
  try {
    const sb = createClient();
    const { data, error } = await sb.from(RULES).update(row).eq("id", id).select("*").single();
    if (error) {
      console.error("[seating_charts.updateRule]", error.message);
      return null;
    }
    return normalizeChartRule(data);
  } catch (e) {
    console.error("[seating_charts.updateRule]", e);
    return null;
  }
}

export async function deleteChartRule(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(RULES).update({ deleted_at: new Date().toISOString() }).eq("id", id);
    if (error) {
      console.error("[seating_charts.deleteRule]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[seating_charts.deleteRule]", e);
    return false;
  }
}

// The chart's settings (menu choices) from the plan's metadata.
export function chartSettingsOf(plan) {
  const raw = plan?.metadata?.seatingChart;
  const meals = Array.isArray(raw?.meals) ? raw.meals.map((m) => String(m || "").trim()).filter(Boolean) : [];
  return { meals: [...new Set(meals)] };
}

// Merges `patch` into metadata.seatingChart on the freshest copy of the plan (other metadata keys untouched) → plan | null.
export async function saveChartSettings(planId, patch) {
  const fresh = await getFloorPlan(planId);
  if (!fresh) return null;
  const current = fresh.metadata?.seatingChart && typeof fresh.metadata.seatingChart === "object" ? fresh.metadata.seatingChart : {};
  return updateFloorPlan(planId, { metadata: { ...fresh.metadata, seatingChart: { ...current, ...patch } } });
}
