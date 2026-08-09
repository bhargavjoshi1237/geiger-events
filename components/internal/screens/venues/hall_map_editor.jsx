"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Grid3x3, Loader2, Plus, Store, Trash2 } from "lucide-react";

import {
  EmptyState,
  Field,
  SectionCard,
  StatsBar,
} from "@/components/internal/shared/screen_kit";
import { MapCanvas } from "@/components/internal/shared/map_canvas";
import { MapField } from "@/components/internal/shared/map_field";
import { MapFloorPanel } from "@/components/internal/shared/map_floor_panel";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { currency } from "@/components/internal/screens/tickets/constants";
import {
  createBooth,
  createBoothGrid,
  deleteBooth,
  getHallMap,
  updateBooth,
  updateHallMap,
} from "@/lib/supabase/hall_maps";
import { uploadVenueImage } from "@/lib/supabase/storage";

// Canvas editor for one exhibitor hall configuration. The booth mirror of
// seat_map_editor: stalls are percent-positioned blocks dragged onto the floor
// over the venue's own plan. Unlike a seat map section a booth has no interior
// to generate — the booth IS the unit of sale, so its geometry, size class and
// price are authored directly.

const SIZE_CLASSES = ["Standard", "Large", "Premium", "Island", "Corner"];

const KIND_STYLE = {
  booth: "border-sky-400/30 bg-sky-400/10",
  zone: "border-dashed border-border-strong bg-transparent",
  feature: "border-border bg-surface-subtle",
};

const clampPos = (n) => Math.max(0, Math.min(98, n));
const clampSize = (n) => Math.max(2, Math.min(100, n));

