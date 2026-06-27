"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ImageIcon,
  FileText,
  ClipboardList,
  UploadCloud,
  Plus,
  Trash2,
  GripVertical,
  Bold,
  Italic,
  List,
  Link2,
  Heading,
  Image as ImgIcon,
  Star,
  Loader2,
  Crown,
  Lock,
  X,
} from "lucide-react";

import {
  Field,
  SectionCard,
  EditorSectionHeader,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getUser } from "@/lib/supabase/user";
import {
  uploadEventImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";
import { useEventConfig } from "@/lib/events/use-event-config";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CoverMediaSection({ event, onCommit }) {
  const commit = onCommit || (() => {});
  const cover = event.coverUrl || "";
  const gallery = Array.isArray(event.gallery) ? event.gallery : [];

  const [me, setMe] = useState(null);
  const [meResolved, setMeResolved] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [compress, setCompress] = useState(true); // Pro placeholder — locked on
  const coverInput = useRef(null);
  const galleryInput = useRef(null);

  useEffect(() => {
    let alive = true;
    getUser().then((u) => {
      if (!alive) return;
      setMe(u?.id || null);
      setMeResolved(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const isOwner = Boolean(me && event.createdBy && me === event.createdBy);

  const onCoverFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setCoverBusy(true);
    const res = await uploadEventImage(event.id, file, { compress });
    setCoverBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the event's creator can add images.");
      return;
    }
    const old = cover;
    commit({ coverUrl: res.url });
    toast.success("Cover image updated.");
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const removeCover = () => {
    const path = pathFromPublicUrl(cover);
    commit({ coverUrl: "" });
    toast.success("Cover image removed.");
    if (path) removeEventImage(path);
  };

  const onGalleryFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setGalleryBusy(true);
    const urls = [];
    for (const file of files) {
      if (!file.type.startsWith("image/")) continue;
      const res = await uploadEventImage(event.id, file, { compress });
      if (res?.url) urls.push(res.url);
    }
    setGalleryBusy(false);
    if (!urls.length) {
      toast.error("Upload failed — only the event's creator can add images.");
      return;
    }
    commit({ gallery: [...gallery, ...urls] });
    toast.success(`${urls.length} photo${urls.length > 1 ? "s" : ""} added.`);
  };

  const removeGalleryImage = (url) => {
    const path = pathFromPublicUrl(url);
    commit({ gallery: gallery.filter((g) => g !== url) });
    if (path) removeEventImage(path);
  };

  const setAsCover = (url) => {
    commit({ coverUrl: url });
    toast.success("Cover image updated.");
  };

  // Read-only view: not the creator (or a seeded event with no owner).
  if (meResolved && !isOwner) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          <p className="text-sm text-amber-200/90">
            Only the event&apos;s creator can upload or change its images.
            {me ? "" : " Sign in as the creator to manage media."}
          </p>
        </div>
        <SectionCard title="Cover image">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt="Event cover"
              className="aspect-[16/9] w-full rounded-xl border border-border object-cover"
            />
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-card text-text-tertiary">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
        </SectionCard>
        {gallery.length ? (
          <SectionCard title="Gallery">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {gallery.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="aspect-square w-full rounded-lg border border-border object-cover"
                />
              ))}
            </div>
          </SectionCard>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        ref={coverInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onCoverFile}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onGalleryFiles}
      />

        {cover ? (
          <div className="group relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover}
              alt="Event cover"
              className="aspect-[16/9] w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-3">
              <Button
                size="sm"
                variant="outline"
                disabled={coverBusy}
                onClick={() => coverInput.current?.click()}
                className="border-border bg-black/40 text-white hover:bg-black/60"
              >
                {coverBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UploadCloud className="h-4 w-4" />
                )}
                Replace
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={coverBusy}
                onClick={removeCover}
                className="border-border bg-black/40 text-white hover:bg-red-500/30"
              >
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={coverBusy}
            onClick={() => coverInput.current?.click()}
            className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-surface-card text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground disabled:opacity-60"
          >
            {coverBusy ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <UploadCloud className="h-8 w-8" />
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                {coverBusy ? "Uploading…" : "Click to upload a cover image"}
              </p>
              <p className="text-xs">16:9 · optimized automatically</p>
            </div>
          </button>
        )}

      <SectionCard
        title="Gallery"
        description="Extra photos shown lower on the event page."
        action={
          <Button
            size="sm"
            variant="outline"
            disabled={galleryBusy}
            onClick={() => galleryInput.current?.click()}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            {galleryBusy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add photos
          </Button>
        }
      >
        {gallery.length === 0 && !galleryBusy ? (
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
          >
            <ImgIcon className="h-6 w-6" />
            <p className="text-sm">Add photos to your event page</p>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {gallery.map((url) => (
              <div
                key={url}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-card"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="h-full w-full object-cover" />
                {cover === url ? (
                  <Badge variant="info" className="absolute left-2 top-2">
                    <Star className="h-3 w-3" /> Cover
                  </Badge>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAsCover(url)}
                    title="Set as cover"
                    className="absolute left-2 top-2 rounded-md bg-black/60 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => removeGalleryImage(url)}
                  title="Remove"
                  className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            {galleryBusy ? (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-surface-card text-text-tertiary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

// --- Rich Descriptions -------------------------------------------------------

const TOOLBAR = [
  { icon: Heading, label: "Heading" },
  { icon: Bold, label: "Bold" },
  { icon: Italic, label: "Italic" },
  { icon: List, label: "List" },
  { icon: Link2, label: "Link" },
  { icon: ImgIcon, label: "Image" },
];

const SNIPPETS = [
  "What to expect",
  "How to get there",
  "Refund policy",
  "Code of conduct",
];

export function RichDescriptionsSection({ event }) {
  const [text, setText, saveText, saving] = useEventConfig(
    event,
    "description",
    "Join us for an evening of talks and networking.\n\nDoors open at 6:30pm. Drinks and snacks provided. Bring a friend!",
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
        <SectionCard title="Description" bodyPadding={false}>
          <div className="flex items-center gap-1 border-b border-border px-3 py-2">
            {TOOLBAR.map((t) => {
              const Icon = t.icon;
              return (
                <Button
                  key={t.label}
                  variant="ghost"
                  size="icon-sm"
                  title={t.label}
                  className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  <Icon className="h-4 w-4" />
                </Button>
              );
            })}
          </div>
          <div className="p-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={12}
              className="border-0 bg-transparent px-0 focus-visible:ring-0"
            />
          </div>
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-text-tertiary">
              {text.length} characters
            </span>
            <Button
              size="sm"
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => saveText(text, { successMsg: "Description saved." })}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
          </div>
        </SectionCard>

        <SectionCard
          title="Saved blocks"
          description="Insert reusable sections."
        >
          <div className="space-y-2">
            {SNIPPETS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => toast.success(`Inserted "${s}" block.`)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-surface-active"
              >
                {s}
                <Plus className="h-4 w-4 text-text-secondary" />
              </button>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

// --- Custom Questions --------------------------------------------------------

const QUESTION_TYPES = [
  { value: "short", label: "Short text" },
  { value: "long", label: "Paragraph" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkboxes" },
  { value: "number", label: "Number" },
];

const INITIAL_QUESTIONS = [
  { id: 1, label: "Full name", type: "short", required: true },
  { id: 2, label: "Dietary requirements", type: "select", required: false },
  { id: 3, label: "T-shirt size", type: "select", required: false },
  { id: 4, label: "How did you hear about us?", type: "long", required: false },
];

export function CustomQuestionsSection({ event, headerItem }) {
  const [questions, , saveQuestions] = useEventConfig(
    event,
    "questions",
    INITIAL_QUESTIONS,
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState({ label: "", type: "short", required: false });

  const typeLabel = (v) =>
    QUESTION_TYPES.find((t) => t.value === v)?.label || v;

  const addQuestion = () => {
    if (!draft.label.trim()) {
      toast.error("Add a question label.");
      return;
    }
    saveQuestions([...questions, { ...draft, id: Date.now() }], {
      successMsg: "Question added.",
    });
    setDraft({ label: "", type: "short", required: false });
    setOpen(false);
  };

  const remove = (id) => saveQuestions(questions.filter((x) => x.id !== id));
  const toggleRequired = (id) =>
    saveQuestions(
      questions.map((x) => (x.id === id ? { ...x, required: !x.required } : x)),
    );

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Custom Questions"}
        description={
          headerItem?.desc ||
          "Questions appear in this order on the registration page."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add question
          </Button>
        }
      />
      <div className="space-y-2">
        {questions.map((q) => (
          <div
            key={q.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
          >
            <GripVertical className="h-4 w-4 shrink-0 cursor-grab text-text-tertiary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {q.label}
              </p>
              <p className="text-xs text-text-secondary">{typeLabel(q.type)}</p>
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              Required
              <Switch
                checked={q.required}
                onCheckedChange={() => toggleRequired(q.id)}
              />
            </label>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
              onClick={() => remove(q.id)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add question</DialogTitle>
            <DialogDescription>
              Create a custom field for your registration form.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <Field label="Question label">
              <Input
                value={draft.label}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, label: e.target.value }))
                }
                placeholder="e.g. Dietary requirements"
              />
            </Field>
            <Field label="Answer type">
              <Select
                value={draft.type}
                onValueChange={(v) => setDraft((d) => ({ ...d, type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUESTION_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <label className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5 text-sm text-muted-foreground">
              Required question
              <Switch
                checked={draft.required}
                onCheckedChange={(v) =>
                  setDraft((d) => ({ ...d, required: v }))
                }
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={addQuestion}
            >
              Add question
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
