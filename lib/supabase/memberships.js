"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the membership roster — the only place that talks to
// events.membership_members. Membership *plans* are reusable records in
// events.ticketing_records (module 'membership'), reached through
// lib/supabase/ticketing.js; the master enable + join settings live in
// ticketing_settings (module 'membership'). This file owns the enrollment rows.
// Pure: validate, console.error on failure, return null / false / [] — never
// throw, never toast. DB is snake_case; the UI is camelCase.

const TABLE = "membership_members";

export function normalizeMember(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    membershipId: row.membership_id ?? null,
    name: row.name ?? "",
    email: row.email ?? "",
    status: row.status ?? "Active",
    startedAt: row.started_at ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId;
  if ("membershipId" in input) row.membership_id = input.membershipId || null;
  if ("name" in input) row.name = input.name || "";
  if ("email" in input) row.email = input.email || "";
  if ("status" in input) row.status = input.status || "Active";
  if ("expiresAt" in input) row.expires_at = input.expiresAt || null;
  return row;
}

export async function listMembers(projectId) {
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
      console.error("[memberships.listMembers]", error.message);
      return null;
    }
    return (data || []).map(normalizeMember);
  } catch (e) {
    console.error("[memberships.listMembers]", e);
    return null;
  }
}

export async function createMember(input) {
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
      console.error("[memberships.createMember]", error.message);
      return null;
    }
    return normalizeMember(data);
  } catch (e) {
    console.error("[memberships.createMember]", e);
    return null;
  }
}

export async function updateMember(id, patch) {
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
      console.error("[memberships.updateMember]", error.message);
      return null;
    }
    return normalizeMember(data);
  } catch (e) {
    console.error("[memberships.updateMember]", e);
    return null;
  }
}

export async function softDeleteMember(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[memberships.deleteMember]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[memberships.deleteMember]", e);
    return false;
  }
}
