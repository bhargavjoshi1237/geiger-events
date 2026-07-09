"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud, Trash2, X } from "lucide-react";

import { Field, SectionCard } from "@/components/internal/shared/screen_kit";
import {
  Button,
  Input,
  Textarea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  cn,
} from "@geiger/ui";
import { getUser } from "@/lib/supabase/user";
import { removeEventImage, pathFromPublicUrl } from "@/lib/supabase/storage";

// Declarative field rendering shared by the Conference create dialog, the light
// single-panel editors, and the rich sectioned editors. A field spec is:
//   { key, label, type, scope, options?, placeholder?, hint?, full? }
//   type:  text | email | number | textarea | select | switch | list
//   scope: "root" (record.name/status/coverUrl) | "config" (record.config[key])

// Read a field's current value off a record/draft.
export function readField(field, values) {
  if (field.scope === "config") return values.config?.[field.key];
  return values[field.key];
}

// Build the partial patch that sets a field to `val` (root vs config bag).
export function fieldPatch(field, values, val) {
  if (field.scope === "config") {
    return { config: { ...(values.config || {}), [field.key]: val } };
  }
  return { [field.key]: val };
}

// --- Chips (string[] editor) -------------------------------------------------

export function ChipsInput({ value, onChange, placeholder }) {
  const [draft, setDraft] = useState("");
  const items = Array.isArray(value) ? value : [];

  const add = () => {
    const v = draft.trim();
    if (!v || items.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...items, v]);
    setDraft("");
  };
  const remove = (item) => onChange(items.filter((i) => i !== item));

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder || "Type and press Enter…"}
        />
        <Button
          type="button"
          variant="outline"
          onClick={add}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          Add
        </Button>
      </div>
      {items.length ? (
        <div className="flex flex-wrap gap-1.5">
          {items.map((item) => (
            <span
              key={item}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-card px-2 py-1 text-xs text-foreground"
            >
              {item}
              <button
                type="button"
                onClick={() => remove(item)}
                aria-label={`Remove ${item}`}
                className="text-text-secondary transition-colors hover:text-red-300"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// --- Single field control ----------------------------------------------------

// Renders one field's control. `value` is the current value; `onValue(val)` gets
// the new raw value (the caller maps it to a patch via fieldPatch).
export function FieldControl({ field, value, onValue }) {
  switch (field.type) {
    case "textarea":
      return (
        <Textarea
          rows={field.rows || 4}
          value={value ?? ""}
          onChange={(e) => onValue(e.target.value)}
          placeholder={field.placeholder}
        />
      );
    case "number":
      return (
        <Input
          type="number"
          min={field.min ?? 0}
          value={value ?? ""}
          onChange={(e) => onValue(e.target.value)}
          placeholder={field.placeholder}
        />
      );
    case "email":
      return (
        <Input
          type="email"
          value={value ?? ""}
          onChange={(e) => onValue(e.target.value)}
          placeholder={field.placeholder}
        />
      );
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={onValue}>
          <SelectTrigger>
            <SelectValue placeholder={field.placeholder || "Select…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "switch":
      return (
        <div className="flex h-9 items-center">
          <Switch checked={Boolean(value)} onCheckedChange={onValue} />
        </div>
      );
    case "list":
      return (
        <ChipsInput
          value={value}
          onChange={onValue}
          placeholder={field.placeholder}
        />
      );
    default:
      return (
        <Input
          value={value ?? ""}
          onChange={(e) => onValue(e.target.value)}
          placeholder={field.placeholder}
        />
      );
  }
}

// A field that spans the full width of the two-column grid (multi-line inputs).
const FULL_TYPES = new Set(["textarea", "list"]);

// --- Section of fields (a titled card with a 2-col grid) ---------------------

export function FieldSection({ title, description, action, fields, values, onPatch }) {
  return (
    <SectionCard title={title} description={description} action={action}>
      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const full = field.full ?? FULL_TYPES.has(field.type);
          return (
            <Field
              key={field.key}
              label={field.label}
              hint={field.hint}
              className={cn(full && "sm:col-span-2")}
            >
              <FieldControl
                field={field}
                value={readField(field, values)}
                onValue={(val) => onPatch(fieldPatch(field, values, val))}
              />
            </Field>
          );
        })}
      </div>
    </SectionCard>
  );
}

// --- Cover image (headshot / logo) -------------------------------------------

export function CoverImageCard({ record, commit, upload, title = "Cover image", description, aspect = "aspect-[16/9]" }) {
  const cover = record.coverUrl || "";
  const [me, setMe] = useState(null);
  const [resolved, setResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

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

  // Only the creator may upload (storage RLS). A record with no owner yet
  // (local-only / just created) is treated as editable.
  const isOwner = !resolved || !record.createdBy || me === record.createdBy;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (!upload) return;
    setBusy(true);
    const res = await upload(record.id, file);
    setBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — only the record's creator can add an image.");
      return;
    }
    const old = cover;
    commit({ coverUrl: res.url });
    toast.success("Image updated.");
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const remove = () => {
    const path = pathFromPublicUrl(cover);
    commit({ coverUrl: "" });
    toast.success("Image removed.");
    if (path) removeEventImage(path);
  };

  return (
    <SectionCard title={title} description={description}>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {cover ? (
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className={cn(aspect, "w-full object-cover")} />
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={busy || !isOwner}
              onClick={() => inputRef.current?.click()}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              Replace
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={remove}
              className="border-border bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy || !isOwner}
          onClick={() => inputRef.current?.click()}
          className={cn(
            aspect,
            "flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-sm text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60",
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
          Upload an image
        </button>
      )}
    </SectionCard>
  );
}
