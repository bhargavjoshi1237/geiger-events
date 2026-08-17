"use client";

// The page builder's component registry.
//
// One entry per component type, merging three sources:
//   - the legacy block catalog (page_block_library.js) with the renderers that
//     already draw those blocks — a block and a builder component share the same
//     `{ type, props }` shape, so nothing is reimplemented here
//   - the sidebar singletons, which the public page renders itself against live
//     checkout state; here they are "slots" the tree positions but does not draw
//   - the builder's own hero / convert / proof / structure components
//
// Anything that needs to know what a component is — the palette, the inspector,
// the renderer, the layers panel — reads this one map.

import React from "react";
import { LayoutGrid } from "lucide-react";

import {
  BLOCK_LIBRARY,
  SIDEBAR_BLOCK_LIBRARY,
} from "../../page_block_library";
import { BLOCK_RENDERERS } from "../../page_blocks";
import { createComponent } from "@/lib/events/page_tree";
import { HERO_COMPONENTS } from "./hero";
import { CONVERT_COMPONENTS } from "./convert";
import { PROOF_COMPONENTS } from "./proof";
import { STRUCTURE_COMPONENTS } from "./structure";

// Palette groups, in the order they appear. `layout` is not a component group —
// it holds the section/column presets the palette offers alongside these.
export const COMPONENT_CATEGORIES = [
  { key: "hero", label: "Hero" },
  { key: "content", label: "Content" },
  { key: "event", label: "Event sections" },
  { key: "convert", label: "Convert" },
  { key: "proof", label: "Social proof" },
  { key: "custom", label: "Structure & custom" },
];

// A sidebar singleton has no renderer of its own: the published page draws it
// from live checkout state and hands it in through `ctx.slots`. In the builder
// there is no checkout, so it draws as a labelled stand-in at the right size.
function SlotPlaceholder({ label, icon: Icon }) {
  return (
    <div className="flex min-h-[7rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card p-5 text-center">
      {Icon ? <Icon className="h-5 w-5 text-text-tertiary" /> : null}
      <p className="text-sm font-medium text-text-secondary">{label}</p>
      <p className="text-xs text-text-tertiary">Rendered live on the published page</p>
    </div>
  );
}

function slotDefinition(meta) {
  return {
    ...meta,
    slot: true,
    fields: meta.fields || [],
    defaultProps: meta.defaultProps || {},
    render: ({ ctx }) =>
      ctx?.slots?.[meta.type] ?? <SlotPlaceholder label={meta.label} icon={meta.icon} />,
  };
}

function blockDefinition(meta) {
  const Renderer = BLOCK_RENDERERS[meta.type];
  return {
    ...meta,
    fields: meta.fields || [],
    defaultProps: meta.defaultProps || {},
    render: Renderer
      ? ({ props, event, accent }) => (
          <Renderer props={props} event={event} accent={accent} />
        )
      : null,
  };
}

const DEFINITIONS = [
  ...HERO_COMPONENTS,
  ...BLOCK_LIBRARY.map(blockDefinition),
  ...SIDEBAR_BLOCK_LIBRARY.map(slotDefinition),
  ...CONVERT_COMPONENTS,
  ...PROOF_COMPONENTS,
  ...STRUCTURE_COMPONENTS,
];

export const COMPONENT_LIBRARY = DEFINITIONS.reduce((map, def) => {
  map[def.type] = def;
  return map;
}, {});

export const COMPONENT_LIST = DEFINITIONS;

export function getComponentMeta(type) {
  return COMPONENT_LIBRARY[type] || null;
}

/** Palette entries for one category, in registry order. */
export function componentsInCategory(category) {
  return DEFINITIONS.filter((d) => d.category === category);
}

/** Types that may appear only once on a page (the smart event sections). */
export function isSingleton(type) {
  return !!getComponentMeta(type)?.singleton;
}

/** Build a fresh node for `type`, wired for children when it is a container. */
export function createComponentOfType(type) {
  const meta = getComponentMeta(type);
  return createComponent(type, meta?.defaultProps || {}, !!meta?.container);
}

/**
 * A component whose type this build doesn't know — a page saved by a newer
 * palette, or a type that was renamed. It renders as a labelled placeholder
 * rather than crashing the page, and the node survives the next save intact.
 */
export function UnknownComponent({ type }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface-card px-4 py-3 text-sm text-text-tertiary">
      <LayoutGrid className="h-4 w-4" />
      Unknown component: <code className="text-xs">{type}</code>
    </div>
  );
}
