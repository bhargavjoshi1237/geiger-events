"use client";

import { useCallback, useRef, useState } from "react";

import { canDrop, kindOfPath, locate } from "@/lib/events/page_tree";

const EDGE_RATIO = 0.3;

const KIND_DEPTH = { component: 0, column: 1, row: 2, section: 3 };

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

function resolveTarget(entries, tree, payloadKind, x, y, draggingId) {
  for (const entry of entries) {
    if (!contains(entry.rect, x, y)) continue;
    if (entry.id === draggingId) continue;

    const found = locate(tree, entry.id);
    if (!found) continue;
    const targetKind = kindOfPath(found.path);
    const isContainer = Array.isArray(found.node.components) && targetKind === "component";

    const horizontal = payloadKind === "column" && targetKind === "column";
    const size = horizontal ? entry.rect.width : entry.rect.height;
    const position = horizontal ? x - entry.rect.left : y - entry.rect.top;
    const edge = size * EDGE_RATIO;

    const insideLegal = canDrop(payloadKind, targetKind, "inside", isContainer);
    const siblingLegal = canDrop(payloadKind, targetKind, "before");
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

    if (!insideLegal) return sibling();
    if (!siblingLegal) return inside();
    return position <= edge || position >= size - edge ? sibling() : inside();
  }
  return null;
}

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
      if (event.button != null && event.button !== 0) return;

      const origin = { x: event.clientX, y: event.clientY };
      let armed = false;

      const arm = () => {
        const frame = getFrame();
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
        if (armed) finish(true);
      };

      const onCancel = () => {
        detach();
        if (armed) finish(false);
      };

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
