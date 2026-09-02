"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { listRecords } from "./ticketing";

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

const MEMBER_RECORD_MODULE = "membership_member";

function toMemberRecord(member, planName = "") {
  if (!member) return null;
  const status = member.status || "Active";
  return {
    id: member.id,
    module: MEMBER_RECORD_MODULE,
    kind: "member",
    name: member.name || member.email || "Member",
    active: status === "Active",
    config: {
      email: member.email || "",
      membershipId: member.membershipId || null,
      planName: planName || "",
      status,
      startedAt: member.startedAt || null,
      expiresAt: member.expiresAt || null,
    },
    projectId: member.projectId,
    createdBy: null,
    createdAt: member.createdAt,
  };
}

function memberPatchFromRecord(patch = {}) {
  const config = patch.config || {};
  const out = {};
  if ("projectId" in patch) out.projectId = patch.projectId;
  if ("name" in patch) out.name = patch.name || "";
  if ("config" in patch) {
    out.email = config.email || "";
    out.membershipId = config.membershipId || null;
    out.status = patch.active
      ? "Active"
      : config.status === "Expired"
        ? "Expired"
        : "Cancelled";
    out.expiresAt = config.expiresAt || null;
  }
  if ("active" in patch && !("config" in patch)) {
    out.status = patch.active ? "Active" : "Cancelled";
  }
  return out;
}

export async function listMemberRecords(projectId) {
  const [members, plans] = await Promise.all([
    listMembers(projectId),
    listRecords(projectId, "membership"),
  ]);
  if (!members) return null;
  const planNames = Object.fromEntries((plans || []).map((p) => [p.id, p.name]));
  return members.map((member) =>
    toMemberRecord(member, planNames[member.membershipId] || ""),
  );
}

export async function createMemberRecord(record) {
  const config = record?.config || {};
  const saved = await createMember({
    id: record?.id,
    projectId: record?.projectId,
    membershipId: config.membershipId,
    name: record?.name,
    email: config.email,
    status: config.status || (record?.active ? "Active" : "Cancelled"),
    expiresAt: config.expiresAt,
  });
  return saved ? toMemberRecord(saved, config.planName) : saved;
}

export async function updateMemberRecord(id, patch) {
  const saved = await updateMember(id, memberPatchFromRecord(patch));
  return saved ? toMemberRecord(saved, patch?.config?.planName) : saved;
}

export function softDeleteMemberRecord(id) {
  return softDeleteMember(id);
}
