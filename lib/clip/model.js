
export const CLIP_VERSION = 1;

export const EMPTY_CLIP = {
  version: CLIP_VERSION,
  html: "",
  css: "",
  scope: "",
  source: { url: "", title: "", selector: "", capturedAt: "" },
  removed: {},
  width: 0,
  height: 0,
  background: "",
  theme: "source",
  fit: "scale",
};

export const CLIP_FITS = [
  {
    key: "scale",
    label: "Contain",
    hint: "Keeps the original proportions, shrunk to fit your column",
  },
  {
    key: "stretch",
    label: "Fill",
    hint: "Lets the component reflow into the available width",
  },
  {
    key: "full",
    label: "Full bleed",
    hint: "Breaks out of the column, edge to edge across the page",
  },
  {
    key: "scroll",
    label: "Scroll",
    hint: "Original size, scrolls sideways",
  },
];

export const CLIP_BACKGROUNDS = [
  { key: "", label: "Original", swatch: null },
  { key: "#ffffff", label: "White", swatch: "#ffffff" },
  { key: "#000000", label: "Black", swatch: "#000000" },
  { key: "transparent", label: "None", swatch: null },
];

export const CLIP_THEMES = [
  {
    key: "source",
    label: "Original colours",
    hint: "Exactly as it looked on the source site",
  },
  {
    key: "page",
    label: "Match my theme",
    hint: "Text and fills follow your event page; brand accents kept",
  },
];

export function scopeClass(id) {
  return `ev-clip-${id}`;
}

export function newScopeId() {
  return Math.random().toString(36).slice(2, 8);
}

export function normalizeClip(value) {
  const c = value && typeof value === "object" ? value : {};
  const source = c.source && typeof c.source === "object" ? c.source : {};
  return {
    ...EMPTY_CLIP,
    ...c,
    html: String(c.html || ""),
    css: String(c.css || ""),
    scope: String(c.scope || ""),
    width: Number(c.width) || 0,
    height: Number(c.height) || 0,
    background: String(c.background || ""),
    theme: c.theme === "page" ? "page" : "source",
    fit: ["scale", "stretch", "full", "scroll"].includes(c.fit) ? c.fit : "scale",
    removed: c.removed && typeof c.removed === "object" ? c.removed : {},
    source: {
      url: String(source.url || ""),
      title: String(source.title || ""),
      selector: String(source.selector || ""),
      capturedAt: String(source.capturedAt || ""),
    },
  };
}

export function isClipFilled(value) {
  return !!normalizeClip(value).html.trim();
}

export function clipHostLabel(clip) {
  const url = normalizeClip(clip).source.url;
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function removedSummary(clip) {
  const removed = normalizeClip(clip).removed;
  const parts = Object.entries(removed)
    .filter(([, n]) => Number(n) > 0)
    .map(([kind, n]) => `${n} ${kind}${Number(n) === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "";
}
