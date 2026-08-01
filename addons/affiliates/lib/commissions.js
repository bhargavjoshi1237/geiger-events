"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";

// Data access for the commission ledger (events.affiliate_commissions) and
// payout batches (events.affiliate_payouts), plus the attribution and clawback
// RPCs.
//
// Clearance is MANUAL by design: nothing here auto-approves. A commission is
// created `pending` by attribution and only an organiser moves it on.
// Pure: validate, console.error on failure, return null/false/[].

const COMMISSIONS = "affiliate_commissions";
const PAYOUTS = "affiliate_payouts";

export function normalizeCommission(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    programId: row.program_id ?? null,
    enrolmentId: row.enrolment_id ?? null,
    affiliateId: row.affiliate_id ?? null,
    orderId: row.order_id ?? null,
    payoutId: row.payout_id ?? null,
    source: row.source ?? "link",
    baseAmount: Number(row.base_amount ?? 0),
    rateModel: row.rate_model ?? "percent",
    rateValue: Number(row.rate_value ?? 0),
    amount: Number(row.amount ?? 0),
    state: row.state ?? "pending",
    approvedAt: row.approved_at ?? null,
    reversedAt: row.reversed_at ?? null,
    reversalReason: row.reversal_reason ?? "",
    createdAt: row.created_at ?? null,
    affiliate: row.affiliates
      ? { id: row.affiliates.id, name: row.affiliates.name, email: row.affiliates.email }
      : null,
    order: row.event_orders
      ? {
          id: row.event_orders.id,
          buyerName: row.event_orders.buyer_name ?? "",
          buyerEmail: row.event_orders.buyer_email ?? "",
          ticketName: row.event_orders.ticket_name ?? "",
          quantity: Number(row.event_orders.quantity ?? 0),
          total: Number(row.event_orders.total ?? 0),
        }
      : null,
  };
}

