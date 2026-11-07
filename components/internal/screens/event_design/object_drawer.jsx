"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Copy, Loader2, Save } from "lucide-react";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@geiger/ui";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@geiger/ui/sheet";
import { Field } from "@/components/internal/shared/screen_kit";
import {
  CATEGORIES,
  CHAIR_MODE_LABELS,
  CHAIR_MODES,
  categoryLabel,
  formatDimensions,
  normaliseChairLayout,
  previewPlanFor,
  SHAPE_LABELS,
} from "@/lib/event_design";
import { CountInput, LengthInput, UnitToggle } from "./fields";
import { PlanRenderer } from "./plan_renderer";

// Object create / edit drawer (custom objects), read-only for the standard catalog with a "Duplicate to customise" action.

const EMPTY = {
  name: "",
  category: "tables",
  shape: "rect",
  widthM: 1.829,
  depthM: 0.762,
  heightM: 0.76,
  seats: 6,
  chairLayout: { mode: "sides" },
  description: "",
  config: {},
};

const toDraft = (o) => ({
  name: o.name,
  category: o.category,
  shape: o.shape,
  widthM: o.widthM,
  depthM: o.depthM,
  heightM: o.heightM,
  seats: o.seats,
  chairLayout: normaliseChairLayout(o.chairLayout, o.shape),
  description: o.description || "",
  config: o.config || {},
});

function DrawerBody({ object, readOnly, onSave, onDuplicate, onClose }) {
  const [draft, setDraft] = useState(() => (object ? toDraft(object) : EMPTY));
  const [unit, setUnit] = useState("m");
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const preview = useMemo(() => previewPlanFor({ ...draft, id: object?.id || "draft" }), [draft, object?.id]);
  const shapes = draft.config?.points ? ["rect", "round", "oval", "custom"] : ["rect", "round", "oval"];

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("Give the object a name.");
      return;
    }
    setBusy(true);
    const ok = await onSave({ ...draft, name: draft.name.trim(), chairLayout: normaliseChairLayout(draft.chairLayout, draft.shape) });
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="text-base">{object ? (readOnly ? object.name : "Edit object") : "New object"}</SheetTitle>
        <SheetDescription>
          {readOnly
            ? `Standard ${categoryLabel(object.category).toLowerCase()} — duplicate it to change sizes or seats.`
            : "Real dimensions and seats, so every plan it lands on counts correctly."}
        </SheetDescription>
      </SheetHeader>

      <div className="h-48 border-b border-border">
        <PlanRenderer plan={preview} showLabels={false} showScale padding={0.02} />
      </div>

      <div className="grid gap-4 px-5 py-5">
        <Field label="Name">
          <Input value={draft.name} disabled={readOnly} onChange={(e) => set("name")(e.target.value)} placeholder="e.g. 66in round" />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Category">
            <Select value={draft.category} onValueChange={set("category")} disabled={readOnly}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Shape">
            <Select
              value={draft.shape}
              disabled={readOnly}
              onValueChange={(shape) =>
                setDraft((d) => ({
                  ...d,
                  shape,
                  ...(shape === "round" ? { depthM: d.widthM } : {}),
                  chairLayout: normaliseChairLayout(d.chairLayout, shape),
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {shapes.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SHAPE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-muted-foreground">Dimensions</span>
          <UnitToggle value={unit} onChange={setUnit} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Field label={draft.shape === "round" ? "Diameter" : "Width"}>
            <LengthInput
              metres={draft.widthM}
              unit={unit}
              disabled={readOnly}
              onChange={(m) => setDraft((d) => ({ ...d, widthM: m, ...(d.shape === "round" ? { depthM: m } : {}) }))}
            />
          </Field>
          <Field label="Depth">
            <LengthInput metres={draft.depthM} unit={unit} disabled={readOnly || draft.shape === "round"} onChange={set("depthM")} />
          </Field>
          <Field label="Height">
            <LengthInput metres={draft.heightM ?? ""} unit={unit} disabled={readOnly} placeholder="—" onChange={set("heightM")} />
          </Field>
        </div>

        <div className="grid grid-cols-[96px_1fr] gap-3">
          <Field label="Seats">
            <CountInput value={draft.seats} max={60} disabled={readOnly} onChange={set("seats")} />
          </Field>
          <Field label="Chair layout">
            <Select
              value={draft.chairLayout.mode}
              disabled={readOnly}
              onValueChange={(mode) => set("chairLayout")({ mode, ...(draft.chairLayout.ends ? { ends: true } : {}) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAIR_MODES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {CHAIR_MODE_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
        {draft.chairLayout.mode === "sides" ? (
          <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
            Seat the ends too
            <Switch
              checked={Boolean(draft.chairLayout.ends)}
              disabled={readOnly}
              onCheckedChange={(on) => set("chairLayout")(on ? { mode: "sides", ends: true } : { mode: "sides" })}
            />
          </label>
        ) : null}

        <Field label="Description" hint={readOnly ? undefined : "Optional — shown in the library."}>
          <Textarea rows={2} value={draft.description} disabled={readOnly} onChange={(e) => set("description")(e.target.value)} />
        </Field>

        {!readOnly && object ? (
          <p className="text-xs text-text-tertiary">
            Changes apply to new placements — objects already on plans keep the size they were placed at.
          </p>
        ) : null}
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 border-t border-border px-5 py-4">
        <span className="text-xs tabular-nums text-text-tertiary">
          {formatDimensions(draft.widthM, draft.depthM, unit)} · {draft.seats} seat{draft.seats === 1 ? "" : "s"}
        </span>
        {readOnly ? (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => onDuplicate(object)}>
            <Copy className="h-4 w-4" /> Duplicate to customise
          </Button>
        ) : (
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {object ? "Save object" : "Create object"}
          </Button>
        )}
      </div>
    </>
  );
}

// `target`: null (closed), { mode: "new" }, or { mode: "edit" | "view", object }.
export function ObjectDrawer({ target, onOpenChange, onSave, onDuplicate }) {
  return (
    <Sheet open={!!target} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
        {target ? (
          <DrawerBody
            key={target.object?.id || "new"}
            object={target.object || null}
            readOnly={target.mode === "view"}
            onSave={onSave}
            onDuplicate={onDuplicate}
            onClose={() => onOpenChange(false)}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default ObjectDrawer;
