import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Guests area. Owns events.contacts (the contact-book
// master record) and events.contact_activity (Communication History), plus the
// derived Guest List (contacts joined to registrations) and the merge_contacts
// RPC behind Dedupe & Merge. Pure: validate, console.error on failure, return
// null / false / [] — never throw, never toast. DB is snake_case; the UI is
// camelCase, mapped at this boundary.

const TABLE = "contacts";
const ACTIVITY_TABLE = "contact_activity";

// DB row -> camelCase view model the screens render directly.
export function normalizeContact(row) {
  if (!row) return null;
  const meta =
    row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    company: row.company ?? "",
    title: row.title ?? "",
    location: row.location ?? "",
    status: row.status ?? "Active",
    tags: Array.isArray(row.tags) ? row.tags : [],
    consentEmail: Boolean(row.consent_email),
    consentSms: Boolean(row.consent_sms),
    consentUpdatedAt: row.consent_updated_at ?? null,
    blocked: Boolean(row.blocked),
    blockedReason: row.blocked_reason ?? "",
    blockedAt: row.blocked_at ?? null,
    avatarUrl: row.avatar_url ?? "",
    notes: Array.isArray(meta.notes) ? meta.notes : [],
    metadata: meta,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    // Expansion-bag keys surface as first-class fields on the view model.
    ...meta,
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present, so one updateContact() serves a full-form save and a single-field
// inline edit (`{ status }`, `{ blocked }`, `{ tags }`).
function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    email: "email",
    phone: "phone",
    company: "company",
    title: "title",
    location: "location",
    status: "status",
    blockedReason: "blocked_reason",
    avatarUrl: "avatar_url",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("email" in input) row.email = String(input.email || "").trim();
  if ("tags" in input) row.tags = Array.isArray(input.tags) ? input.tags : [];
  if ("metadata" in input) {
    row.metadata =
      input.metadata && typeof input.metadata === "object" ? input.metadata : {};
  }
  if ("consentEmail" in input) {
    row.consent_email = Boolean(input.consentEmail);
    row.consent_updated_at = new Date().toISOString();
  }
  if ("consentSms" in input) {
    row.consent_sms = Boolean(input.consentSms);
    row.consent_updated_at = new Date().toISOString();
  }
  if ("blocked" in input) {
    row.blocked = Boolean(input.blocked);
    row.blocked_at = input.blocked ? new Date().toISOString() : null;
  }
  return row;
}

// All contacts in a project, newest first.
export async function listContacts(projectId) {
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
      console.error("[contacts.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeContact);
  } catch (e) {
    console.error("[contacts.list]", e);
    return null;
  }
}

export async function getContact(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[contacts.get]", error.message);
      return null;
    }
    return normalizeContact(data);
  } catch (e) {
    console.error("[contacts.get]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createContact(input) {
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
      console.error("[contacts.create]", error.message);
      return null;
    }
    return normalizeContact(data);
  } catch (e) {
    console.error("[contacts.create]", e);
    return null;
  }
}

export async function updateContact(id, patch) {
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
      console.error("[contacts.update]", error.message);
      return null;
    }
    return normalizeContact(data);
  } catch (e) {
    console.error("[contacts.update]", e);
    return null;
  }
}

