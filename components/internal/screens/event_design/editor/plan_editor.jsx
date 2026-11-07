"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BookmarkPlus, CircleCheck, Library, Loader2, Map as MapIcon, PencilLine, Save } from "lucide-react";

import {
  ActionMenu,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  LogoLoading,
} from "@geiger/ui";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorHeader } from "@/components/internal/shared/editor_shell";
import { EmptyState, InlineTitleInput, StatusPill } from "@/components/internal/shared/screen_kit";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { listDesignObjects } from "@/lib/supabase/design_objects";
import { createFloorPlan, getFloorPlan, saveFloorPlan, updateFloorPlan } from "@/lib/supabase/floor_plans";
import {
  alignInstances,
  arrayInstances,
  catalogById as indexCatalog,
  cloneObjects,
  createInstance,
  distributeInstances,
  duplicateInstances,
  gridStepFor,
  nextTableLabel,
  nudgeStepFor,
  planContent,
  planStats,
  removeInstances,
  resolveCatalog,
  rotateInstances,
  snapToGrid,
  translateInstances,
  validatePlan,
} from "@/lib/event_design";
import { PLAN_STATUS_MAP } from "../constants";
import { SetupStyleSelect } from "../fields";
import { useDesignContext } from "../use_design_context";
import { SaveAsDialog } from "../dialogs/plan_dialogs";
import { EditorCanvas } from "./editor_canvas";
import { LibraryPanel } from "./library_panel";
import { MultiInspector, ObjectInspector, RoomInspector } from "./inspector_panel";
import { StatusBar } from "./status_bar";
import { usePlanHistory } from "./use_plan_history";
import { EDITOR_EXTENSIONS } from "./extensions";

// The floor plan editor: header (name, setup style, extension slots incl. Share, Save) → library | canvas | inspector → status dock.

const KIND_LABEL = { template: "Template", library: "Venue diagram" };

const metaOf = (p) => ({
  name: p.name,
  notes: p.notes,
  eventId: p.eventId,
  venueId: p.venueId,
  venueSpaceId: p.venueSpaceId,
  kind: p.kind,
});

const isTyping = (target) =>
  target?.closest?.(
    "input, textarea, select, [contenteditable='true'], [role='dialog'], [role='menu'], [role='listbox'], [role='combobox']",
  );
const isControl = (target) => target?.closest?.("button, a, [role='button']");

const SHORTCUTS = [
  ["Drag", "move · Shift+click or drag a box to multi-select"],
  ["R / Shift+R", "rotate 15°"],
  ["Arrows", "nudge (Shift = one grid step)"],
  ["Ctrl+D", "duplicate"],
  ["Del", "delete"],
  ["Ctrl+Z / Ctrl+Shift+Z", "undo / redo"],
  ["Space+drag", "pan · scroll to zoom"],
  ["Ctrl+S", "save"],
];

