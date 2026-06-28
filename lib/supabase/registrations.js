"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Registrations area. The only place that talks to the
// public.flow_registrations table (and the waitlist/approval RPCs). Pure:
// validate, console.error on failure, return null / false / [] — never throw,
// never toast (the screen owns UX). DB is snake_case; the UI is camelCase,
// mapped at this boundary.

const TABLE = "flow_registrations";

// DB row -> camelCase view model the screens render directly.
export function normalizeRegistration(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    formId: row.form_id ?? null,
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    status: row.status ?? "Confirmed",
    source: row.source ?? "Online",
    partySize: row.party_size ?? 1,
    plusOnes: Array.isArray(row.plus_ones) ? row.plus_ones : [],
    dietary: row.dietary ?? "",
    accessibility: row.accessibility ?? "",
    answers:
      row.answers && typeof row.answers === "object" ? row.answers : {},
    waitlistPosition: row.waitlist_position ?? null,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    // Expansion-bag keys surface as first-class fields on the view model.
    ...meta,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present in `input`, so one updateRegistration() serves both a full-form save
// and a single-field inline edit (`{ status }`, `{ waitlistPosition }`…).
function toRow(input) {
  const row = {};
  const map = {
    eventId: "event_id",
    formId: "form_id",
    name: "name",
    email: "email",
    phone: "phone",
    status: "status",
    source: "source",
    dietary: "dietary",
    accessibility: "accessibility",
    approvedBy: "approved_by",
    approvedAt: "approved_at",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("plusOnes" in input) {
    row.plus_ones = Array.isArray(input.plusOnes) ? input.plusOnes : [];
  }
  if ("answers" in input) {
    row.answers =
      input.answers && typeof input.answers === "object" ? input.answers : {};
  }
  if ("partySize" in input) row.party_size = Number(input.partySize) || 1;
  if ("waitlistPosition" in input) {
    row.waitlist_position =
      input.waitlistPosition === null || input.waitlistPosition === ""
        ? null
        : Number(input.waitlistPosition);
  }
  return row;
}

export async function listRegistrations() {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[registrations.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeRegistration);
  } catch (e) {
    console.error("[registrations.list]", e);
    return null;
  }
}

export async function listRegistrationsByEvent(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[registrations.listByEvent]", error.message);
      return null;
    }
    return (data || []).map(normalizeRegistration);
  } catch (e) {
    console.error("[registrations.listByEvent]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createRegistration(input) {
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
      console.error("[registrations.create]", error.message);
      return null;
    }
    return normalizeRegistration(data);
  } catch (e) {
    console.error("[registrations.create]", e);
    return null;
  }
}

export async function updateRegistration(id, patch) {
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
      console.error("[registrations.update]", error.message);
      return null;
    }
    return normalizeRegistration(data);
  } catch (e) {
    console.error("[registrations.update]", e);
    return null;
  }
}

export async function softDeleteRegistration(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[registrations.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[registrations.delete]", e);
    return false;
  }
}

// Promote the next N waitlisted registrations for an event to Confirmed. Returns
// the promoted rows (normalized) on success, null when Supabase isn't
// configured, or false on error.
export async function promoteWaitlist(eventId, count = 1) {
  if (!eventId) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("flow_promote_waitlist", {
      p_event_id: eventId,
      p_count: Math.max(1, Number(count) || 1),
    });
    if (error) {
      console.error("[registrations.promote]", error.message);
      return false;
    }
    return (data || []).map(normalizeRegistration);
  } catch (e) {
    console.error("[registrations.promote]", e);
    return false;
  }
}

// Public sign-up entry point used by the /e/<id> page. Delegates the
// capacity/approval/waitlist decision to the flow_register RPC and returns a
// result the page can branch on: { ok, status, registration, local? }. Without
// Supabase configured it resolves a local "ok" with a naive status so the demo
// page still completes.
export async function registerForEvent(input = {}) {
  const eventId = input.eventId;
  if (!eventId) return { ok: false, error: "Missing event." };
  if (!isSupabaseConfigured()) {
    return {
      ok: true,
      local: true,
      status: input.requireApproval ? "Pending" : "Confirmed",
      registration: null,
    };
  }
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("flow_register", {
      p_event_id: eventId,
      p_form_id: input.formId ?? null,
      p_name: input.name || "",
      p_email: input.email || "",
      p_phone: input.phone || null,
      p_party_size: Math.max(1, Number(input.partySize) || 1),
      p_plus_ones: Array.isArray(input.plusOnes) ? input.plusOnes : [],
      p_dietary: input.dietary || null,
      p_accessibility: input.accessibility || null,
      p_answers:
        input.answers && typeof input.answers === "object" ? input.answers : {},
      p_require_approval: Boolean(input.requireApproval),
      p_allow_waitlist: input.allowWaitlist !== false,
      p_source: input.source || "Online",
    });
    if (error) {
      console.error("[registrations.register]", error.message);
      return { ok: false, error: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    const reg = normalizeRegistration(row);
    return { ok: true, status: reg?.status || "Confirmed", registration: reg };
  } catch (e) {
    console.error("[registrations.register]", e);
    return { ok: false, error: String(e) };
  }
}

// Approve or decline a pending registration. Returns the updated row, null when
// not configured, or false on error.
export async function approveRegistration(id, approve, by = null) {
  if (!id) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("flow_approve_registration", {
      p_id: id,
      p_approve: Boolean(approve),
      p_by: by,
    });
    if (error) {
      console.error("[registrations.approve]", error.message);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeRegistration(row);
  } catch (e) {
    console.error("[registrations.approve]", e);
    return false;
  }
}
