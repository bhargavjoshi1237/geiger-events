"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for events.package_enquiries — enquiries submitted from an
// event's public packages page.
//
// The insert runs unauthenticated, which is the whole point of the table: a
// visitor asking about a VIP package has no account. Reads are members-only at
// the RLS level, so nothing here needs to re-check that.
//
// Pure: validate, console.error on failure, return null/false/[] — never throw,
// never toast (the screen owns UX).

const TABLE = "package_enquiries";

export function normalizeEnquiry(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    packageId: row.package_id ?? "",
    packageName: row.package_name ?? "",
    firstName: row.first_name ?? "",
    lastName: row.last_name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    quantity: Number.isInteger(row.quantity) ? row.quantity : null,
    message: row.message ?? "",
    recipient: row.recipient ?? "",
    status: row.status ?? "new",
    createdAt: row.created_at ?? null,
  };
}

/**
 * Record an enquiry. `true` on success, `false` on anything else — the form
 * shows a retry rather than a thank-you, because a silently lost enquiry is a
 * lost sale the organizer never hears about.
 */
export async function submitPackageEnquiry(input) {
  const { eventId, projectId } = input || {};
  if (!eventId || !isSupabaseConfigured()) return false;
  if (!String(input.email || "").trim()) return false;

  try {
    const sb = createClient();
    const { error } = await sb.from(TABLE).insert({
      project_id: projectId || null,
      event_id: eventId,
      package_id: input.packageId || null,
      package_name: input.packageName || "",
      first_name: input.firstName || "",
      last_name: input.lastName || "",
      email: input.email || "",
      phone: input.phone || "",
      quantity: Number.isFinite(input.quantity) ? input.quantity : null,
      message: input.message || "",
      recipient: input.recipient || "",
    });
    if (error) {
      console.error("[package_enquiries.submit]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[package_enquiries.submit]", e);
    return false;
  }
}

/** Every enquiry for one event, newest first. `null` means the read failed. */
export async function listPackageEnquiries(eventId) {
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
      console.error("[package_enquiries.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeEnquiry);
  } catch (e) {
    console.error("[package_enquiries.list]", e);
    return null;
  }
}
