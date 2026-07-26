"use client";

import React, { useState, useMemo } from "react";
import {
  Check,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Eye,
  Globe,
  Palette,
  Pencil,
  Trash2,
  Plus,
  Image as ImageIcon,
  FileText,
  Sparkles,
  Clock,
  MapPin,
  Users,
  HelpCircle,
  Heading,
  Type,
  Video,
  Code,
  MousePointerClick,
  Minus,
  AlignLeft,
  Columns2,
  ListCollapse,
  MoveVertical,
  Ticket,
  Info,
  ClipboardList,
  Accessibility,
} from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  resolveTheme,
  THEME_PRESETS,
  FONT_SCALES,
  HEADING_WEIGHTS,
  RADIUS_OPTIONS,
  WIDTHS,
  COVER_OPTIONS,
  BASES,
  BASE_PALETTES,
  BUTTON_STYLES,
  ELEVATIONS,
  DENSITIES,
  HERO_STYLES,
  OVERLAY_STYLES,
  SIDEBAR_SIDES,
  BG_TYPES,
  themeFontOptions,
} from "@/lib/events/theme";
import { Segmented, ColorField } from "./theme_controls";
import { FooterEditor, DEFAULT_FOOTER } from "./page_footer";
import { ImportBrandDialog, BrandLogoSection } from "./brand_import";

// ---------------------------------------------------------------------------
// Shared page-design model
//
// The public event page is an ordered list of block instances plus a theme.
// Every mode reads the same model:
//   - Standard : rendered with defaults, no controls
//   - Themed   : theme + show/hide/reorder the default event blocks
//   - Custom   : the full builder — add/edit/remove/reorder any block
// ---------------------------------------------------------------------------

export const PAGE_MODES = [
  { key: "standard", label: "Standard", desc: "Geiger's optimized, ready-to-go layout. No setup needed." },
  { key: "themed", label: "Themed", desc: "Your brand — colors, fonts, cover, header, footer, and sections." },
  { key: "imported", label: "Import", desc: "Match a website — we pull its logo, colors, and fonts for you." },
  { key: "custom", label: "Custom", desc: "Everything in Themed, plus build the page and sidebar block by block." },
];

export const ACCENTS = [
  { key: "white", label: "Classic", color: "var(--foreground)", text: "#161616" },
  { key: "violet", label: "Violet", color: "#8b5cf6", text: "#ffffff" },
  { key: "emerald", label: "Emerald", color: "#10b981", text: "#06281d" },
  { key: "sky", label: "Sky", color: "#0ea5e9", text: "#06212e" },
  { key: "amber", label: "Amber", color: "#f59e0b", text: "#161616" },
  { key: "rose", label: "Rose", color: "#f43f5e", text: "#ffffff" },
];

export const COVER_STYLES = [
  { key: "gradient", label: "Gradient" },
  { key: "solid", label: "Solid" },
  { key: "accent", label: "Accent tint" },
];

export const FONTS = [
  { key: "sans", label: "Sans", className: "font-sans" },
  { key: "serif", label: "Serif", className: "font-serif" },
  { key: "mono", label: "Mono", className: "font-mono" },
];

// --- Block field option catalogs ---------------------------------------------

export const COLUMN_RATIO_OPTIONS = [
  { key: "1:1", label: "Even" },
  { key: "1:2", label: "Narrow / wide" },
  { key: "2:1", label: "Wide / narrow" },
];

export const COLUMN_ALIGN_OPTIONS = [
  { key: "start", label: "Top" },
  { key: "center", label: "Middle" },
];

export const COLUMN_KIND_OPTIONS = [
  { key: "text", label: "Text" },
  { key: "image", label: "Image" },
];

export const BUTTON_ITEM_STYLES = [
  { key: "solid", label: "Solid" },
  { key: "outline", label: "Outline" },
];

export const SPACER_SIZE_OPTIONS = [
  { key: "sm", label: "Small" },
  { key: "md", label: "Medium" },
  { key: "lg", label: "Large" },
];

// --- Per-block layout --------------------------------------------------------
// Applied by BlockShell in page_blocks.jsx. Every default is the "no wrapper"
// value, so a block without layout renders exactly as it always has.

