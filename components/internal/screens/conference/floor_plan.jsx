"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  LayoutGrid,
  Loader2,
  Move,
  Plus,
  Store,
  Trash2,
  X,
} from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  EmptyState,
  Field,
  ScreenHeader,
  StatsBar,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
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
  cn,
} from "@geiger/ui";
import { useOptionalProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { currency } from "@/components/internal/shared/records/builders";
import {
  createBooth,
  createHallMap,
  deleteBooth,
  listBooths,
  listHallMaps,
  updateBooth,
} from "@/lib/supabase/hall_maps";
import { BOOTH_STATUS_MAP } from "./constants";
import { DEMO_BOOTHS } from "./demo_floor_plan";

// Floor Plan & Booths — an interactive expo map over events.hall_booths, the one
// booth concept in the app. A hall is a reusable venue-level template; an event
// attaches one on its Exhibitor Floor tab and sells stalls from it, and this
// screen is where the floor itself is laid out.
//
// Booths carry a position in x / y (percent of the canvas); a booth marked
// unplaced sits in a tray you drag onto the floor. The Available / Reserved /
// Occupied status here is PLANNING state on the template (metadata.status) — the
// live sold state is per event and lives in the event editor'"'"'s box office.

const SIZE_OPTIONS = ["Standard", "Large", "Premium"];
const STATUS_OPTIONS = Object.keys(BOOTH_STATUS_MAP);

// Status → floor-tile styling (semantic tailwind color utilities at /10–/30).
const FLOOR_STYLE = {
  Available: "border-emerald-400/30 bg-emerald-400/10 text-emerald-100",
  Reserved: "border-sky-400/30 bg-sky-400/10 text-sky-100",
  Occupied: "border-violet-400/30 bg-violet-400/10 text-violet-100",
};
const DOT_STYLE = {
  Available: "bg-emerald-400",
  Reserved: "bg-sky-400",
  Occupied: "bg-violet-400",
};

const isPlaced = (b) =>
  typeof b.config?.x === "number" && typeof b.config?.y === "number";

// hall_booths row -> the floor plan'"'"'s view model. The screen keeps its original
// { name, status, config } shape so the map, tray and inspector are untouched;
// only what backs them changed.
function toFloorBooth(row) {
  const meta = row.metadata || {};
  const placed = meta.placed !== false;
  return {
    id: row.id,
    name: row.code || row.name,
    status: meta.status || "Available",
    config: {
      hall: row.hall || "",
      size: row.sizeClass || "Standard",
      exhibitor: meta.exhibitor || "",
      price: Number(row.price) || 0,
      notes: meta.notes || "",
      x: placed ? Number(row.x) : null,
      y: placed ? Number(row.y) : null,
    },
  };
}

// …and back. Every save sends the whole booth, which keeps the three call sites
// (drag, inspector edit, status change) identical.
function toBoothPatch(view) {
  const cfg = view.config || {};
  const placed = typeof cfg.x === "number" && typeof cfg.y === "number";
  return {
    code: view.name || "",
    name: view.name || "",
    hall: cfg.hall || "",
    sizeClass: cfg.size || "Standard",
    price: Number(cfg.price) || 0,
    x: placed ? cfg.x : 0,
    y: placed ? cfg.y : 0,
    metadata: {
      status: view.status || "Available",
      exhibitor: cfg.exhibitor || "",
      notes: cfg.notes || "",
      placed,
    },
  };
}

const clamp = (n) => Math.max(2, Math.min(96, n));

function CreateBoothDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState({ name: "", hall: "", size: "Standard" });
  const close = (o) => {
    if (!o) setDraft({ name: "", hall: "", size: "Standard" });
    onOpenChange(o);
  };
  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the booth a name first.");
      return;
    }
    onCreate(draft);
    close(false);
  };
  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <Store className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">Add booth</DialogTitle>
            <DialogDescription className="text-xs">
              It starts in the tray — drag it onto the floor to place it.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 p-5">
            <Field label="Booth name / number">
              <Input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Booth A12"
              />
            </Field>
            <Field label="Hall / zone">
              <Input
                value={draft.hall}
                onChange={(e) => setDraft((d) => ({ ...d, hall: e.target.value }))}
                placeholder="e.g. Hall 1"
              />
            </Field>
            <Field label="Size">
              <Select value={draft.size} onValueChange={(v) => setDraft((d) => ({ ...d, size: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIZE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Add booth
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// `demo` seeds bundled sample booths and skips fetching/persisting so the map can
// run as a live playground on the public landing (no session there).
export function FloorPlanScreen({ demo = false }) {
  const projectId = useOptionalProject()?.projectId ?? null;
  const [booths, setBooths] = useState(demo ? DEMO_BOOTHS : []);
  const [loading, setLoading] = useState(!demo);
  const [userId, setUserId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  // The project's halls, and which one this screen is laying out. A hall is a
  // reusable template, so a project can have several (main hall, atrium…).
  const [halls, setHalls] = useState([]);
  const [hallId, setHallId] = useState(null);
  const canvasRef = useRef(null);
  const dragRef = useRef(null); // { id, moved }

  useEffect(() => {
    if (demo) return undefined;
    let alive = true;
    listHallMaps().then((rows) => {
      if (!alive) return;
      const list = rows ?? [];
      setHalls(list);
      setHallId((current) => current || list[0]?.id || null);
      if (list.length === 0) setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [projectId, demo]);

  useEffect(() => {
    if (demo || !hallId) return undefined;
    let alive = true;
    listBooths(hallId).then((rows) => {
      if (!alive) return;
      setBooths((rows ?? []).map(toFloorBooth));
      setSelectedId(null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [hallId, demo]);

  const placed = useMemo(() => booths.filter(isPlaced), [booths]);
  const tray = useMemo(() => booths.filter((b) => !isPlaced(b)), [booths]);
  const selected = useMemo(
    () => booths.find((b) => b.id === selectedId) || null,
    [booths, selectedId],
  );

  const stats = useMemo(() => {
    const occupied = booths.filter((b) => b.status === "Occupied");
    return [
      { label: "Booths", value: String(booths.length), footer: "On the floor" },
      { label: "Placed", value: String(placed.length), footer: `${tray.length} in tray` },
      { label: "Occupied", value: String(occupied.length), footer: "Assigned" },
      {
        label: "Floor value",
        value: currency(occupied.reduce((s, b) => s + (Number(b.config?.price) || 0), 0)),
        footer: "From occupied",
      },
    ];
  }, [booths, placed, tray]);

  // Persist one booth (optimistic local state already set). The caller hands us
  // the config it just wrote, because setBooths hasn't flushed yet.
  const persist = (id, config) => {
    if (demo) return;
    const current = booths.find((b) => b.id === id);
    if (!current) return;
    updateBooth(id, toBoothPatch({ ...current, config: config || current.config })).then(
      (saved) => {
        if (!saved) toast.error("Couldn't save to the server.");
      },
    );
  };

  const patchConfig = (id, partial, { save = true } = {}) => {
    let nextConfig = null;
    setBooths((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        nextConfig = { ...(b.config || {}), ...partial };
        return { ...b, config: nextConfig };
      }),
    );
    if (save && nextConfig) persist(id, nextConfig);
  };

  const patchRoot = (id, partial) => {
    let updated = null;
    setBooths((prev) =>
      prev.map((b) => {
        if (b.id !== id) return b;
        updated = { ...b, ...partial };
        return updated;
      }),
    );
    if (updated && !demo) {
      updateBooth(id, toBoothPatch(updated)).then((saved) => {
        if (!saved) toast.error("Couldn't save to the server.");
      });
    }
  };

  // --- Drag to position ------------------------------------------------------

  const pointToPercent = (clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return {
      x: clamp(((clientX - rect.left) / rect.width) * 100),
      y: clamp(((clientY - rect.top) / rect.height) * 100),
    };
  };

  const onBoothPointerDown = (e, booth) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: booth.id, moved: false };
  };

  const onBoothPointerMove = (e, booth) => {
    const drag = dragRef.current;
    if (!drag || drag.id !== booth.id) return;
    const pt = pointToPercent(e.clientX, e.clientY);
    if (!pt) return;
    drag.moved = true;
    patchConfig(booth.id, pt, { save: false });
  };

  const onBoothPointerUp = (e, booth) => {
    const drag = dragRef.current;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* capture may already be gone */
    }
    if (!drag || drag.id !== booth.id) return;
    if (drag.moved) {
      persist(booth.id, booths.find((b) => b.id === booth.id)?.config || {});
    } else {
      setSelectedId(booth.id);
    }
  };

  // --- Tray → floor ----------------------------------------------------------

  const placeFromTray = (booth) => {
    // Drop near the center with a little scatter so stacked booths don't hide.
    const scatter = (placed.length % 5) * 6;
    patchConfig(booth.id, { x: clamp(40 + scatter), y: clamp(42 + scatter) });
    setSelectedId(booth.id);
  };

  const sendToTray = (booth) => {
    patchConfig(booth.id, { x: null, y: null });
  };

  // --- Create / delete -------------------------------------------------------

  const handleCreate = (draft) => {
    const booth = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      status: "Available",
      // A new booth starts in the tray, so it has no position yet.
      config: { hall: draft.hall, size: draft.size, exhibitor: "", price: 0, notes: "", x: null, y: null },
    };
    setBooths((prev) => [booth, ...prev]);
    toast.success(`"${booth.name}" added.`);
    if (demo) return;
    createBooth({
      id: booth.id,
      hallMapId: hallId,
      kind: "booth",
      width: 8,
      height: 6,
      sortOrder: booths.length,
      ...toBoothPatch(booth),
    }).then((saved) => {
      if (!saved) {
        setBooths((prev) => prev.filter((b) => b.id !== booth.id));
        toast.error("Couldn't save to the server.");
      }
    });
  };

  // Create the project's first hall from here, so the screen is usable without
  // going to a venue first. It has no venue until someone attaches one.
  const handleCreateHall = async () => {
    const created = await createHallMap({
      id: crypto.randomUUID(),
      projectId,
      name: "Exhibitor hall",
      status: "Active",
      createdBy: userId,
    });
    if (!created) {
      toast.error("Couldn't create the hall.");
      return;
    }
    setHalls((prev) => [created, ...prev]);
    setHallId(created.id);
    toast.success("Hall created.");
  };

  const handleDelete = (booth) => {
    setBooths((prev) => prev.filter((b) => b.id !== booth.id));
    if (selectedId === booth.id) setSelectedId(null);
    toast.success(`Deleted "${booth.name}".`);
    if (demo) return;
    deleteBooth(booth.id).then((ok) => {
      if (!ok) toast.error("Couldn't delete on the server.");
    });
  };

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Floor Plan & Booths"
        description="Lay out the exhibitor floor visually — drag booths into place, colour-coded by status. Events sell stalls from this floor on their Exhibitor Floor tab."
        actions={
          <div className="flex items-center gap-2">
            {halls.length > 1 ? (
              <div className="w-52">
                <Select value={hallId || ""} onValueChange={setHallId}>
                  <SelectTrigger aria-label="Exhibitor hall">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {halls.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name || "Untitled hall"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!demo && !hallId}
              onClick={() => setCreateOpen(true)}
            >
              <Plus className="h-4 w-4" /> Add booth
            </Button>
          </div>
        }
      />

      <StatsBar stats={stats} />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading floor…
        </div>
      ) : !demo && !hallId ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={LayoutGrid}
            title="No exhibitor hall yet"
            description="A hall is the reusable floor plan events sell booths from. Create one here, or build it on a venue to reuse it across events."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={handleCreateHall}
              >
                <Plus className="h-4 w-4" /> Create a hall
              </Button>
            }
          />
        </div>
      ) : booths.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={LayoutGrid}
            title="No booths yet"
            description="Add a booth to start laying out the exhibitor floor."
            action={
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" /> Add booth
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_320px]">
          <div className="min-w-0 space-y-4">
            {/* Legend */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
              {STATUS_OPTIONS.map((s) => (
                <span key={s} className="inline-flex items-center gap-1.5">
                  <span className={cn("h-2 w-2 rounded-full", DOT_STYLE[s])} />
                  {s}
                </span>
              ))}
              <span className="inline-flex items-center gap-1.5 text-text-tertiary">
                <Move className="h-3 w-3" /> Drag to reposition · click to edit
              </span>
            </div>

            {/* Canvas */}
            <div
              ref={canvasRef}
              className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl border border-border bg-surface-subtle"
              style={{
                backgroundImage:
                  "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            >
              <span className="pointer-events-none absolute left-3 top-3 rounded-md border border-border bg-surface-card/80 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-text-tertiary">
                Exhibitor floor
              </span>

              {placed.length === 0 ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <p className="text-sm text-text-tertiary">
                    Drag booths from the tray onto the floor →
                  </p>
                </div>
              ) : null}

              {placed.map((b) => {
                const active = selectedId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onPointerDown={(e) => onBoothPointerDown(e, b)}
                    onPointerMove={(e) => onBoothPointerMove(e, b)}
                    onPointerUp={(e) => onBoothPointerUp(e, b)}
                    style={{ left: `${b.config.x}%`, top: `${b.config.y}%` }}
                    className={cn(
                      "absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none select-none flex-col items-start gap-0.5 rounded-lg border px-2.5 py-1.5 text-left shadow-md transition-shadow active:cursor-grabbing",
                      FLOOR_STYLE[b.status] || "border-border bg-surface-card text-foreground",
                      active && "ring-2 ring-primary ring-offset-2 ring-offset-surface-subtle",
                    )}
                  >
                    <span className="max-w-[120px] truncate text-xs font-semibold">
                      {b.name || "Booth"}
                    </span>
                    <span className="max-w-[120px] truncate text-[10px] opacity-80">
                      {b.config.exhibitor || b.config.hall || b.config.size}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Tray */}
            <div className="rounded-xl border border-dashed border-border bg-surface-subtle/60 p-4">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
                Unplaced booths · {tray.length}
              </p>
              {tray.length ? (
                <div className="flex flex-wrap gap-2">
                  {tray.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => placeFromTray(b)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface-card px-2.5 py-1.5 text-xs text-foreground transition-colors hover:border-border-strong hover:bg-surface-hover"
                    >
                      <span className={cn("h-2 w-2 rounded-full", DOT_STYLE[b.status] || "bg-text-tertiary")} />
                      {b.name || "Booth"}
                      <Plus className="h-3 w-3 text-text-tertiary" />
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-text-tertiary">Every booth is placed on the floor.</p>
              )}
            </div>
          </div>

          {/* Inspector */}
          <aside className="min-w-0">
            <div className="rounded-2xl border border-border bg-surface-subtle p-5 xl:sticky xl:top-0">
              {selected ? (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold text-white">
                        {selected.name || "Untitled booth"}
                      </h2>
                      <StatusPill status={selected.status} map={BOOTH_STATUS_MAP} className="mt-1" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedId(null)}
                      aria-label="Close"
                      className="text-text-tertiary hover:text-foreground"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <Field label="Status">
                    <Select value={selected.status} onValueChange={(v) => patchRoot(selected.id, { status: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Field label="Exhibitor">
                    <Input
                      value={selected.config?.exhibitor ?? ""}
                      onChange={(e) => patchConfig(selected.id, { exhibitor: e.target.value }, { save: false })}
                      onBlur={() => persist(selected.id, selected.config)}
                      placeholder="Who's assigned"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Hall / zone">
                      <Input
                        value={selected.config?.hall ?? ""}
                        onChange={(e) => patchConfig(selected.id, { hall: e.target.value }, { save: false })}
                        onBlur={() => persist(selected.id, selected.config)}
                        placeholder="Hall 1"
                      />
                    </Field>
                    <Field label="Size">
                      <Select
                        value={selected.config?.size || "Standard"}
                        onValueChange={(v) => patchConfig(selected.id, { size: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SIZE_OPTIONS.map((s) => (
                            <SelectItem key={s} value={s}>
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  <Field label="Price">
                    <Input
                      type="number"
                      min={0}
                      value={selected.config?.price ?? ""}
                      onChange={(e) => patchConfig(selected.id, { price: Number(e.target.value) || 0 }, { save: false })}
                      onBlur={() => persist(selected.id, selected.config)}
                      placeholder="e.g. 2500"
                    />
                  </Field>

                  <Field label="Notes">
                    <Textarea
                      rows={3}
                      value={selected.config?.notes ?? ""}
                      onChange={(e) => patchConfig(selected.id, { notes: e.target.value }, { save: false })}
                      onBlur={() => persist(selected.id, selected.config)}
                      placeholder="Setup, power, neighbours…"
                    />
                  </Field>

                  <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sendToTray(selected)}
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    >
                      Remove from floor
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(selected)}
                      className="border-border bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-10 text-center">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-card text-text-secondary">
                    <Store className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium text-foreground">No booth selected</p>
                  <p className="max-w-[220px] text-xs text-text-secondary">
                    Click a booth on the floor to edit its status, exhibitor, and details.
                  </p>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      <CreateBoothDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />
    </MainScreenWrapper>
  );
}

export default FloorPlanScreen;
