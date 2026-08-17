"use client";

import React, { useState, useMemo, useRef, Suspense, lazy } from "react";
import { toast } from "sonner";
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
  Wand2,
  Loader2,
  UploadCloud,
  Image as ImageIcon,
} from "lucide-react";

import {
  Field,
  SectionCard,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
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
  BG_OVERLAYS,
  HEADER_ALIGNS,
  BORDER_WIDTHS,
  BUTTON_WEIGHTS,
  DEFAULT_HEADER,
  VIEWER_MODES,
  themeFontOptions,
} from "@/lib/events/theme";
import { useCan } from "@/context/rbac-context";
import { hasTree } from "@/lib/events/page_migrate";
import { Segmented, ColorField } from "./theme_controls";
import { FooterEditor, DEFAULT_FOOTER } from "./page_footer";
import { ImportBrandDialog, BrandLogoSection } from "./brand_import";
import {
  uploadEventImage,
  uploadEventVideo,
} from "@/lib/supabase/storage";

// ---------------------------------------------------------------------------
// Shared page-design model
//
// The public event page is an ordered list of block instances plus a theme.
// Every mode reads the same model:
//   - Standard : rendered with defaults, no controls
//   - Themed   : theme + show/hide/reorder the default event blocks
//   - Custom   : the full builder — add/edit/remove/reorder any block
// ---------------------------------------------------------------------------

