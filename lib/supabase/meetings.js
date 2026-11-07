"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { conferenceApi } from "./conference";
import { portalFetch } from "@/lib/portal/portal_fetch";
import { isPlaygroundActive } from "@/lib/playground/mode";
import { normalizeSettingsRow, settingsToRow } from "@/lib/meetings/settings";
import { meetingErrorMessage } from "@/lib/meetings/errors";

// Data-access layer for the Meeting Scheduler (events.meeting_settings / meeting_profiles / meeting_requests / meetings).
// Pure: console.error on failure, return null / false / [], never throw. Booking goes through the
// create_meeting / reschedule_meeting RPCs, which refuse double-booking under a lock.

const SETTINGS = "meeting_settings";
const PROFILES = "meeting_profiles";
const REQUESTS = "meeting_requests";
const MEETINGS = "meetings";

const arr = (v) => (Array.isArray(v) ? v : []);

export function normalizeMeetingProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    projectId: row.project_id ?? null,
    memberId: row.member_id ?? null,
    email: row.email ?? "",
    optedIn: Boolean(row.opted_in),
    role: row.role === "exhibitor" ? "exhibitor" : "attendee",
    displayName: row.display_name ?? "",
    company: row.company ?? "",
    title: row.title ?? "",
    bio: row.bio ?? "",
    interests: arr(row.interests),
    lookingFor: arr(row.looking_for),
    avatarUrl: row.avatar_url ?? "",
    blockedSlots: arr(row.blocked_slots),
    hidden: Boolean(row.hidden),
    hiddenReason: row.hidden_reason ?? "",
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

export function normalizeMeetingRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    fromMember: row.from_member ?? null,
    toMember: row.to_member ?? null,
    proposedSlots: arr(row.proposed_slots),
    message: row.message ?? "",
    status: row.status ?? "pending",
    respondedAt: row.responded_at ?? null,
    declineNote: row.decline_note ?? "",
    cancelledBy: row.cancelled_by ?? null,
    expiresAt: row.expires_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

export function normalizeMeeting(row) {
  if (!row) return null;
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    requestId: row.request_id ?? null,
    participants: arr(row.participants),
    startsAt: row.starts_at ?? null,
    endsAt: row.ends_at ?? null,
    locationId: row.location_id ?? null,
    locationName: row.location_name ?? "",
    status: row.status ?? "scheduled",
    notes: row.notes ?? "",
    cancelReason: row.cancel_reason ?? "",
    cancelledBy: row.cancelled_by ?? null,
    rescheduledAt: row.rescheduled_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

// Settings for one event, or the defaults when none are saved yet.
export async function getMeetingSettings(event) {
  if (!event?.id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.from(SETTINGS).select("*").eq("event_id", event.id).maybeSingle();
    if (error) {
      console.error("[meetings.getMeetingSettings]", error.message);
      return null;
    }
    return normalizeSettingsRow(data, event);
  } catch (e) {
    console.error("[meetings.getMeetingSettings]", e);
    return null;
  }
}

export async function saveMeetingSettings(event, input, userId) {
  if (!event?.id || !event?.projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = {
      ...settingsToRow(input),
      event_id: event.id,
      project_id: event.projectId,
      deleted_at: null,
      ...(userId ? { created_by: userId } : {}),
    };
    const { data, error } = await sb
      .from(SETTINGS)
      .upsert(payload, { onConflict: "event_id" })
      .select("*")
      .single();
    if (error) {
      console.error("[meetings.saveMeetingSettings]", error.message);
      return null;
    }
    return normalizeSettingsRow(data, event);
  } catch (e) {
    console.error("[meetings.saveMeetingSettings]", e);
    return null;
  }
}

async function listByEvent(table, eventId, normalize, order = "created_at") {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(table)
      .select("*")
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order(order, { ascending: order !== "created_at" });
    if (error) {
      console.error(`[meetings.list.${table}]`, error.message);
      return null;
    }
    return (data || []).map(normalize);
  } catch (e) {
    console.error(`[meetings.list.${table}]`, e);
    return null;
  }
}

export const listMeetingProfiles = (eventId) => listByEvent(PROFILES, eventId, normalizeMeetingProfile);
export const listMeetingRequests = (eventId) => listByEvent(REQUESTS, eventId, normalizeMeetingRequest);
export const listMeetings = (eventId) => listByEvent(MEETINGS, eventId, normalizeMeeting, "starts_at");

// Organiser moderation: hide/unhide a profile or switch its role.
export async function updateMeetingProfile(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  const row = {};
  if ("hidden" in patch) row.hidden = Boolean(patch.hidden);
  if ("hiddenReason" in patch) row.hidden_reason = String(patch.hiddenReason || "").slice(0, 300);
  if ("role" in patch) row.role = patch.role === "exhibitor" ? "exhibitor" : "attendee";
  try {
    const sb = createClient();
    const { data, error } = await sb.from(PROFILES).update(row).eq("id", id).select("*").single();
    if (error) {
      console.error("[meetings.updateMeetingProfile]", error.message);
      return null;
    }
    return normalizeMeetingProfile(data);
  } catch (e) {
    console.error("[meetings.updateMeetingProfile]", e);
    return null;
  }
}

