// Compiles a builder tree into a stylesheet.
//
// Every node's presentation is emitted as CSS keyed on `[data-ev="<id>"]`,
// with md/sm overrides emitted inside real media queries. That is what makes
// the three breakpoints genuine rather than simulated: the published page and
// the builder's canvas iframe both respond to their actual viewport, and the
// author's own @media rules behave the same way in both.
//
// Only the declarations that differ from the level above are emitted, so a page
// that never touches tablet or mobile produces no media queries at all.

import {
  BREAKPOINTS,
  MAX_WIDTH_SCALE,
  RADIUS_SCALE,
  SHADOW_SCALE,
  SPACE_SCALE,
  hasOverride,
  resolveAt,
  walk,
} from "./page_tree";

// Chosen to sit just above the canvas device widths (834 tablet, 390 mobile) so
// selecting a device in the builder lands squarely inside the matching query.
const MEDIA = {
  md: "@media (max-width: 1023px)",
  sm: "@media (max-width: 639px)",
};

const ORDER = BREAKPOINTS.map((b) => b.key); // ["lg","md","sm"]

function space(key) {
  if (key == null || key === "") return null;
  return SPACE_SCALE[key] ?? String(key);
}

function maxWidth(key) {
  if (!key) return null;
  return MAX_WIDTH_SCALE[key] ?? String(key);
}

const V_ALIGN_FLEX = {
  start: "flex-start",
  center: "center",
  end: "flex-end",
  stretch: "stretch",
};

const V_ALIGN_GRID = {
  start: "start",
  center: "center",
  end: "end",
  stretch: "stretch",
};

/** background config -> a declarations bag (also used for columns). */
function backgroundDecls(bg) {
  const out = {};
  if (!bg || !bg.type || bg.type === "none") return out;
  if (bg.type === "color") {
    if (bg.color) out["background-color"] = bg.color;
    return out;
  }
  if (bg.type === "gradient") {
    if (bg.from && bg.to) {
      out["background-image"] = `linear-gradient(${Number(bg.angle) || 160}deg, ${bg.from}, ${bg.to})`;
    }
    return out;
  }
  if (bg.type === "image" && bg.url) {
    const overlay = Math.min(100, Math.max(0, Number(bg.overlay) || 0)) / 100;
    // The scrim rides in the same background shorthand as the photo, so there is
    // no extra element and no stacking-context surprises.
    const scrim = overlay
      ? `linear-gradient(rgba(0,0,0,${overlay}), rgba(0,0,0,${overlay})), `
      : "";
    out["background-image"] = `${scrim}url("${bg.url}")`;
    out["background-size"] = "cover";
    out["background-position"] = "center";
  }
  return out;
}

function clean(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v != null && v !== "") out[k] = v;
  }
  return out;
}

// --- Per-kind declarations ---------------------------------------------------
//
// Each returns `{ "<selector suffix>": { prop: value } }`. The suffix is
// appended to `[data-ev="<id>"]`, so a node can style its own inner wrapper.

function sectionDecls(resolved) {
  const layout = resolved.layout || {};
  const style = resolved.style || {};
  const outer = clean({
    display: resolved.hidden ? "none" : "block",
    "padding-block": space(layout.paddingY),
    "border-radius": RADIUS_SCALE[style.radius] ?? null,
    "box-shadow": SHADOW_SCALE[style.shadow] ?? null,
    "min-height": style.minHeight || null,
    "text-align": style.textAlign && style.textAlign !== "left" ? style.textAlign : null,
    ...backgroundDecls(style.background),
  });
  const inner = clean({
    display: "flex",
    "flex-direction": "column",
    "max-width": maxWidth(layout.maxWidth),
    "margin-inline": "auto",
    "padding-inline": space(layout.paddingX),
    gap: space(layout.gap),
  });
  return { "": outer, " > .ev-inner": inner };
}

function rowDecls(resolved) {
  const layout = resolved.layout || {};
  const base = clean({
    display: resolved.hidden ? "none" : "grid",
    "grid-template-columns": "repeat(12, minmax(0, 1fr))",
    gap: space(layout.gap),
    "align-items": V_ALIGN_GRID[layout.vAlign] || "start",
  });
  return { "": base };
}

/**
 * A column's span at `bp`. Unless the author set one explicitly, narrow columns
 * widen on tablet and everything goes full width on mobile — the responsive
 * behaviour people expect without having to author it three times. An explicit
 * tablet span flows down to mobile, so "set it once at md" still works.
 */
function spanAt(node, bp, desktopSpan) {
  const span = Math.min(12, Math.max(1, Number(desktopSpan) || 12));
  if (bp === "lg") return span;
  const authoredMd = hasOverride(node, "md", "span");
  if (bp === "md") return authoredMd ? span : Math.min(12, span <= 6 ? span * 2 : 12);
  if (hasOverride(node, "sm", "span") || authoredMd) return span;
  return 12;
}

