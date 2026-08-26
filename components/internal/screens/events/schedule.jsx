"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Pencil,
  Clock,
  UploadCloud,
  Loader2,
  Image as ImgIcon,
  Code as CodeIcon,
  AlignLeft,
  Globe,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

import { EditorSectionHeader, Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  applySection,
  formatScheduleTime,
  sectionSettings,
} from "@/lib/events/schedule_items";
import { clipHostLabel, isClipFilled } from "@/lib/clip/model";
import { removeClipAssets } from "@/lib/clip/assets";
import {
  ClipAppearance,
  ClipPruner,
  WebClipDialog,
} from "@/components/internal/shared/web_clip";
import { ScheduleSlot } from "./page_blocks";
import { ScheduleStyleButton, ChoiceRow } from "./schedule_style";
import { ScheduleTimeField, TimeLabelBadge } from "./schedule_time";
import {
  uploadEventImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";

export const SCHEDULE_CONTENT_TYPES = [
  {
    key: "text",
    label: "Standard",
    hint: "Time, title, description and an image",
    icon: AlignLeft,
  },
  {
    key: "clip",
    label: "Clip from web",
    hint: "Pull a component off any public page",
    icon: Globe,
  },
  {
    key: "html",
    label: "Custom HTML",
    hint: "Your own markup, rendered as-is",
    icon: CodeIcon,
  },
];

export const SCHEDULE_IMAGE_POSITIONS = [
  { key: "left", label: "Left" },
  { key: "right", label: "Right" },
  { key: "top", label: "Top" },
  { key: "background", label: "Behind" },
];

export const SCHEDULE_IMAGE_FITS = [
  { key: "cover", label: "Cover", hint: "Fills the frame, crops the overflow" },
  { key: "fit", label: "Fit", hint: "Shows the whole image, letterboxed" },
  { key: "stretch", label: "Stretch", hint: "Fills the frame, distorts" },
];

const EMPTY_ITEM = {
  time: "",
  title: "",
  description: "",
  image: "",
  sectionNote: "",
  contentType: "text",
  imagePosition: "left",
  imageFit: "cover",
  clip: null,
};

function PositionArt({ kind }) {
  const img = "rounded-[2px] bg-current";
  const txt = "rounded-[2px] bg-current/35";
  if (kind === "top") {
    return (
      <div className="flex h-7 w-full flex-col gap-1 opacity-80">
        <span className={cn(img, "h-3")} />
        <span className={cn(txt, "h-1.5")} />
        <span className={cn(txt, "h-1.5 w-2/3")} />
      </div>
    );
  }
  if (kind === "background") {
    return (
      <div className={cn("relative h-7 w-full opacity-80", img)}>
        <span className="absolute inset-x-1 top-2 h-1.5 rounded-[2px] bg-background/70" />
        <span className="absolute inset-x-1 top-4 h-1.5 w-1/2 rounded-[2px] bg-background/70" />
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex h-7 w-full gap-1 opacity-80",
        kind === "right" && "flex-row-reverse",
      )}
    >
      <span className={cn(img, "h-full w-1/3 shrink-0")} />
      <div className="flex flex-1 flex-col justify-center gap-1">
        <span className={cn(txt, "h-1.5")} />
        <span className={cn(txt, "h-1.5 w-2/3")} />
      </div>
    </div>
  );
}

function FitArt({ kind, src }) {
  const object =
    kind === "fit" ? "object-contain" : kind === "stretch" ? "object-fill" : "object-cover";
  return (
    <div className="h-7 w-full overflow-hidden rounded-[3px] bg-surface-subtle">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className={cn("h-full w-full", object)} />
      ) : null}
    </div>
  );
}

