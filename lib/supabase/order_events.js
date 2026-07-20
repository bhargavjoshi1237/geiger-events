"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the per-order activity timeline — the only place that
// talks to events.order_events. Pure: validate, console.error on failure, return
// null / [] / false — never throw, never toast. DB is snake_case; UI is
// camelCase, mapped at this boundary.

const TABLE = "order_events";

export function normalizeOrderEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    projectId: row.project_id ?? null,
    type: row.type ?? "note",
    summary: row.summary ?? "",
    amount: row.amount == null ? null : Number(row.amount),
    actor: row.actor ?? "",
    createdAt: row.created_at ?? null,
  };
}

// The timeline for one order, newest first.
export async function listOrderEvents(orderId) {
  if (!orderId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[orderEvents.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeOrderEvent);
  } catch (e) {
    console.error("[orderEvents.list]", e);
    return null;
  }
}

// Append a timeline entry (note, receipt_sent, invoice_generated, …). Returns
// the normalized row, or null on failure/no-DB.
export async function addOrderEvent({
  orderId,
  projectId = null,
  type = "note",
  summary = "",
  amount = null,
  actor = "",
}) {
  if (!orderId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = {
      order_id: orderId,
      project_id: projectId,
      type,
      summary,
      actor: actor || "",
    };
    if (amount != null) payload.amount = Number(amount) || 0;
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[orderEvents.add]", error.message);
      return null;
    }
    return normalizeOrderEvent(data);
  } catch (e) {
    console.error("[orderEvents.add]", e);
    return null;
  }
}
