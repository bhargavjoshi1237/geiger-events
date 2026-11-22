import { ApiError } from "../../staff_access/errors.js";
import { MAX_SHORTCUTS, SECTION_KEYS, SHORTCUT_KEYS, UPCOMING_SECTIONS, normalizeAppConfig } from "../../app_config/model.js";

// Branded App: the one attendee app's per-project config (events.app_configs), edited over the same model the dashboard uses.

export { MAX_SHORTCUTS, SECTION_KEYS, SHORTCUT_KEYS, UPCOMING_SECTIONS };

// What the phone edits; white-label build settings stay on the dashboard and are shown read-only.
export function appConfigView(raw) {
  const config = normalizeAppConfig(raw);
  const wl = config.whiteLabel;
  return {
    sections: config.sections,
    home: config.home,
    whiteLabel: { appName: wl.appName, orgName: wl.orgName, version: wl.version, themeMode: wl.themeMode, accent: wl.accent },
  };
}

function bool(value, label) {
  if (typeof value !== "boolean") throw new ApiError("invalid_input", 400, `${label} must be on or off.`);
  return value;
}

// PUT { sections?, home? } merged over what's stored, then normalized like the dashboard's save (whiteLabel untouched).
export function mergeAppConfig(stored, body) {
  const current = normalizeAppConfig(stored);
  if (!body || typeof body !== "object") throw new ApiError("invalid_input", 400, "Send the settings to change.");
  const sections = { ...current.sections };
  if (body.sections !== undefined) {
    if (!body.sections || typeof body.sections !== "object") throw new ApiError("invalid_input", 400, "Sections must be on/off switches.");
    for (const [key, value] of Object.entries(body.sections)) {
      if (!SECTION_KEYS.includes(key)) throw new ApiError("invalid_input", 400, `${key} isn't an app section.`);
      sections[key] = bool(value, key);
    }
  }
  const home = { ...current.home };
  if (body.home !== undefined) {
    const h = body.home && typeof body.home === "object" ? body.home : null;
    if (!h) throw new ApiError("invalid_input", 400, "Home settings must be an object.");
    if ("welcome" in h) {
      if (typeof h.welcome !== "string") throw new ApiError("invalid_input", 400, "The welcome note must be text.");
      if (h.welcome.trim().length > 280) throw new ApiError("invalid_input", 400, "The welcome note must be 280 characters or fewer.");
      home.welcome = h.welcome;
    }
    if ("liveStrip" in h) home.liveStrip = bool(h.liveStrip, "Live strip");
    if ("recentOrders" in h) home.recentOrders = bool(h.recentOrders, "Recent orders");
    if ("shortcuts" in h) {
      if (!Array.isArray(h.shortcuts)) throw new ApiError("invalid_input", 400, "Shortcuts must be a list.");
      if (h.shortcuts.length > MAX_SHORTCUTS) throw new ApiError("invalid_input", 400, `Home fits ${MAX_SHORTCUTS} shortcuts.`);
      for (const key of h.shortcuts) if (!SHORTCUT_KEYS.includes(key)) throw new ApiError("invalid_input", 400, `${key} can't be a shortcut.`);
      home.shortcuts = h.shortcuts;
    }
  }
  // Turning a section off drops its shortcut, as the dashboard does; normalizeAppConfig enforces it.
  return normalizeAppConfig({ ...current, sections, home });
}
