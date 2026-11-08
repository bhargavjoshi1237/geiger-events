"use client";

import { createClient } from "./client";
import { isSupabaseConfigured } from "./events";
import { normalizeAppConfig } from "@/lib/app_config/model";

// Data-access layer for events.app_configs — the project's mobile app configuration (one row per project). Never throws.

const TABLE = "app_configs";

// The project's config (defaults when no row exists yet), or null when the read failed.
export async function getAppConfig(projectId) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .select("config, updated_at")
      .eq("project_id", projectId)
      .maybeSingle();
    if (error) {
      console.error("[app_config.get]", error.message);
      return null;
    }
    return { config: normalizeAppConfig(data?.config), updatedAt: data?.updated_at ?? null };
  } catch (e) {
    console.error("[app_config.get]", e);
    return null;
  }
}

// Saves the whole config (create-on-first-write); returns the stored config or null.
export async function saveAppConfig(projectId, config, { userId = null } = {}) {
  if (!projectId || !isSupabaseConfigured()) return null;
  try {
    const sb = createClient();
    const { data, error } = await sb
      .from(TABLE)
      .upsert(
        { project_id: projectId, config: normalizeAppConfig(config), updated_by: userId },
        { onConflict: "project_id" },
      )
      .select("config, updated_at")
      .single();
    if (error) {
      console.error("[app_config.save]", error.message);
      return null;
    }
    return { config: normalizeAppConfig(data.config), updatedAt: data.updated_at };
  } catch (e) {
    console.error("[app_config.save]", e);
    return null;
  }
}