// The site header bar — the brand's own nav reproduced above the event hero.
// Populated by an import, editable by hand afterwards.
function SiteHeaderEditor({ header, onChange }) {
  const h = { ...DEFAULT_HEADER, ...(header || {}) };
  const links = Array.isArray(h.links) ? h.links : [];
  const patch = (next) => onChange({ ...h, ...next });
  const setLink = (i, key, v) =>
    patch({ links: links.map((l, j) => (j === i ? { ...l, [key]: v } : l)) });

  return (
    <div className="space-y-4">
      <SettingsList>
        <SettingRow
          title="Show the header bar"
          description="A brand bar with your logo and links above the event hero."
          checked={h.show !== false}
          onCheckedChange={(v) => patch({ show: v })}
        />
        <SettingRow
          title="Stick to the top"
          description="Keep the bar visible as the page scrolls."
          checked={h.sticky}
          onCheckedChange={(v) => patch({ sticky: v })}
        />
        <SettingRow
          title="Bottom rule"
          description="A hairline separating the bar from the page."
          checked={h.border !== false}
          onCheckedChange={(v) => patch({ border: v })}
        />
      </SettingsList>

      <Field label="Layout">
        <Segmented
          value={h.align}
          onChange={(v) => patch({ align: v })}
          options={HEADER_ALIGNS}
        />
      </Field>

      <Field label="Nav links" hint="Shown beside your logo, in order.">
        <div className="space-y-2">
          {links.map((l, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={l.label || ""}
                onChange={(e) => setLink(i, "label", e.target.value)}
                placeholder="Label"
                className="w-36 shrink-0"
              />
              <Input
                value={l.url || ""}
                onChange={(e) => setLink(i, "url", e.target.value)}
                placeholder="https://…"
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove link"
                onClick={() => patch({ links: links.filter((_, j) => j !== i) })}
                className="shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => patch({ links: [...links, { label: "", url: "" }] })}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add link
          </Button>
        </div>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Header button" hint="Leave the label blank for no button.">
          <Input
            value={h.cta?.label || ""}
            onChange={(e) => patch({ cta: { ...h.cta, label: e.target.value } })}
            placeholder="Get Tickets"
          />
        </Field>
        <Field label="Button links to">
          <Input
            value={h.cta?.url || ""}
            onChange={(e) => patch({ cta: { ...h.cta, url: e.target.value } })}
            placeholder="https://…"
          />
        </Field>
      </div>

      <Field
        label="Bar background"
        hint="Leave blank to sit on the page background."
      >
        <Input
          value={h.background || ""}
          onChange={(e) => patch({ background: e.target.value })}
          placeholder="#111111"
          className="font-mono text-xs"
        />
      </Field>
    </div>
  );
}

import {
  PAGE_MODES,
  BLOCK_WIDTH_OPTIONS,
  BLOCK_ALIGN_OPTIONS,
  BLOCK_BACKGROUND_OPTIONS,
  DEFAULT_BLOCK_LAYOUT,
  getBlockMeta,
  addableBlocks,
  createBlock,
  defaultSidebarBlocks,
} from "./page_block_library";

// The block catalog, option lists and page-design factories moved to
// page_block_library.js so the page builder can read them without importing
// this file (which renders the builder). Re-exported here so every existing
// `from "./page_design"` import keeps resolving.
export {
  PAGE_MODES,
  ACCENTS,
  COVER_STYLES,
  FONTS,
  COLUMN_RATIO_OPTIONS,
  COLUMN_ALIGN_OPTIONS,
  COLUMN_KIND_OPTIONS,
  BUTTON_ITEM_STYLES,
  SPACER_SIZE_OPTIONS,
  BLOCK_WIDTH_OPTIONS,
  BLOCK_ALIGN_OPTIONS,
  BLOCK_BACKGROUND_OPTIONS,
  DEFAULT_BLOCK_LAYOUT,
  BLOCK_LIBRARY,
  SIDEBAR_BLOCK_LIBRARY,
  getBlockMeta,
  addableBlocks,
  createBlock,
  defaultSidebarBlocks,
  defaultPageDesign,
  resolveAccent,
  resolveFont,
} from "./page_block_library";

// The builder is a whole editor's worth of code and only opens on demand, so it
// loads lazily rather than riding along in the event editor's bundle.
const PageBuilder = lazy(() =>
  import("./builder/page_builder").then((m) => ({ default: m.PageBuilder })),
);

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

export function PageDesignSection({
  design,
  onChange,
  onPersist,
  onPreview,
  eventId,
  event,
}) {
  // Which surface the add-block palette / editor dialog is acting on
  // ("main" | "sidebar"), or null when closed.
  const [adding, setAdding] = useState(null);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [builderOpen, setBuilderOpen] = useState(false);
  // Background media upload lives here beside the URL input. Uploads go into
  // the event's own media folder (same RLS as cover/gallery uploads).
  const bgInput = useRef(null);
  const [bgBusy, setBgBusy] = useState(false);

  const set = (patch) => onChange({ ...design, ...patch });
  const customizable = design.mode !== "standard";
  const isCustom = design.mode === "custom";
  const isImported = design.mode === "imported";

  // Once a page has a builder tree, the tree is what renders — the flat block
  // lists below are the pre-builder editor and would fight it.
  const built = hasTree(design);
  const canUseCustomCode = useCan("events.page.customcode");

  // The builder saves on its own, rather than making the author exit and find
  // the editor's Save button. Falls back to lifting state when no persister is
  // wired (the preview-only paths).
  const saveFromBuilder = async ({ tree, customCode }) => {
    const next = { ...design, tree, customCode };
    onChange(next);
    if (!onPersist) return true;
    return (await onPersist(next)) !== false;
  };

  // Brand theme (Themed mode). Reads the resolved theme (explicit, or legacy
  // back-compat, or defaults) and writes an explicit `design.theme`.
  const theme = resolveTheme(design);
  const setTheme = (patch) => set({ theme: { ...theme, ...patch } });
  const setColors = (patch) => setTheme({ colors: { ...theme.colors, ...patch } });
  const setFont = (patch) => setTheme({ font: { ...theme.font, ...patch } });
  const onBase = (base) =>
    setTheme({ base, colors: { ...theme.colors, ...BASE_PALETTES[base] } });
  const applyPreset = (preset) => set({ theme: preset.theme });

  // Upload a background image or video straight to the event's media folder
  // and point the background at it — the URL input stays for media hosted
  // elsewhere. Mirrors the cover upload flow in Content & media.
  const onBgFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const kind = file.type.startsWith("video/")
      ? "video"
      : file.type.startsWith("image/")
        ? "image"
        : null;
    if (!kind) {
      toast.error("Please choose an image or video file.");
      return;
    }
    setBgBusy(true);
    const res =
      kind === "video"
        ? await uploadEventVideo(eventId, file)
        : await uploadEventImage(eventId, file);
    setBgBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the event's creator can add media.");
      return;
    }
    setTheme({ background: { ...theme.background, type: kind, value: res.url } });
    toast.success(kind === "video" ? "Background video set." : "Background image set.");
  };
  const fontOptions = themeFontOptions(theme);

  // Selecting Import opens the dialog straight away the first time; afterwards it
  // just switches back to the imported look (re-import lives in Brand & logo).
  const selectMode = (key) => {
    set({ mode: key });
    if (key === "imported" && !theme.source?.url) setImportOpen(true);
  };
  // An imported brand is a theme patch — merged over what's there so a partial
  // import (colors only, say) leaves the rest of the theme alone. The footer
  // rides alongside the theme rather than inside it, so it patches separately.
  const applyImport = (patch, nextFooter) =>
    set({
      mode: "imported",
      theme: { ...theme, ...patch },
      ...(nextFooter ? { footer: nextFooter } : null),
    });

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
    <div className="space-y-4">
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
        <Tabs defaultValue="brand" className="gap-4">
          {/* Fourteen stacked panels was a long scroll to find one control.
              Grouped into tabs, each panel is a short list you can take in at
              once, and the mode selector above stays the only thing you have
              to scroll past. */}
          <TabsList
            variant="line"
            className="w-full justify-start gap-1 overflow-x-auto border-b border-border pb-1"
          >
            <TabsTrigger value="brand" className="flex-none">
              Brand
            </TabsTrigger>
            <TabsTrigger value="typography" className="flex-none">
              Typography
            </TabsTrigger>
            <TabsTrigger value="layout" className="flex-none">
              Layout
            </TabsTrigger>
            <TabsTrigger value="chrome" className="flex-none">
              Header & footer
            </TabsTrigger>
            <TabsTrigger value="sections" className="flex-none">
              Sections
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brand" className="space-y-4">
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
              title="Brand colors"
              description="Your palette. Surfaces, borders, and buttons adapt automatically."
            >
              <div className="space-y-4">
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
                    label="Gradient end"
                    value={theme.colors.brandTo || theme.colors.brand}
                    onChange={(v) => setColors({ brandTo: v })}
                  />
                  <ColorField
                    label="Secondary"
                    value={theme.colors.accent || theme.colors.brand}
                    onChange={(v) => setColors({ accent: v })}
                  />
                  <ColorField
                    label="Links"
                    value={theme.colors.link || theme.colors.brand}
                    onChange={(v) => setColors({ link: v })}
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

            <SectionCard
              title="Brand details"
              description="The tagline under your event title, and the browser tab icon."
            >
              <div className="space-y-4">
                <Field label="Tagline" hint="A short line under the event title.">
                  <Input
                    value={theme.tagline || ""}
                    onChange={(e) => setTheme({ tagline: e.target.value })}
                    placeholder="Two days of talks, workshops, and good coffee."
                  />
                </Field>
                <Field label="Favicon URL" hint="Shown in the browser tab on the live page.">
                  <Input
                    value={theme.favicon || ""}
                    onChange={(e) => setTheme({ favicon: e.target.value })}
                    placeholder="https://…/favicon.ico"
                    className="font-mono text-xs"
                  />
                </Field>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="typography" className="space-y-4">
            <SectionCard title="Typography">
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="grid gap-4 sm:grid-cols-2">
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
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Heading tracking"
                    hint="Letter-spacing, in em. Negative tightens."
                  >
                    <Input
                      type="number"
                      step="0.005"
                      value={theme.headingTracking || 0}
                      onChange={(e) =>
                        setTheme({ headingTracking: Number(e.target.value) || 0 })
                      }
                    />
                  </Field>
                  <Field label="Heading line height" hint="0 leaves it to the base style.">
                    <Input
                      type="number"
                      step="0.05"
                      value={theme.headingLineHeight || 0}
                      onChange={(e) =>
                        setTheme({ headingLineHeight: Number(e.target.value) || 0 })
                      }
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
          </TabsContent>

          <TabsContent value="layout" className="space-y-4">
            <SectionCard title="Shape & style">
              <div className="grid gap-4 sm:grid-cols-2">
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
                <Field label="Border weight">
                  <Segmented
                    value={Number(theme.borderWidth ?? 1)}
                    onChange={(v) => setTheme({ borderWidth: v })}
                    options={BORDER_WIDTHS}
                  />
                </Field>
                <Field label="Button weight">
                  <Segmented
                    value={theme.buttonWeight || ""}
                    onChange={(v) => setTheme({ buttonWeight: v })}
                    options={BUTTON_WEIGHTS}
                  />
                </Field>
                <Field
                  label="Exact corner radius"
                  hint="Pixels. Blank uses the bucket above."
                >
                  <Input
                    type="number"
                    min="0"
                    max="48"
                    value={theme.radiusPx ?? ""}
                    onChange={(e) =>
                      setTheme({
                        radiusPx: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="—"
                  />
                </Field>
                <Field label="Button corner radius" hint="Pixels. Blank matches cards.">
                  <Input
                    type="number"
                    min="0"
                    max="48"
                    value={theme.buttonRadiusPx ?? ""}
                    onChange={(e) =>
                      setTheme({
                        buttonRadiusPx:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                    placeholder="—"
                  />
                </Field>
              </div>
              <div className="mt-5">
                <SettingsList>
                  <SettingRow
                    title="Uppercase buttons"
                    description="Render button labels in all caps."
                    checked={theme.buttonUpper}
                    onCheckedChange={(v) => setTheme({ buttonUpper: v })}
                  />
                </SettingsList>
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
                {theme.background?.type === "image" ||
                theme.background?.type === "video" ? (
                  <>
                    <input
                      ref={bgInput}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={onBgFile}
                    />
                    <Field
                      label={
                        theme.background?.type === "video"
                          ? "Video URL"
                          : "Image URL"
                      }
                      hint={
                        theme.background?.type === "video"
                          ? "A muted, looping clip behind your content. Scenario videos with minimal motion work best."
                          : "A large, high-quality image works best."
                      }
                    >
                      <div className="flex gap-2">
                        <Input
                          value={theme.background?.value || ""}
                          onChange={(e) =>
                            setTheme({
                              background: { ...theme.background, value: e.target.value },
                            })
                          }
                          placeholder="https://…"
                          className="flex-1"
                        />
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={bgBusy}
                          onClick={() => bgInput.current?.click()}
                          className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        >
                          {bgBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <UploadCloud className="h-4 w-4" />
                          )}
                          Upload
                        </Button>
                      </div>
                    </Field>
                    <Field
                      label="Overlay"
                      hint={
                        theme.background?.type === "video"
                          ? "Sits between the video and your content. Dark makes cards and buttons stand out; the page color blends the video into the rest of the page."
                          : "Sits between the photo and your content. Dark makes cards and buttons stand out; the page color blends the photo into the rest of the page."
                      }
                    >
                      <Segmented
                        value={theme.background?.overlay || "base"}
                        onChange={(v) =>
                          setTheme({ background: { ...theme.background, overlay: v } })
                        }
                        options={BG_OVERLAYS}
                      />
                    </Field>
                    {(theme.background?.overlay || "base") !== "none" ? (
                      <Field
                        label="Overlay strength"
                        hint="Higher hides more of the media. Below ~50% a busy background starts competing with body copy."
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            step={5}
                            value={Number(theme.background?.dim ?? 80)}
                            onChange={(e) =>
                              setTheme({
                                background: {
                                  ...theme.background,
                                  dim: Number(e.target.value),
                                },
                              })
                            }
                            aria-label="Overlay strength"
                            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-active accent-primary"
                          />
                          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-text-secondary">
                            {Number(theme.background?.dim ?? 80)}%
                          </span>
                        </div>
                      </Field>
                    ) : null}
                  </>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Viewer theme"
              description="Which look visitors open the page in. They can still switch with the toggle on the page, and their choice is remembered."
            >
              <div className="space-y-4">
                <Field label="Preferred theme" hint="Follow system uses each visitor's own light/dark preference.">
                  <Segmented
                    value={design.viewerMode || "auto"}
                    onChange={(v) => set({ viewerMode: v })}
                    options={VIEWER_MODES}
                  />
                </Field>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="chrome" className="space-y-4">
            <SectionCard
              title="Site header"
              description="A brand bar above the event — your logo, links, and a button."
            >
              <SiteHeaderEditor
                header={theme.header}
                onChange={(header) => setTheme({ header })}
              />
            </SectionCard>

            <SectionCard
              title="Header & layout"
              description="How the top of your page and the ticket sidebar are arranged."
            >
              <div className="grid gap-4 sm:grid-cols-2">
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
              title="Footer"
              description="Links, socials, and a closing line at the bottom of your page."
            >
              <FooterEditor
                value={design.footer || DEFAULT_FOOTER}
                onChange={(footer) => set({ footer })}
              />
            </SectionCard>
          </TabsContent>

          <TabsContent value="sections" className="space-y-4">
            {isCustom ? (
              <SectionCard
                title="Page builder"
                description="Lay the page out visually — sections, columns, blocks, dynamic text and custom code."
                action={
                  <Button
                    size="sm"
                    onClick={() => setBuilderOpen(true)}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Wand2 className="h-4 w-4" /> Open builder
                  </Button>
                }
              >
                <p className="text-sm leading-relaxed text-text-secondary">
                  {built
                    ? "This page is built with the visual builder. Open it to change the layout, edit blocks, or adjust how it looks on tablet and mobile."
                    : "Opening the builder converts this page's current sections into an editable layout. Nothing changes on your public page until you save."}
                </p>
              </SectionCard>
            ) : null}

            {isCustom && built ? null : (
            <>
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
                  description="Images and videos from Content & media. Layout is set there."
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
            </>
            )}
          </TabsContent>
        </Tabs>
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
        footer={design.footer || DEFAULT_FOOTER}
        onApply={applyImport}
      />

      {builderOpen ? (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-50 flex items-center justify-center gap-2 bg-background text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading the builder…
            </div>
          }
        >
          <PageBuilder
            design={design}
            event={event}
            eventId={eventId}
            canUseCustomCode={canUseCustomCode}
            onSave={saveFromBuilder}
            onClose={() => setBuilderOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}
