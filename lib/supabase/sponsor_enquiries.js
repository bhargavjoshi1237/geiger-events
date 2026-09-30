"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalizeAnswers } from "@/lib/forms/fields";

// Data-access for events.sponsor_enquiries — interest submitted from an event's public sponsorship page.
// Pure: console.error on failure, return null/false — never throw, never toast (the screen owns UX).

const TABLE = "sponsor_enquiries";

export function normalizeSponsorEnquiry(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    spotId: row.spot_id ?? "",
    spotName: row.spot_name ?? "",
    company: row.company ?? "",
    contactName: row.contact_name ?? "",
    email: row.email ?? "",
    answers: normalizeAnswers(row.answers),
    status: row.status ?? "new",
    sponsorId: row.sponsor_id ?? null,
    createdAt: row.created_at ?? null,
  };
}

/** Record an enquiry; `false` makes the form offer a retry, since a lost enquiry is a lost sponsor. */
export async function submitSponsorEnquiry(input) {
  const { eventId, projectId } = input || {};
  if (!eventId || !projectId || !isSupabaseConfigured()) return false;
  if (!String(input.email || "").trim()) return false;

  try {
    const sb = createClient();
    const { error } = await sb.from(TABLE).insert({
      project_id: projectId,
      event_id: eventId,
      spot_id: input.spotId || null,
      spot_name: input.spotName || "",
      company: input.company || "",
      contact_name: input.contactName || "",
      email: input.email || "",
      answers: normalizeAnswers(input.answers),
    });
    if (error) {
      console.error("[sponsor_enquiries.submit]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sponsor_enquiries.submit]", e);
    return false;
  }
}

/** Every enquiry for one event, newest first. `null` means the read failed. */
export async function listSponsorEnquiries(eventId) {
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
      console.error("[sponsor_enquiries.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeSponsorEnquiry);
  } catch (e) {
    console.error("[sponsor_enquiries.list]", e);
    return null;
  }
}

/** Patch status and/or the converted sponsor. Returns the updated enquiry, or null. */
export async function updateSponsorEnquiry(id, patch) {
  if (!id || !patch || !isSupabaseConfigured()) return null;
  const row = {};
  if ("status" in patch) row.status = patch.status;
  if ("sponsorId" in patch) row.sponsor_id = patch.sponsorId || null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[sponsor_enquiries.update]", error.message);
      return null;
    }
    return normalizeSponsorEnquiry(data);
  } catch (e) {
    console.error("[sponsor_enquiries.update]", e);
    return null;
  }
}

/** Soft delete — the row stays for history but leaves the inbox. */
export async function removeSponsorEnquiry(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[sponsor_enquiries.remove]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[sponsor_enquiries.remove]", e);
    return false;
  }
}
