"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { portalFetch } from "@/lib/portal/portal_fetch";
import {
  normalizeBid,
  normalizePreset,
  normalizeRecipient,
  normalizeRfp,
  recipientToRow,
  rfpToRow,
} from "@/lib/sourcing/rows";

// Data-access for Smart Custom Proposals: events.rfps, rfp_recipients, rfp_bids and rfp_presets.
// Pure: console.error on failure, return null / false / [], never throw. Row mapping lives in lib/sourcing/rows.js.

const RFPS = "rfps";
const RECIPIENTS = "rfp_recipients";
const BIDS = "rfp_bids";
const PRESETS = "rfp_presets";

export { normalizeRfp, normalizeRecipient, normalizeBid, normalizePreset };

async function run(tag, fn, fallback = null) {
  try {
    const { data, error } = await fn(createClient());
    if (error) {
      console.error(`[rfps.${tag}]`, error.message);
      return fallback;
    }
    return data;
  } catch (e) {
    console.error(`[rfps.${tag}]`, e);
    return fallback;
  }
}

// --- RFPs --------------------------------------------------------------------

export async function listRfps(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  const rows = await run("listRfps", (sb) =>
    sb.from(RFPS).select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
  );
  return rows ? rows.map(normalizeRfp) : null;
}

export async function getRfp(id) {
  if (!id || !isSupabaseConfigured()) return null;
  const row = await run("getRfp", (sb) => sb.from(RFPS).select("*").eq("id", id).is("deleted_at", null).maybeSingle());
  return normalizeRfp(row);
}

export async function createRfp(input) {
  if (!input?.projectId || !isSupabaseConfigured()) return null;
  const payload = rfpToRow(input);
  if (input.id) payload.id = input.id;
  const row = await run("createRfp", (sb) => sb.from(RFPS).insert(payload).select("*").single());
  return normalizeRfp(row);
}

export async function updateRfp(id, patch) {
  if (!id || !patch || !isSupabaseConfigured()) return null;
  const row = await run("updateRfp", (sb) => sb.from(RFPS).update(rfpToRow(patch)).eq("id", id).select("*").single());
  return normalizeRfp(row);
}

export async function softDeleteRfp(id) {
  if (!id || !isSupabaseConfigured()) return false;
  const res = await run(
    "softDeleteRfp",
    (sb) => sb.from(RFPS).update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"),
    null,
  );
  return Array.isArray(res) && res.length > 0;
}

// --- Recipients ----------------------------------------------------------------

export async function listRecipients(rfpId) {
  if (!rfpId || !isSupabaseConfigured()) return null;
  const rows = await run("listRecipients", (sb) =>
    sb.from(RECIPIENTS).select("*").eq("rfp_id", rfpId).is("deleted_at", null).order("created_at", { ascending: true }),
  );
  return rows ? rows.map(normalizeRecipient) : null;
}

// Every recipient across the project — powers the list's response counts and the suggestions' track record.
export async function listProjectRecipients(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  const rows = await run("listProjectRecipients", (sb) =>
    sb
      .from(RECIPIENTS)
      .select(
        "id, rfp_id, project_id, source, venue_id, pipeline_record_id, name, contact_name, email, status, invited_at, viewed_at, responded_at, declined_at, details, email_status, decline_reason, last_emailed_at, created_at",
      )
      .eq("project_id", projectId)
      .is("deleted_at", null),
  );
  return rows ? rows.map(normalizeRecipient) : null;
}

export async function addRecipients(rfpId, projectId, list, createdBy) {
  if (!rfpId || !projectId || !Array.isArray(list) || !list.length || !isSupabaseConfigured()) return null;
  const payload = list.map((r) => ({
    ...recipientToRow({ ...r, rfpId, projectId, createdBy }),
    status: "invited",
  }));
  const rows = await run("addRecipients", (sb) => sb.from(RECIPIENTS).insert(payload).select("*"));
  return rows ? rows.map(normalizeRecipient) : null;
}

export async function updateRecipient(id, patch) {
  if (!id || !patch || !isSupabaseConfigured()) return null;
  const row = await run("updateRecipient", (sb) =>
    sb.from(RECIPIENTS).update(recipientToRow(patch)).eq("id", id).select("*").single(),
  );
  return normalizeRecipient(row);
}

// Removing a recipient also kills its link, so an emailed token stops working.
export async function removeRecipient(id) {
  if (!id || !isSupabaseConfigured()) return false;
  const res = await run("removeRecipient", (sb) =>
    sb
      .from(RECIPIENTS)
      .update({ deleted_at: new Date().toISOString(), token_hash: null })
      .eq("id", id)
      .select("id"),
  );
  return Array.isArray(res) && res.length > 0;
}

