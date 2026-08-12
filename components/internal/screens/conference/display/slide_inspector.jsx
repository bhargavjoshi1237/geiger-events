"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, MousePointerClick, Trash2, UploadCloud } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
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
} from "@geiger/ui";
import { FIT_OPTIONS, catalogEntry, slideLabel } from "@/lib/display/constants";
import { agendaDays, agendaRooms } from "@/lib/agenda/sessions";
import { uploadEventImage, removeEventImage, pathFromPublicUrl } from "@/lib/supabase/storage";

// "Any day" / "Any room" sentinel. A Select can't hold "" as a value, so the
// inspector maps this token to the empty string the renderer expects.
const ANY = "__any__";

// Free-text-or-pick control for day and room, which are free-text fields on a
// session: offer what the agenda already uses, and let the board target
// everything when nothing is chosen.
function ScopeSelect({ value, onChange, options, anyLabel, placeholder }) {
  return (
    <Select
      value={value ? value : ANY}
      onValueChange={(v) => onChange(v === ANY ? "" : v)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ANY}>{anyLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ImageField({ eventId, value, onChange }) {
  const [busy, setBusy] = useState(false);
  const fileInput = useRef(null);

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
    const oldPath = pathFromPublicUrl(value);
    onChange(res.url);
    if (oldPath) removeEventImage(oldPath);
  };

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />
      {value ? (
        <div className="group relative overflow-hidden rounded-xl border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="aspect-video w-full object-cover" />
          <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 bg-gradient-to-t from-black/70 to-transparent p-2">
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
              onClick={() => {
                const path = pathFromPublicUrl(value);
                onChange("");
                if (path) removeEventImage(path);
              }}
              className="border-border bg-black/40 text-white hover:bg-red-500/30"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => fileInput.current?.click()}
          className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
          <span className="text-xs">{busy ? "Uploading…" : "Upload an image"}</span>
        </button>
      )}
    </>
  );
}

// Per-type config form for the selected slide. Every edit is emitted straight
// up — the builder owns the debounce and the save.
export function SlideInspector({ slide, sessions, eventId, onChange, onDelete }) {
  if (!slide) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-subtle p-6 text-center">
        <MousePointerClick className="h-5 w-5 text-text-tertiary" />
        <p className="text-sm font-medium text-foreground">No slide selected</p>
        <p className="text-xs text-text-secondary">
          Pick a slide on the canvas to set what it shows, or drag a new one in
          from the palette.
        </p>
      </div>
    );
  }

  const entry = catalogEntry(slide.type);
  const config = slide.config || {};
  const set = (key) => (value) =>
    onChange({ ...slide, config: { ...config, [key]: value } });
  const days = agendaDays(sessions);
  const rooms = agendaRooms(sessions);

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-surface-subtle p-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
          Selected slide
        </p>
        <p className="text-sm font-semibold text-foreground">{slideLabel(slide.type)}</p>
        <p className="mt-0.5 text-xs text-text-secondary">{entry?.desc}</p>
      </div>

      <Field label="On screen for" hint="Seconds">
        <Input
          type="number"
          min={2}
          max={120}
          value={slide.duration ?? entry?.duration ?? 10}
          onChange={(e) =>
            onChange({ ...slide, duration: Math.max(2, Number(e.target.value) || 2) })
          }
        />
      </Field>

      {slide.type === "title" ? (
        <>
          <Field label="Heading" hint="Defaults to the event name">
            <Input
              value={config.heading || ""}
              onChange={(e) => set("heading")(e.target.value)}
              placeholder={"e.g. Welcome to Nightshift"}
            />
          </Field>
          <Field label="Subheading" hint="Defaults to the date and venue">
            <Input
              value={config.subheading || ""}
              onChange={(e) => set("subheading")(e.target.value)}
              placeholder="e.g. Doors 6:30 PM · Hall 2"
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">Use the cover image</p>
              <p className="text-xs text-text-secondary">
                Fills the slide with the event&apos;s cover.
              </p>
            </div>
            <Switch
              checked={config.showCover !== false}
              onCheckedChange={(v) => set("showCover")(v)}
            />
          </div>
        </>
      ) : null}

      {slide.type === "now_next" ? (
        <>
          <Field label="Heading">
            <Input
              value={config.heading || ""}
              onChange={(e) => set("heading")(e.target.value)}
              placeholder="Happening now"
            />
          </Field>
          <Field label="Day" hint="Which day's sessions to read">
            <ScopeSelect
              value={config.day || ""}
              onChange={set("day")}
              options={days}
              anyLabel="Every day"
              placeholder="Every day"
            />
          </Field>
          <Field label="How many to preview" hint="Sessions after the current one">
            <Input
              type="number"
              min={1}
              max={5}
              value={config.upcoming ?? 4}
              onChange={(e) =>
                set("upcoming")(Math.min(5, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </Field>
        </>
      ) : null}

      {slide.type === "day_grid" ? (
        <>
          <Field label="Heading" hint="Defaults to the day">
            <Input
              value={config.heading || ""}
              onChange={(e) => set("heading")(e.target.value)}
              placeholder="e.g. Today's programme"
            />
          </Field>
          <Field label="Day">
            <ScopeSelect
              value={config.day || ""}
              onChange={set("day")}
              options={days}
              anyLabel="Every day"
              placeholder="Every day"
            />
          </Field>
        </>
      ) : null}

      {slide.type === "room_next" ? (
        <>
          <Field label="Heading" hint="Defaults to the room name">
            <Input
              value={config.heading || ""}
              onChange={(e) => set("heading")(e.target.value)}
              placeholder="e.g. Room 2B"
            />
          </Field>
          <Field label="Room">
            <ScopeSelect
              value={config.room || ""}
              onChange={set("room")}
              options={rooms}
              anyLabel="Every room"
              placeholder="Every room"
            />
          </Field>
          <Field label="Day">
            <ScopeSelect
              value={config.day || ""}
              onChange={set("day")}
              options={days}
              anyLabel="Every day"
              placeholder="Every day"
            />
          </Field>
          <Field label="How many to list">
            <Input
              type="number"
              min={1}
              max={5}
              value={config.upcoming ?? 5}
              onChange={(e) =>
                set("upcoming")(Math.min(5, Math.max(1, Number(e.target.value) || 1)))
              }
            />
          </Field>
        </>
      ) : null}

      {slide.type === "message" ? (
        <>
          <Field label="Heading">
            <Input
              value={config.heading || ""}
              onChange={(e) => set("heading")(e.target.value)}
              placeholder="e.g. Keynote moved to Hall 1"
            />
          </Field>
          <Field label="Body" hint="Optional">
            <Textarea
              rows={5}
              value={config.body || ""}
              onChange={(e) => set("body")(e.target.value)}
              placeholder="The detail underneath the heading…"
            />
          </Field>
        </>
      ) : null}

      {slide.type === "image" ? (
        <>
          <Field label="Image">
            <ImageField eventId={eventId} value={config.url || ""} onChange={set("url")} />
          </Field>
          <Field label="How it fills the screen">
            <Select value={config.fit || "cover"} onValueChange={set("fit")}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Caption" hint="Optional">
            <Input
              value={config.caption || ""}
              onChange={(e) => set("caption")(e.target.value)}
              placeholder="e.g. Sponsored by Acme"
            />
          </Field>
        </>
      ) : null}

      <Button
        variant="ghost"
        onClick={() => onDelete(slide)}
        className="mt-auto justify-start text-red-300 hover:bg-red-500/10 hover:text-red-300"
      >
        <Trash2 className="h-4 w-4" /> Remove this slide
      </Button>
    </div>
  );
}

export default SlideInspector;
