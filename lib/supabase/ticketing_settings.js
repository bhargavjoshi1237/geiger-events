"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";

// Data-access layer for the project-global Tickets settings store — the only
// place that talks to events.ticketing_settings. One row per (project, module):
// the config for a Tickets feature (Early-bird, Donations, Access-code, Reserved
// Seating, Refunds, Payment Plans, Transfers, Group Purchasing, Memberships).
// Mirrors the dietary_config one-row-per-scope pattern, keyed by module so one
// table serves every feature. Pure: validate, console.error on failure, return
// null / false — never throw, never toast (the screen owns UX). Config lives in
// a jsonb bag; the screen supplies/reads camelCase keys directly.

const TABLE = "ticketing_settings";

function normalizeSetting(row, projectId, module) {
  const config =
    row?.config && typeof row.config === "object" ? row.config : {};
  return {
    id: row?.id ?? null,
    projectId: row?.project_id ?? projectId ?? null,
    module: row?.module ?? module ?? "",
    config,
  };
}

// A project's config for one module. Returns a defaulted view-model (empty
// config) when the row is missing, null when the DB isn't configured / on error.
export async function getSetting(projectId, module) {
  if (!projectId || !module || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("*")
      .eq("project_id", projectId)
      .eq("module", module)
      .maybeSingle();
    if (error) {
      console.error("[ticketingSettings.get]", error.message);
      return null;
    }
    return normalizeSetting(data, projectId, module);
  } catch (e) {
    console.error("[ticketingSettings.get]", e);
    return null;
  }
}

// Upsert a module's config for a project (create-on-first-write). Replaces the
// whole config bag — callers pass the full config object. Returns the normalized
// row, null when not configured / on failure.
export async function upsertSetting(projectId, module, config) {
  if (!projectId || !module || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const payload = {
      project_id: projectId,
      module,
      config: config && typeof config === "object" ? config : {},
    };
    const { data, error } = await sb
      .from(TABLE)
      .upsert(payload, { onConflict: "project_id,module" })
      .select("*")
      .single();
    if (error) {
      console.error("[ticketingSettings.upsert]", error.message);
      return null;
    }
    return normalizeSetting(data, projectId, module);
  } catch (e) {
    console.error("[ticketingSettings.upsert]", e);
    return null;
  }
}
