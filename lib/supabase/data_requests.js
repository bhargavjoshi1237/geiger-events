import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the GDPR Data Requests queue (events.data_requests):
// export / erasure / rectification requests with a lifecycle and a due date.
// Pure: return null / false / [] — never throw, never toast.

const TABLE = "data_requests";

export function normalizeDataRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    contactId: row.contact_id ?? null,
    email: row.email ?? "",
    type: row.type ?? "Export",
    status: row.status ?? "New",
    note: row.note ?? "",
    dueAt: row.due_at ?? null,
    resolvedAt: row.resolved_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function toRow(input) {
  const row = {};
  const map = {
    projectId: "project_id",
    contactId: "contact_id",
    email: "email",
    type: "type",
    status: "status",
    note: "note",
    createdBy: "created_by",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("email" in input) row.email = String(input.email || "").trim();
  if ("dueAt" in input) row.due_at = input.dueAt || null;
  if ("resolvedAt" in input) row.resolved_at = input.resolvedAt || null;
  return row;
}

export async function listDataRequests(projectId) {
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
      console.error("[data_requests.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeDataRequest);
  } catch (e) {
    console.error("[data_requests.list]", e);
    return null;
  }
}

export async function createDataRequest(input) {
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
      console.error("[data_requests.create]", error.message);
      return null;
    }
    return normalizeDataRequest(data);
  } catch (e) {
    console.error("[data_requests.create]", e);
    return null;
  }
}

export async function updateDataRequest(id, patch) {
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
      console.error("[data_requests.update]", error.message);
      return null;
    }
    return normalizeDataRequest(data);
  } catch (e) {
    console.error("[data_requests.update]", e);
    return null;
  }
}

export async function softDeleteDataRequest(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[data_requests.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[data_requests.delete]", e);
    return false;
  }
}
