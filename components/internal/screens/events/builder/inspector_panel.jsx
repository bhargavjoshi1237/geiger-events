"use client";

// The inspector: everything about the selected node.
//
// Four tabs — Content, Style, Layout, Advanced — driven by a declarative schema
// per node kind, so a new control is a line of data rather than a new panel.
//
// Every control is breakpoint-aware. On desktop it writes the base value; on
// tablet or mobile it writes into that node's sparse override bag and shows a
// dot you can click to drop the override and inherit again.

import React from "react";
import { RotateCcw, MousePointerSquareDashed } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  BACKGROUND_TYPES,
  BASE_BREAKPOINT,
  COMPONENT_BACKGROUND_OPTIONS,
  MAX_WIDTH_OPTIONS,
  RADIUS_OPTIONS,
  SHADOW_OPTIONS,
  SPACE_OPTIONS,
  TEXT_ALIGN_OPTIONS,
  V_ALIGN_OPTIONS,
  hasOverride,
  resolveAt,
} from "@/lib/events/page_tree";
import { cn } from "@/lib/utils";
import { BuilderField, FieldList } from "./field_editor";
import { getComponentMeta } from "./components";

const TABS = [
  { key: "content", label: "Content" },
  { key: "style", label: "Style" },
  { key: "layout", label: "Layout" },
  { key: "advanced", label: "Advanced" },
];

// --- Schemas -----------------------------------------------------------------
// `group` is which bag on the node the value lives in; `key` is the property.

const LAYOUT_SCHEMA = {
  section: [
    { group: "layout", key: "maxWidth", label: "Content width", type: "select", options: MAX_WIDTH_OPTIONS },
    { group: "layout", key: "paddingY", label: "Vertical padding", type: "select", options: SPACE_OPTIONS },
    { group: "layout", key: "paddingX", label: "Horizontal padding", type: "select", options: SPACE_OPTIONS },
    { group: "layout", key: "gap", label: "Gap between rows", type: "select", options: SPACE_OPTIONS },
  ],
  row: [
    { group: "layout", key: "gap", label: "Gap between columns", type: "select", options: SPACE_OPTIONS },
    { group: "layout", key: "vAlign", label: "Vertical alignment", type: "select", options: V_ALIGN_OPTIONS },
    {
      group: "layout",
      key: "reverseOnMobile",
      label: "Reverse order on mobile",
      type: "switch",
      hint: "Put the last column first once the row stacks.",
    },
  ],
  column: [
    {
      group: null,
      key: "span",
      label: "Width",
      type: "range",
      min: 1,
      max: 12,
      step: 1,
      suffix: "/12",
      hint: "Columns narrower than half widen on tablet and go full width on mobile unless you set them here.",
    },
    { group: "layout", key: "gap", label: "Gap between blocks", type: "select", options: SPACE_OPTIONS },
    { group: "layout", key: "vAlign", label: "Content alignment", type: "select", options: V_ALIGN_OPTIONS },
    { group: "layout", key: "padding", label: "Inner padding", type: "select", options: SPACE_OPTIONS },
    {
      group: "layout",
      key: "sticky",
      label: "Stick while scrolling",
      type: "switch",
      hint: "Releases automatically on mobile.",
    },
  ],
  component: [
    { group: "style", key: "maxWidth", label: "Maximum width", type: "select", options: MAX_WIDTH_OPTIONS },
    { group: "style", key: "marginTop", label: "Space above", type: "select", options: SPACE_OPTIONS },
    { group: "style", key: "marginBottom", label: "Space below", type: "select", options: SPACE_OPTIONS },
  ],
};

const STYLE_SCHEMA = {
  section: [
    { group: "style", key: "textAlign", label: "Text alignment", type: "select", options: TEXT_ALIGN_OPTIONS },
    { group: "style", key: "radius", label: "Corner radius", type: "select", options: RADIUS_OPTIONS },
    { group: "style", key: "shadow", label: "Shadow", type: "select", options: SHADOW_OPTIONS },
    { group: "style", key: "minHeight", label: "Minimum height", type: "text", placeholder: "e.g. 60vh" },
  ],
  row: [],
  column: [
    { group: "style", key: "radius", label: "Corner radius", type: "select", options: RADIUS_OPTIONS },
    { group: "style", key: "border", label: "Show a border", type: "switch" },
  ],
  component: [
    { group: "style", key: "align", label: "Text alignment", type: "select", options: TEXT_ALIGN_OPTIONS },
    { group: "style", key: "background", label: "Surface", type: "select", options: COMPONENT_BACKGROUND_OPTIONS },
    { group: "style", key: "padding", label: "Padding", type: "select", options: SPACE_OPTIONS },
    { group: "style", key: "radius", label: "Corner radius", type: "select", options: RADIUS_OPTIONS },
  ],
};

