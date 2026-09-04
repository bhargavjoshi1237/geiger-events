import {
  createColumn,
  createComponent,
  createRow,
  createSection,
  createTree,
} from "../page_tree";
import { BASE_PALETTES } from "../theme";

// Builders for preset trees. Presets are pure data — they never import the
// component library, so a preset states the props it wants rather than
// inheriting a component's editor defaults.

export function cmp(type, props = {}, style = null) {
  const node = createComponent(type, props);
  if (style) node.style = { ...node.style, ...style };
  return node;
}

export function col(span, components = [], { layout, style } = {}) {
  const node = createColumn(span, components);
  if (layout) node.layout = { ...node.layout, ...layout };
  if (style) node.style = { ...node.style, ...style };
  return node;
}

export function row(columns, layout = null) {
  const node = createRow([12]);
  node.columns = columns;
  if (layout) node.layout = { ...node.layout, ...layout };
  return node;
}

export function section(name, rows, { layout, style, background, anchor } = {}) {
  const node = createSection([12], name);
  node.rows = rows;
  if (layout) node.layout = { ...node.layout, ...layout };
  if (style) node.style = { ...node.style, ...style };
  if (background) node.style.background = { ...node.style.background, ...background };
  if (anchor) node.advanced = { ...node.advanced, anchor };
  return node;
}

// One full-width column — the shape most sections actually are.
export function band(name, components, options) {
  return section(name, [row([col(12, components)])], options);
}

// Content beside a rail. The rail sticks on desktop and releases on mobile.
export function withRail(name, mainSpan, main, rail, options) {
  return section(
    name,
    [
      row([
        col(mainSpan, main),
        col(12 - mainSpan, rail, { layout: { sticky: true } }),
      ]),
    ],
    options,
  );
}

// Edge to edge: no gutters, no vertical padding, full bleed.
export const FULL_BLEED = {
  layout: { maxWidth: "full", paddingX: "none", paddingY: "none" },
};

// Bands tinted with whatever brand colour the event is using. `--ev-accent` is
// set on the tree wrapper, so a preset can lean on the brand without knowing it.
export const accentTint = (percent = 10) => ({
  type: "color",
  color: `color-mix(in srgb, var(--ev-accent) ${percent}%, transparent)`,
});

export const accentWash = (from = 18, to = 4, angle = 160) => ({
  type: "gradient",
  from: `color-mix(in srgb, var(--ev-accent) ${from}%, transparent)`,
  to: `color-mix(in srgb, var(--ev-accent) ${to}%, transparent)`,
  angle,
});

export function tree(sections) {
  return createTree(sections);
}

// Merges a preset's theme patch over the theme the event already has. Brand
// colours survive — only the palette that belongs to the light/dark base is
// replaced, because a preset that flips the base without it leaves unreadable
// text on the old background.
export function themeWithPreset(theme, patch) {
  if (!patch) return theme;
  const next = { ...theme, ...patch };
  next.font = { ...theme.font, ...(patch.font || {}) };
  next.colors = { ...theme.colors, ...(patch.colors || {}) };
  if (patch.base && patch.base !== theme.base) {
    next.colors = { ...next.colors, ...BASE_PALETTES[patch.base] };
  }
  // Every preset owns its own opening — the themed hero would otherwise stack
  // on top of the one the tree already draws.
  next.hero = "none";
  return next;
}