export const BLOCK_WIDTH_OPTIONS = [
  { key: "full", label: "Full" },
  { key: "wide", label: "Wide" },
  { key: "narrow", label: "Narrow" },
];

export const BLOCK_ALIGN_OPTIONS = [
  { key: "left", label: "Left" },
  { key: "center", label: "Center" },
  { key: "right", label: "Right" },
];

export const BLOCK_BACKGROUND_OPTIONS = [
  { key: "none", label: "None" },
  { key: "surface", label: "Card" },
  { key: "brand", label: "Brand tint" },
];

export const DEFAULT_BLOCK_LAYOUT = {
  width: "full",
  align: "left",
  background: "none",
};

// Every block type the page understands. `singleton` blocks (the smart event
// sections) can appear only once; content blocks can be added repeatedly and
// carry editable `fields`.
export const BLOCK_LIBRARY = [
  { type: "about", label: "About", icon: FileText, category: "event", singleton: true },
  { type: "expect", label: "What to expect", icon: Sparkles, category: "event", singleton: true },
  { type: "schedule", label: "Schedule", icon: Clock, category: "event", singleton: true },
  { type: "location", label: "Location & directions", icon: MapPin, category: "event", singleton: true },
  { type: "whosgoing", label: "Who's going", icon: Users, category: "event", singleton: true },
  { type: "guests", label: "Guests", icon: Users, category: "event", singleton: true },
  { type: "faq", label: "FAQ", icon: HelpCircle, category: "event", singleton: true },
  {
    type: "heading",
    label: "Heading",
    icon: Heading,
    category: "content",
    defaultProps: { text: "Section heading" },
    fields: [{ key: "text", label: "Heading text", type: "text" }],
  },
  {
    type: "text",
    label: "Text",
    icon: Type,
    category: "content",
    defaultProps: { text: "Add your text here. Tell attendees what makes this event special." },
    fields: [{ key: "text", label: "Text", type: "textarea" }],
  },
  {
    type: "richtext",
    label: "Rich text",
    icon: AlignLeft,
    category: "content",
    defaultProps: {
      text: "## What to expect\n\n- **Morning sessions:** timely, practical topics.\n- **Afternoons at your pace:** relax, explore, or connect.",
    },
    fields: [{ key: "text", label: "Content", type: "richtext" }],
  },
  {
    type: "columns",
    label: "Two columns",
    icon: Columns2,
    category: "content",
    defaultProps: {
      ratio: "1:1",
      align: "start",
      leftKind: "image",
      leftUrl: "",
      leftCaption: "",
      leftText: "",
      rightKind: "text",
      rightText: "**What to expect:**\n\n- First highlight\n- Second highlight",
      rightUrl: "",
      rightCaption: "",
    },
    fields: [
      { key: "ratio", label: "Column widths", type: "select", options: COLUMN_RATIO_OPTIONS },
      { key: "align", label: "Vertical alignment", type: "select", options: COLUMN_ALIGN_OPTIONS },
      { key: "leftKind", label: "Left column", type: "select", options: COLUMN_KIND_OPTIONS, group: "Left column" },
      { key: "leftText", label: "Left content", type: "richtext", showWhen: { leftKind: "text" } },
      { key: "leftUrl", label: "Left image URL", type: "text", showWhen: { leftKind: "image" } },
      { key: "leftCaption", label: "Left caption", type: "text", showWhen: { leftKind: "image" } },
      { key: "rightKind", label: "Right column", type: "select", options: COLUMN_KIND_OPTIONS, group: "Right column" },
      { key: "rightText", label: "Right content", type: "richtext", showWhen: { rightKind: "text" } },
      { key: "rightUrl", label: "Right image URL", type: "text", showWhen: { rightKind: "image" } },
      { key: "rightCaption", label: "Right caption", type: "text", showWhen: { rightKind: "image" } },
    ],
  },
  {
    type: "accordion",
    label: "Accordion",
    icon: ListCollapse,
    category: "content",
    // Starts with no rows — a seeded example would publish verbatim.
    defaultProps: { title: "Pricing & policies", items: [] },
    fields: [
      { key: "title", label: "Section title", type: "text", hint: "Leave empty for no heading." },
      {
        key: "items",
        label: "Rows",
        type: "items",
        addLabel: "Add row",
        itemFields: [
          { key: "q", label: "Label", type: "text" },
          { key: "a", label: "Content", type: "richtext" },
        ],
      },
    ],
  },
  {
    type: "buttons",
    label: "Button group",
    icon: MousePointerClick,
    category: "content",
    defaultProps: {
      items: [{ label: "Register now", url: "#", style: "solid" }],
    },
    fields: [
      {
        key: "items",
        label: "Buttons",
        type: "items",
        addLabel: "Add button",
        itemFields: [
          { key: "label", label: "Label", type: "text" },
          { key: "url", label: "Link", type: "text" },
          { key: "style", label: "Style", type: "select", options: BUTTON_ITEM_STYLES },
        ],
      },
    ],
  },
  {
    type: "spacer",
    label: "Spacer",
    icon: MoveVertical,
    category: "content",
    defaultProps: { size: "md" },
    fields: [{ key: "size", label: "Height", type: "select", options: SPACER_SIZE_OPTIONS }],
  },
  {
    type: "image",
    label: "Image",
    icon: ImageIcon,
    category: "content",
    defaultProps: { url: "", caption: "" },
    fields: [
      { key: "url", label: "Image URL", type: "text" },
      { key: "caption", label: "Caption", type: "text" },
    ],
  },
  {
    type: "video",
    label: "Video",
    icon: Video,
    category: "content",
    defaultProps: { url: "" },
    fields: [{ key: "url", label: "Video URL (YouTube, Vimeo…)", type: "text" }],
  },
  {
    type: "embed",
    label: "Embed",
    icon: Code,
    category: "content",
    defaultProps: { code: "" },
    fields: [{ key: "code", label: "Embed HTML", type: "textarea" }],
  },
  {
    type: "cta",
    label: "Call to action",
    icon: MousePointerClick,
    category: "content",
    defaultProps: { title: "Ready to join us?", label: "Get tickets", url: "#" },
    fields: [
      { key: "title", label: "Heading", type: "text" },
      { key: "label", label: "Button label", type: "text" },
      { key: "url", label: "Button link", type: "text" },
    ],
  },
  { type: "divider", label: "Divider", icon: Minus, category: "content", defaultProps: {} },
];

