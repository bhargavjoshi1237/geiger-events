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
  ArrowUp,
  ArrowDown,
  Image as ImgIcon,
  Star,
  Loader2,
  Crown,
  Lock,
  X,
  ChevronDown,
  Link2 as LinkIcon,
  Settings2,
  Play,
} from "lucide-react";

import {
  Field,
  SectionCard,
  EditorSectionHeader,
  SettingsList,
  SettingRow,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Switch } from "@geiger/ui/switch";
import { cn } from "@/lib/utils";
import { getUser } from "@/lib/supabase/user";
import {
  uploadEventImage,
  uploadEventVideo,
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
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import {
  GALLERY_LAYOUTS,
  GALLERY_SLIDES_OPTIONS,
  GALLERY_ITEM_FIT_OPTIONS,
  GALLERY_LINK_TYPE_OPTIONS,
  DEFAULT_GALLERY,
  resolveGallery,
  galleryItem,
  isSupportedMediaUrl,
  entryUrl,
  patchGalleryItem,
  fitClass,
  coverKind,
} from "@/lib/events/gallery";
import { Segmented } from "./theme_controls";

function AddByLinkDialog({ open, onOpenChange, onAdd }) {
  const [url, setUrl] = useState("");
  const [type, setType] = useState("auto");

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setUrl("");
      setType("auto");
    }
  }

  const submit = () => {
    const value = url.trim();
    if (!isSupportedMediaUrl(value)) {
      toast.error("Paste a full http(s) link.");
      return;
    }
    onAdd(value, type);
    onOpenChange(false);
  };

  const preview = url.trim() ? galleryItem({ url: url.trim(), type }) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Add from a link</DialogTitle>
          <DialogDescription>
            An image URL, a YouTube link, or a direct video file link.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <Field label="Link" htmlFor="gallery-link">
            <Input
              id="gallery-link"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="https://youtube.com/watch?v=… or https://…/photo.jpg"
              autoFocus
            />
          </Field>
          <Field
            label="Type"
            hint="Auto-detect misses video links with no recognizable extension — pick it manually if the preview below looks wrong."
          >
            <Segmented value={type} onChange={setType} options={GALLERY_LINK_TYPE_OPTIONS} />
          </Field>
          {preview?.kind === "video" ? (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card p-3">
              {preview.format === "youtube" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.thumbUrl}
                  alt=""
                  className="h-12 w-20 shrink-0 rounded object-cover"
                />
              ) : (
                <video
                  src={preview.url}
                  muted
                  preload="metadata"
                  className="h-12 w-20 shrink-0 rounded bg-black object-cover"
                />
              )}
              <p className="text-xs text-text-secondary">
                {preview.format === "youtube"
                  ? "YouTube video — plays in a lightbox on your event page."
                  : "Video file — plays in a lightbox on your event page."}
              </p>
            </div>
          ) : null}
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
            Add to gallery
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GalleryLayoutDialog({ open, onOpenChange, gallery, onChange }) {
  const isCarousel = gallery.layout === "carousel";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Gallery layout</DialogTitle>
          <DialogDescription>
            How these images and videos are shown on your public event page.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Layout" hint="Grid is a fixed strip; carousel scrolls.">
              <Segmented
                value={gallery.layout}
                onChange={onChange("layout")}
                options={GALLERY_LAYOUTS}
              />
            </Field>
            {isCarousel ? (
              <Field
                label="Slides across"
                hint="At desktop width; narrower screens step down."
              >
                <Segmented
                  value={gallery.slidesPerView}
                  onChange={onChange("slidesPerView")}
                  options={GALLERY_SLIDES_OPTIONS}
                />
              </Field>
            ) : null}
          </div>

          {isCarousel ? (
            <>
              <SettingsList>
                <SettingRow
                  title="Arrows"
                  description="Previous / next buttons over the edges."
                  checked={gallery.arrows}
                  onCheckedChange={onChange("arrows")}
                />
                <SettingRow
                  title="Dots"
                  description="Position indicators below the images."
                  checked={gallery.dots}
                  onCheckedChange={onChange("dots")}
                />
                <SettingRow
                  title="Loop"
                  description="Wrap from the last item back to the first."
                  checked={gallery.loop}
                  onCheckedChange={onChange("loop")}
                />
                <SettingRow
                  title="Autoplay"
                  description="Advance on its own. Pauses on hover and while a visitor is interacting."
                  checked={gallery.autoplay}
                  onCheckedChange={onChange("autoplay")}
                />
              </SettingsList>
              {gallery.autoplay ? (
                <Field
                  label="Seconds per slide"
                  hint="Visitors who ask their system for reduced motion never get autoplay."
                >
                  <Input
                    type="number"
                    min="1"
                    max="60"
                    step="1"
                    value={gallery.autoplaySeconds}
                    onChange={(e) =>
                      onChange("autoplaySeconds")(Number(e.target.value) || 5)
                    }
                    className="max-w-[8rem]"
                  />
                </Field>
              ) : null}
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GalleryItemSettingsDialog({ open, onOpenChange, item, onChange }) {
  if (!item) return null;
  const isVideo = item.kind === "video";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-background">
        <DialogHeader>
          <DialogTitle>{isVideo ? "Video settings" : "Image settings"}</DialogTitle>
          <DialogDescription>
            {isVideo
              ? "How this video behaves once a visitor opens it."
              : "How this image fills its frame in the gallery."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card p-3">
          {isVideo && item.format === "file" ? (
            <video
              src={item.url}
              muted
              preload="metadata"
              className="h-12 w-20 shrink-0 rounded bg-black object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbUrl}
              alt=""
              className="h-12 w-20 shrink-0 rounded object-cover"
            />
          )}
          <p className="truncate text-xs text-text-secondary">{item.url}</p>
        </div>
        <Field
          label="Type"
          hint="Auto-detect misses video links with no recognizable extension — pick it manually if this looks wrong."
        >
          <Segmented
            value={item.type}
            onChange={(v) => onChange({ type: v })}
            options={GALLERY_LINK_TYPE_OPTIONS}
          />
        </Field>
        {isVideo ? (
          <SettingsList>
            <SettingRow
              title="Autoplay"
              description="Starts playing as soon as the lightbox opens."
              checked={item.autoplay}
              onCheckedChange={(v) => onChange({ autoplay: v })}
            />
            <SettingRow
              title="Muted"
              description="Starts without sound — browsers require this for autoplay."
              checked={item.muted}
              onCheckedChange={(v) => onChange({ muted: v })}
            />
            <SettingRow
              title="Loop"
              description="Starts over automatically when it ends."
              checked={item.loop}
              onCheckedChange={(v) => onChange({ loop: v })}
            />
          </SettingsList>
        ) : (
          <Field label="Fit" hint="How the image is cropped or scaled within its tile.">
            <Segmented
              value={item.fit}
              onChange={(v) => onChange({ fit: v })}
              options={GALLERY_ITEM_FIT_OPTIONS}
            />
          </Field>
        )}
        <DialogFooter>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => onOpenChange(false)}
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CoverMediaSection({ event, onCommit }) {
  const commit = onCommit || (() => {});
  const cover = event.coverUrl || "";
  const gallery = Array.isArray(event.gallery) ? event.gallery : [];

  const [me, setMe] = useState(null);
  const [meResolved, setMeResolved] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [compress, setCompress] = useState(true);
  const [linkOpen, setLinkOpen] = useState(false);
  const [layoutOpen, setLayoutOpen] = useState(false);
  const [itemSettingsUrl, setItemSettingsUrl] = useState(null);
  const coverInput = useRef(null);
  const galleryInput = useRef(null);

  const [rawDisplay, , saveDisplay] = useEventConfig(
    event,
    "galleryDisplay",
    DEFAULT_GALLERY,
  );
  const display = resolveGallery(rawDisplay);
  const setDisplay = (key) => (value) =>
    saveDisplay({ ...display, [key]: value });

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
    if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
      toast.error("Please choose an image or video file.");
      return;
    }
    const isVideo = file.type.startsWith("video/");
    setCoverBusy(true);
    const res = isVideo
      ? await uploadEventVideo(event.id, file)
      : await uploadEventImage(event.id, file, { compress });
    setCoverBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the event's creator can add media.");
      return;
    }
    const old = cover;
    commit({ coverUrl: res.url });
    toast.success(isVideo ? "Cover video updated." : "Cover image updated.");
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const removeCover = () => {
    const path = pathFromPublicUrl(cover);
    commit({ coverUrl: "" });
    toast.success("Cover removed.");
    if (path) removeEventImage(path);
  };

  const onGalleryFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length) return;
    setGalleryBusy(true);
    const urls = [];
    let videos = 0;
    for (const file of files) {
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/"))
        continue;
      if (file.type.startsWith("video/")) {
        videos += 1;
        const res = await uploadEventVideo(event.id, file);
        if (res?.url) urls.push(res.url);
      } else {
        const res = await uploadEventImage(event.id, file, { compress });
        if (res?.url) urls.push(res.url);
      }
    }
    setGalleryBusy(false);
    if (!urls.length) {
      toast.error("Upload failed — only the event's creator can add media.");
      return;
    }
    commit({ gallery: [...gallery, ...urls] });
    toast.success(
      videos
        ? `${urls.length} item${urls.length > 1 ? "s" : ""} added.`
        : `${urls.length} photo${urls.length > 1 ? "s" : ""} added.`,
    );
  };

  const addGalleryLink = (url, type = "auto") => {
    if (gallery.some((g) => entryUrl(g) === url)) {
      toast.error("That link is already in the gallery.");
      return;
    }
    const entry = type === "auto" ? url : { url, type };
    commit({ gallery: [...gallery, entry] });
    toast.success(
      galleryItem(entry).kind === "video" ? "Video added." : "Image added.",
    );
  };

  const removeGalleryImage = (url) => {
    const path = pathFromPublicUrl(url);
    commit({ gallery: gallery.filter((g) => entryUrl(g) !== url) });
    if (path) removeEventImage(path);
  };

  const [removeTarget, setRemoveTarget] = useState(null);

  const handleRemove = () => {
    if (!removeTarget) return;
    if (removeTarget.kind === "cover") removeCover();
    else removeGalleryImage(removeTarget.url);
    setRemoveTarget(null);
  };

  const setAsCover = (url) => {
    commit({ coverUrl: url });
    toast.success("Cover updated.");
  };

  const patchItemSettings = (url, patch) => {
    commit({ gallery: patchGalleryItem(gallery, url, patch) });
  };

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
            coverKind(cover) === "video" ? (
              <video
                src={cover}
                muted
                loop
                playsInline
                autoPlay
                className="aspect-[16/9] w-full rounded-xl border border-border bg-black object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt="Event cover"
                className="aspect-[16/9] w-full rounded-xl border border-border object-cover"
              />
            )
          ) : (
            <div className="flex aspect-[16/9] w-full items-center justify-center rounded-xl border border-dashed border-border bg-surface-card text-text-tertiary">
              <ImageIcon className="h-8 w-8" />
            </div>
          )}
        </SectionCard>
        {gallery.length ? (
          <SectionCard title="Gallery">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {gallery.map((entry) => {
                const item = galleryItem(entry);
                return (
                  <div
                    key={item.url}
                    className="relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-card"
                  >
                    {item.kind === "video" && item.format === "file" ? (
                      <video
                        src={item.url}
                        muted
                        preload="metadata"
                        className={cn("h-full w-full bg-black", fitClass(item.fit))}
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.thumbUrl}
                        alt=""
                        className={cn("h-full w-full", fitClass(item.fit))}
                      />
                    )}
                    {item.kind === "video" ? (
                      <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
                          <Play className="ml-0.5 h-4 w-4 fill-current" />
                        </span>
                      </span>
                    ) : null}
                  </div>
                );
              })}
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
        accept="image/*,video/*"
        className="hidden"
        onChange={onCoverFile}
      />
      <input
        ref={galleryInput}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={onGalleryFiles}
      />

        {cover ? (
          <div className="group relative overflow-hidden rounded-xl border border-border">
            {coverKind(cover) === "video" ? (
              <video
                src={cover}
                muted
                loop
                playsInline
                autoPlay
                className="aspect-[16/9] w-full bg-black object-cover"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={cover}
                alt="Event cover"
                className="aspect-[16/9] w-full object-cover"
              />
            )}
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
                onClick={() => setRemoveTarget({ kind: "cover" })}
                className="border-border bg-black/40 text-white hover:bg-red-500/10 hover:text-red-300"
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
                {coverBusy ? "Uploading…" : "Click to upload a cover image or video"}
              </p>
              <p className="text-xs">16:9 · images optimized automatically</p>
            </div>
          </button>
        )}

      <SectionCard
        title="Gallery"
        description="Extra photos and videos shown lower on the event page."
        action={
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={galleryBusy}
                  className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                >
                  {galleryBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Add media
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="border-border bg-surface-subtle">
                <DropdownMenuItem onSelect={() => galleryInput.current?.click()}>
                  <UploadCloud className="h-4 w-4" /> Upload media
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setLinkOpen(true)}>
                  <LinkIcon className="h-4 w-4" /> Add from a link
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              size="icon-sm"
              variant="outline"
              aria-label="Gallery layout settings"
              onClick={() => setLayoutOpen(true)}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </Button>
          </div>
        }
      >
        {gallery.length === 0 && !galleryBusy ? (
          <button
            type="button"
            onClick={() => galleryInput.current?.click()}
            className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
          >
            <ImgIcon className="h-6 w-6" />
            <p className="text-sm">Add photos or videos to your event page</p>
          </button>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {gallery.map((entry) => {
              const item = galleryItem(entry);
              const url = item.url;
              return (
              <div
                key={url}
                className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-surface-card"
              >
                {item.kind === "video" && item.format === "file" ? (
                  <video
                    src={item.url}
                    muted
                    preload="metadata"
                    className={cn("h-full w-full bg-black", fitClass(item.fit))}
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.thumbUrl}
                    alt=""
                    className={cn("h-full w-full", fitClass(item.fit))}
                  />
                )}
                {item.kind === "video" ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white">
                      <Play className="ml-0.5 h-4 w-4 fill-current" />
                    </span>
                  </span>
                ) : null}
                {item.kind === "video" && item.format === "youtube" ? null : cover === url ? null : (
                  <button
                    type="button"
                    onClick={() => setAsCover(url)}
                    title="Set as cover"
                    aria-label="Set as cover"
                    className="absolute left-2 top-2 rounded-md bg-black/60 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Star className="h-3.5 w-3.5" />
                  </button>
                )}
                {cover === url ? (
                  <Badge variant="info" className="absolute left-2 top-2">
                    <Star className="h-3 w-3" /> Cover
                  </Badge>
                ) : null}
                <button
                  type="button"
                  onClick={() => setItemSettingsUrl(url)}
                  title={item.kind === "video" ? "Video settings" : "Image settings"}
                  aria-label={item.kind === "video" ? "Video settings" : "Image settings"}
                  className="absolute bottom-2 right-2 rounded-md bg-black/60 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Settings2 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setRemoveTarget({ kind: "gallery", url })}
                  title="Remove"
                  aria-label="Remove from gallery"
                  className="absolute right-2 top-2 rounded-md bg-black/60 p-1 text-muted-foreground opacity-0 transition-opacity hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              );
            })}
            {galleryBusy ? (
              <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-border bg-surface-card text-text-tertiary">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : null}
          </div>
        )}
      </SectionCard>

      <AddByLinkDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        onAdd={addGalleryLink}
      />
      <GalleryLayoutDialog
        open={layoutOpen}
        onOpenChange={setLayoutOpen}
        gallery={display}
        onChange={setDisplay}
      />
      <GalleryItemSettingsDialog
        open={Boolean(itemSettingsUrl)}
        onOpenChange={(v) => !v && setItemSettingsUrl(null)}
        item={
          itemSettingsUrl
            ? galleryItem(
                gallery.find((g) => entryUrl(g) === itemSettingsUrl) ||
                  itemSettingsUrl,
              )
            : null
        }
        onChange={(patch) => patchItemSettings(itemSettingsUrl, patch)}
      />
      <Dialog
        open={!!removeTarget}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove media</DialogTitle>
            <DialogDescription>
              {removeTarget?.kind === "cover"
                ? "The cover will no longer be shown on your event page. This can't be undone."
                : "This item will be removed from the gallery. This can't be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={handleRemove}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const SNIPPETS = [
  { label: "What to expect", body: "## What to expect\n\n- \n- \n- \n" },
  {
    label: "How to get there",
    body: "## How to get there\n\nDoors open 30 minutes before the start. Nearest transport:\n\n- \n",
  },
  {
    label: "Refund policy",
    body: "## Refund policy\n\nTickets are refundable up to 7 days before the event.\n",
  },
  {
    label: "Code of conduct",
    body: "## Code of conduct\n\nWe expect all attendees to treat each other with respect.\n",
  },
];

export function RichDescriptionsSection({ event }) {
  const [text, setText, saveText, saving] = useEventConfig(
    event,
    "description",
    "",
  );
  const [blocksOpen, setBlocksOpen] = useState(false);
  const editor = useRef(null);

  const insertSnippet = (snippet) => {
    const el = editor.current;
    const at = el ? el.selectionStart : text.length;
    const before = text.slice(0, at);
    const after = text.slice(at);
    const lead = before && !before.endsWith("\n\n") ? "\n\n" : "";
    const tail = after && !after.startsWith("\n") ? "\n" : "";
    const next = `${before}${lead}${snippet.body}${tail}${after}`;
    setText(next);
    toast.success(`Inserted "${snippet.label}" block.`);
    requestAnimationFrame(() => {
      const caret = (before + lead + snippet.body).length;
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Description" bodyPadding={false}>
        <div className="flex items-center gap-1 border-b border-border px-3 py-2">
          <Button
            variant="ghost"
            size="sm"
            aria-expanded={blocksOpen}
            onClick={() => setBlocksOpen((v) => !v)}
            className={cn(
              "ml-auto text-muted-foreground hover:bg-surface-active hover:text-foreground",
              blocksOpen && "bg-surface-active text-foreground",
            )}
          >
            <ClipboardList className="h-4 w-4" />
            Saved Blocks
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                blocksOpen && "rotate-180",
              )}
            />
          </Button>
        </div>
        {blocksOpen ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-card px-3 py-2.5">
            {SNIPPETS.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => insertSnippet(s)}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface-subtle px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-active hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5 text-text-secondary" />
                {s.label}
              </button>
            ))}
          </div>
        ) : null}
        <div className="p-4">
          <Textarea
            ref={editor}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder={
              "Tell attendees what this event is and why it's worth their time.\n\nSupports **bold**, *italic*, [links](https://…), ## headings, and - bullet lists."
            }
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
    </div>
  );
}

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

  const moveQuestion = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= questions.length) return;
    const copy = [...questions];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveQuestions(copy);
  };

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
        {questions.map((q, i) => (
          <div
            key={q.id}
            className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {q.label}
              </p>
              <p className="text-xs text-text-secondary">{typeLabel(q.type)}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={i === 0}
              onClick={() => moveQuestion(i, -1)}
              aria-label="Move up"
              className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
            >
              <ArrowUp className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              disabled={i === questions.length - 1}
              onClick={() => moveQuestion(i, 1)}
              aria-label="Move down"
              className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
            >
              <ArrowDown className="h-4 w-4" />
            </Button>
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addQuestion();
                  }
                }}
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
