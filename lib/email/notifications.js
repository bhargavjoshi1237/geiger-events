
import { adminClient } from "@/lib/supabase/admin";

import { sendSuiteEmail } from "./client";
import { NOTIFICATIONS_MODULE, isNotificationAllowed } from "./catalog";

const TABLE = "ticketing_settings";

const CACHE_TTL_MS = 30_000;
const cache = new Map();

export async function getNotificationConfig(projectId) {
  if (!projectId) return null;

  const hit = cache.get(projectId);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.config;

  const sb = adminClient();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from(TABLE)
      .select("config")
      .eq("project_id", projectId)
      .eq("module", NOTIFICATIONS_MODULE)
      .maybeSingle();
    if (error) {
      console.error("[email.notifications] read failed:", error.message);
      return null;
    }
    const config = data?.config && typeof data.config === "object" ? data.config : null;
    cache.set(projectId, { at: Date.now(), config });
    return config;
  } catch (e) {
    console.error("[email.notifications] read failed:", e);
    return null;
  }
}

export async function isNotificationEnabled(projectId, notification) {
  const config = await getNotificationConfig(projectId);
  return isNotificationAllowed(config, notification);
}

export async function sendNotificationEmail({
  projectId,
  notification,
  template,
  to,
  data = {},
  subject,
} = {}) {
  if (notification && !(await isNotificationEnabled(projectId, notification))) {
    return { ok: false, skipped: true };
  }
  return sendSuiteEmail({ template, to, data, subject });
}