const ADVANCED_SCHEMA = [
  {
    group: "advanced",
    key: "htmlId",
    label: "HTML id",
    type: "text",
    hint: "Target this element from custom CSS or JS, or link to it as #id.",
  },
  {
    group: "advanced",
    key: "cssClass",
    label: "CSS classes",
    type: "text",
    hint: "Space-separated class names of your own.",
  },
];

// Whether a kind supports a background editor at all.
const HAS_BACKGROUND = { section: true, column: true };

// --- Controls ----------------------------------------------------------------

// The override dot. Present only away from desktop, and only clickable when
// this breakpoint is actually holding a value of its own.
function OverrideBadge({ active, onClear }) {
  if (!active) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      title="Reset to inherited value"
      aria-label="Reset to inherited value"
      className="flex items-center gap-1 rounded px-1 text-[0.6rem] font-medium text-primary hover:bg-primary/10"
    >
      <RotateCcw className="h-3 w-3" />
      reset
    </button>
  );
}

function SchemaControl({ field, node, bp, resolved, onSet, onClear }) {
  const value = field.group ? resolved[field.group]?.[field.key] : resolved[field.key];
  const overridden = hasOverride(node, bp, field.group || field.key, field.group ? field.key : null);

  return (
    <div className="space-y-1">
      {bp !== BASE_BREAKPOINT ? (
        <div className="flex justify-end">
          <OverrideBadge
            active={overridden}
            onClear={() => onClear(field.group || field.key, field.group ? field.key : null)}
          />
        </div>
      ) : null}
      <BuilderField
        field={field}
        value={value}
        onChange={(v) => onSet(field.group, field.key, v)}
      />
    </div>
  );
}

// Background is one nested object rather than four flat keys, so it writes as a
// whole and the shape stays easy to read in saved JSON.
function BackgroundEditor({ background, onChange }) {
  const bg = background || { type: "none" };
  const patch = (next) => onChange({ ...bg, ...next });

  return (
    <div className="space-y-4">
      <BuilderField
        field={{ label: "Background", type: "select", options: BACKGROUND_TYPES }}
        value={bg.type || "none"}
        onChange={(type) => patch({ type })}
      />
      {bg.type === "color" ? (
        <BuilderField
          field={{ label: "Colour", type: "color" }}
          value={bg.color}
          onChange={(color) => patch({ color })}
        />
      ) : null}
      {bg.type === "gradient" ? (
        <>
          <BuilderField
            field={{ label: "From", type: "color" }}
            value={bg.from}
            onChange={(from) => patch({ from })}
          />
          <BuilderField
            field={{ label: "To", type: "color" }}
            value={bg.to}
            onChange={(to) => patch({ to })}
          />
          <BuilderField
            field={{ label: "Angle", type: "range", min: 0, max: 360, step: 5, suffix: "°" }}
            value={bg.angle ?? 160}
            onChange={(angle) => patch({ angle })}
          />
        </>
      ) : null}
      {bg.type === "image" ? (
        <>
          <BuilderField
            field={{ label: "Image URL", type: "text", bindable: true }}
            value={bg.url}
            onChange={(url) => patch({ url })}
          />
          <BuilderField
            field={{
              label: "Overlay darkness",
              type: "range",
              min: 0,
              max: 90,
              step: 5,
              suffix: "%",
              hint: "Darkens the image so text on top stays legible.",
            }}
            value={bg.overlay ?? 0}
            onChange={(overlay) => patch({ overlay })}
          />
        </>
      ) : null}
    </div>
  );
}

// --- Panel -------------------------------------------------------------------

function EmptyInspector() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
      <MousePointerSquareDashed className="h-6 w-6 text-text-tertiary" />
      <p className="text-sm font-medium text-text-secondary">Nothing selected</p>
      <p className="max-w-[15rem] text-xs text-text-tertiary">
        Click a block, column, row or section on the canvas to edit it.
      </p>
    </div>
  );
}

