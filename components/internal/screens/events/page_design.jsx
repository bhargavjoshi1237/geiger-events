"use client";

import React, { useState } from "react";
import {
  Check,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Eye,
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
  FONT_OPTIONS,
  FONT_SCALES,
  HEADING_WEIGHTS,
  RADIUS_OPTIONS,
  WIDTHS,
  COVER_OPTIONS,
  BASES,
  BASE_PALETTES,
} from "@/lib/events/theme";
import { Segmented, ColorField } from "./theme_controls";

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

export function getBlockMeta(type) {
  return BLOCK_LIBRARY.find((b) => b.type === type) || null;
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
  };
}

export function defaultPageDesign() {
  return {
    mode: "standard",
    accent: "white",
    cover: "gradient",
    font: "sans",
    showGallery: true,
    blocks: DEFAULT_BLOCK_TYPES.map(createBlock),
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

function AddBlockDialog({ open, onOpenChange, existingTypes, onAdd }) {
  const available = BLOCK_LIBRARY.filter(
    (b) => b.category === "content" || !existingTypes.includes(b.type),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a block</DialogTitle>
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

function BlockEditorDialog({ block, onOpenChange, onSave }) {
  const meta = block ? getBlockMeta(block.type) : null;
  const [draft, setDraft] = useState(block?.props || {});

  // Re-seed the draft whenever a different block is opened (render-phase reset —
  // React's recommended alternative to a setState-in-effect).
  const [seedId, setSeedId] = useState(block?.id);
  if (block?.id !== seedId) {
    setSeedId(block?.id);
    setDraft(block?.props || {});
  }

  if (!block || !meta?.fields?.length) return null;

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Dialog open={!!block} onOpenChange={(o) => !o && onOpenChange(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {meta.label.toLowerCase()}</DialogTitle>
          <DialogDescription>
            Changes appear on your public page.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          {meta.fields.map((f) => (
            <Field key={f.key} label={f.label}>
              {f.type === "textarea" ? (
                <Textarea
                  rows={4}
                  value={draft[f.key] || ""}
                  onChange={(e) => set(f.key)(e.target.value)}
                />
              ) : (
                <Input
                  value={draft[f.key] || ""}
                  onChange={(e) => set(f.key)(e.target.value)}
                />
              )}
            </Field>
          ))}
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
            onClick={() => onSave(draft)}
          >
            Save block
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Editor section (right-nav "Page design")
// ---------------------------------------------------------------------------

export function PageDesignSection({ design, onChange, onPreview }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const set = (patch) => onChange({ ...design, ...patch });
  const customizable = design.mode !== "standard";
  const isCustom = design.mode === "custom";

  // Brand theme (Themed mode). Reads the resolved theme (explicit, or legacy
  // back-compat, or defaults) and writes an explicit `design.theme`.
  const theme = resolveTheme(design);
  const setTheme = (patch) => set({ theme: { ...theme, ...patch } });
  const setColors = (patch) => setTheme({ colors: { ...theme.colors, ...patch } });
  const setFont = (patch) => setTheme({ font: { ...theme.font, ...patch } });
  const onBase = (base) =>
    setTheme({ base, colors: { ...theme.colors, ...BASE_PALETTES[base] } });
  const applyPreset = (preset) => set({ theme: preset.theme });

  const setBlocks = (blocks) => set({ blocks });
  const toggleBlock = (id) =>
    setBlocks(
      design.blocks.map((b) =>
        b.id === id ? { ...b, visible: !b.visible } : b,
      ),
    );
  const moveBlock = (index, dir) => setBlocks(moveItem(design.blocks, index, dir));
  const removeBlock = (id) =>
    setBlocks(design.blocks.filter((b) => b.id !== id));
  const addBlock = (type) => setBlocks([...design.blocks, createBlock(type)]);
  const saveBlock = (id, props) => {
    setBlocks(design.blocks.map((b) => (b.id === id ? { ...b, props } : b)));
    setEditing(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        {/* Page mode — shown without a card wrapper, the selector sits directly
            on the section surface. */}
        <div className="grid gap-3 sm:grid-cols-3">
          {PAGE_MODES.map((mode) => {
            const active = design.mode === mode.key;
            return (
              <button
                key={mode.key}
                type="button"
                onClick={() => set({ mode: mode.key })}
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
              colors, or <span className="text-foreground">Custom</span> to build
              your own freeform page on a canvas.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard
            title="Brand presets"
            description="Start from a look, then fine-tune everything below."
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
                    options={FONT_OPTIONS}
                  />
                </Field>
                <Field label="Body font">
                  <Segmented
                    value={theme.font.body}
                    onChange={(v) => setFont({ body: v })}
                    options={FONT_OPTIONS}
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
              <Field label="Cover style">
                <Segmented
                  value={theme.cover}
                  onChange={(v) => setTheme({ cover: v })}
                  options={COVER_OPTIONS}
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
            title={isCustom ? "Blocks" : "Sections"}
            description={
              isCustom
                ? "Add, edit, reorder, and remove the blocks on your page."
                : "Show, hide, and reorder what appears on the page."
            }
            action={
              isCustom ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => setAddOpen(true)}
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

            <div className="mt-3 space-y-2">
              {design.blocks.map((b, i) => {
                const meta = getBlockMeta(b.type);
                const Icon = meta?.icon;
                const editable = isCustom && meta?.fields?.length;
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
                          {(b.props?.text || b.props?.title || "").slice(0, 28)}
                        </span>
                      ) : null}
                    </span>
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === 0}
                        onClick={() => moveBlock(i, -1)}
                        className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        disabled={i === design.blocks.length - 1}
                        onClick={() => moveBlock(i, 1)}
                        className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      {editable ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditing(b)}
                          className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      ) : null}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => toggleBlock(b.id)}
                        className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                        title={b.visible ? "Hide" : "Show"}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isCustom ? (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeBlock(b.id)}
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
          </SectionCard>
        </>
      )}

      <AddBlockDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        existingTypes={design.blocks.map((b) => b.type)}
        onAdd={addBlock}
      />
      <BlockEditorDialog
        block={editing}
        onOpenChange={(o) => !o && setEditing(null)}
        onSave={(props) => saveBlock(editing.id, props)}
      />
    </div>
  );
}
