"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArmchairIcon,
  ArrowLeft,
  LayoutGrid,
  Loader2,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";

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
  Textarea,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { generateSeats, sectionSeatCount } from "@/lib/seating/generate";
import { parseManifest } from "@/lib/seating/csv";
import { BOWL_SHAPES, bowlSeatCount, generateBowl } from "@/lib/seating/bowl";
import {
  createBowl,
  createSection,
  deleteSection,
  getSeatMap,
  importManifest,
  regenerateSectionSeats,
  updateSeat,
  updateSeatMap,
  updateSection,
} from "@/lib/supabase/seat_maps";
import { uploadVenueImage } from "@/lib/supabase/storage";

// Canvas editor for one seat map configuration. Sections are percent-positioned
// blocks dragged onto the floor — the same interaction the conference floor plan
// uses for booths. A section's chairs are generated from its layout parameters;
// selecting a section drills into its seats, mirroring how buyers see the map.

const SEAT_KIND_CYCLE = ["standard", "wheelchair", "companion", "obstructed", "house"];

const SEAT_KIND_STYLE = {
  standard: "bg-surface-strong border-border-strong",
  wheelchair: "bg-sky-400/30 border-sky-400/50",
  companion: "bg-sky-400/15 border-sky-400/30",
  obstructed: "bg-amber-400/20 border-amber-400/40",
  house: "bg-violet-400/20 border-violet-400/40",
};

const DEFAULT_LAYOUT = {
  rows: 8,
  seatsPerRow: 12,
  rowLabels: "alpha",
  rowLabelStart: "A",
  numbering: "continental",
  curve: 0,
  rake: 0,
  aisleAfter: [],
};

const clampPos = (n) => Math.max(0, Math.min(96, n));
const clampSize = (n) => Math.max(4, Math.min(100, n));

