// Legacy page design -> builder tree.
//
// Before the builder, a custom page was two flat arrays: `blocks` down the main
// column and `sidebarBlocks` down a fixed 380px rail beside it. The migration is
// lazy and non-destructive — it runs the first time a page is opened in the
// builder, and the original arrays stay in the saved design as a rollback path.
//
// The result is deliberately *one* section holding *one* row of two columns,
// because that is what the old layout actually was: a single band with the main
// column and sidebar side by side. Splitting each block into its own section
// would look different the moment the sidebar exists.

import {
  createTree,
  createSection,
  createRow,
  createComponent,
  DEFAULT_COMPONENT_STYLE,
  GRID,
} from "./page_tree";

// The old sidebar was a fixed 380px rail against a fluid main column — 4/12 is
// the closest honest equivalent on the grid.
const SIDEBAR_SPAN = 4;
const MAIN_SPAN = GRID - SIDEBAR_SPAN;

// legacy layout.width -> component maxWidth
const WIDTH_MAP = { full: "full", wide: "content", narrow: "narrow" };

function styleFromLegacyLayout(layout) {
  const l = layout || {};
  const background = l.background && l.background !== "none" ? l.background : "none";
  return {
    ...DEFAULT_COMPONENT_STYLE,
    align: l.align || "left",
    maxWidth: WIDTH_MAP[l.width] || "full",
    background,
    // A carded block was padded by BlockShell; keep that so it doesn't collapse.
    padding: background === "none" ? "none" : "md",
  };
}

function componentFromBlock(block) {
  const component = createComponent(block.type, block.props || {});
  component.style = styleFromLegacyLayout(block.layout);
  // The tree expresses "switched off" as `hidden` so that one flag covers both
  // "off everywhere" and, through breakpoint overrides, "off on mobile".
  if (block.visible === false) component.hidden = true;
  return component;
}

/**
 * Build a tree from a legacy design's `blocks` / `sidebarBlocks`.
 * Hidden blocks are carried over with `visible: false` rather than dropped, so
 * nothing an organizer authored is lost by opening the builder.
 */
export function treeFromBlocks(blocks, sidebarBlocks) {
  const main = (Array.isArray(blocks) ? blocks : []).map(componentFromBlock);
  const rail = (Array.isArray(sidebarBlocks) ? sidebarBlocks : []).map(componentFromBlock);

  const spans = rail.length ? [MAIN_SPAN, SIDEBAR_SPAN] : [GRID];
  const section = createSection(spans, "Page");
  const row = section.rows[0];

  row.columns[0].components = main;
  if (rail.length) {
    row.columns[1].components = rail;
    // The old rail was `lg:sticky lg:top-20`.
    row.columns[1].layout = { ...row.columns[1].layout, sticky: true };
  }

  return createTree([section]);
}

/** True when a design already carries a builder tree with something in it. */
export function hasTree(design) {
  return !!design?.tree?.sections?.length;
}

/**
 * The tree the builder should open for a design: its own if it has one,
 * otherwise one migrated from the legacy arrays. Never mutates `design`.
 */
export function treeForDesign(design) {
  if (hasTree(design)) return design.tree;
  return treeFromBlocks(design?.blocks, design?.sidebarBlocks);
}

/**
 * A design saved by the builder. `blocks` / `sidebarBlocks` are intentionally
 * left untouched: an organizer who wants the old page back can clear `tree`,
 * and older app builds keep rendering the page correctly in the meantime.
 */
export function designWithTree(design, tree) {
  return { ...design, tree };
}

// A page that is still on the legacy arrays and has never been opened in the
// builder — the renderer uses this to decide which path to take.
export function shouldRenderTree(design) {
  return hasTree(design);
}

/** Spare row factory used when the builder needs a fresh band. */
export function blankSection() {
  const section = createSection();
  section.rows = [createRow()];
  return section;
}
