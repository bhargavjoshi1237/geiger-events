"use client";

// The page builder.
//
// A full-screen surface over the event editor: palette left, live canvas
// centre, inspector right. It owns exactly one piece of state that matters —
// the tree — and every edit goes through a single `commit`, which is what makes
// undo/redo a stack of snapshots rather than a diff engine.
//
// The canvas renders the same PageTree the published page does, portalled into
// an iframe so each device toggle is a real viewport.

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import {
  Code2,
  ExternalLink,
  Layers,
  Loader2,
  Monitor,
  Plus,
  Redo2,
  Smartphone,
  Tablet,
  Undo2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  BASE_BREAKPOINT,
  BREAKPOINTS,
  createSection,
  duplicateNode,
  insertNode,
  kindOfPath,
  locate,
  moveNode,
  removeNode,
  resizeColumn,
  setNodeValue,
  clearNodeOverride,
  treeStats,
  updateNode,
  walk,
} from "@/lib/events/page_tree";
import { treeForDesign } from "@/lib/events/page_migrate";
import { normalizeCustomCode, useCustomCode } from "@/lib/events/custom_code";
import { resolveTheme, themeAccent, themeStyle } from "@/lib/events/theme";
import { cn } from "@/lib/utils";
import { PageTree } from "../page_render";
import { BuilderCanvas } from "./builder_canvas";
import { DropIndicator, EDITING_CSS, useEditingChrome } from "./canvas_nodes";
import { CustomCodeDialog } from "./custom_code_dialog";
import { InspectorPanel } from "./inspector_panel";
import { LayersPanel } from "./layers_panel";
import { PalettePanel } from "./palette_panel";
import { useColumnResize, useDragEngine } from "./use_drag";
import { createComponentOfType, getComponentMeta } from "./components";

const DEVICE_ICON = { lg: Monitor, md: Tablet, sm: Smartphone };
const HISTORY_LIMIT = 50;

// --- History -----------------------------------------------------------------

