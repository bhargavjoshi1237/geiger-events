import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for contact Segments — saved DYNAMIC audience filters
// (events.contact_segments). A segment stores AND-combined rule clauses; its
// membership is recomputed client-side by applySegment() over the fetched
// contacts, so there is no membership table. Pure: return null / false / [].

const TABLE = "contact_segments";

export function normalizeSegment(row) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "Untitled segment",
    description: row.description ?? "",
    rules: Array.isArray(row.rules) ? row.rules : [],
    color: row.color ?? "slate",
    // Contacts added by hand (in addition to the rule matches). Lives in the
    // metadata bag; membership ORs these with the rule results.
    manualIds: Array.isArray(meta.manualIds) ? meta.manualIds : [],
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    name: "name",
    description: "description",
    color: "color",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("rules" in input) row.rules = Array.isArray(input.rules) ? input.rules : [];
  // Manual members live in the metadata bag (the only key we keep there).
  if ("manualIds" in input)
    row.metadata = {
      manualIds: Array.isArray(input.manualIds) ? input.manualIds : [],
    };
  return row;
}

export async function listSegments(projectId) {
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
      console.error("[segments.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeSegment);
  } catch (e) {
    console.error("[segments.list]", e);
    return null;
  }
}

export async function createSegment(input) {
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
      console.error("[segments.create]", error.message);
      return null;
    }
    return normalizeSegment(data);
  } catch (e) {
    console.error("[segments.create]", e);
    return null;
  }
}

export async function updateSegment(id, patch) {
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
      console.error("[segments.update]", error.message);
      return null;
    }
    return normalizeSegment(data);
  } catch (e) {
    console.error("[segments.update]", e);
    return null;
  }
}

export async function softDeleteSegment(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[segments.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[segments.delete]", e);
    return false;
  }
}

// Pure membership test for one contact against one rule. `ctx` supplies the
// derived attendance data (attending emails + events-by-email) the field-only
// contact row can't know on its own.
function matchRule(rule, contact, ctx) {
  const { field, op = "is", value } = rule || {};
  const email = String(contact.email || "").toLowerCase();
  const contains = (hay) =>
    String(hay || "")
      .toLowerCase()
      .includes(String(value || "").toLowerCase());
  switch (field) {
    case "status":
      return op === "isNot"
        ? contact.status !== value
        : contact.status === value;
    case "tag": {
      const has = (contact.tags || []).some(
        (t) => String(t).toLowerCase() === String(value || "").toLowerCase(),
      );
      return op === "isNot" ? !has : has;
    }
    case "consentEmail":
      return Boolean(contact.consentEmail) === (value !== false && value !== "false");
    case "consentSms":
      return Boolean(contact.consentSms) === (value !== false && value !== "false");
    case "blocked":
      return Boolean(contact.blocked) === (value !== false && value !== "false");
    case "attending": {
      const attending = Boolean(ctx?.attendingEmails?.has(email));
      return attending === (value !== false && value !== "false");
    }
    case "event": {
      const evts = ctx?.eventsByEmail?.get(email) || [];
      return evts.includes(value);
    }
    case "location":
      return contains(contact.location);
    case "company":
      return contains(contact.company);
    default:
      return true;
  }
}

// True when a contact matches ALL of a segment's rules (empty rules = match all).
export function applySegment(rules, contact, ctx = {}) {
  if (!Array.isArray(rules) || rules.length === 0) return true;
  return rules.every((r) => matchRule(r, contact, ctx));
}

// Full membership test for a segment: a hand-added contact OR a rule match.
export function isSegmentMember(segment, contact, ctx = {}) {
  if (!segment || !contact) return false;
  if (Array.isArray(segment.manualIds) && segment.manualIds.includes(contact.id))
    return true;
  return applySegment(segment.rules, contact, ctx);
}
