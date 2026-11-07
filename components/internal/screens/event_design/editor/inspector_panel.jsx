"use client";

import React, { useState } from "react";
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignHorizontalDistributeCenter,
  AlignStartHorizontal,
  AlignStartVertical,
  AlignVerticalDistributeCenter,
  Copy,
  LayoutGrid,
  Lock,
  LockOpen,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react";

import { Button, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea } from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";
import {
  categoryLabel,
  CHAIR_MODE_LABELS,
  CHAIR_MODES,
  formatArea,
  formatDimensions,
  roomArea,
  roundTo,
  seatTotal,
  setupStyleLabel,
} from "@/lib/event_design";
import { cn } from "@/lib/utils";
import { CountInput, EventSelect, LengthInput, UnitToggle } from "../fields";
import { ObjectGlyph } from "../object_glyph";
import { SpacePicker } from "../dialogs/space_picker";

// Right zone: what is selected. Room settings when nothing is, one object's properties, or bulk tools for a multi-selection.

const ICON_BUTTON = "h-8 w-8 text-muted-foreground hover:bg-surface-active hover:text-foreground";

function Section({ title, children, className }) {
  return (
    <div className={cn("space-y-3 border-b border-border p-4 last:border-b-0", className)}>
      {title ? <p className="text-xs font-medium text-text-tertiary">{title}</p> : null}
      {children}
    </div>
  );
}

function IconAction({ label, onClick, children, disabled }) {
  return (
    <Button type="button" variant="ghost" size="icon-sm" aria-label={label} title={label} disabled={disabled} onClick={onClick} className={ICON_BUTTON}>
      {children}
    </Button>
  );
}

export function RoomInspector({ doc, meta, ctx, projectId, space, onDoc, onMeta }) {
  const capacity = space?.capacities?.[doc.setupStyle];
  const spaceDiffers =
    space?.widthM && space?.lengthM &&
    (Math.abs(space.widthM - doc.widthM) > 0.01 || Math.abs(space.lengthM - doc.lengthM) > 0.01);

  return (
    <>
      <Section title="Room">
        <div className="flex items-end gap-2">
          <Field label="Width" className="min-w-0 flex-1">
            <LengthInput metres={doc.widthM} unit={doc.unit} min={1} onChange={(m) => onDoc((d) => ({ ...d, widthM: m }), { coalesce: "room-w" })} />
          </Field>
          <Field label="Length" className="min-w-0 flex-1">
            <LengthInput metres={doc.lengthM} unit={doc.unit} min={1} onChange={(m) => onDoc((d) => ({ ...d, lengthM: m }), { coalesce: "room-l" })} />
          </Field>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-text-secondary">{formatArea(roomArea(doc), doc.unit)}</span>
          <UnitToggle value={doc.unit} onChange={(u) => onDoc((d) => ({ ...d, unit: u }))} />
        </div>
      </Section>

      <Section title="Venue">
        <SpacePicker
          ctx={ctx}
          projectId={projectId}
          venueId={meta.venueId}
          spaceId={meta.venueSpaceId}
          stacked
          onChange={({ venueId, spaceId }) => onMeta({ venueId, venueSpaceId: spaceId })}
        />
        {spaceDiffers ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onDoc((d) => ({ ...d, widthM: space.widthM, lengthM: space.lengthM }))}
          >
            Use space size · {formatDimensions(space.widthM, space.lengthM, doc.unit)}
          </Button>
        ) : null}
        {capacity ? (
          <p className="text-xs text-text-secondary">
            {space.name} holds <span className="font-medium text-foreground tabular-nums">{capacity}</span>{" "}
            {setupStyleLabel(doc.setupStyle).toLowerCase()}.
          </p>
        ) : null}
      </Section>

      {meta.kind === "plan" ? (
        <Section title="Event">
          <EventSelect events={ctx.events} value={meta.eventId} onChange={(id) => onMeta({ eventId: id })} />
        </Section>
      ) : null}

      <Section title="Notes">
        <Textarea
          rows={3}
          value={meta.notes}
          onChange={(e) => onMeta({ notes: e.target.value })}
          placeholder="Load-in times, power, anything the venue should know."
        />
      </Section>
    </>
  );
}

