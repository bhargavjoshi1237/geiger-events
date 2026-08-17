"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for an event's Co-hosts & Admins section. The only place
// that talks to events.event_team_members — one row per person with access to a
// single event, added either from the project roster or entered by hand. Access
// is granted directly (status 'active'); the invited_at / invited_by columns are
// left over from the retired email-invite flow and are no longer written.
// Pure: validate, console.error on failure, return null / false / [].

const TABLE = "event_team_members";

// DB row -> camelCase view model the section renders directly.
export function normalizeEventTeamMember(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    projectId: row.project_id ?? null,
    memberId: row.member_id ?? null,
    userId: row.user_id ?? null,
    role: row.role ?? "Co-host",
    status: row.status ?? "active",
    name: row.name ?? "",
    email: row.email ?? "",
    avatarUrl: row.avatar_url ?? "",
    invitedBy: row.invited_by ?? null,
    invitedAt: row.invited_at ?? null,
    joinedAt: row.joined_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    ...meta,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present, so one update serves a full add and a single-field inline edit
// (`{ role }`, `{ status }`).
function toRow(input) {
  const row = {};
  const map = {
    eventId: "event_id",
    projectId: "project_id",
    memberId: "member_id",
    userId: "user_id",
    role: "role",
    status: "status",
    name: "name",
    email: "email",
    avatarUrl: "avatar_url",
    invitedBy: "invited_by",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("invitedAt" in input) row.invited_at = input.invitedAt || null;
  if ("joinedAt" in input) row.joined_at = input.joinedAt || null;
  return row;
}

// Everyone with access to an event, oldest grant first (the owner leads).
export async function listEventTeam(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[event_team.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeEventTeamMember);
  } catch (e) {
    console.error("[event_team.list]", e);
    return null;
  }
}

// Grant access. Honors a caller-supplied id so the optimistic row and the
// inserted row share a UUID. Every grant is active on insert — access is given
// directly, so there is no invitation to accept.
export async function addEventTeamMember(input) {
  if (!input?.eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = toRow(input);
    if (input.id) payload.id = input.id;
    if (payload.status === "active" && !payload.joined_at) {
      payload.joined_at = new Date().toISOString();
    }
    const { data, error } = await sb
      .from(TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[event_team.add]", error.message);
      return null;
    }
    return normalizeEventTeamMember(data);
  } catch (e) {
    console.error("[event_team.add]", e);
    return null;
  }
}

export async function updateEventTeamMember(id, patch) {
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
      console.error("[event_team.update]", error.message);
      return null;
    }
    return normalizeEventTeamMember(data);
  } catch (e) {
    console.error("[event_team.update]", e);
    return null;
  }
}

export async function softDeleteEventTeamMember(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[event_team.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[event_team.delete]", e);
    return false;
  }
}
