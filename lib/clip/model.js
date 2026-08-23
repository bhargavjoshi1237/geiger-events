// The clip object — the one thing the web-clip picker hands back, and the only
// shape any consumer needs to understand.
//
// Deliberately self-contained and serialisable: a clip drops straight into a
// metadata bag (a schedule item today, a page block or conference record
// tomorrow) with no table, no migration, and no join. Everything needed to
// render it travels inside it.

export const CLIP_VERSION = 1;

export const EMPTY_CLIP = {
  version: CLIP_VERSION,
  html: "",
  css: "",
  scope: "",
  source: { url: "", title: "", selector: "", capturedAt: "" },
  removed: {},
  width: 0,
  // Optional crop. A clip re-lays-out inside our page instead of the source
  // page's ancestors, and the drift lands as trailing empty space under the
  // design — space that is no element and so cannot be pruned away. 0 means
  // "however tall it renders".
  height: 0,
  // Overrides the backdrop baked in at capture time. "" means use whatever the
  // extractor detected. Needed because detection can't always be right, and
  // because a clip captured before detection existed has no backdrop at all —
  // which leaves transparent PNGs sitting on the host page's dark canvas.
  background: "",
  // "source" keeps the site's own colours. "page" lets the event page's theme
  // drive anything the source treated as plain text or paper, while leaving
  // brand accents intact — see lib/clip/theme.js.
  theme: "source",
  // How the clip's own width is reconciled with the column it lands in.
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

// Offered in the review step and re-editable afterwards.
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

/** Every clip's markup is wrapped in a div carrying this scope class. */
export function scopeClass(id) {
  return `ev-clip-${id}`;
}

/** Short, collision-resistant enough for a scope class. */
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

/** True when there is actually something to render. */
export function isClipFilled(value) {
  return !!normalizeClip(value).html.trim();
}

/** "stripe.com" — for provenance labels in the editor. */
export function clipHostLabel(clip) {
  const url = normalizeClip(clip).source.url;
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// A short human summary of what the sanitiser dropped, so an inert clip reads
// as intentional rather than broken.
export function removedSummary(clip) {
  const removed = normalizeClip(clip).removed;
  const parts = Object.entries(removed)
    .filter(([, n]) => Number(n) > 0)
    .map(([kind, n]) => `${n} ${kind}${Number(n) === 1 ? "" : "s"}`);
  return parts.length ? parts.join(", ") : "";
}
