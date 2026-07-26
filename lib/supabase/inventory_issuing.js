"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Workspace-side data access for events.inventory_redemptions — the hand-out
// ledger written by the /issue staff route.
//
// Entitlements themselves are never stored: they are derived from an
// allocation's rules against a buyer's order (see zzzz_inventory_issuing.sql).
// This file only reads what was actually handed over, plus the organiser-side
// manual issue/undo which go through the same RPCs the staff route uses so the
// rules can't diverge.
//
// Pure: validate, console.error on failure, return null/[]/false — never throw,
// never toast.

const TABLE = "inventory_redemptions";

export function normalizeRedemption(row) {
  if (!row) return null;
  const metadata = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    allocationId: row.allocation_id ?? null,
    itemId: row.item_id ?? null,
    subjectKind: row.subject_kind ?? "walkup",
    orderId: row.order_id ?? null,
    registrationId: row.registration_id ?? null,
    subjectKey: row.subject_key ?? "",
    attendeeName: row.attendee_name ?? "",
    attendeeEmail: row.attendee_email ?? "",
    periodKey: row.period_key ?? "",
    qty: Number(row.qty ?? 0),
    movementId: row.movement_id ?? null,
    status: row.status ?? "issued",
    override: Boolean(row.override),
    overrideReason: row.override_reason ?? "",
    issuedBy: row.issued_by ?? "",
    roleId: row.role_id ?? null,
    method: row.method ?? "scan",
    createdAt: row.created_at ?? null,
    metadata,
  };
}

// The project's hand-out ledger, newest first. `eventId` / `allocationId`
// narrow it; `status` defaults to everything so undone rows stay visible.
export async function listRedemptions(
  projectId,
  { eventId, allocationId, status, limit = 500 } = {},
) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let q = sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (eventId) q = q.eq("event_id", eventId);
    if (allocationId) q = q.eq("allocation_id", allocationId);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      console.error("[inventory_issuing.listRedemptions]", error.message);
      return null;
    }
    return (data || []).map(normalizeRedemption);
  } catch (e) {
    console.error("[inventory_issuing.listRedemptions]", e);
    return null;
  }
}

// One subject's collection history — powers the buyer portal and the drawer.
export async function listRedemptionsForSubject(eventId, subjectKey) {
  if (!eventId || !subjectKey || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("event_id", eventId)
      .eq("subject_key", subjectKey)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[inventory_issuing.listForSubject]", error.message);
      return null;
    }
    return (data || []).map(normalizeRedemption);
  } catch (e) {
    console.error("[inventory_issuing.listForSubject]", e);
    return null;
  }
}

// Organiser-side manual issue. Deliberately routed through the same RPC the
// staff route calls so entitlement rules, stock movement and the uniqueness
// guard behave identically everywhere. No access code is needed: issue_actor()
// recognises a signed-in project member and grants full rights.
export async function issueManually({
  eventId,
  allocationId,
  itemId,
  subjectKind = "walkup",
  subjectId = null,
  qty = 1,
  override = false,
  reason = "",
  staff = null,
}) {
  if (!eventId || !allocationId || !itemId) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_redeem", {
      p_event: eventId,
      p_code: null,
      p_allocation: allocationId,
      p_item: itemId,
      p_subject_kind: subjectKind,
      p_subject_id: subjectId,
      p_qty: Number(qty) || 1,
      p_override: Boolean(override),
      p_reason: reason || "",
      p_staff: staff,
      p_method: "manual",
    });
    if (error) {
      console.error("[inventory_issuing.issueManually]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[inventory_issuing.issueManually]", e);
    return null;
  }
}

// Reverse a hand-out from the workspace. Writes the compensating return
// movement through the same RPC the staff route uses.
export async function undoRedemptionAsOrganiser(eventId, redemptionId) {
  if (!eventId || !redemptionId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_undo", {
      p_event: eventId,
      p_code: null,
      p_redemption: redemptionId,
    });
    if (error) {
      console.error("[inventory_issuing.undo]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[inventory_issuing.undo]", e);
    return null;
  }
}

// Look up an attendee from the workspace (manual issue against a real buyer).
export async function lookupSubjectsAsOrganiser(eventId, query) {
  if (!eventId || !query || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_lookup", {
      p_event: eventId,
      p_code: null,
      p_query: query,
    });
    if (error) {
      console.error("[inventory_issuing.lookup]", error.message);
      return null;
    }
    return (data || []).map((r) => ({
      subjectKind: r.subject_kind ?? "order",
      subjectId: r.subject_id,
      name: r.name ?? "",
      email: r.email ?? "",
      ticketCode: r.ticket_code ?? "",
      ticketName: r.ticket_name ?? "",
      units: Number(r.units ?? 1),
    }));
  } catch (e) {
    console.error("[inventory_issuing.lookup]", e);
    return null;
  }
}
