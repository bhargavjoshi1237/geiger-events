// The page-builder document model.
//
// A built page is a tree: Section -> Row -> Column -> Component. Sections are
// full-bleed bands that own a background and vertical rhythm; rows hold columns
// on a 12-unit grid; columns stack components. Every node carries an id, its
// desktop presentation, and optional sparse `md` / `sm` override bags.
//
// Everything here is a pure function over plain JSON. Structural edits clone the
// whole tree and mutate the copy — a page is tens of nodes, not thousands, so
// the clone is free, every reference is new (React re-renders correctly), and
// undo/redo is a stack of snapshots rather than a diff engine.

export const TREE_VERSION = 1;

/** Column units in a row. */
export const GRID = 12;

// Desktop is the base and lives on the node itself; md/sm hold only the keys
// that differ, and sm falls back through md. Ordered widest-first.
export const BREAKPOINTS = [
  { key: "lg", label: "Desktop", width: 1280 },
  { key: "md", label: "Tablet", width: 834 },
  { key: "sm", label: "Mobile", width: 390 },
];

export const BASE_BREAKPOINT = "lg";

/** md inherits lg; sm inherits md inherits lg. */
const OVERRIDE_CHAIN = { lg: [], md: ["md"], sm: ["md", "sm"] };

// Only presentation varies by breakpoint. Content (`props`) deliberately does
// not — per-device copy is a maintenance trap, and hiding a whole component
// covers the real use case.
const OVERRIDE_KEYS = ["layout", "style", "advanced", "span", "hidden"];

// --- Design tokens -----------------------------------------------------------
// Named steps rather than raw px, so the inspector offers a scale and a page
// stays internally consistent.

export const SPACE_SCALE = {
  none: "0rem",
  xs: "0.5rem",
  sm: "1rem",
  md: "1.5rem",
  lg: "2.5rem",
  xl: "4rem",
  "2xl": "6rem",
};

export const SPACE_OPTIONS = [
  { key: "none", label: "None" },
  { key: "xs", label: "XS" },
  { key: "sm", label: "S" },
  { key: "md", label: "M" },
  { key: "lg", label: "L" },
  { key: "xl", label: "XL" },
  { key: "2xl", label: "2XL" },
];

export const MAX_WIDTH_SCALE = {
  narrow: "40rem",
  content: "56rem",
  wide: "72rem",
  full: "100%",
};

export const MAX_WIDTH_OPTIONS = [
  { key: "narrow", label: "Narrow" },
  { key: "content", label: "Content" },
  { key: "wide", label: "Wide" },
  { key: "full", label: "Full" },
];

export const V_ALIGN_OPTIONS = [
  { key: "start", label: "Top" },
  { key: "center", label: "Middle" },
  { key: "end", label: "Bottom" },
  { key: "stretch", label: "Stretch" },
];

export const TEXT_ALIGN_OPTIONS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
  { key: "right", label: "Right" },
];

export const BACKGROUND_TYPES = [
  { key: "none", label: "None" },
  { key: "color", label: "Color" },
  { key: "gradient", label: "Gradient" },
  { key: "image", label: "Image" },
];

export const RADIUS_SCALE = {
  none: "0px",
  sm: "0.375rem",
  md: "0.75rem",
  lg: "1rem",
  xl: "1.5rem",
  full: "9999px",
};

export const RADIUS_OPTIONS = [
  { key: "none", label: "None" },
  { key: "sm", label: "S" },
  { key: "md", label: "M" },
  { key: "lg", label: "L" },
  { key: "xl", label: "XL" },
  { key: "full", label: "Pill" },
];

export const SHADOW_SCALE = {
  none: "none",
  sm: "0 1px 2px rgb(0 0 0 / 0.18)",
  md: "0 4px 16px rgb(0 0 0 / 0.22)",
  lg: "0 12px 40px rgb(0 0 0 / 0.28)",
};

export const SHADOW_OPTIONS = [
  { key: "none", label: "None" },
  { key: "sm", label: "S" },
  { key: "md", label: "M" },
  { key: "lg", label: "L" },
];

// --- Node defaults -----------------------------------------------------------

export const DEFAULT_SECTION_LAYOUT = {
  maxWidth: "wide",
  paddingY: "lg",
  paddingX: "sm",
  gap: "lg",
};

