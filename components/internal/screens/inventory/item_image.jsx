"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ImagePlus, Loader2, Trash2, UploadCloud, X } from "lucide-react";

import { Button } from "@geiger/ui/button";
import { cn } from "@/lib/utils";
import { getUser } from "@/lib/supabase/user";
import {
  uploadInventoryImage,
  removeEventImage,
  pathFromPublicUrl,
} from "@/lib/supabase/storage";

import { CATEGORY_ICONS } from "./constants";

// Product photos for the Inventory area. Stored in the public "products" bucket
// under inventory/<item-id>/ and persisted as a direct public URL in
// inventory_items.image_url — the same contract events and venues use.
//
// Three surfaces:
//   ItemThumb        — the square thumbnail every list/table row leads with
//   ItemImageCard    — upload / replace / remove, inside the item drawer
//   ItemImagePicker  — pick a photo while creating an item, uploaded after the
//                      row exists so a failed create can't orphan an object

// A variant rarely has its own photo — a "Large" tee looks like the tee — so an
// image-less variant borrows its group's image.
export function resolveItemImage(item, items) {
  if (!item) return "";
  if (item.imageUrl) return item.imageUrl;
  if (!item.parentId) return "";
  const parent = (Array.isArray(items) ? items : []).find(
    (i) => i.id === item.parentId,
  );
  return parent?.imageUrl || "";
}

// The category's shape, resolved at module scope so no component is created
// inside a render body.
function CategoryIcon({ category, className }) {
  const Icon = CATEGORY_ICONS[category] || CATEGORY_ICONS.Other;
  return <Icon className={className} />;
}

const THUMB_SIZES = {
  sm: { box: "h-8 w-8 rounded-md", icon: "h-3.5 w-3.5" },
  md: { box: "h-10 w-10 rounded-lg", icon: "h-4 w-4" },
  lg: { box: "h-14 w-14 rounded-lg", icon: "h-5 w-5" },
};

export function ItemThumb({ item, items, size = "md", className }) {
  const url = resolveItemImage(item, items);
  const { box, icon } = THUMB_SIZES[size] || THUMB_SIZES.md;

  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={cn(
        box,
        "shrink-0 border border-border object-cover",
        className,
      )}
    />
  ) : (
    <span
      className={cn(
        box,
        "flex shrink-0 items-center justify-center border border-border bg-surface-card text-text-tertiary",
        className,
      )}
    >
      <CategoryIcon category={item?.category} className={icon} />
    </span>
  );
}

// The drawer hero. Uploads straight to inventory/<item-id>/, then hands the
// public URL back through onChange so the screen persists and reflects it.
export function ItemImageCard({ item, items, onChange }) {
  const url = resolveItemImage(item, items);
  const inherited = !item.imageUrl && !!url;
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [me, setMe] = useState(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let alive = true;
    getUser().then((u) => {
      if (!alive) return;
      setMe(u?.id || null);
      setResolved(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Storage RLS allows only the item's creator to write. An item with no owner
  // yet (just created locally) is treated as editable.
  const isOwner = !resolved || !item.createdBy || me === item.createdBy;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    setBusy(true);
    const res = await uploadInventoryImage(item.id, file);
    setBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the item's creator can add a photo.");
      return;
    }
    const previous = item.imageUrl;
    onChange(res.url);
    toast.success("Photo updated.");
    const stale = pathFromPublicUrl(previous);
    if (stale) removeEventImage(stale);
  };

  const remove = () => {
    const path = pathFromPublicUrl(item.imageUrl);
    onChange("");
    toast.success("Photo removed.");
    if (path) removeEventImage(path);
  };

  return (
    <div className="px-5 pt-4">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      {url ? (
        <div className="group relative overflow-hidden rounded-xl border border-border bg-surface-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="aspect-[3/2] w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-background/90 to-transparent px-3 py-2 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
            <span className="text-[11px] text-text-secondary">
              {inherited ? "Using the group photo" : ""}
            </span>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={busy || !isOwner}
                onClick={() => inputRef.current?.click()}
                className="h-7 border-border bg-surface-card/90 text-xs text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                {busy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <UploadCloud className="h-3.5 w-3.5" />
                )}
                {inherited ? "Use own" : "Replace"}
              </Button>
              {item.imageUrl ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={remove}
                  className="h-7 border-border bg-surface-card/90 text-xs text-red-300 hover:bg-red-500/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || !isOwner}
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-sm text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CategoryIcon
              category={item.category}
              className="h-6 w-6 text-text-tertiary"
            />
          )}
          Add a product photo
        </button>
      )}
    </div>
  );
}

// Create-dialog picker. Holds the File locally and previews it; the screen
// uploads it once the row (and its id) exist.
export function ItemImagePicker({ file, onFile, category }) {
  const inputRef = useRef(null);
  // Derived, not stored — the blob URL follows the chosen file and is revoked
  // as soon as that file changes or the dialog unmounts.
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : ""), [file]);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const pick = (e) => {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    if (!chosen.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    onFile(chosen);
  };

  return (
    <div className="flex items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={pick}
      />
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt=""
          className="h-16 w-16 shrink-0 rounded-lg border border-border object-cover"
        />
      ) : (
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-card text-text-tertiary">
          <CategoryIcon category={category} className="h-5 w-5" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            className="gap-1.5"
          >
            <ImagePlus className="h-3.5 w-3.5" />
            {file ? "Change" : "Add photo"}
          </Button>
          {file ? (
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove photo"
              onClick={() => onFile(null)}
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>
        <span className="text-xs text-text-tertiary">
          Optional · compressed and stored on save
        </span>
      </div>
    </div>
  );
}
