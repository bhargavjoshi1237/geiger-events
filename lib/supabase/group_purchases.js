"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the group purchases log — the only place that talks to
// events.group_purchases. Global group-purchasing *settings* live in
// ticketing_settings (module 'group_purchase'); this file owns the purchase
// rows logged across a project's events. Pure: validate, console.error on
// failure, return null / false / [] — never throw, never toast.

const TABLE = "group_purchases";

export function normalizeGroupPurchase(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    organizerName: row.organizer_name ?? "",
    organizerEmail: row.organizer_email ?? "",
    seats: Number(row.seats ?? 0),
    total: Number(row.total ?? 0),
    code: row.code ?? "",
    status: row.status ?? "Pending",
    createdAt: row.created_at ?? null,
  };
}

export async function listGroupPurchases(projectId) {
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
      console.error("[groupPurchases.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeGroupPurchase);
  } catch (e) {
    console.error("[groupPurchases.list]", e);
    return null;
  }
}

export async function updateGroupPurchase(id, patch) {
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
      console.error("[groupPurchases.update]", error.message);
      return null;
    }
    return normalizeGroupPurchase(data);
  } catch (e) {
    console.error("[groupPurchases.update]", e);
    return null;
  }
}

export async function softDeleteGroupPurchase(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[groupPurchases.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[groupPurchases.delete]", e);
    return false;
  }
}