export const DEFAULT_SECTION_STYLE = {
  background: { type: "none", color: "", from: "", to: "", angle: 160, url: "", overlay: 0 },
  textAlign: "left",
  radius: "none",
  shadow: "none",
  minHeight: "",
};

export const DEFAULT_ROW_LAYOUT = {
  gap: "md",
  vAlign: "start",
  reverseOnMobile: false,
};

export const DEFAULT_COLUMN_LAYOUT = {
  vAlign: "start",
  gap: "md",
  padding: "none",
  sticky: false,
};

export const DEFAULT_COLUMN_STYLE = {
  background: { type: "none", color: "" },
  radius: "none",
  border: false,
};

export const DEFAULT_COMPONENT_STYLE = {
  align: "left",
  maxWidth: "full",
  marginTop: "none",
  marginBottom: "none",
  // Optional card treatment around the component, matching what the legacy
  // per-block `layout.background` offered so migrated pages keep their look.
  background: "none",
  padding: "none",
  radius: "lg",
};

export const COMPONENT_BACKGROUND_OPTIONS = [
  { key: "none", label: "None" },
  { key: "surface", label: "Card" },
  { key: "brand", label: "Brand tint" },
];

export const DEFAULT_ADVANCED = {
  htmlId: "",
  cssClass: "",
  anchor: "",
};

// --- Node construction -------------------------------------------------------

