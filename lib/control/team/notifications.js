import { EMAIL_GROUPS, EMAIL_NOTIFICATION_KEYS, EMAIL_NOTIFICATIONS, defaultNotificationConfig } from "../../email/catalog.js";
import { ApiError } from "../../staff_access/errors.js";

// The project's email notification switches (ticketing_settings module "notifications"), as the dashboard's Email tab.

// Saved config over the defaults, so a type added to the catalog later reads as on.
export function notificationsView(stored) {
  const base = defaultNotificationConfig();
  const config = stored && typeof stored === "object" ? stored : {};
  const types = { ...base.types, ...(config.types && typeof config.types === "object" ? config.types : {}) };
  return {
    enabled: config.enabled !== false,
    groups: EMAIL_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      description: group.desc ?? "",
      items: EMAIL_NOTIFICATIONS.filter((n) => n.group === group.key).map((n) => ({
        key: n.key,
        label: n.label,
        description: n.description ?? "",
        audience: n.audience ?? "",
        live: Boolean(n.live),
        on: types[n.key] !== false,
      })),
    })).filter((group) => group.items.length),
  };
}

// { enabled?, types?: { key: boolean } } merged over what's stored; unknown keys are refused rather than stored.
export function parseNotificationsPatch(body, stored) {
  const current = stored && typeof stored === "object" ? stored : {};
  const next = { ...defaultNotificationConfig(), ...current };
  let changed = false;
  if ("enabled" in (body || {})) {
    if (typeof body.enabled !== "boolean") throw new ApiError("invalid_input", 400, "Sending must be on or off.");
    next.enabled = body.enabled;
    changed = true;
  }
  if (body?.types !== undefined) {
    if (!body.types || typeof body.types !== "object" || Array.isArray(body.types)) {
      throw new ApiError("invalid_input", 400, "Send the email types to change.");
    }
    const types = { ...(next.types || {}) };
    for (const [key, on] of Object.entries(body.types)) {
      if (!EMAIL_NOTIFICATION_KEYS.includes(key)) throw new ApiError("invalid_input", 400, `${key} isn't an email this project sends.`);
      if (typeof on !== "boolean") throw new ApiError("invalid_input", 400, "Each email must be on or off.");
      types[key] = on;
      changed = true;
    }
    next.types = types;
  }
  if (!changed) throw new ApiError("invalid_input", 400, "Send at least one switch to change.");
  return next;
}
