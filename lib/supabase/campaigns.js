"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the Campaigns area. The only place that talks to the
// events.campaign* tables. Pure: validate, console.error on failure, return
// null / false / [] — never throw, never toast (the screen owns UX). DB is
// snake_case; the UI is camelCase, mapped at this boundary.
//
//   campaigns          — one row per campaign (channel/type/status/audience/
//                        schedule + content, ab, metrics jsonb bags).
//   campaign_assets    — reusable records: 'template' | 'sequence' (module).
//   campaign_settings  — one row per project: deliverability + personalization.
//
// Records & config only — no message is dispatched. Status advances client-side
// (draft -> scheduled -> sent); metrics store honest recipients/delivered.

// --- campaigns ---------------------------------------------------------------

const CAMPAIGNS_TABLE = "campaigns";

export function normalizeCampaign(row) {
  if (!row) return null;
  const bag = (v) => (v && typeof v === "object" ? v : {});
  return {
    id: row.id,
    projectId: row.project_id ?? null,
    name: row.name ?? "Untitled campaign",
    channel: row.channel ?? "email",
    type: row.type ?? "newsletter",
    status: row.status ?? "draft",
    segmentId: row.segment_id ?? null,
    eventId: row.event_id ?? null,
    scheduledAt: row.scheduled_at ?? null,
    sentAt: row.sent_at ?? null,
    content: bag(row.content),
    ab: bag(row.ab),
    metrics: bag(row.metrics),
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
    ...bag(row.metadata),
  };
}

// camelCase patch -> snake_case columns. Emits a column only when its key is
// present, so one updateCampaign() serves a full save and a single-field edit.
function campaignToRow(input) {
  const row = {};
  if ("projectId" in input) row.project_id = input.projectId;
  if ("name" in input) row.name = input.name || "Untitled campaign";
  if ("channel" in input) row.channel = input.channel || "email";
  if ("type" in input) row.type = input.type || "newsletter";
  if ("status" in input) row.status = input.status || "draft";
  if ("segmentId" in input) row.segment_id = input.segmentId || null;
  if ("eventId" in input) row.event_id = input.eventId || null;
  if ("scheduledAt" in input) row.scheduled_at = input.scheduledAt || null;
  if ("sentAt" in input) row.sent_at = input.sentAt || null;
  if ("content" in input)
    row.content = input.content && typeof input.content === "object" ? input.content : {};
  if ("ab" in input)
    row.ab = input.ab && typeof input.ab === "object" ? input.ab : {};
  if ("metrics" in input)
    row.metrics = input.metrics && typeof input.metrics === "object" ? input.metrics : {};
  if ("createdBy" in input) row.created_by = input.createdBy;
  return row;
}

export async function listCampaigns(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(CAMPAIGNS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[campaigns.list]", error.message);
      return null;
    }
    return (data || []).map(normalizeCampaign);
  } catch (e) {
    console.error("[campaigns.list]", e);
    return null;
  }
}

export async function getCampaign(id) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(CAMPAIGNS_TABLE)
      .select("*")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[campaigns.get]", error.message);
      return null;
    }
    return normalizeCampaign(data);
  } catch (e) {
    console.error("[campaigns.get]", e);
    return null;
  }
}

// Insert. Honors a caller-supplied `id` (the UI mints a UUID up front for
// optimistic rendering) so the row and the optimistic list entry stay in sync.
export async function createCampaign(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = campaignToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(CAMPAIGNS_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[campaigns.create]", error.message);
      return null;
    }
    return normalizeCampaign(data);
  } catch (e) {
    console.error("[campaigns.create]", e);
    return null;
  }
}

export async function updateCampaign(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(CAMPAIGNS_TABLE)
      .update(campaignToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[campaigns.update]", error.message);
      return null;
    }
    return normalizeCampaign(data);
  } catch (e) {
    console.error("[campaigns.update]", e);
    return null;
  }
}

export async function softDeleteCampaign(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(CAMPAIGNS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[campaigns.delete]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[campaigns.delete]", e);
    return false;
  }
}

