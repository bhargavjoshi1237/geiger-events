// Server-only gate in front of sendSuiteEmail.
//
// Settings -> Notifications stores one config bag per project in
// events.ticketing_settings (module 'notifications'). Every transactional send
// site routes through sendNotificationEmail() so a switched-off type is skipped
// before it reaches the shared dash email service.
//
// Fail-open by design: a missing project id, an unconfigured DB or a read error
// all send anyway. Losing a purchase confirmation because a settings lookup
// hiccuped is far worse than sending one the organizer had just turned off.

import { adminClient } from "@/lib/supabase/admin";

import { sendSuiteEmail } from "./client";
import { NOTIFICATIONS_MODULE, isNotificationAllowed } from "./catalog";

const TABLE = "ticketing_settings";

// Config reads are cached briefly so a burst of sends in one fulfillment doesn't
// re-query per email. Short enough that a toggle takes effect almost at once.
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

// True when this project still wants `notification` delivered. Unknown keys and
// unreadable config both return true (see the fail-open note above).
export async function isNotificationEnabled(projectId, notification) {
  const config = await getNotificationConfig(projectId);
  return isNotificationAllowed(config, notification);
}

// sendSuiteEmail, gated on the project's notification settings. `notification`
// is a key from lib/email/catalog.js. A suppressed send returns
// { ok: false, skipped: true } — callers treat it as a non-error.
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
