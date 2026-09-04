import { clubNight, festival } from "./live";
import { conference, launch, workshop } from "./professional";
import { fundraiser, gala, retreat } from "./occasions";
import { exhibition, meetup } from "./community";
import { themeWithPreset } from "./kit";
import { emptyTree } from "../page_tree";

export { themeWithPreset };

export const PRESET_CATEGORIES = [
  {
    key: "live",
    label: "Live & music",
    desc: "The artwork leads and the buy button never leaves the screen.",
  },
  {
    key: "professional",
    label: "Professional",
    desc: "Programme, speakers and price, answerable without scrolling twice.",
  },
  {
    key: "occasion",
    label: "Occasions & causes",
    desc: "Reads as an invitation. The ask is present but never shouts.",
  },
  {
    key: "community",
    label: "Community",
    desc: "Quiet and legible — for regulars, and for work worth looking at.",
  },
];

export const PAGE_PRESETS = [
  festival,
  clubNight,
  conference,
  workshop,
  launch,
  gala,
  retreat,
  fundraiser,
  exhibition,
  meetup,
];

export function getPreset(key) {
  return PAGE_PRESETS.find((p) => p.key === key) || null;
}

export function presetsInCategory(key) {
  return PAGE_PRESETS.filter((p) => p.category === key);
}

// Applying a preset rewrites the page's structure and its look, and switches the
// page into custom mode so the tree is what renders. The legacy `blocks` and
// `sidebarBlocks` arrays are deliberately left alone — they are the way back.
export function designWithPreset(design, preset, theme) {
  if (!preset) return design;
  return {
    ...design,
    mode: "custom",
    tree: preset.build(),
    theme: themeWithPreset(theme, preset.theme),
    presetKey: preset.key,
  };
}

// A saved layout carries its own theme snapshot; falls back to the live theme
// when it was saved before themes were captured.
export function designWithSavedLayout(design, layout, theme) {
  if (!layout?.tree) return design;
  return {
    ...design,
    mode: "custom",
    tree: layout.tree,
    theme: layout.theme ? themeWithPreset(theme, layout.theme) : theme,
    presetKey: `saved:${layout.id}`,
  };
}

export function designFromBlank(design, theme) {
  return {
    ...design,
    mode: "custom",
    tree: emptyTree(),
    theme: { ...theme, hero: "none" },
    presetKey: "blank",
  };
}