/**
 * @param node      selected node (null when nothing is selected)
 * @param kind      its kind
 * @param bp        active breakpoint
 * @param tab/onTab controlled tab state
 * @param onSet     (group, key, value) => void   — group null writes the node itself
 * @param onClear   (group, key) => void          — drop this breakpoint's override
 * @param onSetProp (key, value) => void          — component content
 * @param onRename  (name) => void                — sections only
 */
export function InspectorPanel({
  node,
  kind,
  bp,
  tab,
  onTab,
  onSet,
  onClear,
  onSetProp,
  onRename,
}) {
  if (!node) return <EmptyInspector />;

  const resolved = resolveAt(node, bp);
  const meta = kind === "component" ? getComponentMeta(node.type) : null;
  const styleFields = STYLE_SCHEMA[kind] || [];
  const layoutFields = LAYOUT_SCHEMA[kind] || [];

  const schemaProps = { node, bp, resolved, onSet, onClear };

  const content = () => {
    if (kind === "component") {
      if (!meta) {
        return (
          <p className="text-xs text-text-tertiary">
            This block type isn&apos;t available in this version, so its content
            can&apos;t be edited here. It is preserved when you save.
          </p>
        );
      }
      if (!meta.fields?.length) {
        return (
          <p className="text-xs leading-relaxed text-text-tertiary">
            {meta.slot
              ? "This card is generated from live registration data. Position and style it here; its contents come from the event."
              : "This block draws entirely from the event record — edit it in the event's own sections."}
          </p>
        );
      }
      return (
        <FieldList
          fields={meta.fields}
          values={node.props || {}}
          onChange={onSetProp}
        />
      );
    }

    if (kind === "section") {
      return (
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-text-secondary">Section name</span>
          <Input
            value={node.name || ""}
            placeholder="Section"
            onChange={(e) => onRename(e.target.value)}
            className="bg-surface-card"
          />
          <p className="text-[0.7rem] text-text-tertiary">
            Shown in the layers list only — visitors never see it.
          </p>
        </div>
      );
    }

    return (
      <p className="text-xs leading-relaxed text-text-tertiary">
        {kind === "row"
          ? "A row arranges columns across the grid. Use Layout to set its spacing and alignment."
          : "A column holds blocks. Use Layout to set its width on the 12-column grid."}
      </p>
    );
  };

  const panels = {
    content: content(),
    style: (
      <div className="space-y-4">
        {HAS_BACKGROUND[kind] ? (
          <BackgroundEditor
            background={resolved.style?.background}
            onChange={(bg) => onSet("style", "background", bg)}
          />
        ) : null}
        {styleFields.map((field) => (
          <SchemaControl key={field.key} field={field} {...schemaProps} />
        ))}
        {!styleFields.length && !HAS_BACKGROUND[kind] ? (
          <p className="text-xs text-text-tertiary">
            A row has no styling of its own — style its section or its columns.
          </p>
        ) : null}
      </div>
    ),
    layout: (
      <div className="space-y-4">
        {layoutFields.map((field) => (
          <SchemaControl key={field.key} field={field} {...schemaProps} />
        ))}
      </div>
    ),
    advanced: (
      <div className="space-y-4">
        {ADVANCED_SCHEMA.map((field) => (
          <SchemaControl key={field.key} field={field} {...schemaProps} />
        ))}
        {kind === "section" ? (
          <BuilderField
            field={{
              label: "Anchor name",
              type: "text",
              hint: "Link to this section from a button as #name.",
            }}
            value={node.advanced?.anchor}
            onChange={(v) => onSet("advanced", "anchor", v)}
          />
        ) : null}
        <SchemaControl
          field={{
            group: null,
            key: "hidden",
            label:
              bp === BASE_BREAKPOINT
                ? "Hide on every screen"
                : `Hide on ${bp === "md" ? "tablet" : "mobile"}`,
            type: "switch",
            hint:
              bp === BASE_BREAKPOINT
                ? "Keeps it in the page but stops it rendering anywhere."
                : "Hidden at this size only.",
          }}
          {...schemaProps}
        />
      </div>
    ),
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => onTab(t.key)}
            className={cn(
              "-mb-px flex-1 border-b-2 px-2 py-2.5 text-xs font-medium transition-colors",
              tab === t.key
                ? "border-primary text-foreground"
                : "border-transparent text-text-secondary hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-3">{panels[tab]}</div>
    </div>
  );
}

export default InspectorPanel;
