"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  Pencil,
  Clock,
  UploadCloud,
  Loader2,
  Image as ImgIcon,
} from "lucide-react";

import { EditorSectionHeader, Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
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
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  uploadEventImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";

// Per-event schedule editor. Each item — { id, time, title, description, image }
// — is stored in the event's metadata bag (like tickets/questions) via
// useEventConfig, so the timeline grows without a migration and rehydrates on
// reload. The public page renders these in the Schedule block (page_blocks.jsx).
// Item images live in the shared event-media bucket through uploadEventImage.

const EMPTY_ITEM = { time: "", title: "", description: "", image: "" };

// Author or edit a single schedule item — a required title plus an optional
// time, description, and image. Matches the suite's create-dialog rhythm.
function ScheduleItemDialog({ open, onOpenChange, eventId, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_ITEM);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

  // Re-seed the draft whenever the dialog opens (render-phase reset — React's
  // recommended alternative to a setState-in-effect).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial || EMPTY_ITEM);
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

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
    // Drop the previous image when replacing one.
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
    if (!draft.title.trim()) {
      toast.error("Give the item a title first.");
      return;
    }
    onSave({
      time: draft.time.trim(),
      title: draft.title.trim(),
      description: draft.description.trim(),
      image: draft.image || "",
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>
            {initial ? "Edit schedule item" : "Add schedule item"}
          </DialogTitle>
          <DialogDescription>
            A moment in your event&apos;s timeline. Give it a title, and
            optionally a time, a description, and an image.
          </DialogDescription>
        </DialogHeader>

        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFile}
        />

        <div className="grid gap-4">
          <Field label="Time" hint="Optional" htmlFor="sched-time">
            <Input
              id="sched-time"
              value={draft.time}
              onChange={(e) => set("time")(e.target.value)}
              placeholder="e.g. 6:30 PM"
            />
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
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
                    className="border-border bg-black/40 text-white hover:bg-red-500/30"
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
                className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground disabled:opacity-60"
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
            onClick={submit}
          >
            {initial ? "Save item" : "Add item"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleSection({ event, headerItem }) {
  const [items, , saveItems] = useEventConfig(event, "schedule", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, item } | null

  const addItem = (item) =>
    saveItems([...items, { ...item, id: `sch_${Date.now()}` }], {
      successMsg: "Schedule item added.",
    });

  const updateItem = (index, item) =>
    saveItems(
      items.map((it, i) => (i === index ? { ...it, ...item } : it)),
      { successMsg: "Schedule item updated." },
    );

  const removeItem = (index) => {
    const target = items[index];
    saveItems(items.filter((_, i) => i !== index));
    const path = pathFromPublicUrl(target?.image);
    if (path) removeEventImage(path);
  };

  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= items.length) return;
    const copy = [...items];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveItems(copy);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Schedule"}
        description={
          headerItem?.desc ||
          "Build your event's running order. Items appear in this order in the Schedule section of your public page."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add item
          </Button>
        }
      />

      {items.length ? (
          <div className="space-y-2">
            {items.map((it, i) => (
              <div
                key={it.id || i}
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
              >
                <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-text-tertiary" />
                {it.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={it.image}
                    alt=""
                    className="h-12 w-16 shrink-0 rounded-md border border-border object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-16 shrink-0 items-center justify-center rounded-md border border-border bg-surface-subtle text-text-tertiary">
                    <ImgIcon className="h-4 w-4" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {it.time ? (
                      <span className="shrink-0 text-xs font-medium tabular-nums text-text-secondary">
                        {it.time}
                      </span>
                    ) : null}
                    <p className="truncate text-sm font-medium text-foreground">
                      {it.title}
                    </p>
                  </div>
                  {it.description ? (
                    <p className="mt-0.5 truncate text-xs text-text-secondary">
                      {it.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing({ index: i, item: it })}
                    aria-label="Edit item"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => removeItem(i)}
                    aria-label="Delete item"
                    className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
          >
            <Clock className="h-6 w-6" />
            <p className="text-sm">Add your first schedule item</p>
          </button>
        )}

      <ScheduleItemDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        eventId={event.id}
        onSave={addItem}
      />
      <ScheduleItemDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        eventId={event.id}
        initial={editing?.item}
        onSave={(item) => {
          updateItem(editing.index, item);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default ScheduleSection;
