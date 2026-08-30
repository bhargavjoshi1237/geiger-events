
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

export function applySection(items, section) {
  return (Array.isArray(items) ? items : []).map((item) => ({
    ...item,
    ...section,
  }));
}

const HHMM = /^([01]?\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value) {
  return HHMM.test(String(value || "").trim());
}

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
  if (hours > 23) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

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

export function timeToMinutes(value) {
  const match = HHMM.exec(String(value || "").trim());
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}
