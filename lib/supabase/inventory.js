"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Inventory area — the only place that talks to
// events.inventory_items, events.inventory_movements and
// events.inventory_allocations. Pure: validate, console.error on failure,
// return null / false / [] — never throw, never toast (the screen owns UX).
// DB is snake_case; the UI is camelCase, mapped at this boundary.
//
// Stock is ledger-derived: items.on_hand is maintained by a DB trigger over the
// append-only movements table, so the only way to change stock is to record a
// movement. Never write on_hand directly.

const ITEMS = "inventory_items";
const MOVEMENTS = "inventory_movements";
const ALLOCATIONS = "inventory_allocations";

// --- Items -------------------------------------------------------------------

export function normalizeItem(row) {
  if (!row) return null;
  const config = row.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    parentId: row.parent_id ?? null,
    sku: row.sku ?? "",
    name: row.name ?? "",
    variantLabel: row.variant_label ?? "",
    category: row.category ?? "Merch",
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    unitCost: Number(row.unit_cost ?? 0),
    unitPrice: Number(row.unit_price ?? 0),
    currency: row.currency ?? "USD",
    reorderPoint: Number(row.reorder_point ?? 0),
    onHand: Number(row.on_hand ?? 0),
    active: row.active !== false,
    config,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function itemToRow(input) {
  const row = {};
  const uuidCols = {
    projectId: "project_id",
    parentId: "parent_id",
    createdBy: "created_by",
  };
  const textCols = {
    sku: "sku",
    description: "description",
    imageUrl: "image_url",
  };
  for (const [key, col] of Object.entries(uuidCols)) {
    if (key in input) row[col] = input[key] || null;
  }
  for (const [key, col] of Object.entries(textCols)) {
    if (key in input) row[col] = input[key] || "";
  }
  if ("category" in input) row.category = input.category || "Merch";
  if ("currency" in input) row.currency = input.currency || "USD";
  if ("name" in input) row.name = input.name || "Untitled item";
  if ("variantLabel" in input) row.variant_label = input.variantLabel || "";
  if ("unitCost" in input) row.unit_cost = Number(input.unitCost) || 0;
  if ("unitPrice" in input) row.unit_price = Number(input.unitPrice) || 0;
  if ("reorderPoint" in input) row.reorder_point = Number(input.reorderPoint) || 0;
  if ("active" in input) row.active = Boolean(input.active);
  if ("config" in input) {
    row.config =
      input.config && typeof input.config === "object" ? input.config : {};
  }
  return row;
}

// Every item in the project, parents and variants alike. The screen groups them.
export async function listItems(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ITEMS)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[inventory.listItems]", error.message);
      return null;
    }
    return (data || []).map(normalizeItem);
  } catch (e) {
    console.error("[inventory.listItems]", e);
    return null;
  }
}

export async function createItem(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = itemToRow(input);
    if (input.id) payload.id = input.id; // honour the optimistic UUID
    const { data, error } = await sb.from(ITEMS).insert(payload).select("*").single();
    if (error) {
      console.error("[inventory.createItem]", error.message);
      return null;
    }
    return normalizeItem(data);
  } catch (e) {
    console.error("[inventory.createItem]", e);
    return null;
  }
}

export async function updateItem(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ITEMS)
      .update(itemToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.updateItem]", error.message);
      return null;
    }
    return normalizeItem(data);
  } catch (e) {
    console.error("[inventory.updateItem]", e);
    return null;
  }
}

// Soft-deletes the item and, when it is a parent, its variants with it.
export async function softDeleteItem(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const stamp = new Date().toISOString();
    const { error } = await sb
      .from(ITEMS)
      .update({ deleted_at: stamp })
      .or(`id.eq.${id},parent_id.eq.${id}`);
    if (error) {
      console.error("[inventory.softDeleteItem]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[inventory.softDeleteItem]", e);
    return false;
  }
}

// --- Movements ---------------------------------------------------------------

export function normalizeMovement(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    itemId: row.item_id ?? null,
    eventId: row.event_id ?? null,
    allocationId: row.allocation_id ?? null,
    kind: row.kind ?? "adjust",
    qty: Number(row.qty ?? 0),
    reason: row.reason ?? "",
    note: row.note ?? "",
    reference: row.reference ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function movementToRow(input) {
  const row = {};
  const uuidCols = {
    projectId: "project_id",
    itemId: "item_id",
    eventId: "event_id",
    allocationId: "allocation_id",
    createdBy: "created_by",
  };
  const textCols = { reason: "reason", note: "note", reference: "reference" };
  for (const [key, col] of Object.entries(uuidCols)) {
    if (key in input) row[col] = input[key] || null;
  }
  for (const [key, col] of Object.entries(textCols)) {
    if (key in input) row[col] = input[key] || "";
  }
  if ("kind" in input) row.kind = input.kind || "adjust";
  if ("qty" in input) row.qty = Number(input.qty) || 0;
  return row;
}

// projectId is required; itemId narrows to a single item's history.
export async function listMovements(projectId, { itemId, limit = 500 } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let q = sb
      .from(MOVEMENTS)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (itemId) q = q.eq("item_id", itemId);
    const { data, error } = await q;
    if (error) {
      console.error("[inventory.listMovements]", error.message);
      return null;
    }
    return (data || []).map(normalizeMovement);
  } catch (e) {
    console.error("[inventory.listMovements]", e);
    return null;
  }
}

// The only way stock changes. `qty` is signed by the caller via signedQty().
export async function recordMovement(input) {
  if (!input?.projectId || !input?.itemId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = movementToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(MOVEMENTS)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.recordMovement]", error.message);
      return null;
    }
    return normalizeMovement(data);
  } catch (e) {
    console.error("[inventory.recordMovement]", e);
    return null;
  }
}

