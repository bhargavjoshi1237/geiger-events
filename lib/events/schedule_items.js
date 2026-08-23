// Schedule item helpers — the time field, and the split between per-item and
// section-level settings.
//
// The `time` field started life as free text rendered verbatim, so real events
// already hold "6:30 PM", "18:30", "Evening" and "TBA". The editor now writes
// "HH:mm" to match the event's own `time` column and every other time surface in
// the app, but nothing migrates: `formatScheduleTime` parses what it can and
// passes anything else straight through. A label an organizer typed on purpose
// is not a data error.

// Settings that describe the whole Schedule section rather than one item. The
// renderer reads them off the first item, so the editor has to fan any change
// across the list — which is exactly why they do not belong in a per-item
// dialog and now live on the section header instead.
export const SECTION_KEYS = ["layout", "spacing", "frame", "sectionNote"];

export const DEFAULT_SECTION = {
  layout: "list",
  spacing: "normal",
  frame: "boxed",
  sectionNote: "",
};

export function sectionSettings(items) {
  const head = Array.isArray(items) && items[0] ? items[0] : {};
  return {
    layout: head.layout || DEFAULT_SECTION.layout,
    spacing: head.spacing || DEFAULT_SECTION.spacing,
    frame: head.frame || DEFAULT_SECTION.frame,
    sectionNote: head.sectionNote || DEFAULT_SECTION.sectionNote,
  };
}

/** Apply section-level settings to every item in the list. */
export function applySection(items, section) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    ...section,
  }));
}

// --- Time --------------------------------------------------------------------

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** True when a stored value is a machine-readable "HH:mm". */
export function isClockTime(value) {
  return HHMM.test(String(value || "").trim());
}

/**
 * Parse anything a person might type into "HH:mm", or null if it isn't a time.
 * Accepts "6:45pm", "645p", "1845", "18:45", "6 pm", "noon", "midnight".
 */
export function parseTimeInput(input) {
  const raw = String(input || "").trim().toLowerCase();
  if (!raw) return null;

  if (raw === "noon" || raw === "midday") return "12:00";
  if (raw === "midnight") return "00:00";

  const meridiem = /(a|p)\.?m?\.?$/.exec(raw);
  const suffix = meridiem?.[1];
  const digits = raw.replace(/(a|p)\.?m?\.?$/, "").replace(/[^\d:]/g, "").trim();
  if (!digits) return null;

  let hours;
  let minutes;

  if (digits.includes(":")) {
    const [h, m] = digits.split(":");
    hours = Number(h);
    minutes = Number(m ?? 0);
  } else if (digits.length <= 2) {
    hours = Number(digits);
    minutes = 0;
  } else if (digits.length === 3) {
    hours = Number(digits.slice(0, 1));
    minutes = Number(digits.slice(1));
  } else if (digits.length === 4) {
    hours = Number(digits.slice(0, 2));
    minutes = Number(digits.slice(2));
  } else {
    return null;
  }

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  if (minutes > 59) return null;

  if (suffix === "p" && hours < 12) hours += 12;
  if (suffix === "a" && hours === 12) hours = 0;
  // Bare "18" is unambiguous; bare "6" without a suffix stays 6am, matching how
  // a 24-hour entry would read.
  if (hours > 23) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "18:30" → "6:30 PM". Anything unparseable comes back untouched. */
export function formatScheduleTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = HHMM.exec(raw);
  if (!match) return raw;
  const h = Number(match[1]);
  const m = match[2];
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${m} ${h < 12 ? "AM" : "PM"}`;
}

/** Minutes since midnight, or null for a non-time label. */
export function timeToMinutes(value) {
  const match = HHMM.exec(String(value || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * Quarter-hour options for the time combobox, ordered so the slots just after
 * `afterTime` come first — building a running order is then mostly one click
 * per row rather than a scroll through 96 entries.
 */
export function timeOptions(afterTime) {
  const all = Array.from({ length: 96 }, (_, i) => {
    const h = Math.floor(i / 4);
    const m = (i % 4) * 15;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  });
  const start = timeToMinutes(afterTime);
  if (start === null) return all;
  const pivot = all.findIndex((t) => timeToMinutes(t) > start);
  if (pivot <= 0) return all;
  return [...all.slice(pivot), ...all.slice(0, pivot)];
}