export function ObjectInspector({ instance, catalogObject, unit, onPatch, onDuplicate, onDelete, onArray }) {
  const [grid, setGrid] = useState({ rows: 2, cols: 3, gap: 1 });
  const locked = instance.locked;
  const hasChairs = instance.chairs.mode !== "none" || instance.seats > 0;
  const sizeChanged =
    catalogObject &&
    (Math.abs(catalogObject.widthM - instance.width_m) > 0.001 || Math.abs(catalogObject.depthM - instance.depth_m) > 0.001);
  const patch = (key) => (value, coalesce) => onPatch({ [key]: value }, coalesce);

  return (
    <>
      <Section>
        <div className="flex items-center gap-3">
          <ObjectGlyph object={{ ...instance, widthM: instance.width_m, depthM: instance.depth_m, chairLayout: instance.chairs, config: { points: instance.points } }} size={40} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">{instance.name}</p>
            <p className="truncate text-xs text-text-secondary">{categoryLabel(instance.category)}</p>
          </div>
          <IconAction label={locked ? "Unlock" : "Lock in place"} onClick={() => onPatch({ locked: !locked })}>
            {locked ? <Lock className="h-4 w-4" /> : <LockOpen className="h-4 w-4" />}
          </IconAction>
        </div>
        <Field label="Label" hint={instance.category === "tables" ? "Table number or name — seating charts use it." : undefined}>
          <Input value={instance.label} onChange={(e) => patch("label")(e.target.value, `label-${instance.id}`)} placeholder="e.g. 12 or Head table" />
        </Field>
      </Section>

      <Section title="Position & rotation">
        <div className="flex gap-2">
          <Field label="X" className="min-w-0 flex-1">
            <LengthInput metres={instance.x_m} unit={unit} min={-1000} disabled={locked} onChange={(m) => patch("x_m")(m, `x-${instance.id}`)} />
          </Field>
          <Field label="Y" className="min-w-0 flex-1">
            <LengthInput metres={instance.y_m} unit={unit} min={-1000} disabled={locked} onChange={(m) => patch("y_m")(m, `y-${instance.id}`)} />
          </Field>
        </div>
        <Field label="Rotation">
          <div className="flex items-center gap-1.5">
            <IconAction label="Rotate 15° left" disabled={locked} onClick={() => onPatch({ rotation: (instance.rotation + 345) % 360 })}>
              <RotateCcw className="h-4 w-4" />
            </IconAction>
            <div className="relative min-w-0 flex-1">
              <Input
                type="number"
                inputMode="numeric"
                value={roundTo(instance.rotation, 1)}
                disabled={locked}
                onChange={(e) => patch("rotation")(((Number(e.target.value) % 360) + 360) % 360 || 0, `rot-${instance.id}`)}
                className="pr-7 tabular-nums"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-text-tertiary">°</span>
            </div>
            <IconAction label="Rotate 15° right" disabled={locked} onClick={() => onPatch({ rotation: (instance.rotation + 15) % 360 })}>
              <RotateCw className="h-4 w-4" />
            </IconAction>
          </div>
        </Field>
      </Section>

      <Section title="Size">
        <div className="flex gap-2">
          <Field label="Width" className="min-w-0 flex-1">
            <LengthInput metres={instance.width_m} unit={unit} onChange={(m) => patch("width_m")(m, `w-${instance.id}`)} />
          </Field>
          <Field label="Depth" className="min-w-0 flex-1">
            <LengthInput metres={instance.depth_m} unit={unit} onChange={(m) => patch("depth_m")(m, `d-${instance.id}`)} />
          </Field>
        </div>
        <Field label="Height" hint="Used by the 3D walkthrough.">
          <LengthInput metres={instance.height_m ?? ""} unit={unit} placeholder="—" onChange={(m) => patch("height_m")(m, `h-${instance.id}`)} />
        </Field>
        {sizeChanged ? (
          <button
            type="button"
            className="text-xs font-medium text-text-secondary underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => onPatch({ width_m: catalogObject.widthM, depth_m: catalogObject.depthM })}
          >
            Reset to catalog size · {formatDimensions(catalogObject.widthM, catalogObject.depthM, unit)}
          </button>
        ) : null}
      </Section>

      {hasChairs ? (
        <Section title="Seating">
          <div className="flex gap-2">
            <Field label="Seats" className="w-24 shrink-0">
              <CountInput value={instance.seats} max={60} onChange={(n) => patch("seats")(n, `seats-${instance.id}`)} />
            </Field>
            <Field label="Chairs" className="min-w-0 flex-1">
              <Select value={instance.chairs.mode} onValueChange={(mode) => onPatch({ chairs: { mode, ...(instance.chairs.ends ? { ends: true } : {}) } })}>
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
          {instance.chairs.mode === "sides" ? (
            <label className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
              Seat the ends too
              <Switch
                checked={Boolean(instance.chairs.ends)}
                onCheckedChange={(on) => onPatch({ chairs: on ? { mode: "sides", ends: true } : { mode: "sides" } })}
              />
            </label>
          ) : null}
        </Section>
      ) : null}

      <Section title="Repeat as a grid">
        <div className="flex items-end gap-2">
          <Field label="Rows" className="w-16 shrink-0">
            <CountInput value={grid.rows} min={1} max={60} onChange={(rows) => setGrid((g) => ({ ...g, rows }))} />
          </Field>
          <Field label="Columns" className="w-16 shrink-0">
            <CountInput value={grid.cols} min={1} max={60} onChange={(cols) => setGrid((g) => ({ ...g, cols }))} />
          </Field>
          <Field label="Aisle" className="min-w-0 flex-1">
            <LengthInput metres={grid.gap} unit={unit} min={0} onChange={(gap) => setGrid((g) => ({ ...g, gap }))} />
          </Field>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={grid.rows * grid.cols < 2}
          onClick={() => onArray({ rows: grid.rows, cols: grid.cols, gapX: grid.gap, gapY: grid.gap })}
          className="w-full border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <LayoutGrid className="h-4 w-4" /> Lay out {grid.rows * grid.cols}
        </Button>
      </Section>

      <Section>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onDuplicate} className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={locked} onClick={onDelete} className="flex-1 border-border bg-transparent text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </div>
      </Section>
    </>
  );
}