export async function cancelMeetingRequest(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(REQUESTS)
      .update({ status: "cancelled", cancelled_by: "organiser", responded_at: new Date().toISOString() })
      .eq("id", id)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();
    if (error) {
      console.error("[meetings.cancelMeetingRequest]", error.message);
      return null;
    }
    return normalizeMeetingRequest(data);
  } catch (e) {
    console.error("[meetings.cancelMeetingRequest]", e);
    return null;
  }
}

// Lapse pending requests whose time has passed (the portal does the same on read).
export async function expireMeetingRequests(eventId) {
  if (!eventId || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(REQUESTS)
      .update({ status: "expired" })
      .eq("event_id", eventId)
      .eq("status", "pending")
      .lt("expires_at", new Date().toISOString());
    if (error) {
      console.error("[meetings.expireMeetingRequests]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[meetings.expireMeetingRequests]", e);
    return false;
  }
}

// Status/notes changes. Cancelling records that the organiser did it.
export async function updateMeeting(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  const row = {};
  if ("status" in patch) row.status = patch.status;
  if ("notes" in patch) row.notes = String(patch.notes || "").slice(0, 2000);
  if (patch.status === "cancelled") {
    row.cancelled_by = "organiser";
    row.cancel_reason = String(patch.cancelReason || "").slice(0, 500);
  }
  try {
    const sb = createClient();
    const { data, error } = await sb.from(MEETINGS).update(row).eq("id", id).select("*").single();
    if (error) {
      console.error("[meetings.updateMeeting]", error.message);
      return { ok: false, error: meetingErrorMessage(error, "Couldn't update the meeting.") };
    }
    return { ok: true, meeting: normalizeMeeting(data) };
  } catch (e) {
    console.error("[meetings.updateMeeting]", e);
    return { ok: false, error: "Couldn't update the meeting." };
  }
}

// Book a meeting for two attendees (or force-schedule a request). Returns { ok, id } or { ok: false, error }.
export async function createMeeting({ eventId, participants, startsAt, endsAt, locationId = null, notes = "", requestId = null }) {
  if (!eventId || !isSupabaseConfigured()) return { ok: false, error: "Not connected." };
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("create_meeting", {
      p_event: eventId,
      p_participants: participants || [],
      p_starts: startsAt,
      p_ends: endsAt,
      p_location: locationId || null,
      p_notes: notes || "",
      p_request: requestId || null,
    });
    if (error) {
      console.error("[meetings.createMeeting]", error.message);
      return { ok: false, error: meetingErrorMessage(error, "Couldn't book the meeting.") };
    }
    return { ok: true, id: data };
  } catch (e) {
    console.error("[meetings.createMeeting]", e);
    return { ok: false, error: "Couldn't book the meeting." };
  }
}

export async function rescheduleMeeting(id, { startsAt, endsAt, locationId = null }) {
  if (!id || !isSupabaseConfigured()) return { ok: false, error: "Not connected." };
  try {
    const sb = createClient();
    const { error } = await sb.rpc("reschedule_meeting", {
      p_meeting: id,
      p_starts: startsAt,
      p_ends: endsAt,
      p_location: locationId || null,
    });
    if (error) {
      console.error("[meetings.rescheduleMeeting]", error.message);
      return { ok: false, error: meetingErrorMessage(error, "Couldn't move the meeting.") };
    }
    return { ok: true, id };
  } catch (e) {
    console.error("[meetings.rescheduleMeeting]", e);
    return { ok: false, error: "Couldn't move the meeting." };
  }
}

// Valid ticket holders of the event as portal members: [{ memberId, name, email, ticketName }].
export async function listMeetingAttendees(eventId) {
  if (!eventId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("meeting_attendees", { p_event: eventId });
    if (error) {
      console.error("[meetings.listMeetingAttendees]", error.message);
      return null;
    }
    return (data || []).map((r) => ({
      memberId: r.member_id,
      name: r.name || "",
      email: r.email || "",
      ticketName: r.ticket_name || "",
    }));
  } catch (e) {
    console.error("[meetings.listMeetingAttendees]", e);
    return null;
  }
}

// The event's agenda sessions (Agenda Builder rows tagged with this event).
export async function listEventSessions(projectId, eventId) {
  const rows = await conferenceApi.list(projectId, "session");
  return (rows || []).filter((s) => s.config?.eventId === eventId);
}

// Ask the server to email attendees about an organiser change. Fire-and-forget.
export async function notifyMeetingChange(kind, meetingId) {
  if (!meetingId || isPlaygroundActive()) return false;
  try {
    const { data } = await createClient().auth.getSession();
    const token = data?.session?.access_token;
    const res = await portalFetch("/api/meetings/notify", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ kind, meetingId }),
    });
    return res.ok;
  } catch (e) {
    console.error("[meetings.notifyMeetingChange]", e);
    return false;
  }
}
