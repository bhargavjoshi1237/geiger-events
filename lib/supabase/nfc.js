import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for NFC paid entry (entry points, UID bindings, tap
// ledger). The only place that talks to the events.nfc_* tables. Pure:
// validate, console.error on failure, return null / false / [] — never throw,
// never toast (the screen owns UX). DB is snake_case; the UI is camelCase,
// mapped at this boundary.
//
// Writes go straight at the tables (dashboard members). Hardware taps never
// touch this layer — they go through POST /api/nfc/tap -> events.nfc_tap().

// --- Entry points ----------------------------------------------------------

export function normalizeEntryPoint(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    name: row.name ?? "Untitled point",
    location: row.location ?? "",
    gate: row.gate ?? "",
    zone: row.zone ?? "",
    amountCents: Number(row.amount_cents ?? 0),
    currency: (row.currency || "usd").toLowerCase(),
    billingMode: row.billing_mode ?? "paid_every_tap",
    active: row.active ?? true,
    deviceKey: row.device_key ?? "",
    createdAt: row.created_at ?? null,
  };
}

function entryPointToRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId;
  if ("eventId" in input) row.event_id = input.eventId;
  if ("name" in input) row.name = input.name || "Untitled point";
  if ("location" in input) row.location = input.location || "";
  if ("gate" in input) row.gate = input.gate || null;
  if ("zone" in input) row.zone = input.zone || null;
  if ("amountCents" in input)
    row.amount_cents = Math.max(0, Math.round(Number(input.amountCents) || 0));
  if ("currency" in input)
    row.currency = String(input.currency || "usd").toLowerCase();
  if ("billingMode" in input) row.billing_mode = input.billingMode;
  if ("active" in input) row.active = Boolean(input.active);
  if ("deviceKey" in input) row.device_key = input.deviceKey || null;
  if ("createdBy" in input) row.created_by = input.createdBy;
  return row;
}

export async function listEntryPointsByEvent(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("nfc_entry_points")
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    if (error) {
      console.error("[nfc.listPoints]", error.message);
      return null;
    }
    return (data || []).map(normalizeEntryPoint);
  } catch (e) {
    console.error("[nfc.listPoints]", e);
    return null;
  }
}

export async function listEntryPointsByProject(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("nfc_entry_points")
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[nfc.listPointsProject]", error.message);
      return null;
    }
    return (data || []).map(normalizeEntryPoint);
  } catch (e) {
    console.error("[nfc.listPointsProject]", e);
    return null;
  }
}

export async function createEntryPoint(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = entryPointToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from("nfc_entry_points")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[nfc.createPoint]", error.message);
      return null;
    }
    return normalizeEntryPoint(data);
  } catch (e) {
    console.error("[nfc.createPoint]", e);
    return null;
  }
}

export async function updateEntryPoint(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("nfc_entry_points")
      .update(entryPointToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[nfc.updatePoint]", error.message);
      return null;
    }
    return normalizeEntryPoint(data);
  } catch (e) {
    console.error("[nfc.updatePoint]", e);
    return null;
  }
}

export async function softDeleteEntryPoint(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from("nfc_entry_points")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[nfc.deletePoint]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[nfc.deletePoint]", e);
    return false;
  }
}

// --- Credentials (UID <-> attendee bindings) -------------------------------

export function normalizeCredential(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    registrationId: row.registration_id ?? null,
    orderId: row.order_id ?? null,
    nfcUid: row.nfc_uid ?? "",
    label: row.label ?? "",
    active: row.active ?? true,
    createdAt: row.created_at ?? null,
  };
}

export const normalizeNfcUid = (uid) =>
  String(uid || "").trim().toUpperCase().replace(/\s+/g, "");

export async function listCredentialsByEvent(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("nfc_credentials")
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[nfc.listCreds]", error.message);
      return null;
    }
    return (data || []).map(normalizeCredential);
  } catch (e) {
    console.error("[nfc.listCreds]", e);
    return null;
  }
}