// --- Bids ----------------------------------------------------------------------

// Every revision of every bid on an RFP, newest revision first.
export async function listBids(rfpId) {
  if (!rfpId || !isSupabaseConfigured()) return null;
  const rows = await run("listBids", (sb) =>
    sb.from(BIDS).select("*").eq("rfp_id", rfpId).is("deleted_at", null).order("revision", { ascending: false }),
  );
  return rows ? rows.map(normalizeBid) : null;
}

// Only the bids in play across the project, for the list screen's best totals and stats.
export async function listProjectCurrentBids(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  const rows = await run("listProjectCurrentBids", (sb) =>
    sb
      .from(BIDS)
      .select("id, rfp_id, recipient_id, project_id, revision, is_current, total, subtotal, taxes_fees, currency, status, submitted_at")
      .eq("project_id", projectId)
      .eq("is_current", true)
      .is("deleted_at", null),
  );
  return rows ? rows.map(normalizeBid) : null;
}

export async function setBidStatus(id, status) {
  if (!id || !["submitted", "shortlisted", "rejected"].includes(status) || !isSupabaseConfigured()) return null;
  const row = await run("setBidStatus", (sb) => sb.from(BIDS).update({ status }).eq("id", id).select("*").single());
  return normalizeBid(row);
}

// Atomic award (see events.rfp_award): returns { ok, venueId, venueName, venueCreated, eventLinked } or { ok: false, error }.
export async function awardBid(bidId, { venue = {}, linkEvent = true } = {}) {
  if (!bidId || !isSupabaseConfigured()) return { ok: false, error: "Not configured." };
  try {
    const { data, error } = await createClient().rpc("rfp_award", {
      p_bid: bidId,
      p_venue: venue,
      p_link_event: Boolean(linkEvent),
    });
    if (error) {
      console.error("[rfps.awardBid]", error.message);
      const known = {
        RFP_NOT_AWARDABLE: "This RFP can't be awarded in its current state.",
        BID_SUPERSEDED: "The venue has revised this bid — reload and award the latest version.",
        RECIPIENT_UNAVAILABLE: "This venue declined the RFP.",
        FORBIDDEN: "You don't have access to this RFP.",
      };
      const code = Object.keys(known).find((k) => error.message?.includes(k));
      return { ok: false, error: code ? known[code] : "Couldn't award the bid." };
    }
    return data && typeof data === "object" ? data : { ok: false, error: "Couldn't award the bid." };
  } catch (e) {
    console.error("[rfps.awardBid]", e);
    return { ok: false, error: "Couldn't award the bid." };
  }
}

// --- Presets -------------------------------------------------------------------

export async function listRfpPresets(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  const rows = await run("listRfpPresets", (sb) =>
    sb.from(PRESETS).select("*").eq("project_id", projectId).is("deleted_at", null).order("created_at", { ascending: false }),
  );
  return rows ? rows.map(normalizePreset) : null;
}

export async function createRfpPreset({ projectId, name, description = "", requirements, createdBy }) {
  if (!projectId || !isSupabaseConfigured()) return null;
  const row = await run("createRfpPreset", (sb) =>
    sb
      .from(PRESETS)
      .insert({
        project_id: projectId,
        name: String(name || "").trim() || "Untitled preset",
        description,
        requirements: requirements && typeof requirements === "object" ? requirements : {},
        created_by: createdBy || null,
      })
      .select("*")
      .single(),
  );
  return normalizePreset(row);
}

export async function deleteRfpPreset(id) {
  if (!id || !isSupabaseConfigured()) return false;
  const res = await run("deleteRfpPreset", (sb) =>
    sb.from(PRESETS).update({ deleted_at: new Date().toISOString() }).eq("id", id).select("id"),
  );
  return Array.isArray(res) && res.length > 0;
}

// --- Server actions (token minting and email live in API routes) ------------------

async function postJson(path, body) {
  try {
    const res = await portalFetch(path, {
      method: "POST",
      credentials: "same-origin",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data?.error || `Request failed (${res.status}).`, ...data };
    return { ok: true, ...data };
  } catch (e) {
    console.error("[rfps.post]", path, e);
    return { ok: false, error: "Couldn't reach the server." };
  }
}

// mode "invite" sends to the given (or every not-yet-invited) recipient; "reminder" nudges invited/viewed ones.
export function sendRfpLinks(rfpId, { recipientIds, mode = "invite" } = {}) {
  return postJson(`/api/sourcing/rfps/${rfpId}/send`, { recipientIds, mode });
}

export function sendAwardNotices(rfpId) {
  return postJson(`/api/sourcing/rfps/${rfpId}/notify`, { kind: "award" });
}
