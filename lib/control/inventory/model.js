import { randomInt } from "node:crypto";

import { ApiError } from "../../staff_access/errors.js";

// Control's Inventory and Members view models and request parsers, mirroring lib/supabase/{inventory,inventory_purchasing,memberships}.js.
// Stock is ledger-derived: on_hand moves only through a movement row, never by writing the number.

export const ITEM_CATEGORIES = [
  "Merch",
  "Swag",
  "Badges & Credentials",
  "Print & Signage",
  "Food & Beverage",
  "Equipment",
  "Supplies",
  "Other",
];

// `direction` fixes the sign a movement gets; "either" lets the organiser choose, as in the dashboard dialog.
export const MOVEMENT_KINDS = [
  { value: "receive", label: "Receive into stock", direction: "in" },
  { value: "adjust", label: "Adjust count", direction: "either" },
  { value: "issue", label: "Issue out", direction: "out" },
  { value: "return", label: "Return to stock", direction: "in" },
  { value: "waste", label: "Write off / waste", direction: "out" },
  { value: "transfer", label: "Transfer out", direction: "out" },
];

export const ALLOCATION_STATUSES = ["Planned", "Reserved", "Issued", "Closed"];
// The phone creates the issuance modes that need no audience builder; the rest are shown but set up on the dashboard.
export const PHONE_ISSUANCE = ["internal", "all", "ticket"];
export const PO_STATUSES = ["Draft", "Ordered", "Partial", "Received", "Cancelled"];
// Partial and Received are reached by receiving stock, never by picking them.
export const PO_SETTABLE = ["Draft", "Ordered", "Cancelled"];
export const MEMBER_STATUSES = ["Active", "Expired", "Cancelled"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function invalid(message, field) {
  return new ApiError("invalid_input", 400, message, field ? { [field]: message } : undefined);
}

function text(value, label, max, { required = false } = {}) {
  if (value == null) {
    if (required) throw invalid(`${label} is required.`);
    return "";
  }
  if (typeof value !== "string") throw invalid(`${label} must be text.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw invalid(`${label} is required.`);
  if (trimmed.length > max) throw invalid(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

function amount(value, label, { min = 0, max = 10_000_000 } = {}) {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < min || n > max) throw invalid(`${label} must be a number of ${min} or more.`);
  return Math.round(n * 100) / 100;
}

const num = (v) => Number(v ?? 0) || 0;

export function itemLabel(item) {
  return item?.variantLabel ? `${item.name} — ${item.variantLabel}` : item?.name || "Untitled item";
}

// On-hand vs the reorder point; a reorder point of 0 turns the low-stock band off.
export function stockStatus(onHand, reorderPoint) {
  const n = num(onHand);
  if (n <= 0) return "Out of stock";
  if (num(reorderPoint) > 0 && n <= num(reorderPoint)) return "Low stock";
  return "In stock";
}

export function itemView(row) {
  const view = {
    id: row.id,
    parentId: row.parent_id ?? null,
    sku: row.sku ?? "",
    name: row.name ?? "",
    variantLabel: row.variant_label ?? "",
    category: row.category ?? "Merch",
    description: row.description ?? "",
    imageUrl: row.image_url ?? "",
    unitCost: num(row.unit_cost),
    unitPrice: num(row.unit_price),
    currency: String(row.currency || "USD").toLowerCase(),
    reorderPoint: num(row.reorder_point),
    onHand: num(row.on_hand),
    active: row.active !== false,
    createdAt: row.created_at ?? null,
  };
  return { ...view, label: itemLabel(view), status: stockStatus(view.onHand, view.reorderPoint) };
}

// Parents roll their variants up: on-hand summed, status the worst of them, so a list row reads like the dashboard's group row.
export function itemTree(rows) {
  const items = rows.map(itemView);
  const byParent = new Map();
  for (const item of items) if (item.parentId) byParent.set(item.parentId, [...(byParent.get(item.parentId) || []), item]);
  const rank = { "Out of stock": 2, "Low stock": 1, "In stock": 0 };
  return items
    .filter((item) => !item.parentId)
    .map((item) => {
      const variants = byParent.get(item.id) || [];
      if (!variants.length) return { ...item, variants: [] };
      const onHand = variants.reduce((sum, v) => sum + v.onHand, 0);
      const status = variants.reduce((worst, v) => (rank[v.status] > rank[worst] ? v.status : worst), "In stock");
      return { ...item, onHand, status, variants };
    });
}

// Editable item fields, the same set the dashboard's item drawer saves.
export function parseItemPatch(body, { create = false } = {}) {
  if (!body || typeof body !== "object") throw invalid("Send the item's fields.");
  const row = {};
  if (create || "name" in body) row.name = text(body.name, "Name", 200, { required: create }) || "Untitled item";
  if ("variantLabel" in body) row.variant_label = text(body.variantLabel, "Variant", 120);
  if ("sku" in body) row.sku = text(body.sku, "SKU", 80);
  if ("description" in body) row.description = text(body.description, "Description", 2000);
  if ("category" in body) {
    if (!ITEM_CATEGORIES.includes(body.category)) throw invalid("Pick one of the categories.", "category");
    row.category = body.category;
  }
  if ("unitCost" in body) row.unit_cost = amount(body.unitCost, "Unit cost");
  if ("unitPrice" in body) row.unit_price = amount(body.unitPrice, "Unit price");
  if ("reorderPoint" in body) row.reorder_point = amount(body.reorderPoint, "Reorder point");
  if (!create && !Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}

export function parseOpeningStock(value) {
  if (value == null || value === "") return 0;
  return amount(value, "Opening stock");
}

export function movementView(row) {
  return {
    id: row.id,
    itemId: row.item_id ?? null,
    eventId: row.event_id ?? null,
    allocationId: row.allocation_id ?? null,
    kind: row.kind ?? "adjust",
    qty: num(row.qty),
    reason: row.reason ?? "",
    note: row.note ?? "",
    reference: row.reference ?? "",
    createdAt: row.created_at ?? null,
  };
}

// A movement the organiser asked for → the signed ledger row. Stock can't go below zero, as the dashboard refuses.
export function parseMovement(body, item) {
  const kind = MOVEMENT_KINDS.find((k) => k.value === body?.kind);
  if (!kind) throw invalid("Pick what kind of movement this is.", "kind");
  const qty = amount(body?.qty, "Quantity");
  if (qty <= 0) throw invalid("Enter a quantity above zero.", "qty");
  const direction = kind.direction === "either" ? (body?.direction === "out" ? "out" : "in") : kind.direction;
  const signed = direction === "out" ? -qty : qty;
  if (signed < 0 && qty > num(item?.on_hand)) throw invalid(`Only ${num(item?.on_hand)} on hand for ${itemLabel(itemView(item))}.`, "qty");
  return {
    kind: kind.value,
    qty: signed,
    reason: text(body?.reason, "Reason", 200),
    note: text(body?.note, "Note", 1000),
    reference: text(body?.reference, "Reference", 120),
  };
}

export function allocationView(row) {
  const planned = num(row.planned_qty);
  const issued = num(row.issued_qty);
  return {
    id: row.id,
    itemId: row.item_id ?? null,
    eventId: row.event_id ?? null,
    plannedQty: planned,
    issuedQty: issued,
    outstanding: Math.max(0, planned - issued),
    status: row.status ?? "Planned",
    issuance: row.issuance ?? "internal",
    ticketIds: Array.isArray(row.ticket_ids) ? row.ticket_ids.map(String) : [],
    qtyPerAttendee: num(row.qty_per_attendee) || 1,
    notes: row.notes ?? "",
    createdAt: row.created_at ?? null,
  };
}

export function parseAllocation(body, tickets) {
  const eventId = typeof body?.eventId === "string" && UUID.test(body.eventId) ? body.eventId : null;
  if (!eventId) throw invalid("Pick an event.", "eventId");
  const itemId = typeof body?.itemId === "string" && UUID.test(body.itemId) ? body.itemId : null;
  if (!itemId) throw invalid("Pick an item.", "itemId");
  const issuance = PHONE_ISSUANCE.includes(body?.issuance) ? body.issuance : "internal";
  const known = new Set((tickets || []).map((t) => String(t.id)));
  const ticketIds = issuance === "ticket" ? (Array.isArray(body?.ticketIds) ? body.ticketIds.map(String).filter((id) => known.has(id)) : []) : [];
  if (issuance === "ticket" && !ticketIds.length) throw invalid("Choose at least one ticket that entitles this item.", "ticketIds");
  const status = ALLOCATION_STATUSES.includes(body?.status) ? body.status : "Planned";
  return {
    event_id: eventId,
    item_id: itemId,
    planned_qty: amount(body?.plannedQty ?? 0, "Planned quantity"),
    issuance,
    ticket_ids: ticketIds,
    qty_per_attendee: issuance === "internal" ? 1 : Math.max(1, amount(body?.qtyPerAttendee ?? 1, "Quantity per attendee")),
    period_mode: "none",
    period_config: {},
    status,
    notes: "",
    config: {},
  };
}

// Issue hands outstanding stock out; return puts issued stock back. Both are capped exactly as the dashboard dialog caps them.
export function parseIssueOrReturn(body, allocation, item) {
  const mode = body?.mode === "return" ? "return" : "issue";
  const qty = amount(body?.qty, "Quantity");
  if (qty <= 0) throw invalid("Enter a quantity above zero.", "qty");
  const view = allocationView(allocation);
  if (mode === "issue") {
    if (qty > num(item?.on_hand)) throw invalid(`Only ${num(item?.on_hand)} on hand.`, "qty");
    if (qty > view.outstanding) throw invalid(`Only ${view.outstanding} left to issue on this allocation.`, "qty");
    return {
      mode,
      movement: { kind: "issue", qty: -qty, reason: "Issued to event" },
      patch: { issued_qty: view.issuedQty + qty, status: "Issued" },
    };
  }
  if (qty > view.issuedQty) throw invalid(`Only ${view.issuedQty} has been issued.`, "qty");
  return {
    mode,
    movement: { kind: "return", qty, reason: "Returned from event" },
    patch: { issued_qty: Math.max(0, view.issuedQty - qty) },
  };
}

export function supplierView(row) {
  return {
    id: row.id,
    name: row.name ?? "",
    contactName: row.contact_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    website: row.website ?? "",
    leadTimeDays: num(row.lead_time_days),
    notes: row.notes ?? "",
    createdAt: row.created_at ?? null,
  };
}

export function parseSupplier(body, { create = false } = {}) {
  if (!body || typeof body !== "object") throw invalid("Send the supplier's details.");
  const row = {};
  if (create || "name" in body) row.name = text(body.name, "Name", 200, { required: create });
  if ("contactName" in body) row.contact_name = text(body.contactName, "Contact", 200);
  if ("email" in body) {
    const email = text(body.email, "Email", 254).toLowerCase();
    if (email && !EMAIL.test(email)) throw invalid("Enter a valid email address.", "email");
    row.email = email;
  }
  if ("phone" in body) row.phone = text(body.phone, "Phone", 40);
  if ("website" in body) row.website = text(body.website, "Website", 300);
  if ("leadTimeDays" in body) row.lead_time_days = Math.round(amount(body.leadTimeDays ?? 0, "Lead time"));
  if ("notes" in body) row.notes = text(body.notes, "Notes", 2000);
  if (!create && !Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}

function lineView(line) {
  return {
    itemId: line?.itemId ?? "",
    name: line?.name ?? "",
    qty: num(line?.qty),
    unitCost: num(line?.unitCost),
    receivedQty: num(line?.receivedQty),
  };
}

// The dashboard's short PO reference when no code was typed.
export function poRef(row) {
  return row?.code || (row?.id ? `PO-${String(row.id).replace(/-/g, "").slice(0, 6).toUpperCase()}` : "—");
}

export function purchaseOrderView(row) {
  const lines = Array.isArray(row.lines) ? row.lines.map(lineView) : [];
  return {
    id: row.id,
    ref: poRef(row),
    supplierId: row.supplier_id ?? null,
    status: row.status ?? "Draft",
    expectedAt: row.expected_at ?? null,
    orderedAt: row.ordered_at ?? null,
    receivedAt: row.received_at ?? null,
    currency: String(row.currency || "USD").toLowerCase(),
    total: num(row.total),
    lines,
    outstanding: lines.reduce((sum, l) => sum + Math.max(0, l.qty - l.receivedQty), 0),
    notes: row.notes ?? "",
    createdAt: row.created_at ?? null,
  };
}

export function parsePoStatus(body, row, today) {
  const status = body?.status;
  if (!PO_SETTABLE.includes(status)) throw invalid("Mark it Draft, Ordered or Cancelled; receiving sets the rest.", "status");
  if (row.status === "Received" || row.status === "Cancelled") throw invalid(`This purchase order is ${row.status.toLowerCase()}.`, "status");
  const patch = { status };
  if (status === "Ordered" && !row.ordered_at) patch.ordered_at = today;
  return patch;
}

// Receives every outstanding line in full, as the dashboard's "receive all": one receive movement per line, then lines and status.
export function receivePlan(row, today) {
  if (row.status === "Cancelled" || row.status === "Received") throw invalid(`This purchase order is ${String(row.status).toLowerCase()}.`);
  const lines = Array.isArray(row.lines) ? row.lines.map(lineView) : [];
  const movements = [];
  const nextLines = lines.map((line) => {
    const outstanding = Math.max(0, line.qty - line.receivedQty);
    if (outstanding <= 0 || !line.itemId) return line;
    movements.push({ itemId: line.itemId, qty: outstanding });
    return { ...line, receivedQty: line.receivedQty + outstanding };
  });
  if (!movements.length) throw invalid("Nothing is left to receive on this purchase order.");
  const complete = nextLines.every((l) => l.receivedQty >= l.qty);
  return {
    movements,
    patch: { lines: nextLines, status: complete ? "Received" : "Partial", received_at: complete ? today : row.received_at || null },
  };
}

// Six digits like the dashboard's issuing codes.
export function newDeskCode() {
  return String(randomInt(100000, 1000000));
}

const DEFAULT_PERMISSIONS = { canIssue: true, canReturn: false, canOverride: false, allocationIds: [] };

export function deskRoleView(row) {
  const permissions = { ...DEFAULT_PERMISSIONS, ...(row.permissions && typeof row.permissions === "object" ? row.permissions : {}) };
  return {
    id: row.id,
    name: row.name ?? "Untitled role",
    accessCode: row.access_code ?? "",
    active: row.active !== false,
    canIssue: Boolean(permissions.canIssue),
    canReturn: Boolean(permissions.canReturn),
    canOverride: Boolean(permissions.canOverride),
    allocationCount: Array.isArray(permissions.allocationIds) ? permissions.allocationIds.length : 0,
    createdAt: row.created_at ?? null,
  };
}

// Abilities merge into the stored permissions, so the dashboard's per-allocation scope survives a phone edit.
export function parseDeskRolePatch(body, row) {
  if (!body || typeof body !== "object") throw invalid("Send the changes.");
  const patch = {};
  if ("name" in body) patch.name = text(body.name, "Name", 120, { required: true });
  if ("active" in body) {
    if (typeof body.active !== "boolean") throw invalid("Active must be on or off.");
    patch.active = body.active;
  }
  const abilities = {};
  for (const key of ["canIssue", "canReturn", "canOverride"]) {
    if (key in body) {
      if (typeof body[key] !== "boolean") throw invalid(`${key} must be on or off.`);
      abilities[key] = body[key];
    }
  }
  if (Object.keys(abilities).length) {
    const stored = row?.permissions && typeof row.permissions === "object" ? row.permissions : {};
    patch.permissions = { ...DEFAULT_PERMISSIONS, ...stored, ...abilities };
  }
  if (body.regenerate === true) patch.access_code = newDeskCode();
  if (!Object.keys(patch).length) throw invalid("Send at least one change.");
  return patch;
}

export function newDeskRole(body, projectId, userId) {
  return {
    project_id: projectId,
    name: text(body?.name, "Name", 120, { required: true }),
    type: "issue",
    permissions: { ...DEFAULT_PERMISSIONS },
    access_code: newDeskCode(),
    active: true,
    created_by: userId,
  };
}

export function memberView(row, planNames = new Map()) {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email ?? "",
    membershipId: row.membership_id ?? null,
    planName: planNames.get(row.membership_id) || "",
    status: row.status ?? "Active",
    startedAt: row.started_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function expiry(value) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw invalid("Expiry must be a date.", "expiresAt");
  return new Date(value).toISOString();
}

export function parseMember(body, { create = false, plans = new Set() } = {}) {
  if (!body || typeof body !== "object") throw invalid("Send the member's details.");
  const row = {};
  if (create || "name" in body) row.name = text(body.name, "Name", 200);
  if (create || "email" in body) {
    const email = text(body.email, "Email", 254, { required: create }).toLowerCase();
    if (email && !EMAIL.test(email)) throw invalid("Enter a valid email address.", "email");
    row.email = email;
  }
  if ("membershipId" in body) {
    const id = body.membershipId || null;
    if (id && !plans.has(id)) throw invalid("Pick one of this project's membership plans.", "membershipId");
    row.membership_id = id;
  }
  if ("status" in body) {
    if (!MEMBER_STATUSES.includes(body.status)) throw invalid("Status must be Active, Expired or Cancelled.", "status");
    row.status = body.status;
  }
  if ("expiresAt" in body) row.expires_at = expiry(body.expiresAt);
  if (create && !row.name) row.name = "";
  if (!create && !Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}
