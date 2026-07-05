"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Check-in area. The only place that talks to the
// events.checkin_* tables. Pure: validate, console.error on failure, return
// null / false / [] — never throw, never toast (the screen owns UX). DB is
// snake_case; the UI is camelCase, mapped at this boundary.
//
//   checkin_settings   — one row per project: global feature flags + config.
//   checkin_attendance — check-in records (Real-time Attendance / scanner).
//   checkin_staff_roles — staff scanning roles + access code (route auth).
//   checkin_leads      — exhibitor lead captures (CSV export).
//
// Per-EVENT config is NOT here — it lives in events.events.metadata.checkin,
// written through updateEventMeta (event_merge_meta RPC). Feature-slice config
// defaults live UI-side in the area's constants.js; this layer returns raw bags.

// --- checkin_settings (project singleton) ------------------------------------

const SETTINGS_TABLE = "checkin_settings";

export function normalizeSettings(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    projectId: row.project_id ?? null,
    config: row.config && typeof row.config === "object" ? row.config : {},
    createdBy: row.created_by ?? null,
  };
}

// The project's settings row. Returns a usable object even when no row exists
// yet ({ config: {} }) so the screen can render and the first save creates it.
// null only signals not-configured / read failure.
export async function getCheckinSettings(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SETTINGS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[checkin.getSettings]", error.message);
      return null;
    }
    return data
      ? normalizeSettings(data)
      : { id: null, projectId, config: {} };
  } catch (e) {
    console.error("[checkin.getSettings]", e);
    return null;
  }
}

// Shallow-merge a config patch (a full feature slice, e.g. { doorSales: {…} })
// into the project's settings row, upserting it. Returns the merged config, or
// false on a write failure, or null when not configured.
export async function updateCheckinSettings(projectId, patch) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("checkin_settings_merge", {
      p_project: projectId,
      p_patch: patch && typeof patch === "object" ? patch : {},
    });
    if (error) {
      console.error("[checkin.updateSettings]", error.message);
      return false;
    }
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    console.error("[checkin.updateSettings]", e);
    return false;
  }
}

// --- checkin_attendance ------------------------------------------------------

const ATTENDANCE_TABLE = "checkin_attendance";

export function normalizeAttendance(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    projectId: row.project_id ?? null,
    registrationId: row.registration_id ?? null,
    orderId: row.order_id ?? null,
    attendeeName: row.attendee_name ?? "",
    ticketCode: row.ticket_code ?? "",
    gate: row.gate ?? "",
    zone: row.zone ?? "",
    sessionId: row.session_id ?? "",
    method: row.method ?? "manual",
    checkedInBy: row.checked_in_by ?? "",
    status: row.status ?? "in",
    checkedInAt: row.checked_in_at ?? null,
  };
}

function attendanceToRow(input) {
  const row = {};
  const map = {
    eventId: "event_id",
    projectId: "project_id",
    registrationId: "registration_id",
    orderId: "order_id",
    attendeeName: "attendee_name",
    ticketCode: "ticket_code",
    gate: "gate",
    zone: "zone",
    sessionId: "session_id",
    method: "method",
    checkedInBy: "checked_in_by",
    status: "status",
  };
  for (const [key, col] of Object.entries(map)) if (key in input) row[col] = input[key];
  return row;
}

export async function listAttendanceByProject(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ATTENDANCE_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("checked_in_at", { ascending: false });
    if (error) {
      console.error("[checkin.listAttendance]", error.message);
      return null;
    }
    return (data || []).map(normalizeAttendance);
  } catch (e) {
    console.error("[checkin.listAttendance]", e);
    return null;
  }
}

export async function listAttendanceByEvent(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ATTENDANCE_TABLE)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("checked_in_at", { ascending: false });
    if (error) {
      console.error("[checkin.listAttendanceByEvent]", error.message);
      return null;
    }
    return (data || []).map(normalizeAttendance);
  } catch (e) {
    console.error("[checkin.listAttendanceByEvent]", e);
    return null;
  }
}

// Record a check-in. Honors a caller-supplied id so an optimistic row and the
// inserted row share a UUID.
export async function createCheckin(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = attendanceToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(ATTENDANCE_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[checkin.createCheckin]", error.message);
      return null;
    }
    return normalizeAttendance(data);
  } catch (e) {
    console.error("[checkin.createCheckin]", e);
    return null;
  }
}

// --- checkin_staff_roles -----------------------------------------------------

const ROLES_TABLE = "checkin_staff_roles";

