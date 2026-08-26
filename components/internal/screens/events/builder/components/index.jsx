"use client";

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

export const COMPONENT_CATEGORIES = [
  { key: "hero", label: "Hero" },
  { key: "content", label: "Content" },
  { key: "event", label: "Event sections" },
  { key: "convert", label: "Convert" },
  { key: "proof", label: "Social proof" },
  { key: "custom", label: "Structure & custom" },
];

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

export function componentsInCategory(category) {
  return DEFINITIONS.filter((d) => d.category === category);
}

export function isSingleton(type) {
  return !!getComponentMeta(type)?.singleton;
}

export function createComponentOfType(type) {
  const meta = getComponentMeta(type);
  return createComponent(type, meta?.defaultProps || {}, !!meta?.container);
}

export function UnknownComponent({ type }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-dashed border-border bg-surface-card px-4 py-3 text-sm text-text-tertiary">
      <LayoutGrid className="h-4 w-4" />
      Unknown component: <code className="text-xs">{type}</code>
    </div>
  );
}