const DEFAULT_BLOCK_TYPES = [
  "about",
  "expect",
  "schedule",
  "location",
  "whosgoing",
  "guests",
  "faq",
];

// Sidebar-only singletons. These are rendered by event_public_page.jsx (they
// depend on checkout state), so they carry no renderer here — just identity for
// the show/hide/reorder list. Content blocks from BLOCK_LIBRARY can be added
// alongside them.
export const SIDEBAR_BLOCK_LIBRARY = [
  { type: "register", label: "Date & registration", icon: Ticket, category: "event", singleton: true, locked: true },
  { type: "goodtoknow", label: "Good to know", icon: Info, category: "event", singleton: true },
  { type: "atregistration", label: "At registration", icon: ClipboardList, category: "event", singleton: true },
  { type: "guidelines", label: "Dietary & accessibility", icon: Accessibility, category: "event", singleton: true },
];

const DEFAULT_SIDEBAR_TYPES = [
  "register",
  "goodtoknow",
  "atregistration",
  "guidelines",
];

// Content blocks that make sense in a 380px column — the rest are main-column only.
const SIDEBAR_CONTENT_TYPES = [
  "heading",
  "text",
  "richtext",
  "image",
  "cta",
  "buttons",
  "divider",
  "spacer",
];

export function getBlockMeta(type) {
  return (
    BLOCK_LIBRARY.find((b) => b.type === type) ||
    SIDEBAR_BLOCK_LIBRARY.find((b) => b.type === type) ||
    null
  );
}

/** The blocks addable to one surface: the main column, or the sidebar. */
export function addableBlocks(surface, existingTypes) {
  const library =
    surface === "sidebar"
      ? [
          ...SIDEBAR_BLOCK_LIBRARY,
          ...BLOCK_LIBRARY.filter((b) => SIDEBAR_CONTENT_TYPES.includes(b.type)),
        ]
      : BLOCK_LIBRARY;
  return library.filter(
    (b) => b.category === "content" || !existingTypes.includes(b.type),
  );
}

