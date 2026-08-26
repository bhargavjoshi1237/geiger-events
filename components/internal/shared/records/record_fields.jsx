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
  Tabs,
  TabsList,
  TabsTrigger,
  cn,
} from "@geiger/ui";
import { getUser } from "@/lib/supabase/user";
import { removeEventImage, pathFromPublicUrl } from "@/lib/supabase/storage";
import { AudienceField } from "@/components/internal/shared/audience/audience_field";
import { AccessControlField } from "./access_control";
import { conferenceApi } from "@/lib/supabase/conference";

export function readField(field, values) {
  if (field.scope === "config") return values.config?.[field.key];
  return values[field.key];
}

export function fieldPatch(field, values, val) {
  if (field.scope === "config") {
    return { config: { ...(values.config || {}), [field.key]: val } };
  }
  return { [field.key]: val };
}

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

function ImageField({ field, value, onValue, values }) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const recordId = values?.id;
  const deferred = Boolean(values?.deferUploads);
  const aspect = field.aspect || "aspect-[16/9]";
  const src = typeof value === "string" ? value : value?.preview || "";

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }
    if (deferred) {
      if (value?.preview) URL.revokeObjectURL(value.preview);
      onValue({ file, preview: URL.createObjectURL(file) });
      return;
    }
    if (!field.upload || !recordId) return;
    setBusy(true);
    const res = await field.upload(recordId, file);
    setBusy(false);
    if (!res?.url) {
      toast.error("Upload failed — please try again.");
      return;
    }
    const old = typeof value === "string" ? value : "";
    onValue(res.url);
    const oldPath = pathFromPublicUrl(old);
    if (oldPath) removeEventImage(oldPath);
  };

  const remove = () => {
    if (value?.preview) URL.revokeObjectURL(value.preview);
    const path = typeof value === "string" ? pathFromPublicUrl(value) : null;
    onValue("");
    if (path) removeEventImage(path);
  };

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      {src ? (
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "w-28 shrink-0 overflow-hidden rounded-lg border border-border",
              field.frameClassName,
            )}
          >
            <img src={src} alt="" className={cn(aspect, "w-full object-cover")} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <UploadCloud className="h-4 w-4" />
              )}
              {deferred ? "Change" : "Replace"}
            </Button>
            <Button
              type="button"
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
          disabled={busy || (!deferred && !recordId)}
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-card px-4 py-6 text-sm text-text-secondary transition-colors hover:bg-surface-hover disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          {field.placeholder || "Upload an image"}
        </button>
      )}
    </div>
  );
}

function toLocalInput(iso) {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms - new Date(ms).getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

function RecordRefField({ field, value, onValue, projectId }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    conferenceApi.list(projectId, field.refModule).then((rows) => {
      if (!alive) return;
      setOptions(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, field.refModule]);

  if (loading) {
    return <div className="h-9 animate-pulse rounded-md bg-surface-card" />;
  }
  if (!options.length) {
    return (
      <p className="py-2 text-xs text-text-tertiary">
        No {field.refModule} records yet — create one first.
      </p>
    );
  }
  return (
    <Select value={value ?? ""} onValueChange={onValue}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={field.placeholder || "Select…"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.id} value={o.id}>
            {o.name || "Untitled"}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function FieldControl({ field, value, onValue, values }) {
  switch (field.type) {
    case "audience":
      return (
        <AudienceField
          projectId={values?.projectId}
          value={value}
          onChange={onValue}
        />
      );
    case "access":
      return (
        <AccessControlField
          projectId={values?.projectId}
          value={value}
          onChange={onValue}
        />
      );
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
    case "datetime":
      return (
        <Input
          type="datetime-local"
          value={value ? toLocalInput(value) : ""}
          onChange={(e) =>
            onValue(e.target.value ? new Date(e.target.value).toISOString() : "")
          }
        />
      );
    case "ref":
      return (
        <RecordRefField
          field={field}
          value={value}
          onValue={onValue}
          projectId={values?.projectId}
        />
      );
    case "select":
      return (
        <Select value={value ?? ""} onValueChange={onValue}>
          <SelectTrigger className="w-full">
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
    case "tabs":
      return (
        <Tabs value={value ?? ""} onValueChange={onValue}>
          <TabsList className="w-full">
            {(field.options || []).map((o) => (
              <TabsTrigger key={o.value} value={o.value}>
                {o.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
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
    case "image":
      return (
        <ImageField
          field={field}
          value={value}
          onValue={onValue}
          values={values}
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

const FULL_TYPES = new Set([
  "textarea",
  "list",
  "audience",
  "access",
  "tabs",
  "image",
]);

export function FieldSection({ title, description, action, fields, values, onPatch, bare = false }) {
  return (
    <SectionCard
      title={title}
      description={description}
      action={action}
      bare={bare}
      bodyPadding={!bare || Boolean(title)}
    >
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
                values={values}
              />
            </Field>
          );
        })}
      </div>
    </SectionCard>
  );
}

export function CoverImageCard({ record, commit, upload, aspect = "aspect-[16/9]", frameClassName }) {
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
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
      {cover ? (
        <div className="space-y-3">
          <div
            className={cn(
              "relative overflow-hidden rounded-xl border border-border",
              frameClassName,
            )}
          >
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
            frameClassName,
          )}
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <UploadCloud className="h-5 w-5" />}
          Upload an image
        </button>
      )}
    </>
  );
}
