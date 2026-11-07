"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalisePlanningRules } from "@/lib/event_design";

// Data-access layer for events.design_settings — the project's capacity planning rules (one row per project). Never throws.

const TABLE = "design_settings";

export function normalizeDesignSettings(row, projectId = null) {
  return {
    projectId: row?.project_id ?? projectId,
    rules: normalisePlanningRules(row?.rules),
    customised: Boolean(row && row.rules && Object.keys(row.rules).length),
    updatedAt: row?.updated_at ?? null,
  };
}

// The project's rules (defaults when no row exists yet), or null when the read failed.
export async function getDesignSettings(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb.from(TABLE).select("*").eq("project_id", projectId).maybeSingle();
    if (error) {
      console.error("[design_settings.get]", error.message);
      return null;
    }
    return normalizeDesignSettings(data, projectId);
  } catch (e) {
    console.error("[design_settings.get]", e);
    return null;
  }
}

// Saves the full rule set (create-on-first-write); returns the normalised settings or null.
export async function saveDesignSettings(projectId, rules, { userId = null } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .upsert(
        { project_id: projectId, rules: normalisePlanningRules(rules), updated_by: userId },
        { onConflict: "project_id" },
      )
      .select("*")
      .single();
    if (error) {
      console.error("[design_settings.save]", error.message);
      return null;
    }
    return normalizeDesignSettings(data, projectId);
  } catch (e) {
    console.error("[design_settings.save]", e);
    return null;
  }
}
