"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { recordMovement } from "./inventory";

// Data-access layer for the buying side of Inventory — the only place that
// talks to events.inventory_suppliers and events.inventory_purchase_orders.
// Pure: validate, console.error on failure, return null / false / [] — never
// throw, never toast (the screen owns UX).
//
// PO lines live in the `lines` jsonb bag as
// [{ itemId, name, qty, unitCost, receivedQty }]. Receiving is the only route
// stock enters the catalog: receivePurchaseOrder() writes one `receive`
// movement per line, which the DB trigger applies to items.on_hand.

const SUPPLIERS = "inventory_suppliers";
const PURCHASE_ORDERS = "inventory_purchase_orders";

// --- Suppliers ---------------------------------------------------------------

export function normalizeSupplier(row) {
  if (!row) return null;
  const config = row.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    contactName: row.contact_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    leadTimeDays: Number(row.lead_time_days ?? 0),
    notes: row.notes ?? "",
    config,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function supplierToRow(input) {
  const row = {};
  const uuidCols = { projectId: "project_id", createdBy: "created_by" };
  const textCols = {
    contactName: "contact_name",
    email: "email",
    phone: "phone",
    website: "website",
    notes: "notes",
  };
  for (const [key, col] of Object.entries(uuidCols)) {
    if (key in input) row[col] = input[key] || null;
  }
  for (const [key, col] of Object.entries(textCols)) {
    if (key in input) row[col] = input[key] || "";
  }
  if ("name" in input) row.name = input.name || "Untitled supplier";
  if ("leadTimeDays" in input) {
    row.lead_time_days = Number(input.leadTimeDays) || 0;
  }
  if ("config" in input) {
    row.config =
      input.config && typeof input.config === "object" ? input.config : {};
  }
  return row;
}

export async function listSuppliers(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SUPPLIERS)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[inventory.listSuppliers]", error.message);
      return null;
    }
    return (data || []).map(normalizeSupplier);
  } catch (e) {
    console.error("[inventory.listSuppliers]", e);
    return null;
  }
}

export async function createSupplier(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = supplierToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(SUPPLIERS)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.createSupplier]", error.message);
      return null;
    }
    return normalizeSupplier(data);
  } catch (e) {
    console.error("[inventory.createSupplier]", e);
    return null;
  }
}

export async function updateSupplier(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SUPPLIERS)
      .update(supplierToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.updateSupplier]", error.message);
      return null;
    }
    return normalizeSupplier(data);
  } catch (e) {
    console.error("[inventory.updateSupplier]", e);
    return null;
  }
}

export async function softDeleteSupplier(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(SUPPLIERS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[inventory.softDeleteSupplier]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[inventory.softDeleteSupplier]", e);
    return false;
  }
}

// --- Purchase orders ---------------------------------------------------------

export function normalizeLine(line) {
  if (!line) return null;
  return {
    itemId: line.itemId ?? "",
    name: line.name ?? "",
    qty: Number(line.qty ?? 0),
    unitCost: Number(line.unitCost ?? 0),
    receivedQty: Number(line.receivedQty ?? 0),
  };
}

export function normalizePurchaseOrder(row) {
  if (!row) return null;
  const config = row.config && typeof row.config === "object" ? row.config : {};
  const lines = Array.isArray(row.lines) ? row.lines.map(normalizeLine) : [];
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    supplierId: row.supplier_id ?? null,
    code: row.code ?? "",
    status: row.status ?? "Draft",
    expectedAt: row.expected_at ?? "",
    orderedAt: row.ordered_at ?? "",
    receivedAt: row.received_at ?? "",
    currency: row.currency ?? "USD",
    total: Number(row.total ?? 0),
    lines,
    notes: row.notes ?? "",
    config,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function purchaseOrderToRow(input) {
  const row = {};
  const uuidCols = {
    projectId: "project_id",
    supplierId: "supplier_id",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(uuidCols)) {
    if (key in input) row[col] = input[key] || null;
  }
  if ("code" in input) row.code = input.code || "";
  if ("notes" in input) row.notes = input.notes || "";
  if ("currency" in input) row.currency = input.currency || "USD";
  if ("status" in input) row.status = input.status || "Draft";
  if ("total" in input) row.total = Number(input.total) || 0;
  // Empty-string dates -> null, so Postgres doesn't reject them.
  if ("expectedAt" in input) row.expected_at = input.expectedAt || null;
  if ("orderedAt" in input) row.ordered_at = input.orderedAt || null;
  if ("receivedAt" in input) row.received_at = input.receivedAt || null;
  if ("lines" in input) {
    row.lines = Array.isArray(input.lines) ? input.lines.map(normalizeLine) : [];
  }
  if ("config" in input) {
    row.config =
      input.config && typeof input.config === "object" ? input.config : {};
  }
  return row;
}

export async function listPurchaseOrders(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PURCHASE_ORDERS)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[inventory.listPurchaseOrders]", error.message);
      return null;
    }
    return (data || []).map(normalizePurchaseOrder);
  } catch (e) {
    console.error("[inventory.listPurchaseOrders]", e);
    return null;
  }
}

export async function createPurchaseOrder(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = purchaseOrderToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(PURCHASE_ORDERS)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.createPurchaseOrder]", error.message);
      return null;
    }
    return normalizePurchaseOrder(data);
  } catch (e) {
    console.error("[inventory.createPurchaseOrder]", e);
    return null;
  }
}

export async function updatePurchaseOrder(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PURCHASE_ORDERS)
      .update(purchaseOrderToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[inventory.updatePurchaseOrder]", error.message);
      return null;
    }
    return normalizePurchaseOrder(data);
  } catch (e) {
    console.error("[inventory.updatePurchaseOrder]", e);
    return null;
  }
}

export async function softDeletePurchaseOrder(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(PURCHASE_ORDERS)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[inventory.softDeletePurchaseOrder]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[inventory.softDeletePurchaseOrder]", e);
    return false;
  }
}

// Receive outstanding quantities into stock. `received` maps line index ->
// quantity arriving now; omit it to receive every line in full. Writes one
// `receive` movement per line (the trigger bumps on_hand), then folds the
// receivedQty back onto the lines and advances the status.
export async function receivePurchaseOrder(po, received = null) {
  if (!po?.id || !isSupabaseConfigured()) return null;
  const lines = Array.isArray(po.lines) ? po.lines : [];
  if (!lines.length) return null;

  const nextLines = [];
  let movedAny = false;

  for (let i = 0; i < lines.length; i += 1) {
    const line = normalizeLine(lines[i]);
    const outstanding = Math.max(0, line.qty - line.receivedQty);
    const asked = received ? Number(received[i]) || 0 : outstanding;
    const amount = Math.max(0, Math.min(asked, outstanding));
    if (amount > 0 && line.itemId) {
      const movement = await recordMovement({
        projectId: po.projectId,
        itemId: line.itemId,
        kind: "receive",
        qty: amount,
        reason: "Purchase order received",
        reference: po.code || "",
      });
      if (movement) {
        movedAny = true;
        nextLines.push({ ...line, receivedQty: line.receivedQty + amount });
        continue;
      }
      console.error("[inventory.receivePurchaseOrder] movement failed", line.itemId);
    }
    nextLines.push(line);
  }

  if (!movedAny) return null;

  const complete = nextLines.every((l) => l.receivedQty >= l.qty);
  return updatePurchaseOrder(po.id, {
    lines: nextLines,
    status: complete ? "Received" : "Partial",
    receivedAt: complete ? new Date().toISOString().slice(0, 10) : po.receivedAt || "",
  });
}