let blockCounter = 0;
export function createBlock(type) {
  const meta = getBlockMeta(type);
  blockCounter += 1;
  const id = meta?.singleton ? type : `${type}-${blockCounter}`;
  return {
    id,
    type,
    visible: true,
    props: meta?.defaultProps ? { ...meta.defaultProps } : {},
    ...(meta?.category === "content" ? { layout: { ...DEFAULT_BLOCK_LAYOUT } } : {}),
  };
}

/** The sidebar's out-of-the-box block list — also the fallback for pages saved
 *  before the sidebar became block-driven. */
export function defaultSidebarBlocks() {
  return DEFAULT_SIDEBAR_TYPES.map(createBlock);
}

export function defaultPageDesign() {
  return {
    mode: "standard",
    accent: "white",
    cover: "gradient",
    font: "sans",
    showGallery: true,
    blocks: DEFAULT_BLOCK_TYPES.map(createBlock),
    sidebarBlocks: defaultSidebarBlocks(),
  };
}

export function resolveAccent(key) {
  return ACCENTS.find((a) => a.key === key) || ACCENTS[0];
}

export function resolveFont(key) {
  return FONTS.find((f) => f.key === key) || FONTS[0];
}

function moveItem(arr, index, dir) {
  const ni = index + dir;
  if (ni < 0 || ni >= arr.length) return arr;
  const copy = [...arr];
  [copy[index], copy[ni]] = [copy[ni], copy[index]];
  return copy;
}

// ---------------------------------------------------------------------------
// Add-block palette
// ---------------------------------------------------------------------------