const ALIGN = [
  { mode: "left", label: "Align left", icon: AlignStartVertical },
  { mode: "centerX", label: "Align centres horizontally", icon: AlignCenterVertical },
  { mode: "right", label: "Align right", icon: AlignEndVertical },
  { mode: "top", label: "Align top", icon: AlignStartHorizontal },
  { mode: "centerY", label: "Align centres vertically", icon: AlignCenterHorizontal },
  { mode: "bottom", label: "Align bottom", icon: AlignEndHorizontal },
];

export function MultiInspector({ objects, onAlign, onDistribute, onRotate, onLock, onDuplicate, onDelete }) {
  const allLocked = objects.every((o) => o.locked);
  return (
    <>
      <Section>
        <p className="text-sm font-semibold text-foreground">{objects.length} objects selected</p>
        <p className="text-xs tabular-nums text-text-secondary">{seatTotal(objects)} seats in the selection</p>
      </Section>
      <Section title="Align & distribute">
        <div className="flex flex-wrap gap-1">
          {ALIGN.map(({ mode, label, icon: Icon }) => (
            <IconAction key={mode} label={label} onClick={() => onAlign(mode)}>
              <Icon className="h-4 w-4" />
            </IconAction>
          ))}
          <IconAction label="Distribute horizontally" disabled={objects.length < 3} onClick={() => onDistribute("x")}>
            <AlignHorizontalDistributeCenter className="h-4 w-4" />
          </IconAction>
          <IconAction label="Distribute vertically" disabled={objects.length < 3} onClick={() => onDistribute("y")}>
            <AlignVerticalDistributeCenter className="h-4 w-4" />
          </IconAction>
        </div>
      </Section>
      <Section title="Rotate group">
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onRotate(-15)} className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
            <RotateCcw className="h-4 w-4" /> 15°
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => onRotate(15)} className="flex-1 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
            <RotateCw className="h-4 w-4" /> 15°
          </Button>
        </div>
      </Section>
      <Section>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onLock(!allLocked)} className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
            {allLocked ? <LockOpen className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            {allLocked ? "Unlock all" : "Lock all"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDuplicate} className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground">
            <Copy className="h-4 w-4" /> Duplicate
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onDelete} className="col-span-2 border-border bg-transparent text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400">
            <Trash2 className="h-4 w-4" /> Delete selected
          </Button>
        </div>
      </Section>
    </>
  );
}