function useTreeHistory(initial) {
  const [state, setState] = useState({ past: [], present: initial, future: [] });

  const commit = useCallback((next) => {
    setState((s) => {
      // A no-op edit (a drop that resolved to the same place) must not consume
      // an undo step.
      if (next === s.present) return s;
      return {
        past: [...s.past, s.present].slice(-HISTORY_LIMIT),
        present: next,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    setState((s) =>
      s.past.length
        ? {
            past: s.past.slice(0, -1),
            present: s.past[s.past.length - 1],
            future: [s.present, ...s.future].slice(0, HISTORY_LIMIT),
          }
        : s,
    );
  }, []);

  const redo = useCallback(() => {
    setState((s) =>
      s.future.length
        ? {
            past: [...s.past, s.present].slice(-HISTORY_LIMIT),
            present: s.future[0],
            future: s.future.slice(1),
          }
        : s,
    );
  }, []);

  return {
    tree: state.present,
    commit,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}

// --- Shell -------------------------------------------------------------------

/**
 * @param design    the current pageDesign (theme, blocks, tree, customCode)
 * @param event     the event view model — drives smart blocks and bindings
 * @param eventId   for the "open published page" link
 * @param canUseCustomCode  events.page.customcode
 * @param onSave    (patch) => Promise<boolean> | boolean
 * @param onClose   () => void
 */
export function PageBuilder({
  design,
  event,
  eventId,
  canUseCustomCode = false,
  onSave,
  onClose,
}) {
  // Migration happens once, on open: a page still on the legacy flat arrays
  // becomes an equivalent tree, and the arrays stay in the saved design.
  const initialTree = useMemo(() => treeForDesign(design), [design]);
  const { tree, commit, undo, redo, canUndo, canRedo } = useTreeHistory(initialTree);
  // Which tree is on the server. Every commit mints a new object, so reference
  // identity is an exact "has anything changed since the last save?" — and it
  // clears correctly when undo walks the page back to its saved state.
  const [savedTree, setSavedTree] = useState(initialTree);

  const [customCode, setCustomCode] = useState(() =>
    normalizeCustomCode(design?.customCode),
  );
  const [codeOpen, setCodeOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [bp, setBp] = useState(BASE_BREAKPOINT);
  const [tab, setTab] = useState("content");
  const [leftTab, setLeftTab] = useState("add");
  const [saving, setSaving] = useState(false);
  const [codeDirty, setCodeDirty] = useState(false);

  const frameRef = useRef(null);
  // Handlers and the drag engine read the tree through a ref so they never
  // close over a stale copy. Written in an effect (not during render) — effects
  // land before any user event can fire, so it is always current when read.
  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  const [canvasDoc, setCanvasDoc] = useState(null);
  // Custom CSS renders in the canvas so authored classes are visible while
  // designing; scripts are deliberately never run here.
  useCustomCode(customCode, { doc: canvasDoc, runScripts: false, scope: "canvas" });

  const theme = useMemo(() => resolveTheme(design), [design]);
  const accent = useMemo(() => themeAccent(theme), [theme]);
  const themed = design?.mode !== "standard";

  const selected = useMemo(() => (selectedId ? locate(tree, selectedId) : null), [tree, selectedId]);
  const selectedKind = selected ? kindOfPath(selected.path) : null;

  const usedTypes = useMemo(() => {
    const types = new Set();
    walk(tree, (node, _path, kind) => {
      if (kind === "component") types.add(node.type);
    });
    return types;
  }, [tree]);

  const device = BREAKPOINTS.find((b) => b.key === bp) || BREAKPOINTS[0];

  // --- Edits ---

  const setValue = useCallback(
    (group, key, value) => {
      if (!selectedId) return;
      // `group: null` addresses the node itself (span, hidden).
      commit(setNodeValue(treeRef.current, selectedId, bp, group ?? key, group ? key : null, value));
    },
    [commit, selectedId, bp],
  );

  const clearOverride = useCallback(
    (group, key) => {
      if (!selectedId) return;
      commit(clearNodeOverride(treeRef.current, selectedId, bp, group, key));
    },
    [commit, selectedId, bp],
  );

  const setProp = useCallback(
    (key, value) => {
      if (!selectedId) return;
      commit(
        updateNode(treeRef.current, selectedId, (node) => {
          node.props = { ...(node.props || {}), [key]: value };
          return node;
        }),
      );
    },
    [commit, selectedId],
  );

  const rename = useCallback(
    (name) => {
      if (!selectedId) return;
      commit(
        updateNode(treeRef.current, selectedId, (node) => {
          node.name = name;
          return node;
        }),
      );
    },
    [commit, selectedId],
  );

  // Switches a block off everywhere. Per-device hiding is the same flag written
  // into that breakpoint's override bag, from the inspector's Advanced tab.
  const toggleVisible = useCallback(
    (id) => {
      commit(
        updateNode(treeRef.current, id, (node) => {
          node.hidden = !node.hidden;
          return node;
        }),
      );
    },
    [commit],
  );

  const duplicate = useCallback(
    (id) => {
      const result = duplicateNode(treeRef.current, id);
      if (result?.tree) {
        commit(result.tree);
        setSelectedId(result.id);
      }
    },
    [commit],
  );

  const remove = useCallback(
    (id) => {
      commit(removeNode(treeRef.current, id));
      setSelectedId((current) => (current === id ? null : current));
    },
    [commit],
  );

  // The default landing spot for a click-to-add: the selected column, the
  // column holding the selected block, or the last column on the page.
  const defaultTarget = useCallback(() => {
    const current = treeRef.current;
    if (selectedId) {
      const hit = locate(current, selectedId);
      const kind = hit && kindOfPath(hit.path);
      if (kind === "column") return { id: hit.node.id, position: "inside" };
      if (kind === "component") return { id: hit.node.id, position: "after" };
    }
    let last = null;
    walk(current, (node, _path, kind) => {
      if (kind === "column") last = node;
    });
    return last ? { id: last.id, position: "inside" } : null;
  }, [selectedId]);

  const insertPayload = useCallback(
    (payload, target) => {
      if (!target) return;
      const current = treeRef.current;

      if (payload.nodeId) {
        commit(moveNode(current, payload.nodeId, target));
        return;
      }

      if (payload.kind === "section") {
        const node = createSection(payload.spans);
        commit(insertNode(current, node, target));
        setSelectedId(node.id);
        return;
      }

      const node = createComponentOfType(payload.type);
      commit(insertNode(current, node, target));
      setSelectedId(node.id);
      setTab("content");
    },
    [commit],
  );

  const { drag, startDrag } = useDragEngine({
    getFrame: () => frameRef.current,
    getTree: () => treeRef.current,
    onDrop: insertPayload,
  });

  const { startResize } = useColumnResize({
    getFrame: () => frameRef.current,
    onResize: (rowId, index, delta) => {
      commit(resizeColumn(treeRef.current, rowId, index, delta));
    },
  });

  const addFromPalette = useCallback(
    (payload) => {
      if (payload.kind === "section") {
        const current = treeRef.current;
        const last = current.sections[current.sections.length - 1];
        insertPayload(payload, { id: last.id, position: "after" });
        return;
      }
      const target = defaultTarget();
      if (!target) {
        toast.error("Add a section first.");
        return;
      }
      insertPayload(payload, target);
    },
    [insertPayload, defaultTarget],
  );

  const chrome = useEditingChrome({
    tree,
    selectedId,
    onSelect: setSelectedId,
    onDragStart: startDrag,
    onResize: startResize,
    onDuplicate: duplicate,
    onDelete: remove,
    onAddInto: (columnId) => {
      setSelectedId(columnId);
      setLeftTab("add");
    },
  });

  // --- Keyboard ---

  useEffect(() => {
    const onKey = (e) => {
      // Never hijack a key the author is typing into a field.
      const el = e.target;
      const typing =
        el?.tagName === "INPUT" ||
        el?.tagName === "TEXTAREA" ||
        el?.isContentEditable;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if (typing) return;
      if (mod && e.key.toLowerCase() === "d" && selectedId) {
        e.preventDefault();
        duplicate(selectedId);
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        e.preventDefault();
        remove(selectedId);
        return;
      }
      if (e.key === "Escape") setSelectedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo, duplicate, remove, selectedId]);

  // Warn on a real browser navigation with unsaved work. In-app closing is
  // handled by the Exit button's own confirm.
  const unsaved = tree !== savedTree || codeDirty;
  useEffect(() => {
    if (!unsaved) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsaved]);

  // --- Save / exit ---

  const save = async () => {
    setSaving(true);
    const ok = await onSave({ tree, customCode });
    setSaving(false);
    if (ok === false) {
      toast.error("Couldn't save the page.");
      return;
    }
    setSavedTree(tree);
    setCodeDirty(false);
    toast.success("Page saved");
  };

  const close = () => {
    if (unsaved && !window.confirm("Discard unsaved changes to this page?")) return;
    onClose();
  };

  const stats = treeStats(tree);
  const selectedMeta =
    selectedKind === "component" ? getComponentMeta(selected.node.type) : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={close}
            aria-label="Close builder"
            className="text-text-secondary hover:bg-surface-active hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {event?.name || "Page builder"}
            </p>
            <p className="text-[0.7rem] text-text-tertiary">
              {stats.sections} section{stats.sections === 1 ? "" : "s"} ·{" "}
              {stats.components} block{stats.components === 1 ? "" : "s"}
              {unsaved ? " · unsaved" : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-card p-0.5">
          {BREAKPOINTS.map((b) => {
            const Icon = DEVICE_ICON[b.key];
            return (
              <button
                key={b.key}
                type="button"
                onClick={() => setBp(b.key)}
                aria-label={b.label}
                title={`${b.label} · ${b.width}px`}
                className={cn(
                  "rounded-md px-2.5 py-1.5 transition-colors",
                  bp === b.key
                    ? "bg-surface-active text-foreground"
                    : "text-text-secondary hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          {canUseCustomCode ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCodeOpen(true)}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Code2 className="h-4 w-4" /> Code
            </Button>
          ) : null}
          {eventId ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <a href={`/e/${eventId}`} target="_blank" rel="noreferrer noopener">
                <ExternalLink className="h-4 w-4" /> Preview
              </a>
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={save}
            disabled={saving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Palette / layers */}
        <aside className="flex w-[16.5rem] shrink-0 flex-col border-r border-border bg-surface-subtle">
          <div className="flex border-b border-border">
            {[
              { key: "add", label: "Add", icon: Plus },
              { key: "layers", label: "Layers", icon: Layers },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setLeftTab(t.key)}
                className={cn(
                  "-mb-px flex flex-1 items-center justify-center gap-1.5 border-b-2 py-2.5 text-xs font-medium transition-colors",
                  leftTab === t.key
                    ? "border-primary text-foreground"
                    : "border-transparent text-text-secondary hover:text-foreground",
                )}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {leftTab === "add" ? (
              <PalettePanel
                usedTypes={usedTypes}
                canUseCustomCode={canUseCustomCode}
                onDragItem={startDrag}
                onAddItem={addFromPalette}
              />
            ) : (
              <LayersPanel
                tree={tree}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onDragStart={startDrag}
                onToggleVisible={toggleVisible}
              />
            )}
          </div>
        </aside>

        {/* Canvas */}
        <main
          className="min-w-0 flex-1 overflow-hidden bg-surface-strong p-4"
          onClick={() => setSelectedId(null)}
        >
          <div className="mx-auto h-full overflow-hidden rounded-xl border border-border bg-background shadow-lg">
            <BuilderCanvas
              width={device.width}
              frameRef={frameRef}
              onDocument={setCanvasDoc}
              className="h-full"
              bodyClassName={cn("ev-editing", themed && "ev-themed")}
              bodyStyle={themed ? themeStyle(theme) : undefined}
            >
              <style dangerouslySetInnerHTML={{ __html: EDITING_CSS }} />
              <PageTree
                tree={tree}
                event={event}
                accent={accent}
                runScripts={false}
                editing={chrome}
                brand={{ logo: theme?.logo?.url, siteName: theme?.source?.siteName }}
              />
            </BuilderCanvas>
          </div>
        </main>

        {/* Inspector */}
        <aside className="flex w-[18rem] shrink-0 flex-col border-l border-border bg-surface-subtle">
          {selected ? (
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <span className="truncate text-xs font-semibold text-foreground">
                {selectedKind === "component"
                  ? selectedMeta?.label || selected.node.type
                  : selectedKind === "section"
                    ? selected.node.name || "Section"
                    : selectedKind === "column"
                      ? `Column · ${selected.node.span}/12`
                      : "Row"}
              </span>
              {bp !== BASE_BREAKPOINT ? (
                <span className="ml-auto shrink-0 rounded bg-primary/15 px-1.5 py-0.5 text-[0.6rem] font-medium text-primary">
                  {device.label}
                </span>
              ) : null}
            </div>
          ) : null}
          <div className="min-h-0 flex-1">
            <InspectorPanel
              node={selected?.node || null}
              kind={selectedKind}
              bp={bp}
              tab={tab}
              onTab={setTab}
              onSet={setValue}
              onClear={clearOverride}
              onSetProp={setProp}
              onRename={rename}
            />
          </div>
        </aside>
      </div>

      {/* Drop rail, drawn in the parent document where the drag lives. */}
      {drag ? <DropIndicator hit={drag.hit} /> : null}

      <CustomCodeDialog
        open={codeOpen}
        onOpenChange={setCodeOpen}
        value={customCode}
        onChange={(next) => {
          setCustomCode(next);
          setCodeDirty(true);
        }}
      />
    </div>
  );
}

export default PageBuilder;