// "4, 8" -> [4, 8]; tolerates spaces and stray separators.
const parseAisles = (text) =>
  String(text || "")
    .split(/[,\s]+/)
    .map((v) => Number.parseInt(v, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

function ImportDialog({ open, onOpenChange, onImport }) {
  const [text, setText] = useState("");
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);

  const close = (next) => {
    if (!next) {
      setText("");
      setErrors([]);
    }
    onOpenChange(next);
  };

  const submit = async () => {
    const parsed = parseManifest(text);
    // Errors render in the dialog, not a toast — a 40-row list must stay readable.
    setErrors(parsed.errors);
    if (!parsed.sections.length) return;
    setBusy(true);
    const ok = await onImport(parsed);
    setBusy(false);
    if (ok) close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="space-y-1 border-b border-border p-5 text-left">
          <DialogTitle className="text-base">Import a seat manifest</DialogTitle>
          <DialogDescription className="text-xs">
            Paste a CSV with <code>section, row, seat</code> columns (an optional{" "}
            <code>kind</code> column marks wheelchair, companion, obstructed or house
            seats). Positions are generated for you.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 p-5">
          <Field label="CSV" hint="Exports from most box-office systems work as-is.">
            <Textarea
              rows={10}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"section,row,seat\nOrchestra,A,1\nOrchestra,A,2"}
              className="font-mono text-xs"
            />
          </Field>
          {errors.length > 0 ? (
            <div className="max-h-40 overflow-y-auto rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="mb-1 text-xs font-medium text-red-400">
                {errors.length} problem{errors.length > 1 ? "s" : ""} found
              </p>
              <ul className="space-y-0.5 text-xs text-text-secondary">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
          <Button
            type="button"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => close(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !text.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {busy ? "Importing…" : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Lay a whole bowl out in one go. Everything here is a preview over the pure
// generator — nothing is written until the organiser confirms, and the seat
// count is shown first because a two-tier arena is tens of thousands of rows.
function BowlDialog({ open, onOpenChange, field, onGenerate, hasSections }) {
  const [draft, setDraft] = useState({
    shape: "oval",
    tiers: 2,
    perSide: 6,
    tierDepth: 10,
    rows: 12,
    seatsPerRow: 14,
    tables: 16,
    seatsPerTable: 10,
  });
  const [busy, setBusy] = useState(false);

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const num = (key) => (e) => set(key)(Number(e.target.value) || 0);

  const preview = useMemo(() => generateBowl({ ...draft, field }), [draft, field]);
  const isRounds = draft.shape === "rounds";

  const submit = async () => {
    setBusy(true);
    const ok = await onGenerate(preview);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg bg-background">
        <DialogHeader>
          <DialogTitle>Generate the bowl</DialogTitle>
          <DialogDescription>
            Lay sections around the central feature, then drag any of them to match the real
            venue. Import a CSV manifest afterwards to fill in the real row and seat labels.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Shape" hint={BOWL_SHAPES.find((s) => s.value === draft.shape)?.hint}>
            <Select value={draft.shape} onValueChange={set("shape")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BOWL_SHAPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {isRounds ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tables">
                <Input
                  type="number"
                  min={1}
                  max={200}
                  inputMode="numeric"
                  value={draft.tables}
                  onChange={num("tables")}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Seats per table">
                <Input
                  type="number"
                  min={2}
                  max={20}
                  inputMode="numeric"
                  value={draft.seatsPerTable}
                  onChange={num("seatsPerTable")}
                  className="tabular-nums"
                />
              </Field>
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Tiers">
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    inputMode="numeric"
                    value={draft.tiers}
                    onChange={num("tiers")}
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Per side">
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    inputMode="numeric"
                    value={draft.perSide}
                    onChange={num("perSide")}
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Tier depth %">
                  <Input
                    type="number"
                    min={3}
                    max={30}
                    inputMode="numeric"
                    value={draft.tierDepth}
                    onChange={num("tierDepth")}
                    className="tabular-nums"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Rows per section">
                  <Input
                    type="number"
                    min={1}
                    max={80}
                    inputMode="numeric"
                    value={draft.rows}
                    onChange={num("rows")}
                    className="tabular-nums"
                  />
                </Field>
                <Field label="Seats per row">
                  <Input
                    type="number"
                    min={1}
                    max={80}
                    inputMode="numeric"
                    value={draft.seatsPerRow}
                    onChange={num("seatsPerRow")}
                    className="tabular-nums"
                  />
                </Field>
              </div>
            </>
          )}

          <p className="rounded-lg border border-border bg-surface-subtle p-3 text-xs text-text-secondary tabular-nums">
            {preview.length} sections · {bowlSeatCount(preview).toLocaleString()} seats
            {hasSections ? (
              <span className="mt-1 block text-red-400">
                This replaces every section already on this map.
              </span>
            ) : null}
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
            disabled={busy || preview.length === 0}
            onClick={submit}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LayoutGrid className="h-4 w-4" />}
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Layout fields are buffered locally and committed on blur, so typing "12" into
// a seats-per-row box doesn't regenerate the section once per keystroke.
function SectionPanel({ section, seatCount, onPatch, onCommitLayout, onCommitRotation, onDelete }) {
  const [draft, setDraft] = useState(section.layout || {});
  const [seedId, setSeedId] = useState(section.id);
  if (section.id !== seedId) {
    setSeedId(section.id);
    setDraft(section.layout || {});
  }

  const setLayout = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const commit = () => onCommitLayout(draft);

  const isGa = section.kind === "ga";

  return (
    <SectionCard
      title={section.name || "Section"}
      action={
        <Button
          size="sm"
          variant="ghost"
          className="text-red-400 hover:bg-red-500/10 hover:text-red-400"
          onClick={onDelete}
          aria-label="Delete section"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <Input
            value={section.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="e.g. Orchestra"
          />
        </Field>

        <Field label="Type" hint="A GA zone sells by capacity and has no chairs.">
          <Select value={section.kind} onValueChange={(v) => onPatch({ kind: v })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="seated">Seated (individual chairs)</SelectItem>
              <SelectItem value="ga">General admission zone</SelectItem>
            </SelectContent>
          </Select>
        </Field>

        <Field
          label="Facing"
          hint="Degrees clockwise. 0 faces up; a bowl section is turned to face the field."
        >
          <Input
            type="number"
            min={0}
            max={359}
            inputMode="numeric"
            value={Math.round(section.rotation ?? 0)}
            onChange={(e) => onPatch({ rotation: Number(e.target.value) || 0 })}
            onBlur={onCommitRotation}
            className="tabular-nums"
          />
        </Field>

        {isGa ? (
          <Field label="Capacity">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              value={section.capacity}
              onChange={(e) => onPatch({ capacity: Number(e.target.value) || 0 })}
              className="tabular-nums"
            />
          </Field>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Rows">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={draft.rows ?? 0}
                  onChange={(e) => setLayout("rows")(Number(e.target.value) || 0)}
                  onBlur={commit}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Seats per row">
                <Input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={draft.seatsPerRow ?? 0}
                  onChange={(e) => setLayout("seatsPerRow")(Number(e.target.value) || 0)}
                  onBlur={commit}
                  className="tabular-nums"
                />
              </Field>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Row labels">
                <Select
                  value={draft.rowLabels || "alpha"}
                  onValueChange={(v) => {
                    const next = { ...draft, rowLabels: v };
                    setDraft(next);
                    onCommitLayout(next);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alpha">A, B, C…</SelectItem>
                    <SelectItem value="numeric">1, 2, 3…</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="First row">
                <Input
                  value={draft.rowLabelStart ?? "A"}
                  onChange={(e) => setLayout("rowLabelStart")(e.target.value)}
                  onBlur={commit}
                />
              </Field>
            </div>

            <Field
              label="Seat numbering"
              hint="Odd/even counts outward from the centre aisle, the American theatre convention."
            >
              <Select
                value={draft.numbering || "continental"}
                onValueChange={(v) => {
                  const next = { ...draft, numbering: v };
                  setDraft(next);
                  onCommitLayout(next);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continental">Continental (1 → N across)</SelectItem>
                  <SelectItem value="odd-even">Odd / even from centre</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Curve" hint="Degrees of bow">
                <Input
                  type="number"
                  min={0}
                  max={90}
                  inputMode="numeric"
                  value={draft.curve ?? 0}
                  onChange={(e) => setLayout("curve")(Number(e.target.value) || 0)}
                  onBlur={commit}
                  className="tabular-nums"
                />
              </Field>
              <Field label="Rake" hint="Row spacing toward the back">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={draft.rake ?? 0}
                  onChange={(e) => setLayout("rake")(Number(e.target.value) || 0)}
                  onBlur={commit}
                  className="tabular-nums"
                />
              </Field>
            </div>

            <Field label="Aisles after seat" hint="Comma-separated, e.g. 4, 8">
              <Input
                value={(draft.aisleAfter || []).join(", ")}
                onChange={(e) => setLayout("aisleAfter")(parseAisles(e.target.value))}
                onBlur={commit}
                placeholder="none"
              />
            </Field>
          </>
        )}

        <p className="border-t border-border pt-3 text-xs text-text-secondary tabular-nums">
          {isGa ? `${section.capacity} capacity` : `${seatCount} seats`}
        </p>
      </div>
    </SectionCard>
  );
}

export function SeatMapEditor({ mapId, onBack }) {
  const [map, setMap] = useState(null);
  const [sections, setSections] = useState([]);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [bowlOpen, setBowlOpen] = useState(false);
  // Panning is suppressed while a block is being dragged, so the floor doesn't
  // slide out from under it.
  const [dragging, setDragging] = useState(false);
  const canvasRef = useRef(null);
  const dragRef = useRef(null);

  // Bumping the token re-runs the fetch effect. Handlers reconcile through it
  // instead of calling a loader directly, keeping setState out of the effect body.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    let alive = true;
    getSeatMap(mapId).then((data) => {
      if (!alive) return;
      if (data) {
        setMap(data);
        setSections(data.sections);
        setSeats(data.seats);
      }
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [mapId, reloadToken]);

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) || null,
    [sections, selectedId],
  );

  const selectedSeats = useMemo(
    () => (selected ? seats.filter((s) => s.sectionId === selected.id) : []),
    [seats, selected],
  );

  const stats = useMemo(() => {
    const seated = sections.filter((s) => s.kind !== "ga");
    const ga = sections.filter((s) => s.kind === "ga");
    const accessible = seats.filter(
      (s) => s.kind === "wheelchair" || s.kind === "companion",
    );
    return [
      { label: "Seats", value: String(seats.length), footer: `${seated.length} sections` },
      {
        label: "GA capacity",
        value: String(ga.reduce((sum, s) => sum + (Number(s.capacity) || 0), 0)),
        footer: `${ga.length} zones`,
      },
      { label: "Accessible", value: String(accessible.length), footer: "Wheelchair + companion" },
      {
        label: "Total capacity",
        value: String(
          seats.length + ga.reduce((sum, s) => sum + (Number(s.capacity) || 0), 0),
        ),
        footer: "Seated + standing",
      },
    ];
  }, [sections, seats]);

  // --- floor config --------------------------------------------------------

  // The floor's shape, central feature and traced plan all live in the map's
  // config jsonb, so one patch + one save serves all of them.
  const patchConfig = (partial) => {
    const config = { ...(map?.config || {}), ...partial };
    setMap((prev) => (prev ? { ...prev, config, ...partial } : prev));
    updateSeatMap(mapId, { config }).then((row) => {
      if (!row) toast.error("Couldn't save the floor.");
    });
  };

  const uploadPlan = (file) => uploadVenueImage(map?.venueId, file);

  // --- section mutations ---------------------------------------------------

  const patchSection = (id, partial) => {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, ...partial } : s)));
    updateSection(id, partial).then((row) => {
      if (!row) toast.error("Couldn't save the section.");
    });
  };

  // Layout changes rebuild the section's chairs, so they persist and regenerate
  // together and the canvas reloads the new seats.
  const commitLayout = async (id, layout) => {
    const next = sections.find((s) => s.id === id);
    if (!next) return;
    const merged = { ...next, layout };
    setSections((prev) => prev.map((s) => (s.id === id ? merged : s)));
    const saved = await updateSection(id, { layout });
    if (!saved) {
      toast.error("Couldn't save the layout.");
      return;
    }
    const count = await regenerateSectionSeats(merged);
    if (count === false) {
      toast.error("Couldn't rebuild the seats.");
      return;
    }
    reload();
  };

  const addSection = async () => {
    const created = await createSection({
      id: crypto.randomUUID(),
      seatMapId: mapId,
      name: `Section ${sections.length + 1}`,
      kind: "seated",
      x: 10,
      y: 10,
      width: 40,
      height: 25,
      layout: DEFAULT_LAYOUT,
      sortOrder: sections.length,
    });
    if (!created) {
      toast.error("Couldn't add the section.");
      return;
    }
    const count = await regenerateSectionSeats(created);
    if (count === false) toast.error("Section added, but its seats didn't generate.");
    reload();
    setSelectedId(created.id);
  };

  const removeSection = async (id) => {
    setSections((prev) => prev.filter((s) => s.id !== id));
    setSeats((prev) => prev.filter((s) => s.sectionId !== id));
    setSelectedId(null);
    const ok = await deleteSection(id);
    if (!ok) {
      toast.error("Couldn't delete the section.");
      reload();
      return;
    }
    toast.success("Section deleted.");
  };

  const cycleSeatKind = (seat) => {
    const next = SEAT_KIND_CYCLE[(SEAT_KIND_CYCLE.indexOf(seat.kind) + 1) % SEAT_KIND_CYCLE.length];
    setSeats((prev) => prev.map((s) => (s.id === seat.id ? { ...s, kind: next } : s)));
    updateSeat(seat.id, { kind: next }).then((row) => {
      if (!row) toast.error("Couldn't update the seat.");
    });
  };

  // Rotating a section moves its chairs with it, so the seats are rebuilt on
  // commit exactly as a layout change does.
  const commitRotation = async () => {
    const current = sections.find((s) => s.id === selectedId);
    if (!current) return;
    const saved = await updateSection(current.id, { rotation: current.rotation });
    if (!saved) {
      toast.error("Couldn't save the rotation.");
      return;
    }
    await regenerateSectionSeats(saved);
    reload();
  };

  const runBowl = async (drafts) => {
    const result = await createBowl(mapId, drafts, { replace: sections.length > 0 });
    if (!result) {
      toast.error("Couldn't generate the bowl.");
      return false;
    }
    reload();
    setSelectedId(null);
    if (result.partial) {
      toast.error(`Generated ${result.sections} sections, but only ${result.seats} seats landed.`);
      return true;
    }
    toast.success(
      `Generated ${result.sections} sections and ${result.seats.toLocaleString()} seats.`,
    );
    return true;
  };

  const runImport = async (parsed) => {
    const result = await importManifest(mapId, parsed);
    if (!result) {
      toast.error("Couldn't import the manifest.");
      return false;
    }
    reload();
    toast.success(`Imported ${result.seats} seats across ${result.sections} sections.`);
    return true;
  };

  // --- canvas drag ---------------------------------------------------------

  const onPointerDown = (event, section, mode) => {
    event.preventDefault();
    event.stopPropagation();
    if (!canvasRef.current) return;
    dragRef.current = {
      id: section.id,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: { x: section.x, y: section.y, width: section.width, height: section.height },
    };
    setDragging(true);
    setSelectedId(section.id);
  };

  useEffect(() => {
    const onMove = (event) => {
      const drag = dragRef.current;
      if (!drag) return;
      // Deltas go through the canvas so a block tracks the cursor at any zoom.
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
      setSections((prev) => prev.map((s) => (s.id === drag.id ? { ...s, ...next } : s)));
    };

    const onUp = () => {
      const drag = dragRef.current;
      dragRef.current = null;
      setDragging(false);
      // No movement between down and up is a plain click, not a drag.
      if (!drag?.next) return;
      // Persist the final geometry, then rebuild chairs so they follow the box.
      updateSection(drag.id, drag.next).then(async (row) => {
        if (!row) {
          toast.error("Couldn't save the position.");
          return;
        }
        await regenerateSectionSeats(row);
        reload();
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
        icon={ArmchairIcon}
        title="Configuration not found"
        description="It may have been deleted."
        action={
          <Button variant="ghost" onClick={onBack}>
            Back to configurations
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
          All configurations
        </button>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setBowlOpen(true)}
          >
            <LayoutGrid className="h-4 w-4" /> Generate bowl
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setImportOpen(true)}
          >
            <Upload className="h-4 w-4" /> Import CSV
          </Button>
          <Button
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={addSection}
          >
            <Plus className="h-4 w-4" /> Add section
          </Button>
        </div>
      </div>

      <StatsBar stats={stats} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_340px]">
        {/* Floor */}
        <MapCanvas
          ref={canvasRef}
          aspect={map.aspect}
          background={map.background}
          panDisabled={dragging}
          onCanvasPointerDown={() => setSelectedId(null)}
          overlay={
            sections.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <p className="text-sm text-text-secondary">
                  Generate a bowl, add a section, or import a CSV manifest.
                </p>
              </div>
            ) : null
          }
        >
          <MapField field={map.field} />

          {/* The selected section's chairs are drawn in CANVAS space, not inside
              the block: a rotated section's seats legitimately fall outside its
              box, and nesting them would rotate them a second time. */}
          {selected
            ? selectedSeats.map((seat) => (
                <button
                  key={seat.id}
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleSeatKind(seat);
                  }}
                  aria-label={`Row ${seat.rowLabel} seat ${seat.seatLabel}, ${seat.kind}`}
                  title={`${seat.rowLabel}${seat.seatLabel} · ${seat.kind}`}
                  className={cn(
                    "absolute z-10 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full border",
                    SEAT_KIND_STYLE[seat.kind] || SEAT_KIND_STYLE.standard,
                  )}
                  style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
                />
              ))
            : null}

          {sections.map((section) => {
            const isSelected = section.id === selectedId;
            const count =
              section.kind === "ga" ? section.capacity : sectionSeatCount(section);
            return (
              <div
                key={section.id}
                role="button"
                tabIndex={0}
                onPointerDown={(e) => onPointerDown(e, section, "move")}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") setSelectedId(section.id);
                }}
                aria-label={`${section.name}, ${count} seats`}
                className={cn(
                  "absolute cursor-move rounded-lg border transition-colors",
                  section.kind === "ga"
                    ? "border-amber-400/30 bg-amber-400/10"
                    : "border-sky-400/30 bg-sky-400/10",
                  isSelected && "ring-2 ring-primary",
                )}
                style={{
                  left: `${section.x}%`,
                  top: `${section.y}%`,
                  width: `${section.width}%`,
                  height: `${section.height}%`,
                  transform: section.rotation ? `rotate(${section.rotation}deg)` : undefined,
                }}
              >
                <span className="pointer-events-none absolute left-2 top-1.5 text-[10px] font-medium uppercase tracking-wide text-foreground">
                  {section.name}
                </span>
                <span className="pointer-events-none absolute right-2 top-1.5 text-[10px] tabular-nums text-text-secondary">
                  {count}
                </span>

                {isSelected ? (
                  <span
                    role="presentation"
                    onPointerDown={(e) => onPointerDown(e, section, "resize")}
                    className="absolute -bottom-1 -right-1 h-3 w-3 cursor-se-resize rounded-sm border border-primary bg-background"
                  />
                ) : null}
              </div>
            );
          })}
        </MapCanvas>

        {/* Panel */}
        <div className="space-y-4">
          {selected ? (
            <SectionPanel
              section={selected}
              seatCount={selectedSeats.length}
              onPatch={(partial) => patchSection(selected.id, partial)}
              onCommitLayout={(layout) => commitLayout(selected.id, layout)}
              onCommitRotation={commitRotation}
              onDelete={() => removeSection(selected.id)}
            />
          ) : (
            <MapFloorPanel
              config={map.config}
              field={map.field}
              background={map.background}
              onChange={patchConfig}
              onUpload={uploadPlan}
              description="Pick a section on the floor to edit its rows and seats, or set the room up here."
            />
          )}

          {selected && selected.kind !== "ga" ? (
            <SectionCard title="Seat legend">
              <ul className="space-y-2 text-xs text-text-secondary">
                {SEAT_KIND_CYCLE.map((kind) => (
                  <li key={kind} className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-2.5 w-2.5 rounded-full border",
                        SEAT_KIND_STYLE[kind],
                      )}
                    />
                    <span className="capitalize">{kind}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-border pt-3 text-xs text-text-tertiary">
                Click a chair on the floor to cycle its type.
              </p>
            </SectionCard>
          ) : null}
        </div>
      </div>

      <ImportDialog open={importOpen} onOpenChange={setImportOpen} onImport={runImport} />
      <BowlDialog
        open={bowlOpen}
        onOpenChange={setBowlOpen}
        field={map.field}
        hasSections={sections.length > 0}
        onGenerate={runBowl}
      />
    </div>
  );
}

// Preview helper for the create dialog — shows what a layout will produce before
// anything is written.
export function previewSeatCount(layout) {
  return generateSeats({ x: 0, y: 0, width: 100, height: 100, layout }).length;
}

export default SeatMapEditor;
