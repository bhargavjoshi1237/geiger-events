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
  { key: "themed", label: "Themed", desc: "Your colors, cover, font, and section order." },
  { key: "custom", label: "Custom", desc: "Add and arrange your own content blocks." },
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

  // Re-seed the draft whenever a different block is opened.
  React.useEffect(() => {
    setDraft(block?.props || {});
  }, [block]);

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
      <SectionCard
        title="Page mode"
        description="Choose how much control you want over the public event page."
        action={
          <Button
            size="sm"
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={onPreview}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
        }
      >
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
      </SectionCard>

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
              the page block by block.
            </p>
          </div>
        </SectionCard>
      ) : (
        <>
          <SectionCard title="Theme">
            <div className="space-y-5">
              <Field label="Accent color">
                <div className="flex flex-wrap gap-2.5">
                  {ACCENTS.map((a) => {
                    const active = design.accent === a.key;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        title={a.label}
                        onClick={() => set({ accent: a.key })}
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform",
                          active
                            ? "scale-110 border-white"
                            : "border-transparent hover:scale-105",
                        )}
                        style={{ backgroundColor: a.color }}
                      >
                        {active ? (
                          <Check className="h-4 w-4" style={{ color: a.text }} />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Cover style">
                  <div className="flex gap-2">
                    {COVER_STYLES.map((c) => (
                      <button
                        key={c.key}
                        type="button"
                        onClick={() => set({ cover: c.key })}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          design.cover === c.key
                            ? "border-white bg-white text-[#161616]"
                            : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                        )}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Font">
                  <div className="flex gap-2">
                    {FONTS.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => set({ font: f.key })}
                        className={cn(
                          "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                          f.className,
                          design.font === f.key
                            ? "border-white bg-white text-[#161616]"
                            : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                        )}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </Field>
              </div>
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