export function FloorPlanEditor({ planId, onBack, backLabel = "Floor Plans", onSaved }) {
  const { projectId } = useProject();
  const ctx = useDesignContext(projectId);
  const history = usePlanHistory(null);
  const { doc, reset: resetHistory } = history;
  const rendererRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [plan, setPlan] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [meta, setMeta] = useState(null);
  const [saved, setSaved] = useState({ doc: "", meta: "" });
  const [selection, setSelection] = useState([]);
  const [tool, setTool] = useState("select");
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [snapOn, setSnapOn] = useState(true);
  const [gridOn, setGridOn] = useState(true);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [saveAs, setSaveAs] = useState(null);

  const load = useCallback(
    (p) => {
      const content = planContent(p);
      const m = metaOf(p);
      setPlan(p);
      setMeta(m);
      resetHistory(content);
      setSaved({ doc: JSON.stringify(content), meta: JSON.stringify(m) });
      setSelection([]);
    },
    [resetHistory],
  );

  useEffect(() => {
    let alive = true;
    Promise.all([getFloorPlan(planId), listDesignObjects(projectId)]).then(([p, objects]) => {
      if (!alive) return;
      setCatalog(resolveCatalog(objects));
      if (p) load(p);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [planId, projectId, load]);

  const catalogIndex = useMemo(() => indexCatalog(catalog), [catalog]);
  const stats = useMemo(() => (doc ? planStats(doc) : null), [doc]);
  const space = meta?.venueSpaceId ? ctx.spaceById.get(meta.venueSpaceId) || null : null;
  const docJson = useMemo(() => (doc ? JSON.stringify(doc) : ""), [doc]);
  const dirty = Boolean(doc && meta) && (docJson !== saved.doc || JSON.stringify(meta) !== saved.meta);
  const selectedObjects = useMemo(
    () => (doc ? doc.objects.filter((o) => selection.includes(o.id)) : []),
    [doc, selection],
  );

  // Warn before a reload / tab close drops unsaved work.
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const patchMeta = (patch) => setMeta((m) => ({ ...m, ...patch }));

  const save = async ({ force = false } = {}) => {
    if (!plan || !doc || saving) return false;
    const check = validatePlan(doc);
    if (!check.ok) {
      toast.error(check.errors[0]);
      return false;
    }
    const sentDoc = doc;
    const sentMeta = meta;
    setSaving(true);
    const result = await saveFloorPlan(plan.id, { ...sentDoc, ...sentMeta }, plan.version, { force });
    setSaving(false);
    if (result === "conflict") {
      setConflict(true);
      return false;
    }
    if (!result) {
      toast.error("Couldn't save the plan.");
      return false;
    }
    setPlan(result);
    setSaved({ doc: JSON.stringify(sentDoc), meta: JSON.stringify(sentMeta) });
    onSaved?.(result);
    toast.success(`Saved · version ${result.version}`);
    return true;
  };

  const reloadFromServer = async () => {
    setConflict(false);
    const fresh = await getFloorPlan(planId);
    if (!fresh) {
      toast.error("Couldn't load the latest version.");
      return;
    }
    load(fresh);
    toast.success(`Loaded version ${fresh.version}.`);
  };

  const setStatus = async (status) => {
    const result = await updateFloorPlan(plan.id, { status });
    if (!result) {
      toast.error("Couldn't update the status.");
      return;
    }
    setPlan((p) => ({ ...p, status: result.status, updatedAt: result.updatedAt }));
    onSaved?.(result);
    toast.success(status === "final" ? "Marked final." : "Back to draft.");
  };

  const saveCopyAs = async (mode, input) => {
    const user = await getUser();
    const created = await createFloorPlan({
      projectId,
      kind: mode,
      name: input.name,
      templateCategory: mode === "template" ? input.templateCategory : "",
      venueId: mode === "library" ? input.venueId : null,
      venueSpaceId: mode === "library" ? input.venueSpaceId : null,
      widthM: doc.widthM,
      lengthM: doc.lengthM,
      unit: doc.unit,
      outline: doc.outline,
      setupStyle: doc.setupStyle,
      objects: cloneObjects(doc.objects),
      notes: meta.notes,
      sourcePlanId: plan.id,
      createdBy: user?.id ?? null,
    });
    if (!created) {
      toast.error(mode === "template" ? "Couldn't save the template." : "Couldn't add it to the library.");
      return false;
    }
    toast.success(mode === "template" ? "Saved to Room Templates." : "Added to the Venue Diagram Library.");
    return true;
  };

  // --- object edits -----------------------------------------------------------

  const addObject = (object, point) => {
    if (!doc || !object) return;
    const grid = gridOn && snapOn ? gridStepFor(doc.unit) : 0;
    let [x, y] = point || rendererRef.current?.getViewCenter() || [doc.widthM / 2, doc.lengthM / 2];
    if (grid) {
      x = snapToGrid(x, grid);
      y = snapToGrid(y, grid);
    }
    if (!point) {
      while (doc.objects.some((o) => Math.abs(o.x_m - x) < 0.05 && Math.abs(o.y_m - y) < 0.05)) {
        x += 0.5;
        y += 0.5;
      }
    }
    const label = object.category === "tables" && object.seats > 0 ? nextTableLabel(doc.objects) : "";
    const instance = createInstance(object, { x, y, label });
    history.apply((d) => ({ ...d, objects: [...d.objects, instance] }));
    setSelection([instance.id]);
  };

  const editObjects = (fn, opts) => history.apply((d) => ({ ...d, objects: fn(d.objects) }), opts);

  const patchObject = (id, patch, coalesce) =>
    editObjects((objects) => objects.map((o) => (o.id === id ? { ...o, ...patch } : o)), { coalesce });

  const duplicateSelection = () => {
    if (!selection.length) return;
    const step = gridStepFor(doc.unit);
    const { objects, ids } = duplicateInstances(doc.objects, selection, step, step);
    history.apply((d) => ({ ...d, objects }));
    setSelection(ids);
  };

  const deleteSelection = () => {
    if (!selection.length) return;
    const locked = selectedObjects.filter((o) => o.locked).length;
    editObjects((objects) => removeInstances(objects, selection));
    setSelection(selectedObjects.filter((o) => o.locked).map((o) => o.id));
    if (locked) toast.message(`${locked} locked object${locked === 1 ? " was" : "s were"} kept — unlock to delete.`);
  };

  const runArray = (opts) => {
    const source = selectedObjects[0];
    if (!source) return;
    const { objects, ids } = arrayInstances(doc.objects, source.id, opts);
    history.apply((d) => ({ ...d, objects }));
    setSelection(ids);
    toast.success(`Laid out ${ids.length}.`);
  };

  // Latest-state handle for the window key listener (assigned after render, read only inside events).
  const keyRef = useRef(null);
  useEffect(() => {
    keyRef.current = { doc, dirty, selection, history, save, duplicateSelection, deleteSelection, editObjects };
  });

  useEffect(() => {
    const onKeyDown = (e) => {
      const k = keyRef.current;
      const mod = e.ctrlKey || e.metaKey;
      const key = String(e.key || "").toLowerCase();
      if (!k?.doc || !e.key) return;
      if (mod && key === "s" && !e.target?.closest?.("[role='dialog']")) {
        e.preventDefault();
        if (k.dirty) k.save();
        return;
      }
      if (isTyping(e.target)) return;
      if (mod && key === "z") {
        e.preventDefault();
        if (e.shiftKey) k.history.redo();
        else k.history.undo();
      } else if (mod && key === "y") {
        e.preventDefault();
        k.history.redo();
      } else if (mod && key === "d") {
        e.preventDefault();
        k.duplicateSelection();
      } else if (mod && key === "a") {
        e.preventDefault();
        setSelection(k.doc.objects.map((o) => o.id));
      } else if (e.key === "Delete" || e.key === "Backspace") {
        if (!k.selection.length) return;
        e.preventDefault();
        k.deleteSelection();
      } else if (e.key === "Escape") {
        setSelection([]);
      } else if (e.key.startsWith("Arrow") && k.selection.length) {
        e.preventDefault();
        const step = nudgeStepFor(k.doc.unit, e.shiftKey);
        const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        k.editObjects((objects) => translateInstances(objects, k.selection, dx, dy), { coalesce: `nudge-${k.selection.join()}` });
      } else if (!mod && key === "r" && k.selection.length) {
        e.preventDefault();
        k.editObjects((objects) => rotateInstances(objects, k.selection, e.shiftKey ? -15 : 15));
      } else if (!mod && key === "v") {
        setTool("select");
      } else if (!mod && key === "h") {
        setTool("pan");
      } else if (e.key === " " && !isControl(e.target)) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e) => {
      if (e.key === " ") setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex h-full min-h-[480px] items-center justify-center">
        <LogoLoading size={80} aria-label="Loading floor plan" />
      </div>
    );
  }

  if (!plan || !doc || !meta) {
    return (
      <MainScreenWrapper>
        <EmptyState
          icon={MapIcon}
          title="Plan not found"
          description="It may have been deleted, or you no longer have access to it."
          action={
            <Button variant="ghost" onClick={onBack}>
              Back to {backLabel}
            </Button>
          }
        />
      </MainScreenWrapper>
    );
  }

  const flaggedIds = stats?.flaggedIds || [];
  const capacity = space?.capacities?.[doc.setupStyle] || null;
  // Selects ids and zooms to a single object — shared by the status bar flags and extensions.
  const focusIds = (ids) => {
    setSelection(ids);
    const boxRenderer = rendererRef.current;
    if (boxRenderer && ids.length === 1) {
      const o = doc.objects.find((x) => x.id === ids[0]);
      if (o) boxRenderer.zoomTo({ minX: o.x_m - 2, minY: o.y_m - 2, maxX: o.x_m + 2, maxY: o.y_m + 2 });
    }
  };
  // `apply` is the undoable change path (history.apply); `select` focuses objects.
  const extProps = { plan, doc, selectedIds: selection, flaggedIds, space, dirty, save, apply: history.apply, select: focusIds };
  const leave = () => (dirty ? setLeaveOpen(true) : onBack());

  const selectedSingle = selectedObjects.length === 1 ? selectedObjects[0] : null;

  return (
    <MainScreenWrapper className="lg:flex lg:h-full lg:max-w-none lg:flex-col lg:gap-4 lg:space-y-0 lg:overflow-hidden lg:py-0">
      <EditorHeader
        className="pb-4 lg:shrink-0"
        back={{ label: backLabel, onClick: leave }}
        title={
          <InlineTitleInput
            value={meta.name}
            onChange={(e) => patchMeta({ name: e.target.value })}
            aria-label="Plan name"
            placeholder="Untitled plan"
            className="text-2xl font-semibold tracking-tight text-foreground"
          />
        }
        badges={
          <>
            <StatusPill status={plan.status} map={PLAN_STATUS_MAP} />
            {KIND_LABEL[plan.kind] ? <Badge variant="info">{KIND_LABEL[plan.kind]}</Badge> : null}
          </>
        }
        actions={
          <>
            <div className="w-44">
              <SetupStyleSelect
                value={doc.setupStyle}
                onChange={(v) => history.apply((d) => ({ ...d, setupStyle: v }))}
              />
            </div>
            {EDITOR_EXTENSIONS.map((ext) => (ext.HeaderAction ? <ext.HeaderAction key={ext.key} {...extProps} /> : null))}
            <ActionMenu
              label="More plan actions"
              items={[
                plan.kind === "plan" && {
                  icon: plan.status === "final" ? PencilLine : CircleCheck,
                  label: plan.status === "final" ? "Back to draft" : "Mark final",
                  onSelect: () => setStatus(plan.status === "final" ? "draft" : "final"),
                },
                { separator: true },
                { icon: BookmarkPlus, label: "Save as template", onSelect: () => setSaveAs("template") },
                { icon: Library, label: "Add to venue library", onSelect: () => setSaveAs("library") },
              ]}
            />
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!dirty || saving}
              onClick={() => save()}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </Button>
          </>
        }
      />

      <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface-subtle lg:min-h-0 lg:flex-1">
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[240px_minmax(0,1fr)_300px] lg:grid-rows-[minmax(0,1fr)]">
          <aside className="order-2 h-80 min-h-0 border-t border-border lg:order-1 lg:h-auto lg:border-r lg:border-t-0">
            <LibraryPanel catalog={catalog} unit={doc.unit} onAdd={(o) => addObject(o)} />
          </aside>

          <div className="order-1 h-[60vh] min-h-0 lg:order-2 lg:h-auto">
            <EditorCanvas
              doc={doc}
              selectedIds={selection}
              flaggedIds={flaggedIds}
              onSelect={setSelection}
              history={history}
              tool={tool}
              onToolChange={setTool}
              panning={spaceHeld}
              snapOn={snapOn}
              onSnapChange={setSnapOn}
              gridOn={gridOn}
              onGridChange={setGridOn}
              onDropObject={(objectId, point) => addObject(catalogIndex.get(objectId), point)}
              rendererRef={rendererRef}
              extensionOverlay={
                EDITOR_EXTENSIONS.some((e) => e.CanvasOverlay)
                  ? (view) =>
                      EDITOR_EXTENSIONS.map((ext) =>
                        ext.CanvasOverlay ? <ext.CanvasOverlay key={ext.key} {...extProps} view={view} /> : null,
                      )
                  : null
              }
              extensionHud={
                EDITOR_EXTENSIONS.some((e) => e.CanvasHud)
                  ? (view) =>
                      EDITOR_EXTENSIONS.map((ext) =>
                        ext.CanvasHud ? <ext.CanvasHud key={ext.key} {...extProps} view={view} /> : null,
                      )
                  : null
              }
            />
          </div>

          <aside className="scrollbar-subtle order-3 min-h-0 overflow-y-auto border-t border-border bg-surface-subtle lg:border-l lg:border-t-0">
            {selectedSingle ? (
              <ObjectInspector
                key={selectedSingle.id}
                instance={selectedSingle}
                catalogObject={catalogIndex.get(selectedSingle.objectId) || null}
                unit={doc.unit}
                onPatch={(patch, coalesce) => patchObject(selectedSingle.id, patch, coalesce)}
                onDuplicate={duplicateSelection}
                onDelete={deleteSelection}
                onArray={runArray}
              />
            ) : selectedObjects.length > 1 ? (
              <MultiInspector
                objects={selectedObjects}
                onAlign={(mode) => editObjects((objects) => alignInstances(objects, selection, mode))}
                onDistribute={(axis) => editObjects((objects) => distributeInstances(objects, selection, axis))}
                onRotate={(delta) => editObjects((objects) => rotateInstances(objects, selection, delta))}
                onLock={(locked) =>
                  editObjects((objects) => objects.map((o) => (selection.includes(o.id) ? { ...o, locked } : o)))
                }
                onDuplicate={duplicateSelection}
                onDelete={deleteSelection}
              />
            ) : (
              <>
                <RoomInspector
                  doc={doc}
                  meta={meta}
                  ctx={ctx}
                  projectId={projectId}
                  space={space}
                  onDoc={(fn, opts) => history.apply(fn, opts)}
                  onMeta={patchMeta}
                />
                <div className="space-y-1.5 p-4">
                  <p className="text-xs font-medium text-text-tertiary">Shortcuts</p>
                  {SHORTCUTS.map(([keys, what]) => (
                    <p key={keys} className="text-xs text-text-secondary">
                      <span className="font-medium text-muted-foreground">{keys}</span> — {what}
                    </p>
                  ))}
                </div>
              </>
            )}
            {EDITOR_EXTENSIONS.map((ext) =>
              ext.InspectorSection ? <ext.InspectorSection key={ext.key} {...extProps} /> : null,
            )}
          </aside>
        </div>

        <StatusBar
          stats={stats}
          unit={doc.unit}
          setupStyle={doc.setupStyle}
          capacity={capacity}
          dirty={dirty}
          version={plan.version}
          saving={saving}
          onSelectIds={focusIds}
          extra={EDITOR_EXTENSIONS.map((ext) => (ext.StatusItem ? <ext.StatusItem key={ext.key} {...extProps} /> : null))}
        />
      </div>

      <SaveAsDialog
        open={saveAs === "template"}
        onOpenChange={(o) => !o && setSaveAs(null)}
        mode="template"
        initial={{ name: meta.name }}
        ctx={ctx}
        projectId={projectId}
        title="Save as template"
        description="A reusable copy of this layout under Room Templates — new plans can start from it in any room."
        submitLabel="Save template"
        onSubmit={(input) => saveCopyAs("template", input)}
      />
      <SaveAsDialog
        open={saveAs === "library"}
        onOpenChange={(o) => !o && setSaveAs(null)}
        mode="library"
        initial={{ name: meta.name, venueId: meta.venueId, venueSpaceId: meta.venueSpaceId }}
        ctx={ctx}
        projectId={projectId}
        title="Add to venue library"
        description="Keep a copy of this layout as one of the space's standard diagrams, ready to reuse for future events."
        submitLabel="Add to library"
        onSubmit={(input) => saveCopyAs("library", input)}
      />

      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unsaved changes</DialogTitle>
            <DialogDescription>Save this plan before leaving, or discard what changed since the last save.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeaveOpen(false)}>
              Keep editing
            </Button>
            <Button
              variant="outline"
              className="border-border bg-transparent text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
              onClick={() => {
                setLeaveOpen(false);
                onBack();
              }}
            >
              Discard
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={saving}
              onClick={async () => {
                if (await save()) {
                  setLeaveOpen(false);
                  onBack();
                }
              }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save and leave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={conflict} onOpenChange={setConflict}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Someone else saved this plan</DialogTitle>
            <DialogDescription>
              A newer version was saved while you were editing. Load theirs (your unsaved changes are dropped), or
              overwrite it with yours.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={reloadFromServer}>
              Load latest
            </Button>
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={async () => {
                setConflict(false);
                await save({ force: true });
              }}
            >
              Overwrite with mine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default FloorPlanEditor;