function columnDecls(resolved, { node, bp }) {
  const layout = resolved.layout || {};
  const style = resolved.style || {};
  const span = spanAt(node, bp, resolved.span);
  const base = clean({
    display: resolved.hidden ? "none" : "flex",
    "grid-column": `span ${span} / span ${span}`,
    "flex-direction": "column",
    gap: space(layout.gap),
    "justify-content": V_ALIGN_FLEX[layout.vAlign] || "flex-start",
    padding: space(layout.padding),
    "border-radius": RADIUS_SCALE[style.radius] ?? null,
    border: style.border ? "1px solid var(--border)" : null,
    // A sticky rail is a desktop/tablet idea; on a phone it just eats the
    // viewport, so it releases at the smallest breakpoint.
    // Relative rather than static so the builder's per-column handles have a
    // containing block; with no offsets it is visually identical.
    position: layout.sticky && bp !== "sm" ? "sticky" : "relative",
    top: layout.sticky && bp !== "sm" ? "1.5rem" : null,
    "align-self": layout.sticky && bp !== "sm" ? "start" : null,
    ...backgroundDecls(style.background),
  });
  return { "": base };
}

function componentDecls(resolved) {
  const style = resolved.style || {};
  const width = maxWidth(style.maxWidth);
  const carded = style.background && style.background !== "none";
  const base = clean({
    display: resolved.hidden || resolved.visible === false ? "none" : "block",
    "text-align": style.align && style.align !== "left" ? style.align : null,
    "max-width": width && width !== "100%" ? width : null,
    "margin-inline": width && width !== "100%" ? "auto" : null,
    "margin-top": space(style.marginTop),
    "margin-bottom": space(style.marginBottom),
    padding: carded ? space(style.padding) : null,
    "border-radius": carded ? (RADIUS_SCALE[style.radius] ?? null) : null,
    ...(carded
      ? style.background === "surface"
        ? { "background-color": "var(--surface-subtle)", border: "1px solid var(--border)" }
        : {
            // Brand tint keeps the accent as the source of truth rather than
            // baking a hex into the saved page.
            "background-color": "color-mix(in srgb, var(--ev-accent) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--ev-accent) 28%, transparent)",
          }
      : {}),
  });
  return { "": base };
}

const DECLS_BY_KIND = {
  section: sectionDecls,
  row: rowDecls,
  column: columnDecls,
  component: componentDecls,
};

// --- Emission ----------------------------------------------------------------

function serialize(selector, decls) {
  const body = Object.entries(decls)
    .map(([prop, value]) => `${prop}:${value}`)
    .join(";");
  return body ? `${selector}{${body}}` : "";
}

/** Declarations in `next` that differ from `prev`. */
function diff(next, prev) {
  const out = {};
  for (const [prop, value] of Object.entries(next)) {
    if (prev[prop] !== value) out[prop] = value;
  }
  return out;
}

/**
 * Compile a tree to CSS. Returns a single stylesheet string; empty when the
 * tree has nothing to style.
 */
export function compileTreeCss(tree) {
  if (!tree?.sections?.length) return "";

  const rules = { lg: [], md: [], sm: [] };

  walk(tree, (node, _path, kind) => {
    const build = DECLS_BY_KIND[kind];
    if (!build) return;
    const base = `[data-ev="${node.id}"]`;

    // Compute every breakpoint up front so md can diff against lg and sm
    // against md — an override only has to be written once, at the level the
    // author changed it.
    const perBp = {};
    for (const bp of ORDER) {
      const resolved = resolveAt(node, bp);
      if (kind === "component") resolved.visible = node.visible;
      perBp[bp] = build(resolved, { node, bp });
    }

    for (const suffix of Object.keys(perBp.lg)) {
      const selector = `${base}${suffix}`;
      const lg = perBp.lg[suffix] || {};
      const md = perBp.md[suffix] || {};
      const sm = perBp.sm[suffix] || {};

      const lgRule = serialize(selector, lg);
      if (lgRule) rules.lg.push(lgRule);

      const mdRule = serialize(selector, diff(md, lg));
      if (mdRule) rules.md.push(mdRule);

      const smRule = serialize(selector, diff(sm, md));
      if (smRule) rules.sm.push(smRule);
    }

    // Mobile column reversal is a row-level switch, and it is the one place a
    // grid has to become a flex column to get the order it wants.
    if (kind === "row" && resolveAt(node, "sm").layout?.reverseOnMobile) {
      rules.sm.push(`${base}{display:flex;flex-direction:column-reverse}`);
    }
  });

  const parts = [rules.lg.join("")];
  if (rules.md.length) parts.push(`${MEDIA.md}{${rules.md.join("")}}`);
  if (rules.sm.length) parts.push(`${MEDIA.sm}{${rules.sm.join("")}}`);
  return parts.filter(Boolean).join("");
}