export async function softDeleteContact(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[contacts.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[contacts.delete]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Derived Guest List — attendees across the project's events.
//
// A "guest" is anyone with ≥1 registration (ticket purchases also file a
// registration, so this is the complete attendee roster). We group the project's
// registrations by normalized email and enrich each with the matching contact
// (status/tags/contactId). The screen filters by event and computes stats.
// ---------------------------------------------------------------------------
export async function listGuests(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const [regsRes, contactsRes] = await Promise.all([
      sb
        .from("registrations")
        .select("id,event_id,name,email,phone,status,created_at")
        .eq("project_id", projectId)
        .is("deleted_at", null),
      sb
        .from(TABLE)
        .select("*")
        .eq("project_id", projectId)
        .is("deleted_at", null),
    ]);
    if (regsRes.error) {
      console.error("[contacts.listGuests]", regsRes.error.message);
      return null;
    }
    if (contactsRes.error) {
      console.error("[contacts.listGuests]", contactsRes.error.message);
      return null;
    }

    const contacts = (contactsRes.data || []).map(normalizeContact);
    const contactByEmail = new Map();
    for (const c of contacts) {
      if (c.email) contactByEmail.set(c.email.toLowerCase(), c);
    }

    const going = new Set(["Confirmed", "Checked-in"]);
    const byEmail = new Map();
    for (const reg of regsRes.data || []) {
      const key = String(reg.email || "").toLowerCase();
      if (!key) continue;
      let g = byEmail.get(key);
      if (!g) {
        const c = contactByEmail.get(key) || null;
        g = {
          id: c?.id || key,
          contactId: c?.id || null,
          contact: c,
          name: c?.name || reg.name || "",
          email: reg.email || "",
          phone: c?.phone || reg.phone || "",
          status: c?.status || null,
          tags: c?.tags || [],
          eventIds: new Set(),
          events: [],
          statuses: [],
          going: false,
          lastSeenAt: reg.created_at || null,
        };
        byEmail.set(key, g);
      }
      if (reg.event_id) {
        g.eventIds.add(reg.event_id);
        g.events.push({ eventId: reg.event_id, status: reg.status, at: reg.created_at });
      }
      if (reg.status) g.statuses.push(reg.status);
      if (going.has(reg.status)) g.going = true;
      if (reg.created_at && (!g.lastSeenAt || reg.created_at > g.lastSeenAt)) {
        g.lastSeenAt = reg.created_at;
      }
    }

    return Array.from(byEmail.values())
      .map((g) => ({
        ...g,
        eventIds: Array.from(g.eventIds),
        eventsCount: g.eventIds.size,
      }))
      .sort((a, b) => (b.lastSeenAt || "").localeCompare(a.lastSeenAt || ""));
  } catch (e) {
    console.error("[contacts.listGuests]", e);
    return null;
  }
}

// ---------------------------------------------------------------------------
// All contact notes across the project (Guests > Notes feed). Contact notes live
// in metadata.notes = [{ id, body, createdAt, createdBy }]; this flattens every
// contact's notes into one newest-first feed, each enriched with its contact.
// ---------------------------------------------------------------------------
export async function listAllNotes(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("id,name,email,metadata")
      .eq("project_id", projectId)
      .is("deleted_at", null);
    if (error) {
      console.error("[contacts.listAllNotes]", error.message);
      return null;
    }
    const out = [];
    for (const row of data || []) {
      const meta =
        row.metadata && typeof row.metadata === "object" ? row.metadata : {};
      const notes = Array.isArray(meta.notes) ? meta.notes : [];
      for (const n of notes) {
        out.push({
          id: n.id || `${row.id}:${n.createdAt || out.length}`,
          body: n.body || "",
          createdAt: n.createdAt || null,
          createdBy: n.createdBy || null,
          contactId: row.id,
          contactName: row.name || "",
          contactEmail: row.email || "",
        });
      }
    }
    return out.sort((a, b) =>
      (b.createdAt || "").localeCompare(a.createdAt || ""),
    );
  } catch (e) {
    console.error("[contacts.listAllNotes]", e);
    return null;
  }
}

// Atomic merge of duplicate contacts (Dedupe & Merge). Returns the survivor.
export async function mergeContacts(survivorId, loserIds) {
  if (!survivorId || !Array.isArray(loserIds) || !loserIds.length) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("merge_contacts", {
      p_survivor: survivorId,
      p_losers: loserIds,
    });
    if (error) {
      console.error("[contacts.merge]", error.message);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeContact(row);
  } catch (e) {
    console.error("[contacts.merge]", e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Contact activity (Communication History).
// ---------------------------------------------------------------------------
export function normalizeActivity(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    contactId: row.contact_id ?? null,
    channel: row.channel ?? "Note",
    direction: row.direction ?? "Internal",
    subject: row.subject ?? "",
    body: row.body ?? "",
    occurredAt: row.occurred_at ?? row.created_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

export async function listContactActivity(contactId) {
  if (!contactId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ACTIVITY_TABLE)
      .select("*")
      .eq("contact_id", contactId)
      .is("deleted_at", null)
      .order("occurred_at", { ascending: false });
    if (error) {
      console.error("[contacts.listActivity]", error.message);
      return null;
    }
    return (data || []).map(normalizeActivity);
  } catch (e) {
    console.error("[contacts.listActivity]", e);
    return null;
  }
}

export async function logContactActivity(input = {}) {
  if (!input.projectId || !input.contactId || !isSupabaseConfigured()) {
    return null;
  }
  try {
    const sb = createClient();
    const payload = {
      project_id: input.projectId,
      contact_id: input.contactId,
      channel: input.channel || "Note",
      direction: input.direction || "Internal",
      subject: input.subject || "",
      body: input.body || "",
      created_by: input.createdBy ?? null,
    };
    if (input.id) payload.id = input.id;
    if (input.occurredAt) payload.occurred_at = input.occurredAt;
    const { data, error } = await sb
      .from(ACTIVITY_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[contacts.logActivity]", error.message);
      return null;
    }
    return normalizeActivity(data);
  } catch (e) {
    console.error("[contacts.logActivity]", e);
    return null;
  }
}
