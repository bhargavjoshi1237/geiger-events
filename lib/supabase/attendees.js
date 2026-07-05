import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Guests "Who's Going" + "Attendee Export" screens.
// Read-only: it joins events.registrations × events.events × events.contacts into
// one enriched attendee row PER REGISTRATION (a person's ticket for a given
// event), carrying the event's date/venue and the matching contact's tags so the
// screens can filter by upcoming window / venue / status and export. Pure:
// console.error on failure, return null / []. DB is snake_case; the UI is
// camelCase, mapped at this boundary.

// One attendee×event row the screens render directly.
function normalizeRow(reg, ev, contact) {
  return {
    id: reg.id,
    eventId: reg.event_id ?? null,
    eventName: ev?.name ?? "",
    eventDate: ev?.event_date ?? "",
    eventTime: ev?.event_time ?? "",
    eventVenue: ev?.venue ?? "",
    eventCity: ev?.city ?? "",
    eventStatus: ev?.status ?? "",
    name: contact?.name || reg.name || "",
    email: reg.email ?? "",
    phone: contact?.phone || reg.phone || "",
    status: reg.status ?? "",
    dietary: reg.dietary ?? "",
    accessibility: reg.accessibility ?? "",
    partySize: reg.party_size ?? 1,
    contactId: contact?.id ?? null,
    company: contact?.company ?? "",
    title: contact?.title ?? "",
    location: contact?.location ?? "",
    tags: Array.isArray(contact?.tags) ? contact.tags : [],
    registeredAt: reg.created_at ?? null,
  };
}

// Every attendee×event row in a project. A registration with no email is skipped
// (nothing to roster). Registrations whose event was deleted keep empty event
// fields (filtered out by the upcoming/scope logic in the screens).
export async function listAttendeeRows(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const [regsRes, eventsRes, contactsRes] = await Promise.all([
      sb
        .from("registrations")
        .select(
          "id,event_id,name,email,phone,status,dietary,accessibility,party_size,created_at",
        )
        .eq("project_id", projectId)
        .is("deleted_at", null),
      sb
        .from("events")
        .select("id,name,event_date,event_time,venue,city,status")
        .eq("project_id", projectId)
        .is("deleted_at", null),
      sb
        .from("contacts")
        .select("id,name,email,phone,company,title,location,tags")
        .eq("project_id", projectId)
        .is("deleted_at", null),
    ]);
    if (regsRes.error) {
      console.error("[attendees.list]", regsRes.error.message);
      return null;
    }
    if (eventsRes.error) {
      console.error("[attendees.list]", eventsRes.error.message);
      return null;
    }
    if (contactsRes.error) {
      console.error("[attendees.list]", contactsRes.error.message);
      return null;
    }

    const eventById = new Map();
    for (const e of eventsRes.data || []) eventById.set(e.id, e);
    const contactByEmail = new Map();
    for (const c of contactsRes.data || []) {
      const key = String(c.email || "").toLowerCase();
      if (key) contactByEmail.set(key, c);
    }

    return (regsRes.data || [])
      .filter((r) => r.email)
      .map((r) =>
        normalizeRow(
          r,
          eventById.get(r.event_id) || null,
          contactByEmail.get(String(r.email).toLowerCase()) || null,
        ),
      )
      .sort((a, b) => (a.eventDate || "").localeCompare(b.eventDate || ""));
  } catch (e) {
    console.error("[attendees.list]", e);
    return null;
  }
}