function AddBlockDialog({ open, onOpenChange, surface, existingTypes, onAdd }) {
  const available = addableBlocks(surface, existingTypes);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            Add a block{surface === "sidebar" ? " to the sidebar" : ""}
          </DialogTitle>
          <DialogDescription>
            Insert a content block, or re-add an event section you removed.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {available.map((b) => {
            const Icon = b.icon;
            return (
              <button
                key={b.type}
                type="button"
                onClick={() => {
                  onAdd(b.type);
                  onOpenChange(false);
                }}
                className="flex flex-col items-start gap-2 rounded-xl border border-border bg-surface-card p-3 text-left transition-colors hover:border-border-strong hover:bg-surface-active"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                  <Icon className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-foreground">
                  {b.label}
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Block property editor
// ---------------------------------------------------------------------------

const RICHTEXT_HINT =
  "Supports **bold**, *italic*, [links](https://…), ## headings, and - bullet lists.";

// One field of a block (or of a repeater row). Field types: text, textarea,
// richtext, select, items.
function BlockField({ field, value, onChange }) {
  if (field.type === "select") {
    return (
      <Field label={field.label} hint={field.hint}>
        <Segmented
          value={value ?? field.options[0].key}
          onChange={onChange}
          options={field.options}
        />
      </Field>
    );
  }
  if (field.type === "textarea" || field.type === "richtext") {
    return (
      <Field
        label={field.label}
        hint={field.type === "richtext" ? field.hint || RICHTEXT_HINT : field.hint}
      >
        <Textarea
          rows={field.type === "richtext" ? 6 : 4}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </Field>
    );
  }
  return (
    <Field label={field.label} hint={field.hint}>
      <Input value={value || ""} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

// Repeater for list-shaped props (accordion rows, button groups).
function ItemsField({ field, items, onChange }) {
  const rows = Array.isArray(items) ? items : [];
  const setRow = (i, patch) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () =>
    onChange([
      ...rows,
      Object.fromEntries(
        field.itemFields.map((f) => [f.key, f.type === "select" ? f.options[0].key : ""]),
      ),
    ]);
  const removeRow = (i) => onChange(rows.filter((_, j) => j !== i));
  const moveRow = (i, dir) => onChange(moveItem(rows, i, dir));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-foreground">{field.label}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={addRow}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> {field.addLabel || "Add"}
        </Button>
      </div>
      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div
              key={i}
              className="space-y-3 rounded-lg border border-border bg-surface-card p-3"
            >
              <div className="flex items-center justify-end gap-1">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  onClick={() => moveRow(i, -1)}
                  aria-label="Move up"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === rows.length - 1}
                  onClick={() => moveRow(i, 1)}
                  aria-label="Move down"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeRow(i)}
                  aria-label="Remove row"
                  className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              {field.itemFields.map((f) => (
                <BlockField
                  key={f.key}
                  field={f}
                  value={row[f.key]}
                  onChange={(v) => setRow(i, { [f.key]: v })}
                />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-text-tertiary">
          No rows yet.
        </p>
      )}
    </div>
  );
}

function BlockEditorDialog({ block, onOpenChange, onSave }) {
  const meta = block ? getBlockMeta(block.type) : null;
  const [draft, setDraft] = useState(block?.props || {});
  const [layout, setLayout] = useState(block?.layout || DEFAULT_BLOCK_LAYOUT);

  // Re-seed the draft whenever a different block is opened (render-phase reset —
  // React's recommended alternative to a setState-in-effect).
  const [seedId, setSeedId] = useState(block?.id);
  if (block?.id !== seedId) {
    setSeedId(block?.id);
    setDraft(block?.props || {});
    setLayout(block?.layout || DEFAULT_BLOCK_LAYOUT);
  }

  if (!block || !meta) return null;

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const setLayoutKey = (key) => (value) => setLayout((l) => ({ ...l, [key]: value }));
  // Fields gated on another field's value (an image column hides the text field).
  const visible = (f) =>
    !f.showWhen ||
    Object.entries(f.showWhen).every(([k, v]) => (draft[k] ?? "") === v);

  return (
    <Dialog open={!!block} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {meta.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Changes appear on your public page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {(meta.fields || []).filter(visible).map((f) => (
            <React.Fragment key={f.key}>
              {f.group ? (
                <p className="mt-1 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  {f.group}
                </p>
              ) : null}
              {f.type === "items" ? (
                <ItemsField
                  field={f}
                  items={draft[f.key]}
                  onChange={set(f.key)}
                />
              ) : (
                <BlockField field={f} value={draft[f.key]} onChange={set(f.key)} />
              )}
            </React.Fragment>
          ))}

          {/* Layout applies to any content block, including ones with no fields. */}
          <p className="mt-1 border-t border-border pt-4 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Layout
          </p>
          <Field label="Width">
            <Segmented
              value={layout.width || "full"}
              onChange={setLayoutKey("width")}
              options={BLOCK_WIDTH_OPTIONS}
            />
          </Field>
          <Field label="Alignment">
            <Segmented
              value={layout.align || "left"}
              onChange={setLayoutKey("align")}
              options={BLOCK_ALIGN_OPTIONS}
            />
          </Field>
          <Field label="Background" hint="Wraps the block in a padded card.">
            <Segmented
              value={layout.background || "none"}
              onChange={setLayoutKey("background")}
              options={BLOCK_BACKGROUND_OPTIONS}
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onSave(draft, layout)}
          >
            Save block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Block list (shared by the main column and the sidebar)
// ---------------------------------------------------------------------------

function BlockList({ blocks, isCustom, onToggle, onMove, onRemove, onEdit }) {
  if (!blocks.length) {
    return (
      <p className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-text-tertiary">
        No blocks yet.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {blocks.map((b, i) => {
        const meta = getBlockMeta(b.type);
        const Icon = meta?.icon;
        const editable = isCustom && meta?.category === "content";
        // The registration card is the page's reason to exist — it can be moved,
        // never hidden or deleted.
        const locked = meta?.locked;
        return (
          <div
            key={b.id}
            className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5"
          >
            <GripVertical className="h-4 w-4 shrink-0 text-text-tertiary" />
            {Icon ? (
              <Icon className="h-4 w-4 shrink-0 text-text-secondary" />
            ) : null}
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-sm",
                b.visible ? "text-foreground" : "text-text-tertiary",
              )}
            >
              {meta?.label || b.type}
              {meta?.category === "content" ? (
                <span className="ml-2 text-xs text-text-tertiary">
                  {(b.props?.text || b.props?.title || b.props?.label || "").slice(0, 28)}
                </span>
              ) : null}
            </span>
            <div className="flex items-center">
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === 0}
                onClick={() => onMove(i, -1)}
                aria-label="Move up"
                className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={i === blocks.length - 1}
                onClick={() => onMove(i, 1)}
                aria-label="Move down"
                className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </Button>
              {editable ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onEdit(b)}
                  aria-label="Edit block"
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              ) : null}
              {!locked ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onToggle(b.id)}
                  className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                  title={b.visible ? "Hide" : "Show"}
                  aria-label={b.visible ? "Hide block" : "Show block"}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              ) : null}
              {isCustom && !locked ? (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onRemove(b.id)}
                  aria-label="Remove block"
                  className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Editor section (right-nav "Page design")
// ---------------------------------------------------------------------------

export function PageDesignSection({ design, onChange, onPreview, eventId }) {
  // Which surface the add-block palette / editor dialog is acting on
  // ("main" | "sidebar"), or null when closed.
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const set = (patch) => onChange({ ...design, ...patch });
  const customizable = design.mode !== "standard";
  const isCustom = design.mode === "custom";
  const isImported = design.mode === "imported";

  // Brand theme (Themed mode). Reads the resolved theme (explicit, or legacy
  // back-compat, or defaults) and writes an explicit `design.theme`.
  const theme = resolveTheme(design);
  const setTheme = (patch) => set({ theme: { ...theme, ...patch } });
  const setColors = (patch) => setTheme({ colors: { ...theme.colors, ...patch } });
  const setFont = (patch) => setTheme({ font: { ...theme.font, ...patch } });
  const onBase = (base) =>
    setTheme({ base, colors: { ...theme.colors, ...BASE_PALETTES[base] } });
  const applyPreset = (preset) => set({ theme: preset.theme });
  const fontOptions = themeFontOptions(theme);

  // Selecting Import opens the dialog straight away the first time; afterwards it
  // just switches back to the imported look (re-import lives in Brand & logo).
  const selectMode = (key) => {
    set({ mode: key });
    if (key === "imported" && !theme.source?.url) setImportOpen(true);
  };
  // An imported brand is a theme patch — merged over what's there so a partial
  // import (colors only, say) leaves the rest of the theme alone.
  const applyImport = (patch) => set({ mode: "imported", theme: { ...theme, ...patch } });

  // The two block surfaces. A design saved before the sidebar became
  // block-driven has no `sidebarBlocks` — fall back to the defaults so the list
  // renders, and the first edit persists it.
  const mainBlocks = design.blocks || [];
  const sidebarBlocks = useMemo(
    () => design.sidebarBlocks || defaultSidebarBlocks(),
    [design.sidebarBlocks],
  );

  // One set of list handlers, bound to whichever surface's array it's given.
  const handlersFor = (key, list) => ({
    onToggle: (id) =>
      set({
        [key]: list.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
      }),
    onMove: (index, dir) => set({ [key]: moveItem(list, index, dir) }),
    onRemove: (id) => set({ [key]: list.filter((b) => b.id !== id) }),
    onAdd: (type) => set({ [key]: [...list, createBlock(type)] }),
    onSave: (id, props, layout) =>
      set({
        [key]: list.map((b) => (b.id === id ? { ...b, props, layout } : b)),
      }),
  });
  const mainHandlers = handlersFor("blocks", mainBlocks);
  const sidebarHandlers = handlersFor("sidebarBlocks", sidebarBlocks);
  const surfaceHandlers = (surface) =>
    surface === "sidebar" ? sidebarHandlers : mainHandlers;

  const saveBlock = (props, layout) => {
    surfaceHandlers(editing.surface).onSave(editing.block.id, props, layout);
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {/* Page mode — shown without a card wrapper, the selector sits directly
            on the section surface. */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {PAGE_MODES.map((mode) => {
            const active = design.mode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => selectMode(mode.key)}
                className={cn(

                  "flex flex-col gap-1.5 rounded-xl border p-4 text-left transition-colors",
                  active
                    ? "border-border-strong bg-surface-card"
                    : "border-border bg-transparent hover:bg-surface-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">
                    {mode.label}
                  </span>
                  {active ? (
                    <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white">
                      <Check className="h-3 w-3 text-[#161616]" />
                    </span>
                  ) : null}
                </div>
                <span className="text-xs text-text-secondary">{mode.desc}</span>
              </button>
            );
          })}
        </div>
      </div>

      {!customizable ? (
        <SectionCard>
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
              <Palette className="h-4 w-4" />
            </div>
            <p className="text-sm text-muted-foreground">
              Standard mode uses Geiger&apos;s tuned, mobile-optimized layout —
              nothing to configure. Switch to{" "}
              <span className="text-foreground">Themed</span> to set your brand
              colors by hand, or <span className="text-foreground">Import</span>{" "}
              to pull them straight off an existing website.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          {isImported || theme.logo?.url || theme.source?.url ? (
            <SectionCard
              title="Brand & logo"
              description="The mark shown on your page, and where it came from."
            >
              <BrandLogoSection
                theme={theme}
                eventId={eventId}
                onChange={setTheme}
                onReimport={() => setImportOpen(true)}
              />
            </SectionCard>
          ) : null}

          <SectionCard
            title="Brand presets"
            description="Start from a look, then fine-tune everything below."
            action={
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportOpen(true)}
                className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <Globe className="h-4 w-4" /> Import from a site
              </Button>
            }
          >
            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-border-strong hover:bg-surface-active hover:text-foreground"
                >
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-border"
                    style={{ backgroundColor: p.theme.colors.brand }}
                  />
                  {p.label}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Brand colors"
            description="Your palette. Surfaces, borders, and buttons adapt automatically."
          >
            <div className="space-y-5">
              <Field label="Base">
                <Segmented value={theme.base} onChange={onBase} options={BASES} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <ColorField
                  label="Brand / accent"
                  value={theme.colors.brand}
                  onChange={(v) => setColors({ brand: v })}
                />
                <ColorField
                  label="Brand text"
                  value={theme.colors.brandText}
                  onChange={(v) => setColors({ brandText: v })}
                />
                <ColorField
                  label="Page background"
                  value={theme.colors.bg}
                  onChange={(v) => setColors({ bg: v })}
                />
                <ColorField
                  label="Surface / cards"
                  value={theme.colors.surface}
                  onChange={(v) => setColors({ surface: v })}
                />
                <ColorField
                  label="Text"
                  value={theme.colors.text}
                  onChange={(v) => setColors({ text: v })}
                />
                <ColorField
                  label="Muted text"
                  value={theme.colors.muted}
                  onChange={(v) => setColors({ muted: v })}
                />
                <ColorField
                  label="Border"
                  value={theme.colors.border}
                  onChange={(v) => setColors({ border: v })}
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Typography">
            <div className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Heading font">
                  <Segmented
                    value={theme.font.heading}
                    onChange={(v) => setFont({ heading: v })}
                    options={fontOptions}
                  />
                </Field>
                <Field label="Body font">
                  <Segmented
                    value={theme.font.body}
                    onChange={(v) => setFont({ body: v })}
                    options={fontOptions}
                  />
                </Field>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Text size">
                  <Segmented
                    value={theme.font.scale}
                    onChange={(v) => setFont({ scale: v })}
                    options={FONT_SCALES}
                  />
                </Field>
                <Field label="Heading weight">
                  <Segmented
                    value={theme.headingWeight}
                    onChange={(v) => setTheme({ headingWeight: v })}
                    options={HEADING_WEIGHTS}
                  />
                </Field>
              </div>
              <SettingsList>
                <SettingRow
                  title="Uppercase headings"
                  description="Render section headings in all caps."
                  checked={theme.headingUpper}
                  onCheckedChange={(v) => setTheme({ headingUpper: v })}
                />
              </SettingsList>
            </div>
          </SectionCard>

          <SectionCard title="Shape & style">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Corner radius">
                <Segmented
                  value={theme.radius}
                  onChange={(v) => setTheme({ radius: v })}
                  options={RADIUS_OPTIONS}
                />
              </Field>
              <Field label="Button style">
                <Segmented
                  value={theme.button}
                  onChange={(v) => setTheme({ button: v })}
                  options={BUTTON_STYLES}
                />
              </Field>
              <Field label="Card shadow">
                <Segmented
                  value={theme.elevation}
                  onChange={(v) => setTheme({ elevation: v })}
                  options={ELEVATIONS}
                />
              </Field>
              <Field label="Spacing">
                <Segmented
                  value={theme.density}
                  onChange={(v) => setTheme({ density: v })}
                  options={DENSITIES}
                />
              </Field>
              <Field label="Content width">
                <Segmented
                  value={theme.width}
                  onChange={(v) => setTheme({ width: v })}
                  options={WIDTHS}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Header & layout"
            description="How the top of your page and the ticket sidebar are arranged."
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Hero style">
                <Segmented
                  value={theme.hero}
                  onChange={(v) => setTheme({ hero: v })}
                  options={HERO_STYLES}
                />
              </Field>
              <Field label="Cover style">
                <Segmented
                  value={theme.cover}
                  onChange={(v) => setTheme({ cover: v })}
                  options={COVER_OPTIONS}
                />
              </Field>
              <Field label="Cover overlay" hint="Improves text legibility on a banner hero.">
                <Segmented
                  value={theme.coverOverlay}
                  onChange={(v) => setTheme({ coverOverlay: v })}
                  options={OVERLAY_STYLES}
                />
              </Field>
              <Field label="Ticket sidebar">
                <Segmented
                  value={theme.sidebar}
                  onChange={(v) => setTheme({ sidebar: v })}
                  options={SIDEBAR_SIDES}
                />
              </Field>
            </div>
          </SectionCard>

          <SectionCard
            title="Page background"
            description="What sits behind your content, edge to edge."
          >
            <div className="space-y-4">
              <Field label="Background">
                <Segmented
                  value={theme.background?.type || "surface"}
                  onChange={(v) =>
                    setTheme({ background: { ...theme.background, type: v } })
                  }
                  options={BG_TYPES}
                />
              </Field>
              {theme.background?.type === "image" ? (
                <Field label="Image URL" hint="A large, high-quality image works best.">
                  <Input
                    value={theme.background?.value || ""}
                    onChange={(e) =>
                      setTheme({
                        background: { ...theme.background, value: e.target.value },
                      })
                    }
                    placeholder="https://…"
                  />
                </Field>
              ) : null}
            </div>
          </SectionCard>

          <SectionCard
            title={isCustom ? "Page blocks" : "Sections"}
            description={
              isCustom
                ? "Add, edit, reorder, and remove the blocks in the main column."
                : "Show, hide, and reorder what appears on the page."
            }
            action={
              isCustom ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => setAdding("main")}
                >
                  <Plus className="h-4 w-4" /> Add block
                </Button>
              ) : null
            }
          >
            <SettingsList>
              <SettingRow
                icon={ImageIcon}
                title="Photo gallery"
                description="Thumbnail strip under the cover image."
                checked={design.showGallery}
                onCheckedChange={(v) => set({ showGallery: v })}
              />
            </SettingsList>

            <div className="mt-3">
              <BlockList
                blocks={mainBlocks}
                isCustom={isCustom}
                onEdit={(b) => setEditing({ block: b, surface: "main" })}
                {...mainHandlers}
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Sidebar"
            description={
              isCustom
                ? "The registration column — reorder the built-in cards, or add your own."
                : "Show, hide, and reorder the cards in the registration column."
            }
            action={
              isCustom ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => setAdding("sidebar")}
                >
                  <Plus className="h-4 w-4" /> Add block
                </Button>
              ) : null
            }
          >
            <BlockList
              blocks={sidebarBlocks}
              isCustom={isCustom}
              onEdit={(b) => setEditing({ block: b, surface: "sidebar" })}
              {...sidebarHandlers}
            />
          </SectionCard>

          <SectionCard
            title="Footer"
            description="Links, socials, and a closing line at the bottom of your page."
          >
            <FooterEditor
              value={design.footer || DEFAULT_FOOTER}
              onChange={(footer) => set({ footer })}
            />
          </SectionCard>
        </>
      )}

      <AddBlockDialog
        open={!!adding}
        onOpenChange={(o) => !o && setAdding(null)}
        surface={adding}
        existingTypes={(adding === "sidebar" ? sidebarBlocks : mainBlocks).map(
          (b) => b.type,
        )}
        onAdd={(type) => surfaceHandlers(adding).onAdd(type)}
      />
      <BlockEditorDialog
        block={editing?.block || null}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={saveBlock}
      />
      <ImportBrandDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        eventId={eventId}
        theme={theme}
        onApply={applyImport}
      />
    </div>
  );
}