// Lay a rectangular block of identical stalls out in one go, which is how an
// exhibitor hall is actually planned — rows of equal booths off an aisle.
function GridDialog({ open, onOpenChange, onGenerate, nextIndex }) {
  const [draft, setDraft] = useState({
    rows: 4,
    columns: 6,
    prefix: "A",
    startAt: 1,
    sizeClass: "Standard",
    price: 0,
    hall: "",
    width: 8,
    height: 6,
    gapX: 3,
    gapY: 4,
    x: 8,
    y: 12,
  });
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const num = (key) => (e) => set(key)(Number(e.target.value) || 0);
  const count = Math.max(1, draft.rows) * Math.max(1, draft.columns);

  const submit = async () => {
    setBusy(true);
    const ok = await onGenerate({ ...draft, sortFrom: nextIndex });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Add a block of booths</DialogTitle>
          <DialogDescription>
            Lays a grid of identical stalls onto the floor. Drag any of them afterwards to match
            the real hall.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Rows">
              <Input
                type="number"
                min={1}
                max={30}
                inputMode="numeric"
                value={draft.rows}
                onChange={num("rows")}
                className="tabular-nums"
              />
            </Field>
            <Field label="Columns">
              <Input
                type="number"
                min={1}
                max={30}
                inputMode="numeric"
                value={draft.columns}
                onChange={num("columns")}
                className="tabular-nums"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Code prefix" hint="A1, A2, A3…">
              <Input
                value={draft.prefix}
                onChange={(e) => set("prefix")(e.target.value)}
                placeholder="A"
              />
            </Field>
            <Field label="Numbers start at">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.startAt}
                onChange={num("startAt")}
                className="tabular-nums"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Size">
              <Select value={draft.sizeClass} onValueChange={set("sizeClass")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_CLASSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Price">
              <Input
                type="number"
                min={0}
                inputMode="decimal"
                value={draft.price}
                onChange={num("price")}
                className="tabular-nums"
              />
            </Field>
            <Field label="Hall / zone">
              <Input
                value={draft.hall}
                onChange={(e) => set("hall")(e.target.value)}
                placeholder="Hall 1"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-4">
            {[
              ["width", "Width %"],
              ["height", "Height %"],
              ["gapX", "Aisle X %"],
              ["gapY", "Aisle Y %"],
            ].map(([key, label]) => (
              <Field key={key} label={label}>
                <Input
                  type="number"
                  min={0}
                  max={50}
                  inputMode="numeric"
                  value={draft[key]}
                  onChange={num(key)}
                  className="tabular-nums"
                />
              </Field>
            ))}
          </div>

          <p className="rounded-lg border border-border bg-surface-subtle p-3 text-xs text-text-secondary tabular-nums">
            {count} booths · {currency(count * (Number(draft.price) || 0))} if all sell
          </p>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy}
            onClick={submit}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Grid3x3 className="h-4 w-4" />}
            Add {count} booths
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BoothPanel({ booth, onPatch, onDelete }) {
  const isBooth = booth.kind === "booth";
  return (
    <SectionCard
      title={booth.code || booth.name || "Booth"}
      action={
        <Button
          size="sm"
          variant="ghost"
          className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
          onClick={onDelete}
          aria-label="Delete booth"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Type" hint="Zones and features are floor furniture and never sell.">
          <Select value={booth.kind} onValueChange={(v) => onPatch({ kind: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="booth">Booth (sellable)</SelectItem>
              <SelectItem value="zone">Zone</SelectItem>
              <SelectItem value="feature">Feature (entrance, cafe…)</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Code" hint="As printed on the floor.">
            <Input
              value={booth.code}
              onChange={(e) => onPatch({ code: e.target.value })}
              placeholder="A12"
            />
          </Field>
          <Field label="Hall / zone">
            <Input
              value={booth.hall}
              onChange={(e) => onPatch({ hall: e.target.value })}
              placeholder="Hall 1"
            />
          </Field>
        </div>

        <Field label="Name">
          <Input
            value={booth.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Corner stand"
          />
        </Field>

        {isBooth ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Size class">
              <Select value={booth.sizeClass} onValueChange={(v) => onPatch({ sizeClass: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_CLASSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Price" hint="Used when the event prices booths directly.">
              <Input
                type="number"
                min={0}
                inputMode="decimal"
                value={booth.price}
                onChange={(e) => onPatch({ price: Number(e.target.value) || 0 })}
                className="tabular-nums"
              />
            </Field>
          </div>
        ) : null}

        <Field label="Facing" hint="Degrees clockwise.">
          <Input
            type="number"
            min={0}
            max={359}
            inputMode="numeric"
            value={Math.round(booth.rotation ?? 0)}
            onChange={(e) => onPatch({ rotation: Number(e.target.value) || 0 })}
            className="tabular-nums"
          />
        </Field>

        <Field label="On the floor" hint="Hidden booths are neither shown nor sellable.">
          <Select
            value={booth.active ? "yes" : "no"}
            onValueChange={(v) => onPatch({ active: v === "yes" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yes">Visible</SelectItem>
              <SelectItem value="no">Hidden</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </SectionCard>
  );
}

export function HallMapEditor({ mapId, onBack }) {
  const [map, setMap] = useState(null);
  const [booths, setBooths] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [gridOpen, setGridOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let alive = true;
    getHallMap(mapId).then((data) => {
      if (!alive) return;
      if (data) {
        setMap(data.map);
        setBooths(data.booths);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [mapId, reloadToken]);

  const selected = useMemo(
    () => booths.find((b) => b.id === selectedId) || null,
    [booths, selectedId],
  );

  const stats = useMemo(() => {
    const sellable = booths.filter((b) => b.kind === "booth" && b.active);
    const value = sellable.reduce((sum, b) => sum + (Number(b.price) || 0), 0);
    const halls = new Set(sellable.map((b) => b.hall).filter(Boolean));
    return [
      { label: "Booths", value: String(sellable.length), footer: "Sellable stalls" },
      { label: "Halls", value: String(halls.size || 1), footer: "Zones on this floor" },
      {
        label: "Floor value",
        value: currency(value),
        footer: "If every booth sells",
      },
      {
        label: "Furniture",
        value: String(booths.filter((b) => b.kind !== "booth").length),
        footer: "Zones and features",
      },
    ];
  }, [booths]);

  // --- floor config --------------------------------------------------------

  const patchConfig = (partial) => {
    const config = { ...(map?.config || {}), ...partial };
    setMap((prev) => (prev ? { ...prev, config, ...partial } : prev));
    updateHallMap(mapId, { config }).then((row) => {
      if (!row) toast.error("Couldn't save the floor.");
    });
  };

  const uploadPlan = (file) => uploadVenueImage(map?.venueId || mapId, file);

  // --- booth mutations -----------------------------------------------------

  const patchBooth = (id, partial) => {
    setBooths((prev) => prev.map((b) => (b.id === id ? { ...b, ...partial } : b)));
    updateBooth(id, partial).then((row) => {
      if (!row) toast.error("Couldn't save the booth.");
    });
  };

  const addBooth = async () => {
    const code = `B${booths.length + 1}`;
    const created = await createBooth({
      id: crypto.randomUUID(),
      hallMapId: mapId,
      code,
      name: code,
      kind: "booth",
      x: 10,
      y: 10,
      width: 8,
      height: 6,
      sortOrder: booths.length,
    });
    if (!created) {
      toast.error("Couldn't add the booth.");
      return;
    }
    setBooths((prev) => [...prev, created]);
    setSelectedId(created.id);
  };

  const removeBooth = async (id) => {
    setBooths((prev) => prev.filter((b) => b.id !== id));
    setSelectedId(null);
    const ok = await deleteBooth(id);
    if (!ok) {
      toast.error("Couldn't delete the booth.");
      reload();
      return;
    }
    toast.success("Booth deleted.");
  };

  const runGrid = async (options) => {
    const created = await createBoothGrid(mapId, options);
    if (!created) {
      toast.error("Couldn't add the block. Check the codes aren't already used.");
      return false;
    }
    reload();
    toast.success(`Added ${created.length} booths.`);
    return true;
  };

  // --- canvas drag ---------------------------------------------------------

  const onPointerDown = (event, booth, mode) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canvasRef.current) return;
    dragRef.current = {
      id: booth.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: booth.x, y: booth.y, width: booth.width, height: booth.height },
    };
    setDragging(true);
    setSelectedId(booth.id);
  };

  useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      const { x: dx, y: dy } = canvasRef.current.toPercentDelta(
        event.clientX - drag.startX,
        event.clientY - drag.startY,
      );
      const next =
        drag.mode === "resize"
          ? {
              x: drag.origin.x,
              y: drag.origin.y,
              width: clampSize(drag.origin.width + dx),
              height: clampSize(drag.origin.height + dy),
            }
          : {
              x: clampPos(drag.origin.x + dx),
              y: clampPos(drag.origin.y + dy),
              width: drag.origin.width,
              height: drag.origin.height,
            };
      drag.next = next;
      setBooths((prev) => prev.map((b) => (b.id === drag.id ? { ...b, ...next } : b)));
    };

    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      // No movement between down and up is a plain click, not a drag.
      if (!drag?.next) return;
      updateBooth(drag.id, drag.next).then((row) => {
        if (!row) toast.error("Couldn't save the position.");
      });
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (!map) {
    return (
      <EmptyState
        icon={Store}
        title="Hall not found"
        description="It may have been deleted."
        action={
          <Button variant="ghost" onClick={onBack}>
            Back to halls
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All halls
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setGridOpen(true)}
          >
            <Grid3x3 className="h-4 w-4" /> Add block
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={addBooth}
          >
            <Plus className="h-4 w-4" /> Add booth
          </Button>
        </div>
      </div>

      <StatsBar stats={stats} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        <MapCanvas
          ref={canvasRef}
          aspect={map.aspect}
          background={map.background}
          panDisabled={dragging}
          onCanvasPointerDown={() => setSelectedId(null)}
          overlay={
            booths.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-text-secondary">
                  Add a block of booths, or place them one at a time.
                </p>
              </div>
            ) : null
          }
        >
          <MapField field={map.field} />

          {booths.map((booth) => {
            const isSelected = booth.id === selectedId;
            return (
              <div
                key={booth.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onPointerDown(e, booth, "move")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedId(booth.id);
                }}
                aria-label={`${booth.code || booth.name}, ${booth.kind}`}
                className={cn(
                  "absolute flex cursor-move flex-col items-center justify-center overflow-hidden rounded-md border text-center transition-colors",
                  KIND_STYLE[booth.kind] || KIND_STYLE.booth,
                  !booth.active && "opacity-40",
                  isSelected && "ring-2 ring-primary",
                )}
                style={{
                  left: `${booth.x}%`,
                  top: `${booth.y}%`,
                  width: `${booth.width}%`,
                  height: `${booth.height}%`,
                  transform: booth.rotation ? `rotate(${booth.rotation}deg)` : undefined,
                }}
              >
                <span className="pointer-events-none truncate px-0.5 text-[9px] font-medium leading-tight text-foreground">
                  {booth.code || booth.name}
                </span>
                {booth.kind === "booth" && booth.price ? (
                  <span className="pointer-events-none truncate text-[8px] leading-tight tabular-nums text-text-tertiary">
                    {currency(booth.price)}
                  </span>
                ) : null}

                {isSelected ? (
                  <span
                    role="presentation"
                    onPointerDown={(e) => onPointerDown(e, booth, "resize")}
                    className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-primary bg-background"
                  />
                ) : null}
              </div>
            );
          })}
        </MapCanvas>

        <div className="space-y-4">
          {selected ? (
            <BoothPanel
              booth={selected}
              onPatch={(partial) => patchBooth(selected.id, partial)}
              onDelete={() => removeBooth(selected.id)}
            />
          ) : (
            <MapFloorPanel
              config={map.config}
              field={map.field}
              background={map.background}
              onChange={patchConfig}
              onUpload={uploadPlan}
              title="Hall floor"
              description="Pick a booth to edit it, or set the hall up here."
            />
          )}
        </div>
      </div>

      <GridDialog
        open={gridOpen}
        onOpenChange={setGridOpen}
        onGenerate={runGrid}
        nextIndex={booths.length}
      />
    </div>
  );
}

export default HallMapEditor;
