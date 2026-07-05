import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Dietary & Accessibility feature. Owns two tables in
// the events schema — dietary_config (one row per project: the requests master
// switch + prompt and the reusable ticket-form inquiry question set) and
// dietary_requests (the post-purchase free-text query inbox) — plus the two
// public RPCs the anon event page uses. Pure: validate, console.error on
// failure, return null / false / [] — never throw, never toast. DB is
// snake_case; the UI is camelCase, mapped at this boundary.

const CONFIG_TABLE = "dietary_config";
const REQUESTS_TABLE = "dietary_requests";

// Empty view-model so the screen renders a clean builder when a project has no
// config row yet (configured-but-empty, distinct from "couldn't load" = null).
function emptyConfig(projectId = null) {
  return {
    projectId,
    requestsEnabled: false,
    requestPrompt: "",
    inquiryTitle: "",
    inquiryDescription: "",
    questions: [],
  };
}

export function normalizeConfig(row, projectId = null) {
  if (!row) return emptyConfig(projectId);
  return {
    projectId: row.project_id ?? projectId,
    requestsEnabled: Boolean(row.requests_enabled),
    requestPrompt: row.request_prompt ?? "",
    inquiryTitle: row.inquiry_title ?? "",
    inquiryDescription: row.inquiry_description ?? "",
    questions: Array.isArray(row.questions) ? row.questions : [],
  };
}

export function normalizeRequest(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    eventId: row.event_id ?? null,
    registrationId: row.registration_id ?? null,
    name: row.name ?? "",
    email: row.email ?? "",
    message: row.message ?? "",
    status: row.status ?? "Open",
    createdAt: row.created_at ?? null,
  };
}

// camelCase config patch -> snake_case columns. Emits a column only when its key
// is present, so one upsert serves a full save and a single-field toggle.
function configToRow(input) {
  const row = {};
  const map = {
    requestsEnabled: "requests_enabled",
    requestPrompt: "request_prompt",
    inquiryTitle: "inquiry_title",
    inquiryDescription: "inquiry_description",
  };
  for (const [key, col] of Object.entries(map)) {
    if (key in input) row[col] = input[key];
  }
  if ("questions" in input) {
    row.questions = Array.isArray(input.questions) ? input.questions : [];
  }
  return row;
}

// The project's D&A config for the dashboard (D&A screen, ticket-tab preview).
// Returns a defaulted view-model when the row is missing, null when the DB isn't
// configured or the read failed.
export async function getDietaryConfig(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(CONFIG_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("[dietary.getConfig]", error.message);
      return null;
    }
    return normalizeConfig(data, projectId);
  } catch (e) {
    console.error("[dietary.getConfig]", e);
    return null;
  }
}

// Upsert the project's config (create-on-first-write). Returns the normalized
// row, null when not configured / on failure.
export async function upsertDietaryConfig(projectId, patch) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = { project_id: projectId, ...configToRow(patch) };
    const { data, error } = await sb
      .from(CONFIG_TABLE)
      .upsert(payload, { onConflict: "project_id" })
      .select("*")
      .single();
    if (error) {
      console.error("[dietary.upsertConfig]", error.message);
      return null;
    }
    return normalizeConfig(data, projectId);
  } catch (e) {
    console.error("[dietary.upsertConfig]", e);
    return null;
  }
}

// The request inbox for a project, newest first.
export async function listDietaryRequests(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(REQUESTS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[dietary.listRequests]", error.message);
      return null;
    }
    return (data || []).map(normalizeRequest);
  } catch (e) {
    console.error("[dietary.listRequests]", e);
    return null;
  }
}

// Update a request (status change). Returns the normalized row, null on failure.
export async function updateDietaryRequest(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const row = {};
    if ("status" in patch) row.status = patch.status;
    const sb = createClient();
    const { data, error } = await sb
      .from(REQUESTS_TABLE)
      .update(row)
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[dietary.updateRequest]", error.message);
      return null;
    }
    return normalizeRequest(data);
  } catch (e) {
    console.error("[dietary.updateRequest]", e);
    return null;
  }
}

export async function softDeleteDietaryRequest(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(REQUESTS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[dietary.deleteRequest]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[dietary.deleteRequest]", e);
    return false;
  }
}

// Public read of a project's config for the anon event page (via SECURITY
// DEFINER RPC). Returns a defaulted view-model even with no row; null on failure
// so the page just hides the surfaces.
export async function getPublicDietaryConfig(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("dietary_public_config", {
      p_project_id: projectId,
    });
    if (error) {
      console.error("[dietary.publicConfig]", error.message);
      return null;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeConfig(row, projectId);
  } catch (e) {
    console.error("[dietary.publicConfig]", e);
    return null;
  }
}

// File a post-purchase request from the public order-success step (via SECURITY
// DEFINER RPC that derives project_id from the event). Returns the row on
// success, null when not configured, false on error.
export async function submitDietaryRequest(input = {}) {
  if (!input.eventId || !String(input.message || "").trim()) return false;
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("submit_dietary_request", {
      p_event_id: input.eventId,
      p_registration_id: input.registrationId ?? null,
      p_name: input.name || "",
      p_email: input.email || "",
      p_message: input.message,
    });
    if (error) {
      console.error("[dietary.submitRequest]", error.message);
      return false;
    }
    const row = Array.isArray(data) ? data[0] : data;
    return normalizeRequest(row);
  } catch (e) {
    console.error("[dietary.submitRequest]", e);
    return false;
  }
}