// Bind a UID to an attendee. Upserts on (event, uid) so re-binding a recycled
// wristband moves it instead of erroring.
export async function bindCredential({
  eventId,
  projectId,
  registrationId = null,
  orderId = null,
  nfcUid,
  label = "",
}) {
  const uid = normalizeNfcUid(nfcUid);
  if (!eventId || !uid || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data: existing, error: findError } = await sb
      .from("nfc_credentials")
      .select("*")
      .eq("event_id", eventId)
      .eq("nfc_uid", uid)
      .is("deleted_at", null)
      .maybeSingle();
    if (findError) {
      console.error("[nfc.bind.find]", findError.message);
      return null;
    }
    if (existing) {
      const { data, error } = await sb
        .from("nfc_credentials")
        .update({
          registration_id: registrationId,
          order_id: orderId,
          label: label || existing.label || "",
          active: true,
        })
        .eq("id", existing.id)
        .select("*")
        .single();
      if (error) {
        console.error("[nfc.bind.move]", error.message);
        return null;
      }
      return normalizeCredential(data);
    }
    const { data, error } = await sb
      .from("nfc_credentials")
      .insert({
        project_id: projectId || null,
        event_id: eventId,
        registration_id: registrationId,
        order_id: orderId,
        nfc_uid: uid,
        label: label || "",
        active: true,
      })
      .select("*")
      .single();
    if (error) {
      console.error("[nfc.bind]", error.message);
      return null;
    }
    return normalizeCredential(data);
  } catch (e) {
    console.error("[nfc.bind]", e);
    return null;
  }
}

export async function setCredentialActive(id, active) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from("nfc_credentials")
      .update({ active: Boolean(active) })
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[nfc.credActive]", error.message);
      return null;
    }
    return normalizeCredential(data);
  } catch (e) {
    console.error("[nfc.credActive]", e);
    return null;
  }
}

export async function unbindCredential(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from("nfc_credentials")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[nfc.unbind]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[nfc.unbind]", e);
    return false;
  }
}

// --- Taps (billing ledger) -------------------------------------------------

export function normalizeTap(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    entryPointId: row.entry_point_id ?? null,
    credentialId: row.credential_id ?? null,
    registrationId: row.registration_id ?? null,
    orderId: row.order_id ?? null,
    nfcUid: row.nfc_uid ?? "",
    attendeeName: row.attendee_name ?? "",
    amountCents: Number(row.amount_cents ?? 0),
    currency: (row.currency || "usd").toLowerCase(),
    status: row.status ?? "pending",
    billingMode: row.billing_mode ?? "paid_every_tap",
    idempotencyKey: row.idempotency_key ?? "",
    tappedAt: row.tapped_at ?? null,
    settledAt: row.settled_at ?? null,
    attendanceId: row.attendance_id ?? null,
  };
}

export async function listTapsByEvent(eventId, { status = null } = {}) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    let q = sb
      .from("nfc_taps")
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("tapped_at", { ascending: false })
      .limit(500);
    if (status) q = q.eq("status", status);
    const { data, error } = await q;
    if (error) {
      console.error("[nfc.listTaps]", error.message);
      return null;
    }
    return (data || []).map(normalizeTap);
  } catch (e) {
    console.error("[nfc.listTaps]", e);
    return null;
  }
}

async function setTapStatus(id, status, { settledBy = "" } = {}) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const patch =
      status === "settled"
        ? {
            status,
            settled_at: new Date().toISOString(),
            settled_by: settledBy || null,
          }
        : { status, settled_at: null, settled_by: null };
    const { data, error } = await sb
      .from("nfc_taps")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[nfc.tapStatus]", error.message);
      return null;
    }
    return normalizeTap(data);
  } catch (e) {
    console.error("[nfc.tapStatus]", e);
    return null;
  }
}

export const settleTap = (id, settledBy = "") =>
  setTapStatus(id, "settled", { settledBy });
export const voidTap = (id) => setTapStatus(id, "void");
export const reopenTap = (id) => setTapStatus(id, "pending");

// Group taps into per-attendee bills for the Pending bills view.
export function summarizeBills(taps) {
  const by = new Map();
  for (const t of taps || []) {
    const key = t.registrationId || t.nfcUid || t.id;
    if (!by.has(key)) {
      by.set(key, {
        key,
        registrationId: t.registrationId,
        name: t.attendeeName || t.nfcUid || "Unknown",
        uid: t.nfcUid || "",
        currency: t.currency,
        pendingCents: 0,
        settledCents: 0,
        taps: 0,
      });
    }
    const b = by.get(key);
    b.taps += 1;
    if (t.status === "pending") b.pendingCents += t.amountCents;
    if (t.status === "settled") b.settledCents += t.amountCents;
  }
  return [...by.values()].sort((a, b) => b.pendingCents - a.pendingCents);
}

// --- Hardware simulation (dashboard "test tap" button) ---------------------
// Goes through the same POST /api/nfc/tap route the hardware calls, so the
// simulation exercises the real RPC path end to end.

export async function simulateTap({ deviceKey, nfcUid, idempotencyKey = null }) {
  try {
    const res = await fetch("/api/nfc/tap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        device_key: deviceKey,
        nfc_uid: nfcUid,
        idempotency_key: idempotencyKey,
      }),
    });
    const json = await res.json().catch(() => ({}));
    return { http: res.status, ...json };
  } catch (e) {
    console.error("[nfc.simulate]", e);
    return { ok: false, reason: "NETWORK", http: 0 };
  }
}
