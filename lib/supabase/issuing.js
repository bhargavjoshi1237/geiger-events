"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Anon-callable wrappers for the /issue staff route, mirroring lib/supabase/checkin.js.
//
// Every call is gated server-side on a per-event 'issue' access code — the
// staff device is unauthenticated, so the SECURITY DEFINER RPCs in
// zzzz_inventory_issuing.sql are the only way in. Entitlement is always
// re-derived inside the RPC; nothing here is trusted.
//
// Pure: validate, console.error on failure, return null/[]/false. The screen
// owns all UX.

// Candidate subjects (orders + registrations) matching a scan or a typed query.
export async function lookupSubjects(eventId, code, query) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_lookup", {
      p_event: eventId,
      p_code: code,
      p_query: query || "",
    });
    if (error) {
      console.error("[issuing.lookup]", error.message);
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
    console.error("[issuing.lookup]", e);
    return null;
  }
}

// Everything this subject may collect right now, with live variant stock.
export async function listEntitlements(eventId, code, subjectKind, subjectId) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_entitlements", {
      p_event: eventId,
      p_code: code,
      p_subject_kind: subjectKind || "walkup",
      p_subject_id: subjectId || null,
    });
    if (error) {
      console.error("[issuing.entitlements]", error.message);
      return null;
    }
    return (data || []).map(normalizeEntitlement);
  } catch (e) {
    console.error("[issuing.entitlements]", e);
    return null;
  }
}

export function normalizeEntitlement(row) {
  if (!row) return null;
  return {
    allocationId: row.allocation_id,
    itemId: row.item_id,
    itemName: row.item_name ?? "",
    variantLabel: row.variant_label ?? "",
    imageUrl: row.image_url ?? "",
    category: row.category ?? "",
    issuance: row.issuance ?? "internal",
    periodMode: row.period_mode ?? "none",
    periodKey: row.period_key ?? "",
    periodLabel: row.period_label ?? "",
    entitledQty: Number(row.entitled_qty ?? 0),
    redeemedQty: Number(row.redeemed_qty ?? 0),
    remaining: Number(row.remaining ?? 0),
    lastAt: row.last_at ?? null,
    blockedReason: row.blocked_reason ?? "",
    variants: Array.isArray(row.variants) ? row.variants : [],
  };
}

// Open allocations for the event, with their pickable variants. Used by walk-up
// issuing, which has no subject to derive entitlement from.
export async function listOpenAllocations(eventId, code) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_allocations", {
      p_event: eventId,
      p_code: code,
    });
    if (error) {
      console.error("[issuing.allocations]", error.message);
      return null;
    }
    return (data || []).map((r) => ({
      allocationId: r.allocation_id,
      itemId: r.item_id,
      itemName: r.item_name ?? "",
      variantLabel: r.variant_label ?? "",
      imageUrl: r.image_url ?? "",
      category: r.category ?? "",
      issuance: r.issuance ?? "internal",
      status: r.status ?? "Planned",
      plannedQty: Number(r.planned_qty ?? 0),
      issuedQty: Number(r.issued_qty ?? 0),
      variants: Array.isArray(r.variants) ? r.variants : [],
    }));
  } catch (e) {
    console.error("[issuing.allocations]", e);
    return null;
  }
}

// Hand it over. Returns the RPC's { ok, reason, already, redemptionId, ... }.
// A falsy `ok` is a normal outcome (already collected, outside window, capped),
// not an error — the screen reads `reason` to decide what to say.
export async function redeemEntitlement({
  eventId,
  code,
  allocationId,
  itemId,
  subjectKind = "walkup",
  subjectId = null,
  qty = 1,
  override = false,
  reason = "",
  staff = null,
  method = "scan",
}) {
  if (!eventId || !code || !allocationId || !itemId) return null;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_redeem", {
      p_event: eventId,
      p_code: code,
      p_allocation: allocationId,
      p_item: itemId,
      p_subject_kind: subjectKind,
      p_subject_id: subjectId,
      p_qty: Number(qty) || 1,
      p_override: Boolean(override),
      p_reason: reason || "",
      p_staff: staff,
      p_method: method,
    });
    if (error) {
      console.error("[issuing.redeem]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[issuing.redeem]", e);
    return null;
  }
}

// Reverse a hand-out — writes a compensating return movement. Needs canReturn.
export async function undoRedemption(eventId, code, redemptionId) {
  if (!eventId || !code || !redemptionId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_undo", {
      p_event: eventId,
      p_code: code,
      p_redemption: redemptionId,
    });
    if (error) {
      console.error("[issuing.undo]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[issuing.undo]", e);
    return null;
  }
}

// Header counts for the staff route: { issuedToday, issuedTotal, collectors }.
export async function issueStats(eventId, code) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_stats", {
      p_event: eventId,
      p_code: code,
    });
    if (error) {
      console.error("[issuing.stats]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[issuing.stats]", e);
    return null;
  }
}