// --- campaign_assets (templates + sequences) ---------------------------------

const ASSETS_TABLE = "campaign_assets";

export function normalizeAsset(row) {
  if (!row) return null;
  return {
    id: row.id,
    module: row.module ?? "",
    kind: row.kind ?? "",
    name: row.name ?? "",
    active: row.active ?? true,
    config: row.config && typeof row.config === "object" ? row.config : {},
    projectId: row.project_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? null,
  };
}

function assetToRow(input) {
  const row = {};
  if ("module" in input) row.module = input.module;
  if ("kind" in input) row.kind = input.kind || null;
  if ("name" in input) row.name = input.name || "Untitled";
  if ("active" in input) row.active = Boolean(input.active);
  if ("config" in input)
    row.config = input.config && typeof input.config === "object" ? input.config : {};
  if ("projectId" in input) row.project_id = input.projectId;
  if ("createdBy" in input) row.created_by = input.createdBy;
  return row;
}

// Records for a project + module (matches the RecordsScreen data-adapter shape).
export async function listAssets(projectId, module) {
  if (!projectId || !module || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSETS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .eq("module", module)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[campaigns.listAssets]", error.message);
      return null;
    }
    return (data || []).map(normalizeAsset);
  } catch (e) {
    console.error("[campaigns.listAssets]", e);
    return null;
  }
}

export async function createAsset(input) {
  if (!isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = assetToRow(input);
    if (input.id) payload.id = input.id;
    const { data, error } = await sb
      .from(ASSETS_TABLE)
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      console.error("[campaigns.createAsset]", error.message);
      return null;
    }
    return normalizeAsset(data);
  } catch (e) {
    console.error("[campaigns.createAsset]", e);
    return null;
  }
}

export async function updateAsset(id, patch) {
  if (!id || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(ASSETS_TABLE)
      .update(assetToRow(patch))
      .eq("id", id)
      .select("*")
      .single();
    if (error) {
      console.error("[campaigns.updateAsset]", error.message);
      return null;
    }
    return normalizeAsset(data);
  } catch (e) {
    console.error("[campaigns.updateAsset]", e);
    return null;
  }
}

export async function softDeleteAsset(id) {
  if (!id || !isSupabaseConfigured()) return false;
  try {
    const sb = createClient();
    const { error } = await sb
      .from(ASSETS_TABLE)
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      console.error("[campaigns.deleteAsset]", error.message);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[campaigns.deleteAsset]", e);
    return false;
  }
}

// --- campaign_settings (project singleton) -----------------------------------

const SETTINGS_TABLE = "campaign_settings";

export function normalizeSettings(row) {
  if (!row) return null;
  return {
    id: row.id ?? null,
    projectId: row.project_id ?? null,
    config: row.config && typeof row.config === "object" ? row.config : {},
    createdBy: row.created_by ?? null,
  };
}

// The project's settings row. Returns a usable object even when no row exists
// yet ({ config: {} }) so the screen renders and the first save creates it.
// null only signals not-configured / read failure.
export async function getCampaignSettings(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(SETTINGS_TABLE)
      .select("*")
      .eq("project_id", projectId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) {
      console.error("[campaigns.getSettings]", error.message);
      return null;
    }
    return data ? normalizeSettings(data) : { id: null, projectId, config: {} };
  } catch (e) {
    console.error("[campaigns.getSettings]", e);
    return null;
  }
}

// Shallow-merge a config patch (a full feature slice, e.g. { deliverability })
// into the project's settings row, upserting it. Returns the merged config, or
// false on a write failure, or null when not configured.
export async function updateCampaignSettings(projectId, patch) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.rpc("campaign_settings_merge", {
      p_project: projectId,
      p_patch: patch && typeof patch === "object" ? patch : {},
    });
    if (error) {
      console.error("[campaigns.updateSettings]", error.message);
      return false;
    }
    return data && typeof data === "object" ? data : {};
  } catch (e) {
    console.error("[campaigns.updateSettings]", e);
    return false;
  }
}