// Short readable ids. Prefixed so a node's kind is obvious in saved JSON and in
// the layers panel's DOM, and unique enough that a duplicate never collides.
function nid(prefix) {
  const rand =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}_${rand}`;
}

export function createComponent(type, defaultProps = {}, container = false) {
  const node = {
    id: nid("cmp"),
    type,
    props: { ...defaultProps },
    style: { ...DEFAULT_COMPONENT_STYLE },
    advanced: { ...DEFAULT_ADVANCED },
    visible: true,
  };
  // Only a container carries children; the presence of this array is what makes
  // a component a legal drop target.
  if (container) node.components = [];
  return node;
}

export function createColumn(span = GRID, components = []) {
  return {
    id: nid("col"),
    span,
    layout: { ...DEFAULT_COLUMN_LAYOUT },
    style: { ...DEFAULT_COLUMN_STYLE },
    advanced: { ...DEFAULT_ADVANCED },
    components,
  };
}

export function createRow(spans = [GRID]) {
  return {
    id: nid("row"),
    layout: { ...DEFAULT_ROW_LAYOUT },
    columns: normalizeSpans(spans).map((s) => createColumn(s)),
  };
}

export function createSection(spans = [GRID], name = "Section") {
  return {
    id: nid("sec"),
    name,
    layout: { ...DEFAULT_SECTION_LAYOUT },
    style: { ...DEFAULT_SECTION_STYLE, background: { ...DEFAULT_SECTION_STYLE.background } },
    advanced: { ...DEFAULT_ADVANCED },
    rows: [createRow(spans)],
  };
}

export function createTree(sections = []) {
  return { version: TREE_VERSION, sections };
}

export function emptyTree() {
  return createTree([createSection()]);
}

// Column presets offered in the palette's Layout group.
export const COLUMN_PRESETS = [
  { key: "1", label: "1 column", spans: [12] },
  { key: "2", label: "2 columns", spans: [6, 6] },
  { key: "3", label: "3 columns", spans: [4, 4, 4] },
  { key: "4", label: "4 columns", spans: [3, 3, 3, 3] },
  { key: "1-2", label: "Narrow / wide", spans: [4, 8] },
  { key: "2-1", label: "Wide / narrow", spans: [8, 4] },
  { key: "sidebar", label: "Content + sidebar", spans: [8, 4] },
];

// --- Breakpoint resolution ---------------------------------------------------

function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Merge a node's desktop presentation with its md/sm overrides for `bp`.
 * Returns only the presentational keys — never children.
 */
export function resolveAt(node, bp = BASE_BREAKPOINT) {
  const out = {};
  if (!node) return out;
  for (const key of OVERRIDE_KEYS) out[key] = node[key];
  for (const level of OVERRIDE_CHAIN[bp] || []) {
    const override = node[level];
    if (!isPlainObject(override)) continue;
    for (const key of OVERRIDE_KEYS) {
      if (!(key in override)) continue;
      out[key] =
        isPlainObject(out[key]) && isPlainObject(override[key])
          ? { ...out[key], ...override[key] }
          : override[key];
    }
  }
  return out;
}

/** True when `bp` (not the base) carries its own value for `group.key`. */
export function hasOverride(node, bp, group, key) {
  if (!node || bp === BASE_BREAKPOINT) return false;
  const bag = node[bp];
  if (!isPlainObject(bag)) return false;
  if (!key) return group in bag;
  return isPlainObject(bag[group]) && key in bag[group];
}

// --- Tree traversal ----------------------------------------------------------
//
// A node is addressed by its index path: [s] section, [s,r] row, [s,r,c] column,
// [s,r,c,x] component. Path length is the node's kind.

export const KIND_BY_DEPTH = ["section", "row", "column", "component"];

// Depth 4 and beyond are all components: a container component holds its own
// `components` array, so a path can be arbitrarily deep past the column.
export function kindOfPath(path) {
  if (!path?.length) return null;
  return KIND_BY_DEPTH[Math.min(path.length, 4) - 1];
}

function walkComponents(list, base, cb) {
  (list || []).forEach((component, i) => {
    const path = [...base, i];
    if (cb(component, path, "component") === false) return;
    if (Array.isArray(component.components)) {
      walkComponents(component.components, path, cb);
    }
  });
}

/** Depth-first walk. `cb(node, path, kind)`; return false to skip children. */
export function walk(tree, cb) {
  (tree?.sections || []).forEach((section, s) => {
    if (cb(section, [s], "section") === false) return;
    (section.rows || []).forEach((row, r) => {
      if (cb(row, [s, r], "row") === false) return;
      (row.columns || []).forEach((column, c) => {
        if (cb(column, [s, r, c], "column") === false) return;
        walkComponents(column.components, [s, r, c], cb);
      });
    });
  });
}

/** Locate a node by id: `{ node, path, kind }`, or null. */
export function locate(tree, id) {
  if (!id) return null;
  let found = null;
  walk(tree, (node, path, kind) => {
    if (found) return false;
    if (node.id === id) found = { node, path, kind };
    return undefined;
  });
  return found;
}

/** The array a path's node lives in, within `tree`. */
export function listAt(tree, path) {
  const [s, r, c] = path;
  if (path.length === 1) return tree.sections;
  if (path.length === 2) return tree.sections[s].rows;
  if (path.length === 3) return tree.sections[s].rows[r].columns;
  // Components: descend through any container components on the way down.
  let list = tree.sections[s].rows[r].columns[c].components;
  for (let i = 3; i < path.length - 1; i += 1) list = list[path[i]].components;
  return list;
}

/** The node at a path. */
export function nodeAt(tree, path) {
  const list = listAt(tree, path);
  return list?.[path[path.length - 1]] ?? null;
}

/** The node's parent, or null for a section. */
export function parentOf(tree, path) {
  if (path.length < 2) return null;
  return nodeAt(tree, path.slice(0, -1));
}

// Structural edits clone first, then mutate the copy in place. Cheap at this
// size and far less error-prone than threading spreads through four levels.
function clone(tree) {
  return typeof structuredClone === "function"
    ? structuredClone(tree)
    : JSON.parse(JSON.stringify(tree));
}

// --- Span arithmetic ---------------------------------------------------------

/** Force a set of spans to positive integers totalling exactly GRID. */
export function normalizeSpans(spans) {
  const raw = (spans || []).map((s) => Math.max(1, Math.round(Number(s) || 1)));
  if (!raw.length) return [GRID];
  if (raw.length >= GRID) return new Array(GRID).fill(1);
  const total = raw.reduce((a, b) => a + b, 0);
  if (total === GRID) return raw;
  // Scale proportionally, then push the rounding remainder onto the widest
  // column so the row always adds up.
  const scaled = raw.map((s) => Math.max(1, Math.round((s / total) * GRID)));
  let drift = GRID - scaled.reduce((a, b) => a + b, 0);
  // Settle the rounding remainder on the widest column, which absorbs a unit
  // either way with the least visual effect.
  while (drift !== 0) {
    const step = drift > 0 ? 1 : -1;
    let target = 0;
    for (let i = 1; i < scaled.length; i += 1) {
      if (scaled[i] > scaled[target]) target = i;
    }
    if (step < 0 && scaled[target] <= 1) break;
    scaled[target] += step;
    drift -= step;
  }
  return scaled;
}

function rebalance(row) {
  const spans = normalizeSpans(row.columns.map((c) => c.span));
  row.columns.forEach((col, i) => {
    col.span = spans[i];
  });
}

/**
 * Drag the divider to the right of column `index` by `delta` grid units,
 * borrowing from its neighbour so the row still totals GRID.
 */
export function resizeColumn(tree, rowId, index, delta) {
  const next = clone(tree);
  const hit = locate(next, rowId);
  if (!hit || hit.kind !== "row") return tree;
  const cols = hit.node.columns;
  const a = cols[index];
  const b = cols[index + 1];
  if (!a || !b) return tree;
  const step = Math.round(delta);
  const nextA = a.span + step;
  const nextB = b.span - step;
  if (nextA < 1 || nextB < 1) return tree;
  a.span = nextA;
  b.span = nextB;
  return next;
}

// --- Structural operations ---------------------------------------------------

/** Replace a node with `updater(node)`'s result (mutating the clone is fine). */
export function updateNode(tree, id, updater) {
  const next = clone(tree);
  const hit = locate(next, id);
  if (!hit) return tree;
  const result = updater(hit.node);
  if (result && result !== hit.node) {
    const list = listAt(next, hit.path);
    list[hit.path[hit.path.length - 1]] = result;
  }
  return next;
}

/**
 * Write `value` at `group.key` for the active breakpoint. Desktop writes onto
 * the node; md/sm write into that node's sparse override bag.
 */
export function setNodeValue(tree, id, bp, group, key, value) {
  return updateNode(tree, id, (node) => {
    if (bp === BASE_BREAKPOINT) {
      if (key == null) node[group] = value;
      else node[group] = { ...(node[group] || {}), [key]: value };
      return node;
    }
    const bag = { ...(node[bp] || {}) };
    if (key == null) bag[group] = value;
    else bag[group] = { ...(bag[group] || {}), [key]: value };
    node[bp] = bag;
    return node;
  });
}

/** Drop a breakpoint override so the value inherits again. */
export function clearNodeOverride(tree, id, bp, group, key) {
  if (bp === BASE_BREAKPOINT) return tree;
  return updateNode(tree, id, (node) => {
    const bag = node[bp];
    if (!isPlainObject(bag)) return node;
    const nextBag = { ...bag };
    if (key == null) delete nextBag[group];
    else if (isPlainObject(nextBag[group])) {
      const inner = { ...nextBag[group] };
      delete inner[key];
      if (Object.keys(inner).length) nextBag[group] = inner;
      else delete nextBag[group];
    }
    if (Object.keys(nextBag).length) node[bp] = nextBag;
    else delete node[bp];
    return node;
  });
}

/** Remove a node. Empty rows and sections collapse; the last section stays. */
export function removeNode(tree, id) {
  const next = clone(tree);
  const hit = locate(next, id);
  if (!hit) return tree;
  const list = listAt(next, hit.path);
  list.splice(hit.path[hit.path.length - 1], 1);

  if (hit.kind === "column") {
    const row = nodeAt(next, hit.path.slice(0, 2));
    if (row && row.columns.length) rebalance(row);
  }
  prune(next);
  return next;
}

// A row with no columns and a section with no rows are invisible dead weight —
// drop them, but never leave the page with nothing to drop onto.
function prune(tree) {
  tree.sections.forEach((section) => {
    section.rows = (section.rows || []).filter((row) => (row.columns || []).length);
  });
  tree.sections = tree.sections.filter((section) => (section.rows || []).length);
  if (!tree.sections.length) tree.sections.push(createSection());
}

// Re-key a cloned subtree. The prefix comes from the existing id rather than
// from which child array is present, because a container component carries
// `components` exactly like a column does.
function reid(node) {
  const prefix = String(node.id || "").split("_")[0] || "cmp";
  node.id = nid(prefix);
  (node.rows || node.columns || node.components || []).forEach(reid);
  return node;
}

/** Insert a copy of a node directly after it, with fresh ids throughout. */
export function duplicateNode(tree, id) {
  const next = clone(tree);
  const hit = locate(next, id);
  if (!hit) return tree;
  const copy = reid(clone(hit.node));
  if (hit.kind === "section" && copy.name) copy.name = `${copy.name} copy`;
  const list = listAt(next, hit.path);
  list.splice(hit.path[hit.path.length - 1] + 1, 0, copy);
  if (hit.kind === "column") rebalance(nodeAt(next, hit.path.slice(0, 2)));
  return { tree: next, id: copy.id };
}

// --- Insertion & moves -------------------------------------------------------
//
// A drop target names an existing node and a side: `{ id, position }` where
// position is "before" | "after" (siblings) or "inside" (append to a container).

/**
 * Where a payload of `kind` may legally land, given the target node's kind.
 * `targetIsContainer` lets a component drop inside a container component.
 */
export function canDrop(payloadKind, targetKind, position, targetIsContainer = false) {
  if (position === "inside") {
    if (payloadKind === "component") {
      return targetKind === "column" || (targetKind === "component" && targetIsContainer);
    }
    if (payloadKind === "row") return targetKind === "section";
    return false;
  }
  return payloadKind === targetKind;
}

function insertAt(tree, node, target) {
  const hit = locate(tree, target.id);
  if (!hit) return false;

  if (target.position === "inside") {
    // A column always accepts components; a component only does when it is a
    // container (the only component kind that carries its own `components`).
    if (hit.kind === "column" || (hit.kind === "component" && Array.isArray(hit.node.components))) {
      hit.node.components = hit.node.components || [];
      hit.node.components.push(node);
      return true;
    }
    if (hit.kind === "section") {
      hit.node.rows = hit.node.rows || [];
      hit.node.rows.push(node);
      return true;
    }
    return false;
  }

  const list = listAt(tree, hit.path);
  const index = hit.path[hit.path.length - 1] + (target.position === "after" ? 1 : 0);
  list.splice(index, 0, node);
  if (hit.kind === "column") rebalance(nodeAt(tree, hit.path.slice(0, 2)));
  return true;
}

/** Insert a freshly created node at a drop target. Returns the updated tree. */
export function insertNode(tree, node, target) {
  const next = clone(tree);
  if (!insertAt(next, node, target)) return tree;
  return next;
}

/**
 * Move an existing node to a drop target. Refuses to drop a node into its own
 * subtree, which would detach the branch from the document.
 */
export function moveNode(tree, id, target) {
  if (!target || id === target.id) return tree;
  const next = clone(tree);
  const source = locate(next, id);
  if (!source) return tree;

  // Guard the self-nesting case before anything is spliced out.
  let inSubtree = false;
  walkFrom(source.node, (n) => {
    if (n.id === target.id) inSubtree = true;
  });
  if (inSubtree) return tree;

  const list = listAt(next, source.path);
  const [detached] = list.splice(source.path[source.path.length - 1], 1);
  if (source.kind === "column") {
    const row = nodeAt(next, source.path.slice(0, 2));
    if (row?.columns?.length) rebalance(row);
  }

  if (!insertAt(next, detached, target)) return tree;
  prune(next);
  return next;
}

function walkFrom(node, cb) {
  cb(node);
  (node.rows || node.columns || node.components || []).forEach((child) =>
    walkFrom(child, cb),
  );
}

/** Add a new column to a row, splitting the grid evenly. */
export function addColumn(tree, rowId) {
  const next = clone(tree);
  const hit = locate(next, rowId);
  if (!hit || hit.kind !== "row") return tree;
  if (hit.node.columns.length >= GRID) return tree;
  hit.node.columns.push(createColumn(1));
  const count = hit.node.columns.length;
  const spans = normalizeSpans(new Array(count).fill(GRID / count));
  hit.node.columns.forEach((col, i) => {
    col.span = spans[i];
  });
  return next;
}

// --- Statistics --------------------------------------------------------------

/** Counts for the builder's status line and the empty-state check. */
export function treeStats(tree) {
  let sections = 0;
  let components = 0;
  walk(tree, (_node, _path, kind) => {
    if (kind === "section") sections += 1;
    if (kind === "component") components += 1;
  });
  return { sections, components };
}

/** True when the page has no content a visitor would see. */
export function isTreeEmpty(tree) {
  return treeStats(tree).components === 0;
}