// --- Allocations -------------------------------------------------------------

export function normalizeAllocation(row) {
  if (!row) return null;
  const config = row.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    itemId: row.item_id ?? null,
    eventId: row.event_id ?? null,
    plannedQty: Number(row.planned_qty ?? 0),
    issuedQty: Number(row.issued_qty ?? 0),
    status: row.status ?? "Planned",
    issuance: row.issuance ?? "internal",
    ticketIds: Array.isArray(row.ticket_ids) ? row.ticket_ids : [],
    qtyPerAttendee: Number(row.qty_per_attendee ?? 1),
    purchasableId: row.purchasable_id ?? "",
    // How often a qualifying attendee may collect: none | day | window | rolling.
    periodMode: row.period_mode ?? "none",
    periodConfig:
      row.period_config && typeof row.period_config === "object" ? row.period_config : {},
    sessionIds: Array.isArray(row.session_ids) ? row.session_ids : [],
    audience: row.audience && typeof row.audience === "object" ? row.audience : {},
    notes: row.notes ?? "",
    config,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function allocationToRow(input) {
  const row = {};
  const uuidCols = {
    projectId: "project_id",
    itemId: "item_id",
    eventId: "event_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(uuidCols)) {
    if (key in input) row[col] = input[key] || null;
  }
  if ("notes" in input) row.notes = input.notes || "";
  if ("plannedQty" in input) row.planned_qty = Number(input.plannedQty) || 0;
  if ("issuedQty" in input) row.issued_qty = Number(input.issuedQty) || 0;
  if ("status" in input) row.status = input.status || "Planned";
  if ("issuance" in input) row.issuance = input.issuance || "internal";
  if ("ticketIds" in input) {
    row.ticket_ids = Array.isArray(input.ticketIds) ? input.ticketIds : [];
  }
  if ("qtyPerAttendee" in input) {
    row.qty_per_attendee = Number(input.qtyPerAttendee) || 0;
  }
  if ("purchasableId" in input) row.purchasable_id = input.purchasableId || "";
  if ("periodMode" in input) row.period_mode = input.periodMode || "none";
  if ("periodConfig" in input) {
    row.period_config =
      input.periodConfig && typeof input.periodConfig === "object" ? input.periodConfig : {};
  }
  if ("sessionIds" in input) {
    row.session_ids = Array.isArray(input.sessionIds) ? input.sessionIds : [];
  }
  if ("audience" in input) {
    row.audience =
      input.audience && typeof input.audience === "object" ? input.audience : {};
  }
  if ("config" in input) {
    row.config =
      input.config && typeof input.config === "object" ? input.config : {};
  }
  return row;
}

// All allocations in the project; `itemId`/`eventId` narrow it.
export async function listAllocations(projectId, { itemId, eventId } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let q = sb
      .from(ALLOCATIONS)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (itemId) q = q.eq("item_id", itemId);
    if (eventId) q = q.eq("event_id", eventId);
    const { data, error } = await q;
    if (error) {
      console.error("[inventory.listAllocations]", error.message);
      return null;
    }
    return (data || []).map(normalizeAllocation);
  } catch (e) {
    console.error("[inventory.listAllocations]", e);
    return null;
  }
}

export async function createAllocation(input) {
  if (!input?.projectId || !input?.itemId || !input?.eventId) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = allocationToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(ALLOCATIONS)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.createAllocation]", error.message);
      return null;
    }
    return normalizeAllocation(data);
  } catch (e) {
    console.error("[inventory.createAllocation]", e);
    return null;
  }
}

export async function updateAllocation(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ALLOCATIONS)
      .update(allocationToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.updateAllocation]", error.message);
      return null;
    }
    return normalizeAllocation(data);
  } catch (e) {
    console.error("[inventory.updateAllocation]", e);
    return null;
  }
}

export async function softDeleteAllocation(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(ALLOCATIONS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[inventory.softDeleteAllocation]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[inventory.softDeleteAllocation]", e);
    return false;
  }
}

// Hand stock out against an allocation: writes the negative `issue` movement
// (which the trigger applies to on_hand) then bumps issued_qty. Returns the
// updated allocation, or null if either half failed.
export async function issueAllocation(allocation, qty, { note = "" } = {}) {
  const amount = Number(qty) || 0;
  if (!allocation?.id || amount <= 0 || !isSupabaseConfigured()) return null;
  const movement = await recordMovement({
    projectId: allocation.projectId,
    itemId: allocation.itemId,
    eventId: allocation.eventId,
    allocationId: allocation.id,
    kind: "issue",
    qty: -amount,
    reason: "Issued to event",
    note,
  });
  if (!movement) return null;
  return updateAllocation(allocation.id, {
    issuedQty: (Number(allocation.issuedQty) || 0) + amount,
    status: "Issued",
  });
}

// Return unused stock from an allocation back into the catalog.
export async function returnAllocation(allocation, qty, { note = "" } = {}) {
  const amount = Number(qty) || 0;
  if (!allocation?.id || amount <= 0 || !isSupabaseConfigured()) return null;
  const movement = await recordMovement({
    projectId: allocation.projectId,
    itemId: allocation.itemId,
    eventId: allocation.eventId,
    allocationId: allocation.id,
    kind: "return",
    qty: amount,
    reason: "Returned from event",
    note,
  });
  if (!movement) return null;
  return updateAllocation(allocation.id, {
    issuedQty: Math.max(0, (Number(allocation.issuedQty) || 0) - amount),
  });
}
