"use client";

// The builder's drag engine.
//
// Hand-rolled pointer events, matching how the workflow and badge canvases in
// this app already work — no drag-and-drop dependency, and full control over
// what a drop means on a 12-column grid.
//
// The canvas lives in an iframe, which normally swallows pointer events. Rather
// than listening in two documents and reconciling two coordinate spaces, the
// drag turns the iframe transparent to pointers for its duration: every move
// then lands on the parent, and hit-testing runs against a snapshot of node
// rectangles translated into parent-viewport space once, at drag start.

import { useCallback, useRef, useState } from "react";

import { canDrop, kindOfPath, locate } from "@/lib/events/page_tree";

// How close to an edge counts as "before"/"after" rather than "inside", as a
// fraction of the node's height. Anything in the middle of a container drops in.
const EDGE_RATIO = 0.3;

// Deepest first: a point inside a component is also inside its column and its
// section, and the most specific target is always the one the user means.
const KIND_DEPTH = { component: 0, column: 1, row: 2, section: 3 };

// Pointer travel, in px, before a press becomes a drag. Below this it stays a
// click, which is what lets a palette tile be both draggable and clickable.
const DRAG_THRESHOLD = 5;

function translate(rect, offset, zoom) {
  return {
    left: offset.left + rect.left * zoom,
    top: offset.top + rect.top * zoom,
    width: rect.width * zoom,
    height: rect.height * zoom,
    right: offset.left + (rect.left + rect.width) * zoom,
    bottom: offset.top + (rect.top + rect.height) * zoom,
  };
}

function contains(rect, x, y) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Snapshot every addressable node in the canvas, in parent-viewport space.
 * Taken once per drag: the layout cannot change mid-drag, and re-measuring on
 * every move is what makes hand-rolled drags feel heavy.
 */
function snapshot(frame, zoom) {
  const doc = frame?.contentDocument;
  if (!doc) return [];
  const frameRect = frame.getBoundingClientRect();
  const offset = { left: frameRect.left, top: frameRect.top };

  return Array.from(doc.querySelectorAll("[data-ev]"))
    .map((el) => ({
      id: el.getAttribute("data-ev"),
      kind: el.getAttribute("data-ev-kind"),
      rect: translate(el.getBoundingClientRect(), offset, zoom),
    }))
    .filter((entry) => entry.kind)
    .sort((a, b) => KIND_DEPTH[a.kind] - KIND_DEPTH[b.kind]);
}

/**
 * Resolve a pointer position to a drop target.
 * Returns `{ target: { id, position }, rect, orientation }` or null.
 */
function resolveTarget(entries, tree, payloadKind, x, y, draggingId) {
  for (const entry of entries) {
    if (!contains(entry.rect, x, y)) continue;
    if (entry.id === draggingId) continue;

    const found = locate(tree, entry.id);
    if (!found) continue;
    const targetKind = kindOfPath(found.path);
    const isContainer = Array.isArray(found.node.components) && targetKind === "component";

    // Columns are the one axis where "before/after" is horizontal: a column
    // dropped on a column becomes a new column beside it.
    const horizontal = payloadKind === "column" && targetKind === "column";
    const size = horizontal ? entry.rect.width : entry.rect.height;
    const position = horizontal ? x - entry.rect.left : y - entry.rect.top;
    const edge = size * EDGE_RATIO;

    const insideLegal = canDrop(payloadKind, targetKind, "inside", isContainer);
    const siblingLegal = canDrop(payloadKind, targetKind, "before");
    // Neither works here — fall through to the next, shallower candidate.
    if (!insideLegal && !siblingLegal) continue;

    const sibling = () => {
      const after = position >= size / 2;
      return {
        target: { id: entry.id, position: after ? "after" : "before" },
        rect: entry.rect,
        orientation: horizontal ? "vertical" : "horizontal",
        after,
      };
    };
    const inside = () => ({
      target: { id: entry.id, position: "inside" },
      rect: entry.rect,
      orientation: "area",
    });

    // Near an edge means "beside this"; the middle means "into this". When only
    // one of the two is legal it wins everywhere in the node, so an empty column
    // accepts a drop anywhere inside it rather than only in its middle third.
    if (!insideLegal) return sibling();
    if (!siblingLegal) return inside();
    return position <= edge || position >= size - edge ? sibling() : inside();
  }
  return null;
}

