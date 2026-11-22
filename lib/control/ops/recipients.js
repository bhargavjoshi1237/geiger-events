import { listGuests, normalizeContact } from "../../supabase/contacts.js";
import { isSegmentMember, listSegments } from "../../supabase/segments.js";
import { selectAll } from "../../supabase/select_all.js";
import { must } from "../scope.js";

// How many contacts a campaign reaches, counted the same way as the dashboard's campaign editor.
export async function estimateRecipients(db, projectId, segmentId) {
  const contacts = must(
    await selectAll(() => db.from("contacts").select("*").eq("project_id", projectId).is("deleted_at", null).order("id")),
    "campaigns.contacts",
  ).map(normalizeContact);
  if (!segmentId) return contacts.length;

  const [segments, guests] = await Promise.all([listSegments(projectId, { client: db }), listGuests(projectId, { client: db })]);
  const segment = (segments || []).find((s) => s.id === segmentId);
  if (!segment) return 0;
  const attendingEmails = new Set();
  const eventsByEmail = new Map();
  for (const guest of guests || []) {
    const key = String(guest.email || "").toLowerCase();
    if (!key) continue;
    attendingEmails.add(key);
    eventsByEmail.set(key, guest.eventIds || []);
  }
  const ctx = { attendingEmails, eventsByEmail };
  return contacts.filter((contact) => isSegmentMember(segment, contact, ctx)).length;
}

export async function segmentName(db, segmentId) {
  if (!segmentId) return "All contacts";
  const row = must(await db.from("contact_segments").select("name").eq("id", segmentId).maybeSingle(), "campaigns.segment");
  return row?.name || "Segment";
}
