"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlignLeft,
  Code as CodeIcon,
  ExternalLink,
  Eye,
  Globe,
  Loader2,
  RefreshCw,
  Tag,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Field, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Kbd, KbdGroup } from "@geiger/ui/kbd";
import { useModifierKeyLabel } from "@geiger/ui/command-palette";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@geiger/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { cn } from "@/lib/utils";
import { clipHostLabel, isClipFilled } from "@/lib/clip/model";
import {
  ClipAppearance,
  ClipPruner,
  WebClipDialog,
} from "@/components/internal/shared/web_clip";
import {
  uploadEventImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";
import { isClockTime } from "@/lib/events/schedule_items";
import { ScheduleSlot } from "./page_blocks";
import { ChoiceRow } from "./schedule_style";
import { EventTimeField } from "./date_time_fields";

export const SCHEDULE_CONTENT_TYPES = [
  {
    key: "text",
    label: "Standard",
    hint: "A time, a title, a description and an optional image.",
    icon: AlignLeft,
  },
  {
    key: "clip",
    label: "Clip From Web",
    hint: "Pull a component off any public page and drop it into the running order.",
    icon: Globe,
  },
  {
    key: "html",
    label: "Custom HTML",
    hint: "Your own markup, rendered as-is. Scripts are never executed.",
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

export const EMPTY_ITEM = {
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

// One labelled block in the form pane; siblings are separated by the pane's divide-y.
function Group({ title, hint, children }) {
  return (
    <section className="space-y-3 p-5">
      {title ? (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {title}
          </h3>
          {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
        </div>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

// Items created before the time field went native can hold a free-text label
// ("Doors open"). A time input can't show one, so surface it here rather than
// letting the browser silently drop it on the next save.
function LegacyTimeLabel({ value, onClear }) {
  if (!value || isClockTime(value)) return null;
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Tag className="h-3 w-3 shrink-0" />
      <span className="min-w-0 flex-1 truncate">Label: “{value}”</span>
      <button
        type="button"
        onClick={onClear}
        className="shrink-0 rounded px-1 text-muted-foreground transition-colors hover:text-foreground"
      >
        Clear
      </button>
    </span>
  );
}

function ErrorText({ children }) {
  if (!children) return null;
  return <p className="text-xs text-destructive">{children}</p>;
}

function RequiredLabel({ children }) {
  return (
    <>
      {children} <span className="text-destructive">*</span>
    </>
  );
}

export function ScheduleItemDialog({
  open,
  onOpenChange,
  eventId,
  initial,
  onSave,
}) {
  const [draft, setDraft] = useState(EMPTY_ITEM);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [clipOpen, setClipOpen] = useState(false);
  const fileInput = useRef(null);
  const titleInput = useRef(null);
  const modKey = useModifierKeyLabel();

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(initial || EMPTY_ITEM);
      setErrors({});
    }
  }

  const set = (key) => (value) => {
    setErrors((e) => (e[key] ? { ...e, [key]: null } : e));
    setDraft((d) => ({ ...d, [key]: value }));
  };

  const mode = draft.contentType || "text";
  const activeType =
    SCHEDULE_CONTENT_TYPES.find((t) => t.key === mode) || SCHEDULE_CONTENT_TYPES[0];
  const ModeIcon = activeType.icon;

  const setMode = (next) => {
    setErrors({});
    setDraft((d) => ({ ...d, contentType: next }));
  };

  const uploadFile = async (file) => {
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

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) uploadFile(file);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const removeImage = () => {
    const path = pathFromPublicUrl(draft.image);
    set("image")("");
    if (path) removeEventImage(path);
  };

  const submit = () => {
    if (mode === "text" && !draft.title.trim()) {
      setErrors({ title: "Give this item a title." });
      titleInput.current?.focus();
      return;
    }
    if (mode === "html" && !draft.description.trim()) {
      setErrors({ description: "Add the HTML you want to render." });
      return;
    }
    if (mode === "clip" && !isClipFilled(draft.clip)) {
      setErrors({ clip: "Clip something from a web page first." });
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

  const onDialogKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const submitOnEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  const clipHost = clipHostLabel(draft.clip);
  const clipped = isClipFilled(draft.clip);
  const editing = !!initial?.id;

  const previewEmpty =
    mode === "text"
      ? !draft.time && !draft.title.trim() && !draft.description.trim() && !draft.image
      : mode === "html"
        ? !draft.description.trim()
        : !clipped;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          onKeyDown={onDialogKeyDown}
          className="flex max-h-[88vh] w-[95vw] max-w-4xl flex-col gap-0 overflow-hidden bg-background p-0"
        >
          <DialogHeader className="shrink-0 flex-row items-center gap-3 space-y-0 border-b border-border p-5 pr-14 text-left">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
              <ModeIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <DialogTitle className="text-base">
                {editing ? "Edit schedule item" : "Add schedule item"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                A single moment in your event&apos;s running order.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="shrink-0 space-y-2 border-b border-border px-5 py-3">
            <SegmentedTabs
              tabs={SCHEDULE_CONTENT_TYPES.map((t) => ({
                value: t.key,
                label: t.label,
                icon: t.icon,
              }))}
              value={mode}
              onChange={setMode}
              fullWidth
            />
            <p className="text-xs text-muted-foreground">{activeType.hint}</p>
          </div>

          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />

          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto md:grid-cols-2 md:overflow-hidden">
            <div className="min-h-0 divide-y divide-border border-border md:overflow-y-auto md:border-r">
              {mode === "text" ? (
                <>
                  <Group title="Details">
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,9.5rem)_minmax(0,1fr)]">
                      <Field label="Time" htmlFor="sched-time">
                        <EventTimeField
                          id="sched-time"
                          value={draft.time}
                          onChange={set("time")}
                        />
                        <LegacyTimeLabel
                          value={draft.time}
                          onClear={() => set("time")("")}
                        />
                      </Field>
                      <Field
                        label={<RequiredLabel>Title</RequiredLabel>}
                        htmlFor="sched-title"
                      >
                        <Input
                          id="sched-title"
                          ref={titleInput}
                          value={draft.title}
                          aria-invalid={!!errors.title}
                          onChange={(e) => set("title")(e.target.value)}
                          onKeyDown={submitOnEnter}
                          placeholder="e.g. Opening remarks"
                          autoFocus
                        />
                        <ErrorText>{errors.title}</ErrorText>
                      </Field>
                    </div>
                    <Field label="Description" htmlFor="sched-desc">
                      <Textarea
                        id="sched-desc"
                        rows={3}
                        value={draft.description}
                        onChange={(e) => set("description")(e.target.value)}
                        placeholder="What happens during this part of the event?"
                      />
                    </Field>
                  </Group>

                  <Group
                    title="Image"
                    hint="Optional. Uploads are compressed automatically."
                  >
                    {draft.image ? (
                      <div className="group relative overflow-hidden rounded-xl border border-border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={draft.image}
                          alt=""
                          className="aspect-[16/9] w-full object-cover"
                        />
                        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-3">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => fileInput.current?.click()}
                            className="border-white/20 bg-black/50 text-white backdrop-blur-sm hover:bg-black/70 hover:text-white"
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
                            className="border-white/20 bg-black/50 text-white backdrop-blur-sm hover:border-red-400/40 hover:bg-red-500/25 hover:text-red-100"
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
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={onDrop}
                        className={cn(
                          "flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed transition-colors disabled:opacity-60",
                          dragging
                            ? "border-primary bg-primary/10 text-foreground"
                            : "border-border bg-surface-card text-muted-foreground hover:border-border-strong hover:text-foreground",
                        )}
                      >
                        {busy ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <UploadCloud className="h-5 w-5" />
                        )}
                        <span className="text-sm">
                          {busy ? "Uploading…" : "Drop an image, or click to browse"}
                        </span>
                        {!busy ? (
                          <span className="text-xs text-muted-foreground">
                            PNG, JPG, GIF or WebP
                          </span>
                        ) : null}
                      </button>
                    )}

                    {draft.image ? (
                      <div className="space-y-3">
                        <ChoiceRow
                          label="Position"
                          value={draft.imagePosition || "left"}
                          onChange={set("imagePosition")}
                          options={SCHEDULE_IMAGE_POSITIONS}
                          render={(o) => <PositionArt kind={o.key} />}
                        />
                        <ChoiceRow
                          label="Fit"
                          value={draft.imageFit || "cover"}
                          onChange={set("imageFit")}
                          options={SCHEDULE_IMAGE_FITS}
                          render={(o) => <FitArt kind={o.key} src={draft.image} />}
                        />
                      </div>
                    ) : null}
                  </Group>
                </>
              ) : null}

              {mode === "clip" ? (
                <>
                  <Group title="Source">
                    {clipped ? (
                      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface-card py-2.5 pl-3 pr-2">
                        <Globe className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm text-foreground">
                            {clipHost || "Clipped component"}
                          </p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {draft.clip?.source?.selector}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center">
                          {draft.clip?.source?.url ? (
                            <Button variant="ghost" size="icon-sm" asChild>
                              <a
                                href={draft.clip.source.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open the original page"
                                aria-label="Open the original page"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </Button>
                          ) : null}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setClipOpen(true)}
                            title="Re-clip from the source page"
                            aria-label="Re-clip from the source page"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => set("clip")(null)}
                            title="Remove this clip"
                            aria-label="Remove this clip"
                            className="hover:bg-red-500/10 hover:text-red-400"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setClipOpen(true)}
                          className={cn(
                            "flex h-32 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed bg-surface-card transition-colors",
                            errors.clip
                              ? "border-destructive text-foreground"
                              : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground",
                          )}
                        >
                          <Globe className="h-5 w-5" />
                          <span className="text-sm">Clip a component from a URL</span>
                          <span className="text-xs text-muted-foreground">
                            Hover the page, pick the piece you want
                          </span>
                        </button>
                        <ErrorText>{errors.clip}</ErrorText>
                      </>
                    )}

                    <Field
                      label="Internal label"
                      hint="Only shown in this list, to help you find it again."
                      htmlFor="sched-clip-title"
                    >
                      <Input
                        id="sched-clip-title"
                        value={draft.title}
                        onChange={(e) => set("title")(e.target.value)}
                        onKeyDown={submitOnEnter}
                        placeholder="e.g. Pricing table"
                      />
                    </Field>
                  </Group>

                  {clipped ? (
                    <Group>
                      <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="appearance" className="border-border">
                          <AccordionTrigger className="py-3 hover:no-underline">
                            Appearance
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4">
                            <ClipAppearance
                              clip={draft.clip}
                              onChange={(next) => set("clip")(next)}
                            />
                          </AccordionContent>
                        </AccordionItem>
                        <AccordionItem value="contents" className="border-border">
                          <AccordionTrigger className="py-3 hover:no-underline">
                            Contents
                          </AccordionTrigger>
                          <AccordionContent className="space-y-3">
                            <p className="text-xs text-muted-foreground">
                              Strip the containers the component was sitting in, or
                              remove parts you don&apos;t want.
                            </p>
                            <ClipPruner
                              clip={draft.clip}
                              onChange={(next) => set("clip")(next)}
                            />
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </Group>
                  ) : null}
                </>
              ) : null}

              {mode === "html" ? (
                <Group
                  title="Markup"
                  hint="Rendered verbatim on the public page. Scripts are not executed."
                >
                  <Textarea
                    id="sched-html"
                    aria-label="HTML"
                    aria-invalid={!!errors.description}
                    className="min-h-[18rem] font-mono text-xs"
                    spellCheck={false}
                    value={draft.description}
                    onChange={(e) => set("description")(e.target.value)}
                    placeholder={'<div class="rounded-xl border border-border p-4">…</div>'}
                  />
                  <ErrorText>{errors.description}</ErrorText>
                </Group>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-col border-t border-border bg-surface-subtle md:border-t-0">
              <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Preview
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Eye className="h-3.5 w-3.5" /> Schedule section
                </span>
              </div>
              <div className="min-h-0 flex-1 p-5 md:overflow-y-auto">
                {previewEmpty ? (
                  <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-6 text-center">
                    <p className="text-sm text-muted-foreground">Nothing to show yet</p>
                    <p className="text-xs text-muted-foreground">
                      Your item takes shape here as you fill it in.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-border bg-surface-card p-4">
                    <ScheduleSlot slot={draft} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="shrink-0 items-center border-t border-border bg-surface-subtle/40 px-5 py-4 sm:justify-between">
            <p className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
              <KbdGroup>
                <Kbd>{modKey}</Kbd>
                <Kbd>↵</Kbd>
              </KbdGroup>
              To Save
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={submit} disabled={busy}>
                {editing ? "Save item" : "Add Item"}
              </Button>
            </div>
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

export default ScheduleItemDialog;