function ModePicker({ value, onChange }) {
  return (
    <div className="grid gap-1.5">
      {SCHEDULE_CONTENT_TYPES.map((mode) => {
        const active = value === mode.key;
        const Icon = mode.icon;
        return (
          <button
            key={mode.key}
            type="button"
            onClick={() => onChange(mode.key)}
            aria-pressed={active}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "border-border bg-surface-card hover:border-border-strong hover:bg-surface-active",
            )}
          >
            <Icon
              className={cn(
                "h-4 w-4 shrink-0",
                active ? "text-primary" : "text-text-tertiary",
              )}
            />
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-xs font-medium leading-tight",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {mode.label}
              </span>
              <span className="block truncate text-[11px] leading-tight text-text-tertiary">
                {mode.hint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ScheduleItemDialog({
  open,
  onOpenChange,
  eventId,
  initial,
  previousTime,
  onSave,
}) {
  const [draft, setDraft] = useState(EMPTY_ITEM);
  const [busy, setBusy] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const fileInput = useRef(null);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial || EMPTY_ITEM);
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const mode = draft.contentType || "text";

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    const res = await uploadEventImage(eventId, file);
    setBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the event's creator can add images.");
      return;
    }
    const old = draft.image;
    set("image")(res.url);
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const removeImage = () => {
    const path = pathFromPublicUrl(draft.image);
    set("image")("");
    if (path) removeEventImage(path);
  };

  const submit = () => {
    if (mode === "html" && !draft.description.trim()) {
      toast.error("Add some HTML for the item first.");
      return;
    }
    if (mode === "clip" && !isClipFilled(draft.clip)) {
      toast.error("Clip something from a web page first.");
      return;
    }
    if (mode === "text" && !draft.title.trim()) {
      toast.error("Give the item a title first.");
      return;
    }
    const standalone = mode !== "text";
    onSave({
      time: standalone ? "" : draft.time.trim(),
      title: draft.title.trim() || (mode === "clip" ? "Clipped component" : "Custom item"),
      description: mode === "clip" ? "" : draft.description.trim(),
      image: standalone ? "" : draft.image || "",
      contentType: mode,
      imagePosition: draft.imagePosition || "left",
      imageFit: draft.imageFit || "cover",
      clip: mode === "clip" ? draft.clip : null,
    });
    onOpenChange(false);
  };

  const clipHost = clipHostLabel(draft.clip);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden bg-background p-0">
          <DialogHeader className="shrink-0 border-b border-border px-5 py-3.5">
            <DialogTitle>
              {initial?.id ? "Edit schedule item" : "Add schedule item"}
            </DialogTitle>
            <DialogDescription>
              A moment in your event&apos;s timeline.
            </DialogDescription>
          </DialogHeader>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-h-0 space-y-4 overflow-y-auto border-border p-5 md:border-r">
              <ModePicker value={mode} onChange={set("contentType")} />

              {mode === "html" ? (
                <Field
                  label="HTML"
                  hint="Rendered verbatim on the public page. Scripts are not executed."
                  htmlFor="sched-html"
                >
                  <Textarea
                    id="sched-html"
                    rows={14}
                    className="font-mono text-xs"
                    spellCheck={false}
                    value={draft.description}
                    onChange={(e) => set("description")(e.target.value)}
                    placeholder={'<div class="rounded-xl border border-border p-4">…</div>'}
                  />
                </Field>
              ) : null}

              {mode === "clip" ? (
                <div className="space-y-4">
                  {isClipFilled(draft.clip) ? (
                    <div className="space-y-2 rounded-lg border border-border bg-surface-card p-3">
                      <div className="flex items-center gap-2">
                        <Globe className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                          {clipHost || "Clipped component"}
                        </span>
                        {draft.clip?.source?.url ? (
                          <a
                            href={draft.clip.source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-text-tertiary transition-colors hover:text-foreground"
                            aria-label="Open the original page"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        ) : null}
                      </div>
                      <p className="font-mono text-[11px] text-text-tertiary">
                        {draft.clip?.source?.selector}
                      </p>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setClipOpen(true)}
                          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Re-clip
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => set("clip")(null)}
                          className="border-border bg-transparent text-muted-foreground hover:bg-red-500/10 hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Remove
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setClipOpen(true)}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
                    >
                      <Globe className="h-6 w-6" />
                      <span className="text-sm">Clip a component from a URL</span>
                      <span className="text-[11px] text-text-tertiary">
                        Hover the page, pick the piece you want
                      </span>
                    </button>
                  )}

                  <Field
                    label="Internal label"
                    hint="Only shown in this list, to help you find it."
                    htmlFor="sched-clip-title"
                  >
                    <Input
                      id="sched-clip-title"
                      value={draft.title}
                      onChange={(e) => set("title")(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      placeholder="e.g. Pricing table"
                    />
                  </Field>

                  {isClipFilled(draft.clip) ? (
                    <>
                      <ClipAppearance
                        clip={draft.clip}
                        onChange={(next) => set("clip")(next)}
                      />
                      <Accordion type="single" collapsible>
                        <AccordionItem
                          value="contents"
                          className="rounded-lg border border-border px-3"
                        >
                          <AccordionTrigger className="py-2.5 text-xs font-medium hover:no-underline">
                            Contents
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            <p className="mb-2 text-[11px] text-text-tertiary">
                              Strip the containers the component was sitting in,
                              or remove parts you don&apos;t want.
                            </p>
                            <ClipPruner
                              clip={draft.clip}
                              onChange={(next) => set("clip")(next)}
                            />
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </>
                  ) : null}
                </div>
              ) : null}

              {mode === "text" ? (
                <>
                  <Field label="Time" hint="Optional" htmlFor="sched-time">
                    <ScheduleTimeField
                      id="sched-time"
                      value={draft.time}
                      onChange={set("time")}
                      afterTime={previousTime}
                    />
                    <TimeLabelBadge value={draft.time} />
                  </Field>
                  <Field label="Title" htmlFor="sched-title">
                    <Input
                      id="sched-title"
                      value={draft.title}
                      onChange={(e) => set("title")(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          submit();
                        }
                      }}
                      placeholder="e.g. Opening remarks"
                      autoFocus
                    />
                  </Field>
                  <Field label="Description" hint="Optional" htmlFor="sched-desc">
                    <Textarea
                      id="sched-desc"
                      rows={3}
                      value={draft.description}
                      onChange={(e) => set("description")(e.target.value)}
                      placeholder="What happens during this part of the event?"
                    />
                  </Field>

                  <Field label="Image" hint="Optional">
                    {draft.image ? (
                      <div className="group relative overflow-hidden rounded-xl border border-border">
                        <img
                          src={draft.image}
                          alt=""
                          className="aspect-[16/9] w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => fileInput.current?.click()}
                            className="border-border bg-black/40 text-white hover:bg-black/60"
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <UploadCloud className="h-4 w-4" />
                            )}
                            Replace
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={removeImage}
                            className="border-border bg-black/40 text-white hover:bg-red-500/10 hover:text-red-300"
                          >
                            <Trash2 className="h-4 w-4" /> Remove
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => fileInput.current?.click()}
                        className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-text-secondary transition-colors hover:border-border-strong hover:text-foreground disabled:opacity-60"
                      >
                        {busy ? (
                          <Loader2 className="h-6 w-6 animate-spin" />
                        ) : (
                          <UploadCloud className="h-6 w-6" />
                        )}
                        <span className="text-sm">
                          {busy ? "Uploading…" : "Click to upload an image"}
                        </span>
                      </button>
                    )}
                  </Field>

                  {draft.image ? (
                    <>
                      <ChoiceRow
                        label="Image position"
                        value={draft.imagePosition || "left"}
                        onChange={set("imagePosition")}
                        options={SCHEDULE_IMAGE_POSITIONS}
                        render={(o) => <PositionArt kind={o.key} />}
                      />
                      <ChoiceRow
                        label="Image fit"
                        value={draft.imageFit || "cover"}
                        onChange={set("imageFit")}
                        options={SCHEDULE_IMAGE_FITS}
                        render={(o) => <FitArt kind={o.key} src={draft.image} />}
                      />
                    </>
                  ) : null}
                </>
              ) : null}
            </div>

            <div className="hidden min-h-0 flex-col overflow-hidden bg-surface-subtle md:flex">
              <p className="shrink-0 px-5 pt-4 text-[11px] uppercase tracking-wider text-text-tertiary">
                Live preview
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="rounded-xl border border-border bg-surface-card p-4">
                  <ScheduleSlot slot={draft} />
                </div>
                <p className="mt-3 text-[11px] text-text-tertiary">
                  Exactly how this item renders in the Schedule section.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 border-t border-border px-5 py-3.5">
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={submit}
              disabled={busy}
            >
              {initial?.id ? "Save item" : "Add item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WebClipDialog
        open={clipOpen}
        onOpenChange={setClipOpen}
        onClip={(clip) => {
          set("clip")(clip);
          
          setDraft((d) =>
            d.title.trim()
              ? d
              : { ...d, title: clipHostLabel(clip) || "Clipped component" },
          );
        }}
      />
    </>
  );
}

