"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for order-linked refunds — the only place that talks to
// events.order_refunds and the events.issue_order_refund() RPC. One row per
// refund against an order (full or partial). Pure: validate, console.error on
// failure, return null / [] / false — never throw, never toast (the screen owns
// UX). DB is snake_case; the UI is camelCase, mapped at this boundary.

const TABLE = "order_refunds";

export function normalizeOrderRefund(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    eventId: row.event_id ?? null,
    projectId: row.project_id ?? null,
    amount: Number(row.amount ?? 0),
    reason: row.reason ?? "",
    reasonCode: row.reason_code ?? "other",
    method: row.method ?? "original",
    status: row.status ?? "Requested",
    notes: row.notes ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

// Every refund in a project, newest first — powers the Refunds & Cancellations
// queue.
export async function listOrderRefunds(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[orderRefunds.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeOrderRefund);
  } catch (e) {
    console.error("[orderRefunds.list]", e);
    return null;
  }
}

// Refunds against a single order (for the detail drawer).
export async function listRefundsForOrder(orderId) {
  if (!orderId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("order_id", orderId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[orderRefunds.listForOrder]", error.message);
      return null;
    }
    return (data || []).map(normalizeOrderRefund);
  } catch (e) {
    console.error("[orderRefunds.listForOrder]", e);
    return null;
  }
}

// Issue a refund through the atomic RPC — records it, bumps the order's
// refunded_total, adjusts event revenue, and writes a timeline entry. Returns
// { ok, refundId, refundedTotal, orderTotal } or null on failure/no-DB.
export async function issueRefund({
  orderId,
  amount,
  reason = "",
  reasonCode = "other",
  method = "original",
  actor = "",
}) {
  if (!orderId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("issue_order_refund", {
      p_order_id: orderId,
      p_amount: Number(amount) || 0,
      p_reason: reason || "",
      p_reason_code: reasonCode || "other",
      p_method: method || "original",
      p_actor: actor || "",
    });
    if (error) {
      console.error("[orderRefunds.issue]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return null;
    return {
      ok: Boolean(row.ok),
      refundId: row.refund_id ?? null,
      refundedTotal: Number(row.refunded_total ?? 0),
      orderTotal: Number(row.order_total ?? 0),
    };
  } catch (e) {
    console.error("[orderRefunds.issue]", e);
    return null;
  }
}

// Move a refund request through the queue (Requested → Approved / Denied).
export async function updateRefundStatus(id, status) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb.from(TABLE).update({ status }).eq("id", id);
    if (error) {
      console.error("[orderRefunds.updateStatus]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[orderRefunds.updateStatus]", e);
    return false;
  }
}

export async function softDeleteOrderRefund(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[orderRefunds.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[orderRefunds.delete]", e);
    return false;
  }
}
