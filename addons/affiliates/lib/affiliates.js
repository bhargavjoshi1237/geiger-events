"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/events";
import { getUser } from "@/lib/supabase/user";

// Data access for events.affiliates — the project-wide affiliate person.
//
// One identity per project: one portal login, one payout destination, one
// lifetime earnings view. Per-event participation lives in affiliate_enrolments
// (see ./programs.js), never here.
//
// DB is snake_case, the UI is camelCase; map at this boundary. Pure: validate,
// console.error on failure, return null/false/[] — never throw, never toast.

const TABLE = "affiliates";

export function normalizeAffiliate(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    portalMemberId: row.portal_member_id ?? null,
    name: row.name ?? "",
    email: row.email ?? "",
    slug: row.slug ?? "",
    status: row.status ?? "invited",
    invitedAt: row.invited_at ?? null,
    acceptedAt: row.accepted_at ?? null,
    payoutDetails:
      row.payout_details && typeof row.payout_details === "object"
        ? row.payout_details
        : {},
    notes: row.notes ?? "",
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    portalMemberId: "portal_member_id",
    name: "name",
    email: "email",
    slug: "slug",
    status: "status",
    notes: "notes",
    payoutDetails: "payout_details",
    metadata: "metadata",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("invitedAt" in input) row.invited_at = input.invitedAt || null;
  if ("acceptedAt" in input) row.accepted_at = input.acceptedAt || null;
  if ("email" in input) row.email = String(input.email || "").trim().toLowerCase();
  return row;
}

export async function listAffiliates(projectId) {
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
      console.error("[affiliates.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeAffiliate);
  } catch (e) {
    console.error("[affiliates.list]", e);
    return null;
  }
}

export async function getAffiliate(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .single();
    if (error) {
      console.error("[affiliates.get]", error.message);
      return null;
    }
    return normalizeAffiliate(data);
  } catch (e) {
    console.error("[affiliates.get]", e);
    return null;
  }
}

// Invite one affiliate. Recruitment is invite-only in this design, so a created
// affiliate always starts `invited` with the invite timestamp stamped.
export async function createAffiliate(projectId, input) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const user = await getUser();
    const payload = {
      ...toRow({ ...input, projectId }),
      status: input.status || "invited",
      invited_at: input.invitedAt || new Date().toISOString(),
      created_by: user?.id ?? null,
    };
    if (input.id) payload.id = input.id; // honour the optimistic UUID
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[affiliates.create]", error.message);
      return null;
    }
    return normalizeAffiliate(data);
  } catch (e) {
    console.error("[affiliates.create]", e);
    return null;
  }
}

export async function updateAffiliate(id, patch) {
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
      console.error("[affiliates.update]", error.message);
      return null;
    }
    return normalizeAffiliate(data);
  } catch (e) {
    console.error("[affiliates.update]", e);
    return null;
  }
}

export async function softDeleteAffiliate(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[affiliates.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[affiliates.delete]", e);
    return false;
  }
}

// Per-affiliate rollups for the roster: lifetime earned (everything not
// reversed), still pending, and already paid. One grouped read rather than a
// query per row.
export async function listAffiliateTotals(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("affiliate_commissions")
      .select("affiliate_id, amount, state")
      .eq("project_id", projectId);
    if (error) {
      console.error("[affiliates.totals]", error.message);
      return null;
    }
    const totals = {};
    (data || []).forEach((row) => {
      const key = row.affiliate_id;
      if (!totals[key]) {
        totals[key] = { earned: 0, pending: 0, approved: 0, paid: 0, orders: 0 };
      }
      const amount = Number(row.amount) || 0;
      if (row.state === "reversed") return;
      totals[key].earned += amount;
      totals[key].orders += 1;
      if (row.state === "pending") totals[key].pending += amount;
      if (row.state === "approved") totals[key].approved += amount;
      if (row.state === "paid") totals[key].paid += amount;
    });
    return totals;
  } catch (e) {
    console.error("[affiliates.totals]", e);
    return null;
  }
}