function ScheduleRow({ item, index, count, onEdit, onRemove, onMove }) {
  const clipped = item.contentType === "clip";
  const html = item.contentType === "html";

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3">
      {item.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.image}
          alt=""
          className="h-12 w-16 shrink-0 rounded-md border border-border object-cover"
        />
      ) : (
        <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-text-tertiary">
          {clipped ? (
            <Globe className="h-4 w-4" />
          ) : html ? (
            <CodeIcon className="h-4 w-4" />
          ) : (
            <ImgIcon className="h-4 w-4" />
          )}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {item.time ? (
            <span className="shrink-0 text-xs font-medium tabular-nums text-text-secondary">
              {formatScheduleTime(item.time)}
            </span>
          ) : null}
          <p className="truncate text-sm font-medium text-foreground">
            {item.title}
          </p>
          {clipped || html ? (
            <span className="shrink-0 rounded border border-border bg-surface-subtle px-1 py-px text-[10px] font-semibold uppercase tracking-wide text-text-secondary">
              {clipped ? clipHostLabel(item.clip) || "Clip" : "HTML"}
            </span>
          ) : null}
        </div>
        {item.description ? (
          <p className="mt-0.5 truncate text-xs text-text-secondary">
            {item.description}
          </p>
        ) : null}
      </div>
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === 0}
          onClick={() => onMove(-1)}
          aria-label="Move up"
          className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={index === count - 1}
          onClick={() => onMove(1)}
          aria-label="Move down"
          className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
        >
          <ArrowDown className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onEdit}
          aria-label="Edit item"
          className="text-text-secondary hover:bg-surface-active hover:text-foreground"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label="Delete item"
          className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function ScheduleSection({ event, headerItem }) {
  const [items, , saveItems] = useEventConfig(event, "schedule", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); 

  const section = sectionSettings(items);
  
  const saveSection = (next) =>
    saveItems(applySection(items, next), { successMsg: "Schedule style updated." });
  const addItem = (item) =>
    saveItems([...items, { ...item, ...section, id: `sch_${Date.now()}` }], {
      successMsg: "Schedule item added.",
    });
  
  const updateItem = (index, item) => {
    const previous = items[index];
    saveItems(
      items.map((it, i) => (i === index ? { ...it, ...item } : it)),
      { successMsg: "Schedule item updated." },
    );
    if (previous?.clip) removeClipAssets(previous.clip, { keep: item.clip });
  };

  const removeItem = (index) => {
    const target = items[index];
    saveItems(items.filter((_, i) => i !== index));
    const path = pathFromPublicUrl(target?.image);
    if (path) removeEventImage(path);
    if (target?.clip) removeClipAssets(target.clip);
  };

  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= items.length) return;
    const copy = [...items];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveItems(copy);
  };
  
  const lastTime = [...items].reverse().find((it) => it.time)?.time || "";

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Schedule"}
        description={
          headerItem?.desc ||
          "Build your event's running order. Items appear in this order in the Schedule section of your public page."
        }
        action={
          <div className="flex items-center gap-2">
            <ScheduleStyleButton
              section={section}
              onChange={saveSection}
              disabled={!items.length}
            />
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </div>
        }
      />

      {items.length ? (
        <div className="space-y-2">
          {items.map((it, i) => (
            <ScheduleRow
              key={it.id || i}
              item={it}
              index={i}
              count={items.length}
              onEdit={() => setEditing({ index: i, item: it })}
              onRemove={() => removeItem(i)}
              onMove={(dir) => move(i, dir)}
            />
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-foreground"
        >
          <Clock className="h-6 w-6" />
          <p className="text-sm">Add your first schedule item</p>
        </button>
      )}

      <ScheduleItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={event.id}
        initial={EMPTY_ITEM}
        previousTime={lastTime}
        onSave={addItem}
      />
      <ScheduleItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        eventId={event.id}
        initial={editing ? { ...EMPTY_ITEM, ...editing.item } : null}
        previousTime={editing ? items[editing.index - 1]?.time || "" : ""}
        onSave={(item) => {
          updateItem(editing.index, item);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default ScheduleSection;