export async function listCommissions(projectId, { state } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let query = sb
      .from(COMMISSIONS)
      .select(
        "*, affiliates(id, name, email), event_orders(id, buyer_name, buyer_email, ticket_name, quantity, total)",
      )
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (state && state !== "all") query = query.eq("state", state);
    const { data, error } = await query;
    if (error) {
      console.error("[affiliates.commissions.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeCommission);
  } catch (e) {
    console.error("[affiliates.commissions.list]", e);
    return null;
  }
}

// Approve pending rows. Manual approval is the whole clearance model here, so
// this is the only path out of `pending` other than a reversal.
export async function approveCommissions(ids) {
  if (!ids?.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const user = await getUser();
    const { error } = await sb
      .from(COMMISSIONS)
      .update({
        state: "approved",
        approved_at: new Date().toISOString(),
        approved_by: user?.id ?? null,
      })
      .in("id", ids)
      .eq("state", "pending");
    if (error) {
      console.error("[affiliates.commissions.approve]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[affiliates.commissions.approve]", e);
    return false;
  }
}

// Reverse by commission id (the organiser's manual clawback). The refund-driven
// path goes through reverseCommissionForOrder instead.
export async function reverseCommissions(ids, reason = "reversed") {
  if (!ids?.length || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(COMMISSIONS)
      .update({
        state: "reversed",
        reversed_at: new Date().toISOString(),
        reversal_reason: reason,
      })
      .in("id", ids)
      .in("state", ["pending", "approved"]);
    if (error) {
      console.error("[affiliates.commissions.reverse]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[affiliates.commissions.reverse]", e);
    return false;
  }
}

// --- RPCs --------------------------------------------------------------------

// Attribute an order to an affiliate. Safe to call more than once: the RPC is
// idempotent on order_id, so a retry returns the existing commission rather
// than paying twice. Returns { ok, commissionId, amount, reason }.
export async function attributeOrder(orderId, { ref, code } = {}) {
  if (!orderId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("attribute_affiliate_order", {
      p_order_id: orderId,
      p_ref: ref || null,
      p_code: code || null,
    });
    if (error) {
      console.error("[affiliates.attribute]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      ok: Boolean(row.ok),
      commissionId: row.commission_id ?? null,
      amount: Number(row.amount ?? 0),
      reason: row.reason ?? null,
    };
  } catch (e) {
    console.error("[affiliates.attribute]", e);
    return null;
  }
}

// Clawback driven by a refund. Leaves already-paid rows alone — money that has
// left is an accounting problem, not a state flip.
export async function reverseCommissionForOrder(orderId, reason = "refunded") {
  if (!orderId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("reverse_affiliate_commission", {
      p_order_id: orderId,
      p_reason: reason,
    });
    if (error) {
      console.error("[affiliates.reverseForOrder]", error.message);
      return false;
    }
    return Boolean(data);
  } catch (e) {
    console.error("[affiliates.reverseForOrder]", e);
    return false;
  }
}

// --- Payouts -----------------------------------------------------------------

export function normalizePayout(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    affiliateId: row.affiliate_id ?? null,
    periodStart: row.period_start ?? null,
    periodEnd: row.period_end ?? null,
    amount: Number(row.amount ?? 0),
    method: row.method ?? "manual",
    reference: row.reference ?? "",
    state: row.state ?? "draft",
    sentAt: row.sent_at ?? null,
    notes: row.notes ?? "",
    createdAt: row.created_at ?? null,
    affiliate: row.affiliates
      ? { id: row.affiliates.id, name: row.affiliates.name, email: row.affiliates.email }
      : null,
  };
}

export async function listPayouts(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(PAYOUTS)
      .select("*, affiliates(id, name, email)")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[affiliates.payouts.list]", error.message);
      return null;
    }
    return (data || []).map(normalizePayout);
  } catch (e) {
    console.error("[affiliates.payouts.list]", e);
    return null;
  }
}

// Settle every approved commission for one affiliate into a payout batch.
//
// Two steps rather than one RPC: create the batch, then stamp its id and `paid`
// onto the rows it covers. If the second step fails the batch is left in draft
// with no rows attached — visibly incomplete, which is the safe way to fail.
export async function createPayoutBatch(projectId, affiliateId, input = {}) {
  if (!projectId || !affiliateId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const user = await getUser();

    const { data: rows, error: readError } = await sb
      .from(COMMISSIONS)
      .select("id, amount")
      .eq("project_id", projectId)
      .eq("affiliate_id", affiliateId)
      .eq("state", "approved");
    if (readError) {
      console.error("[affiliates.payouts.collect]", readError.message);
      return null;
    }
    if (!rows?.length) return null;

    const amount = rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
    const { data: payout, error } = await sb
      .from(PAYOUTS)
      .insert({
        project_id: projectId,
        affiliate_id: affiliateId,
        amount,
        method: input.method || "manual",
        reference: input.reference || "",
        notes: input.notes || "",
        state: "draft",
        period_start: input.periodStart || null,
        period_end: input.periodEnd || null,
        created_by: user?.id ?? null,
      })
      .select("*, affiliates(id, name, email)")
      .single();
    if (error) {
      console.error("[affiliates.payouts.create]", error.message);
      return null;
    }

    const { error: markError } = await sb
      .from(COMMISSIONS)
      .update({ payout_id: payout.id, state: "paid" })
      .in(
        "id",
        rows.map((r) => r.id),
      );
    if (markError) {
      console.error("[affiliates.payouts.mark]", markError.message);
      // The batch exists but covers nothing — surfaced as a draft with no rows.
      return normalizePayout(payout);
    }
    return normalizePayout(payout);
  } catch (e) {
    console.error("[affiliates.payouts.create]", e);
    return null;
  }
}

export async function updatePayout(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const row = {};
    if ("state" in patch) row.state = patch.state;
    if ("method" in patch) row.method = patch.method;
    if ("reference" in patch) row.reference = patch.reference;
    if ("notes" in patch) row.notes = patch.notes;
    if (patch.state === "sent") row.sent_at = new Date().toISOString();
    const { data, error } = await sb
      .from(PAYOUTS)
      .update(row)
      .eq("id", id)
      .select("*, affiliates(id, name, email)")
      .single();
    if (error) {
      console.error("[affiliates.payouts.update]", error.message);
      return null;
    }
    return normalizePayout(data);
  } catch (e) {
    console.error("[affiliates.payouts.update]", e);
    return null;
  }
}
