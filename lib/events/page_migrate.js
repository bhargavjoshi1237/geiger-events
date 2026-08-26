
import {
  createTree,
  createSection,
  createRow,
  createComponent,
  DEFAULT_COMPONENT_STYLE,
  GRID,
} from "./page_tree";

const SIDEBAR_SPAN = 4;
const MAIN_SPAN = GRID - SIDEBAR_SPAN;

const WIDTH_MAP = { full: "full", wide: "content", narrow: "narrow" };

function styleFromLegacyLayout(layout) {
  const l = layout || {};
  const background = l.background && l.background !== "none" ? l.background : "none";
  return {
    ...DEFAULT_COMPONENT_STYLE,
    align: l.align || "left",
    maxWidth: WIDTH_MAP[l.width] || "full",
    background,
    padding: background === "none" ? "none" : "md",
  };
}

function componentFromBlock(block) {
  const component = createComponent(block.type, block.props || {});
  component.style = styleFromLegacyLayout(block.layout);
  if (block.visible === false) component.hidden = true;
  return component;
}

export function treeFromBlocks(blocks, sidebarBlocks) {
  const main = (Array.isArray(blocks) ? blocks : []).map(componentFromBlock);
  const rail = (Array.isArray(sidebarBlocks) ? sidebarBlocks : []).map(componentFromBlock);

  const spans = rail.length ? [MAIN_SPAN, SIDEBAR_SPAN] : [GRID];
  const section = createSection(spans, "Page");
  const row = section.rows[0];

  row.columns[0].components = main;
  if (rail.length) {
    row.columns[1].components = rail;
    row.columns[1].layout = { ...row.columns[1].layout, sticky: true };
  }

  return createTree([section]);
}

export function hasTree(design) {
  return !!design?.tree?.sections?.length;
}

export function treeForDesign(design) {
  if (hasTree(design)) return design.tree;
  return treeFromBlocks(design?.blocks, design?.sidebarBlocks);
}

export function designWithTree(design, tree) {
  return { ...design, tree };
}

export function shouldRenderTree(design) {
  return hasTree(design);
}

export function blankSection() {
  const section = createSection();
  section.rows = [createRow()];
  return section;
}