/**
 * @param getFrame  () => the canvas iframe element
 * @param getTree   () => the current tree (read at drag start, never stale)
 * @param zoom      canvas scale factor
 * @param onDrop    (payload, target) => void
 */
export function useDragEngine({ getFrame, getTree, zoom = 1, onDrop }) {
  const [drag, setDrag] = useState(null);
  const state = useRef(null);

  const finish = useCallback(
    (commit) => {
      const current = state.current;
      state.current = null;
      const frame = getFrame();
      if (frame) frame.style.pointerEvents = "";
      document.body.style.userSelect = "";
      setDrag(null);
      if (commit && current?.hit?.target) onDrop(current.payload, current.hit.target);
    },
    [getFrame, onDrop],
  );

  const startDrag = useCallback(
    (event, payload) => {
      // Left button only; a right-click drag is never intentional.
      if (event.button != null && event.button !== 0) return;

      const origin = { x: event.clientX, y: event.clientY };
      let armed = false;

      // Deliberately no preventDefault here. A palette tile is both draggable
      // and clickable, and swallowing pointerdown would suppress the click that
      // click-to-add depends on. Instead the drag only arms once the pointer has
      // actually travelled — which also stops a twitchy click from reordering
      // the page.
      const arm = () => {
        const frame = getFrame();
        // Pointer-transparent for the duration, so every move lands on the
        // parent document and there is one coordinate space to reason about.
        if (frame) frame.style.pointerEvents = "none";
        document.body.style.userSelect = "none";
        state.current = {
          payload,
          entries: snapshot(frame, zoom),
          tree: getTree(),
          hit: null,
        };
        armed = true;
      };

      const detach = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        window.removeEventListener("keydown", onKey);
      };

      const onMove = (e) => {
        if (!armed) {
          const travelled =
            Math.abs(e.clientX - origin.x) + Math.abs(e.clientY - origin.y);
          if (travelled < DRAG_THRESHOLD) return;
          arm();
        }
        const current = state.current;
        if (!current) return;
        const hit = resolveTarget(
          current.entries,
          current.tree,
          payload.kind,
          e.clientX,
          e.clientY,
          payload.nodeId,
        );
        current.hit = hit;
        setDrag({ payload, x: e.clientX, y: e.clientY, hit });
      };

      const onUp = () => {
        detach();
        // Never armed means this was a click, not a drag — leave it alone so the
        // element's own onClick still runs.
        if (armed) finish(true);
      };

      const onCancel = () => {
        detach();
        if (armed) finish(false);
      };

      // Escape aborts a drag in flight, which is what every other canvas in the
      // app does and what people try first.
      const onKey = (e) => {
        if (e.key === "Escape") onCancel();
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
      window.addEventListener("keydown", onKey);
    },
    [getFrame, getTree, zoom, finish],
  );

  return { drag, startDrag };
}

/**
 * Column-divider resize. Drags in whole grid units, reporting a signed delta
 * relative to where the drag began, so the caller can apply it idempotently.
 *
 * @param getFrame () => the canvas iframe element
 * @param onResize (rowId, index, delta) => void
 */
export function useColumnResize({ getFrame, zoom = 1, onResize }) {
  const [resizing, setResizing] = useState(null);

  const startResize = useCallback(
    (event, rowId, index) => {
      if (event.button != null && event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();

      const frame = getFrame();
      const doc = frame?.contentDocument;
      const rowEl = doc?.querySelector(`[data-ev="${rowId}"]`);
      if (!rowEl) return;

      // One grid unit in screen pixels — the quantum this drag snaps to.
      const unit = (rowEl.getBoundingClientRect().width * zoom) / 12;
      const startX = event.clientX;
      let applied = 0;

      if (frame) frame.style.pointerEvents = "none";
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      setResizing({ rowId, index });

      const onMove = (e) => {
        const steps = Math.round((e.clientX - startX) / unit);
        if (steps === applied) return;
        onResize(rowId, index, steps - applied);
        applied = steps;
      };

      const stop = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", stop);
        window.removeEventListener("pointercancel", stop);
        if (frame) frame.style.pointerEvents = "";
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        setResizing(null);
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", stop);
      window.addEventListener("pointercancel", stop);
    },
    [getFrame, zoom, onResize],
  );

  return { resizing, startResize };
}