export function normalizeStaffRole(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "Untitled role",
    permissions:
      row.permissions && typeof row.permissions === "object"
        ? row.permissions
        : {},
    accessCode: row.access_code ?? "",
    active: row.active ?? true,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function roleToRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId;
  if ("name" in input) row.name = input.name || "Untitled role";
  if ("permissions" in input) {
    row.permissions =
      input.permissions && typeof input.permissions === "object"
        ? input.permissions
        : {};
  }
  if ("accessCode" in input) row.access_code = input.accessCode || null;
  if ("active" in input) row.active = Boolean(input.active);
  if ("createdBy" in input) row.created_by = input.createdBy;
  return row;
}

export async function listStaffRoles(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ROLES_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[checkin.listStaffRoles]", error.message);
      return null;
    }
    return (data || []).map(normalizeStaffRole);
  } catch (e) {
    console.error("[checkin.listStaffRoles]", e);
    return null;
  }
}

export async function createStaffRole(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = roleToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(ROLES_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[checkin.createStaffRole]", error.message);
      return null;
    }
    return normalizeStaffRole(data);
  } catch (e) {
    console.error("[checkin.createStaffRole]", e);
    return null;
  }
}

export async function updateStaffRole(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ROLES_TABLE)
      .update(roleToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[checkin.updateStaffRole]", error.message);
      return null;
    }
    return normalizeStaffRole(data);
  } catch (e) {
    console.error("[checkin.updateStaffRole]", e);
    return null;
  }
}

export async function softDeleteStaffRole(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(ROLES_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[checkin.deleteStaffRole]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[checkin.deleteStaffRole]", e);
    return false;
  }
}

// --- checkin_leads -----------------------------------------------------------

const LEADS_TABLE = "checkin_leads";

export function normalizeLead(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    projectId: row.project_id ?? null,
    exhibitor: row.exhibitor ?? "",
    attendeeName: row.attendee_name ?? "",
    contact: row.contact && typeof row.contact === "object" ? row.contact : {},
    capturedAt: row.captured_at ?? null,
  };
}

export async function listLeadsByProject(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(LEADS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("captured_at", { ascending: false });
    if (error) {
      console.error("[checkin.listLeads]", error.message);
      return null;
    }
    return (data || []).map(normalizeLead);
  } catch (e) {
    console.error("[checkin.listLeads]", e);
    return null;
  }
}

// --- Staff-route RPCs (Phase 2) ----------------------------------------------
// Anonymous, access-code-gated. These call SECURITY DEFINER RPCs
// (supabase/sqls/checkin_routes.sql) so an anon staff device can read/admit
// without the member-only RLS on checkin_attendance. Pure: return data / null.

// Validate a staff access code for an event → the role { id, name, permissions }
// or null (invalid / not configured).
export async function validateCheckinCode(eventId, code) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("checkin_validate_code", {
      p_event: eventId,
      p_code: code,
    });
    if (error) {
      console.error("[checkin.validateCode]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[checkin.validateCode]", e);
    return null;
  }
}

// Search an event's registrations (name / email / ticket code). Returns rows
// (camelCase) or null on failure / invalid code.
export async function searchCheckin(eventId, code, query) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("checkin_search", {
      p_event: eventId,
      p_code: code,
      p_query: query || "",
    });
    if (error) {
      console.error("[checkin.search]", error.message);
      return null;
    }
    return (data || []).map((r) => ({
      registrationId: r.registration_id,
      name: r.name ?? "",
      email: r.email ?? "",
      ticketCode: r.ticket_code ?? "",
      partySize: r.party_size ?? 1,
      status: r.status ?? "",
      checkedIn: !!r.checked_in,
    }));
  } catch (e) {
    console.error("[checkin.search]", e);
    return null;
  }
}

// Admit an attendee. Returns { ok, already, id } or null on failure.
export async function admitCheckin({
  eventId,
  code,
  registrationId = null,
  orderId = null,
  name = "",
  ticketCode = null,
  gate = null,
  zone = null,
  sessionId = null,
  method = "manual",
  staff = null,
}) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("checkin_admit", {
      p_event: eventId,
      p_code: code,
      p_registration: registrationId,
      p_order: orderId,
      p_name: name,
      p_ticket_code: ticketCode,
      p_gate: gate,
      p_zone: zone,
      p_session: sessionId,
      p_method: method,
      p_staff: staff,
    });
    if (error) {
      console.error("[checkin.admit]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[checkin.admit]", e);
    return null;
  }
}

// Live counts for a route header → { checkedIn, expected } or null.
export async function checkinStats(eventId, code) {
  if (!eventId || !code || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("checkin_stats", {
      p_event: eventId,
      p_code: code,
    });
    if (error) {
      console.error("[checkin.stats]", error.message);
      return null;
    }
    return data || null;
  } catch (e) {
    console.error("[checkin.stats]", e);
    return null;
  }
}
