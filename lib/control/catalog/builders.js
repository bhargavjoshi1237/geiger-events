// Field and status builders for Control's module catalog, mirroring the dashboard's records/builders.jsx without React.

const TONE_BY_VARIANT = {
  success: "success",
  warning: "warning",
  info: "info",
  danger: "danger",
  purple: "info",
  neutral: "neutral",
  outline: "neutral",
};

// A dashboard status map ({ Value: { label, variant } }) → the ordered list the app renders.
export function statuses(map) {
  return Object.entries(map).map(([value, meta]) => ({
    value,
    label: meta?.label || value,
    tone: TONE_BY_VARIANT[meta?.variant] || "neutral",
  }));
}

export function options(values) {
  return values.map((value) => (typeof value === "string" ? { value, label: value } : value));
}

export const nameField = (label = "Name", placeholder) => ({ key: "name", label, type: "text", scope: "root", placeholder });

// Options come from the module's own statuses, so the field carries none.
export const statusField = () => ({ key: "status", label: "Status", type: "status", scope: "root" });

// A config field: c(key, label, type, extra), the same signature as the dashboard's builder.
export const c = (key, label, type = "text", extra = {}) => ({ key, label, type, scope: "config", ...extra });

// A promoted timestamp column (startsAt / endsAt).
export const dateTimeField = (key, label, extra = {}) => ({ key, label, type: "datetime", scope: "root", ...extra });

// A sibling record's id kept in config; refModule is a catalog id such as "conference.speaker".
export const refField = (key, label, refModule, extra = {}) => ({ key, label, type: "ref", scope: "config", refModule, ...extra });

export const imageField = (label = "Image", hint) => ({ key: "coverUrl", label, type: "image", scope: "root", hint });

// Ticketing-style records switch on and off instead of carrying a status.
export const activeField = (label = "Active") => ({ key: "active", label, type: "switch", scope: "root" });
