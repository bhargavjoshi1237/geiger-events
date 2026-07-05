"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the refund requests inbox — the only place that talks to
// events.refund_requests. Global refund *settings* live in ticketing_settings
// (module 'refund'); this file owns the request rows. Pure: validate,
// console.error on failure, return null / false / [] — never throw, never toast.
// DB is snake_case; the UI is camelCase, mapped at this boundary.

const TABLE = "refund_requests";

export function normalizeRefundRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    orderId: row.order_id ?? null,
    buyerName: row.buyer_name ?? "",
    buyerEmail: row.buyer_email ?? "",
    reason: row.reason ?? "",
    amount: Number(row.amount ?? 0),
    status: row.status ?? "Requested",
    createdAt: row.created_at ?? null,
  };
}

export async function listRefundRequests(projectId) {
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
      console.error("[refunds.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeRefundRequest);
  } catch (e) {
    console.error("[refunds.list]", e);
    return null;
  }
}

export async function updateRefundRequest(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const row = {};
    if ("status" in patch) row.status = patch.status;
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[refunds.update]", error.message);
      return null;
    }
    return normalizeRefundRequest(data);
  } catch (e) {
    console.error("[refunds.update]", e);
    return null;
  }
}

export async function softDeleteRefundRequest(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[refunds.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[refunds.delete]", e);
    return false;
  }
}
