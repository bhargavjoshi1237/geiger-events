"use client";

import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Loader2, Trash2 } from "lucide-react";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";

import { Field, SectionCard } from "./screen_kit";
import { FIELD_SHAPES } from "./map_field";

const ASPECTS = [
  { value: "16/10", label: "Wide (16:10)" },
  { value: "16/9", label: "Widescreen (16:9)" },
  { value: "4/3", label: "Classic (4:3)" },
  { value: "1/1", label: "Square" },
  { value: "3/4", label: "Portrait" },
];

export function MapFloorPanel({
  config = {},
  field,
  background,
  onChange,
  onUpload,
  title = "Floor",
  description = "The canvas, its central feature, and the plan traced underneath.",
}) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);

  const patchField = (partial) => onChange({ field: { ...field, ...partial } });
  const patchBackground = (partial) => onChange({ background: { ...background, ...partial } });

  const pickImage = async (file) => {
    if (!file) return;
    setUploading(true);
    const result = await onUpload?.(file);
    setUploading(false);
    if (!result?.url) {
      toast.error("Couldn't upload the floor plan.");
      return;
    }
    patchBackground({ url: result.url, path: result.path });
    toast.success("Floor plan uploaded.");
  };

  const hasImage = Boolean(background?.url);

  return (
    <SectionCard title={title} description={description}>
      <div className="space-y-4">
        <Field label="Canvas shape" hint="Match the real room so the plan isn't distorted.">
          <Select value={config.aspect || "16/10"} onValueChange={(v) => onChange({ aspect: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECTS.map((a) => (
                <SelectItem key={a.value} value={a.value}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Central feature"
          hint={FIELD_SHAPES.find((s) => s.value === (field?.shape || "stage"))?.hint}
        >
          <Select value={field?.shape || "stage"} onValueChange={(v) => patchField({ shape: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FIELD_SHAPES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {field?.shape !== "none" ? (
          <>
            <Field label="Label">
              <Input
                value={field?.label ?? ""}
                onChange={(e) => patchField({ label: e.target.value })}
                placeholder="e.g. Centre court"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              {[
                ["x", "Left %"],
                ["y", "Top %"],
                ["width", "Width %"],
                ["height", "Height %"],
              ].map(([key, label]) => (
                <Field key={key} label={label}>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    inputMode="numeric"
                    value={field?.[key] ?? 0}
                    onChange={(e) => patchField({ [key]: Number(e.target.value) || 0 })}
                    className="tabular-nums"
                  />
                </Field>
              ))}
            </div>
          </>
        ) : null}

        <div className="border-t border-border pt-4">
          <Field
            label="Floor plan image"
            hint="The venue's own plan, shown underneath so blocks can be placed on top of it."
          >
            <div className="flex items-center gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  pickImage(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ImageIcon className="h-4 w-4" />
                )}
                {hasImage ? "Replace" : "Upload"}
              </Button>
              {hasImage ? (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label="Remove floor plan image"
                  onClick={() => patchBackground({ url: "", path: "" })}
                  className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>
          </Field>

          {hasImage ? (
            <Field
              label={`Plan opacity · ${Math.round((background.opacity ?? 0.6) * 100)}%`}
              hint="Fade it back once the blocks are placed."
            >
              <input
                type="range"
                min={5}
                max={100}
                step={5}
                value={Math.round((background.opacity ?? 0.6) * 100)}
                onChange={(e) => patchBackground({ opacity: Number(e.target.value) / 100 })}
                aria-label="Floor plan opacity"
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-active accent-primary"
              />
            </Field>
          ) : null}
        </div>
      </div>
    </SectionCard>
  );
}

export default MapFloorPanel;
