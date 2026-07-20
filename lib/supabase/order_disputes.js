"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for chargebacks / disputes — the only place that talks to
// events.order_disputes. Pure: validate, console.error on failure, return
// null / [] / false — never throw, never toast. DB is snake_case; UI is
// camelCase, mapped at this boundary.

const TABLE = "order_disputes";

export function normalizeDispute(row) {
  if (!row) return null;
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    eventId: row.event_id ?? null,
    projectId: row.project_id ?? null,
    amount: Number(row.amount ?? 0),
    status: row.status ?? "Needs response",
    reason: row.reason ?? "",
    evidenceDueAt: row.evidence_due_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    orderId: "order_id",
    eventId: "event_id",
    projectId: "project_id",
    reason: "reason",
    status: "status",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("amount" in input) row.amount = Number(input.amount) || 0;
  if ("evidenceDueAt" in input) row.evidence_due_at = input.evidenceDueAt || null;
  return row;
}

export async function listDisputes(projectId) {
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
      console.error("[disputes.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeDispute);
  } catch (e) {
    console.error("[disputes.list]", e);
    return null;
  }
}

export async function createDispute(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[disputes.create]", error.message);
      return null;
    }
    return normalizeDispute(data);
  } catch (e) {
    console.error("[disputes.create]", e);
    return null;
  }
}

export async function updateDispute(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(toRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[disputes.update]", error.message);
      return null;
    }
    return normalizeDispute(data);
  } catch (e) {
    console.error("[disputes.update]", e);
    return null;
  }
}

export async function softDeleteDispute(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[disputes.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[disputes.delete]", e);
    return false;
  }
}
