// Built-in page sections an organiser can rename; a blank or missing entry falls back to these.
export const SECTION_TITLE_DEFAULTS = {
  about: "About this event",
  expect: "What to expect",
  schedule: "Schedule",
  location: "Location",
  whosgoing: "Who's going",
  guests: "Guests",
  faq: "Frequently Asked Questions",
  register: "Select ticket",
  goodtoknow: "Good To Know",
  atregistration: "At registration",
  guidelines: "Dietary & Accessibility",
};

export const SECTION_TITLE_MAX = 60;

export function isRenamableSection(key) {
  return Object.prototype.hasOwnProperty.call(SECTION_TITLE_DEFAULTS, key);
}

function titlesOf(source) {
  return source && typeof source === "object" ? source : {};
}

export function customSectionTitle(event, key) {
  return String(titlesOf(event?.sectionTitles)[key] || "").trim();
}

export function sectionTitle(event, key) {
  return customSectionTitle(event, key) || SECTION_TITLE_DEFAULTS[key] || "";
}

// Returns the next `sectionTitles` map; blank or default text drops the override.
export function withSectionTitle(titles, key, value) {
  const next = { ...titlesOf(titles) };
  const clean = String(value || "").trim().slice(0, SECTION_TITLE_MAX);
  if (!clean || clean === SECTION_TITLE_DEFAULTS[key]) delete next[key];
  else next[key] = clean;
  return next;
}
