"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  closestCenter, DndContext, DragOverlay, defaultDropAnimationSideEffects, getFirstCollision, MeasuringStrategy, MouseSensor,
  pointerWithin, rectIntersection, TouchSensor, useDroppable, useSensor, useSensors,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDownToLine, ArrowUpToLine, Eye, EyeOff, PanelRightOpen, Plus, SquareCheck, Trash2 } from "lucide-react";
import {
  ActionMenu, Button, ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuRadioGroup, ContextMenuRadioItem, ContextMenuSeparator,
  ContextMenuShortcut, ContextMenuSub, ContextMenuSubContent, ContextMenuSubTrigger, ContextMenuTrigger,
} from "@geiger/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { allowedMoves } from "@/lib/workspace/process/stages.js";
import { FieldValue, TypeIcon } from "../ws_ui";

const NONE = "__none";
const MAX_PROPS = 6;
// These already draw as chips; everything else gets an outlined property pill with its type icon.
const CHIP_TYPES = new Set(["single_select", "multi_select", "link_record", "link_event"]);
const TONE = {
  gray: "text-zinc-400", blue: "text-sky-500", green: "text-emerald-500", amber: "text-amber-500",
  red: "text-red-500", violet: "text-violet-500", pink: "text-pink-500", teal: "text-teal-500",
};
// The lifted card glides into its slot, and the slot stays empty until it lands.
const DROP_ANIMATION = {
  duration: 220,
  easing: "cubic-bezier(0.2, 0.9, 0.3, 1)",
  sideEffects: defaultDropAnimationSideEffects({ styles: { active: { opacity: "0" } } }),
};
const MEASURING = { droppable: { strategy: MeasuringStrategy.Always } };
const ACCESSIBILITY = {
  screenReaderInstructions: { draggable: "Press Enter to open. Alt+Shift+Up or Down moves the card to the top or bottom; Alt+Shift+Left or Right moves it to the next column." },
};
const keepOrder = () => null;
const now = () => Date.now();

function readHidden(key) {
  try { const saved = JSON.parse(window.localStorage.getItem(key) ?? "[]"); return Array.isArray(saved) ? saved : []; } catch { return []; }
}

function hasValue(field, row) {
  if (field.type === "link_record" || field.type === "link_event") return Boolean(row.links?.[field.id]?.length);
  const value = field.type === "lookup" || field.type === "rollup" ? row.computed?.[field.id] : row.values?.[field.id];
  return !(value === null || value === undefined || value === "" || value === false || (Array.isArray(value) && !value.length));
}

const laneOf = (items, id) => Object.keys(items).find((key) => items[key].includes(id)) ?? null;

// A status ring that fills as the status moves along the list; other groupings show a dot in the option's colour.
function LaneGlyph({ lane }) {
  if (lane.id === null) return <span aria-hidden className="size-3.5 shrink-0 rounded-full border-[1.5px] border-dashed border-zinc-400" />;
  const tone = TONE[lane.color] ?? TONE.gray;
  if (lane.steps === undefined) return <span aria-hidden className={cn("size-2.5 shrink-0 rounded-full bg-current", tone)} />;
  const fill = lane.steps > 1 ? lane.step / (lane.steps - 1) : 1;
  return (
    <svg viewBox="0 0 14 14" aria-hidden className={cn("size-3.5 shrink-0", tone)}>
      <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
      {fill > 0 ? <circle cx="7" cy="7" r="2.5" fill="none" stroke="currentColor" strokeWidth="5" strokeDasharray={`${fill * 15.71} 15.71`} transform="rotate(-90 7 7)" /> : null}
    </svg>
  );
}

function CardFace({ object, row, props, statusLane, eventId, timeZone, onOpen }) {
  const title = row.title && row.title !== `${object.numberPrefix}-${row.number}` ? row.title : null;
  return (
    <>
      <p className="text-xs leading-4 tabular-nums text-text-tertiary">{object.numberPrefix}-{row.number}</p>
      <div className="mt-1 flex items-start gap-1.5">
        {statusLane ? <span className="mt-0.5"><LaneGlyph lane={statusLane} /></span> : null}
        <p className={cn("line-clamp-2 min-w-0 flex-1 text-[13px] font-medium leading-[18px]", title ? "text-foreground" : "text-text-tertiary")}>{title ?? "Untitled"}</p>
      </div>
      {props.length ? (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {props.map((field) => (CHIP_TYPES.has(field.type) ? (
            <span key={field.id} className="flex min-w-0 max-w-full">
              <FieldValue field={field} record={row} eventId={eventId} timeZone={timeZone} onOpenRecord={(id) => onOpen(id, field.config.targetObjectId)} />
            </span>
          ) : (
            <span key={field.id} title={field.name} className="inline-flex h-[22px] min-w-0 max-w-full items-center gap-1 rounded-md border border-border/80 px-1.5 text-xs text-text-secondary">
              <TypeIcon type={field.type} className="h-3 w-3 shrink-0 text-text-tertiary" />
              {field.type === "checkbox" ? <span className="truncate">{field.name}</span> : <FieldValue field={field} record={row} eventId={eventId} timeZone={timeZone} />}
            </span>
          )))}
        </div>
      ) : null}
    </>
  );
}

// One card. While it's being dragged it stays in the list as a dashed slot showing exactly where it will land.
function BoardCard({ row, draggable, selected, open, flash, menu, onClick, onKeyDown, children }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: row.id, disabled: !draggable });
  const node = useRef(null);

  // After a drop the card settles with a short outline pulse once the lifted copy has landed.
  useEffect(() => {
    if (!flash || !node.current?.animate) return undefined;
    const pulse = node.current.animate(
      [{ boxShadow: "0 0 0 2px var(--ring)" }, { boxShadow: "0 0 0 2px transparent" }],
      { duration: 900, delay: 200, easing: "ease-out" },
    );
    return () => pulse.cancel();
  }, [flash]);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div ref={(element) => { setNodeRef(element); node.current = element; }} data-card {...attributes} {...listeners}
          role="button" tabIndex={0} aria-pressed={selected || undefined} onClick={onClick} onKeyDown={onKeyDown}
          style={{ transform: CSS.Translate.toString(transform), transition }}
          className={cn("relative shrink-0 select-none rounded-lg border bg-surface-card px-3 py-2.5 text-left shadow-xs outline-none transition-[background-color,border-color]",
            "focus-visible:ring-2 focus-visible:ring-ring", draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
            selected ? "border-foreground/35 bg-surface-active" : open ? "border-border-strong bg-surface-hover" : "border-border/80 hover:border-border-strong hover:bg-surface-hover",
            isDragging && "border-dashed border-border-strong bg-surface-subtle shadow-none [&>*]:invisible")}>
          {children}
        </div>
      </ContextMenuTrigger>
      {menu}
    </ContextMenu>
  );
}

function BoardLane({ lane, target, refused, children, header }) {
  const { setNodeRef } = useDroppable({ id: `lane:${lane.key}` });
  return (
    <section ref={setNodeRef} aria-label={lane.label}
      className={cn("group/lane flex w-[min(292px,85vw)] shrink-0 flex-col rounded-lg bg-surface-subtle/70 transition-[background-color,box-shadow,opacity]",
        target && "bg-surface-subtle ring-1 ring-inset ring-border-strong", refused && "opacity-40")}>
      {header}
      {children}
    </section>
  );
}

function HiddenLane({ lane, count, onShow }) {
  const { setNodeRef, isOver } = useDroppable({ id: `hidden:${lane.key}` });
  return (
    <div ref={setNodeRef} className={cn("group/hidden flex h-9 items-center gap-2 rounded-md px-2.5 text-[13px] transition-colors",
      isOver ? "bg-surface-active ring-1 ring-inset ring-border-strong" : "hover:bg-surface-hover")}>
      <LaneGlyph lane={lane} />
      <span className="min-w-0 flex-1 truncate text-text-secondary">{lane.label}</span>
      <span className="tabular-nums text-text-tertiary">{count}</span>
      {onShow ? (
        <Button variant="ghost" size="icon" className="size-6 text-text-secondary opacity-0 group-hover/hidden:opacity-100 focus-visible:opacity-100 max-lg:opacity-100"
          aria-label={`Show ${lane.label}`} title="Show column" onClick={onShow}>
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

// Columns by status or a single-select field, laid out like Linear: drag a card to move it or (in manual order) reorder it;
// other cards slide apart to show where it lands, it glides into place on release and pulses once.
export function BoardView({
  object, fields, columns, rows, groupBy, eventId, timeZone, can, stageRules, manual = true, showEmpty = true,
  selected, onSelect, onOpen, onPlace, onAdd, onDelete, activeId = null,
}) {
  const by = groupBy || "status";
  const groupField = fields.find((item) => item.id === by);
  const options = by === "status"
    ? (object.statuses ?? []).map((status) => ({ id: status.key, label: status.label, color: status.color }))
    : groupField?.config?.options ?? [];
  const lanes = [
    { key: NONE, id: null, label: by === "status" ? "No status" : `No ${groupField?.name.toLowerCase() ?? "value"}`, color: "gray" },
    ...options.map((option, index) => ({
      key: option.id, id: option.id, label: option.label, color: option.color, ...(by === "status" ? { step: index, steps: options.length } : {}),
    })),
  ];
  const laneByKey = new Map(lanes.map((lane) => [lane.key, lane]));
  const known = new Set(options.map((option) => option.id));
  const valueOf = (row) => (by === "status" ? row.status : row.values?.[by]) ?? null;
  const laneKeyOf = (row) => (known.has(valueOf(row)) ? valueOf(row) : NONE);
  const laneValue = (key) => (key === NONE ? null : key);
  const rowById = new Map(rows.map((row) => [row.id, row]));
  const order = new Map(rows.map((row, index) => [row.id, index]));
  const base = Object.fromEntries(lanes.map((lane) => [lane.key, []]));
  for (const row of rows) base[laneKeyOf(row)].push(row.id);

  const storageKey = `ws-board-hidden:${object.id}:${by}`;
  const [hiddenState, setHiddenState] = useState(() => ({ key: storageKey, keys: readHidden(storageKey) }));
  if (hiddenState.key !== storageKey) setHiddenState({ key: storageKey, keys: readHidden(storageKey) });
  const hidden = new Set(hiddenState.keys);
  const setHidden = (key, on) => {
    const keys = on ? [...new Set([...hiddenState.keys, key])] : hiddenState.keys.filter((item) => item !== key);
    setHiddenState({ key: storageKey, keys });
    try { window.localStorage.setItem(storageKey, JSON.stringify(keys)); } catch { /* per-viewer convenience only */ }
  };

  const [drag, setDrag] = useState(null);
  const [settled, setSettled] = useState(null);
  const settle = (id) => setSettled((current) => ({ id, n: (current?.n ?? 0) + 1 }));
  const lastOver = useRef(null);
  const lastDrop = useRef(0);
  const boardRef = useRef(null);
  const items = drag?.items ?? base;
  const dragged = drag ? rowById.get(drag.id) : null;

  // Stage rules: columns a card may not move to. People who can configure may still drop there (and push it through).
  const refusedFor = (row, key) => {
    if (by !== "status" || !row) return false;
    const allowed = allowedMoves(stageRules, object, row.status ?? null);
    return Boolean(allowed) && laneValue(key) !== (row.status ?? null) && !allowed.includes(laneValue(key));
  };
  const refused = (key) => refusedFor(dragged, key);
  const blocked = (key, row = dragged) => refusedFor(row, key) && !can.configure;

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
  );

  const shownLane = (lane) => {
    if (lane.key === NONE) return base[NONE].length > 0;
    return !hidden.has(lane.key) && (showEmpty || base[lane.key].length > 0);
  };
  const visible = lanes.filter(shownLane);
  const tucked = lanes.filter((lane) => lane.key !== NONE && !shownLane(lane));

  const cardFields = columns.filter((column) => !column.hidden && column.fieldId !== object.titleFieldId && column.fieldId !== by)
    .map((column) => fields.find((item) => item.id === column.fieldId)).filter(Boolean);
  const statusLanes = by !== "status" && object.statuses?.length
    ? new Map(object.statuses.map((status, index) => [status.key, { id: status.key, label: status.label, color: status.color, step: index, steps: object.statuses.length }]))
    : null;

  if (!options.length) {
    return (
      <div className="m-6 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-center text-sm text-text-secondary">
        {by === "status" ? "Add statuses to this list to see it as a board." : "Add options to this field to see it as a board."}
      </div>
    );
  }

  // Over a column, aim at its nearest card so the gap opens where the pointer is; keep the last target between frames.
  const collide = (args) => {
    const hits = pointerWithin(args);
    let overId = getFirstCollision(hits.length ? hits : rectIntersection(args), "id");
    if (overId == null) return lastOver.current ? [{ id: lastOver.current }] : [];
    const id = String(overId);
    if (id.startsWith("lane:")) {
      const ids = items[id.slice(5)] ?? [];
      if (ids.length) {
        const inner = closestCenter({ ...args, droppableContainers: args.droppableContainers.filter((container) => ids.includes(container.id)) });
        if (inner.length) overId = inner[0].id;
      }
    }
    lastOver.current = overId;
    return [{ id: overId }];
  };

  const dragStart = ({ active }) => {
    const row = rowById.get(active.id);
    if (!row) return;
    lastOver.current = null;
    setDrag({ id: row.id, from: laneKeyOf(row), items: base });
  };

  // Moving into another column re-slots the card there: at the pointer in manual order, or where the sort puts it.
  const dragOver = ({ active, over }) => {
    if (!over) return;
    const overId = String(over.id);
    if (overId.startsWith("hidden:")) return;
    const below = Boolean(active.rect.current.translated) && active.rect.current.translated.top > over.rect.top + over.rect.height / 2;
    setDrag((current) => {
      if (!current) return current;
      const from = laneOf(current.items, active.id);
      const target = overId.startsWith("lane:") ? overId.slice(5) : laneOf(current.items, overId);
      if (!from || !target || from === target || blocked(target)) return current;
      const rest = current.items[target].filter((id) => id !== active.id);
      let index = rest.length;
      if (!manual) index = rest.filter((id) => (order.get(id) ?? 0) < (order.get(active.id) ?? 0)).length;
      else if (!overId.startsWith("lane:") && rest.includes(overId)) index = rest.indexOf(overId) + (below ? 1 : 0);
      return {
        ...current,
        items: { ...current.items, [from]: current.items[from].filter((id) => id !== active.id), [target]: [...rest.slice(0, index), active.id, ...rest.slice(index)] },
      };
    });
  };

  const dragEnd = ({ active, over }) => {
    const current = drag;
    setDrag(null);
    lastDrop.current = now();
    const row = rowById.get(active.id);
    if (!current || !over || !row) return;
    const overId = String(over.id);
    const overLane = overId.startsWith("hidden:") || overId.startsWith("lane:") ? overId.slice(overId.indexOf(":") + 1) : laneOf(current.items, overId);
    if (overLane && blocked(overLane)) {
      toast.error(`The stage rules don't allow moving to ${laneByKey.get(overLane)?.label ?? "that column"}.`);
      return;
    }
    // Dropped on a hidden column: it goes to the top of that column.
    if (overId.startsWith("hidden:")) {
      if (overLane === current.from) return;
      onPlace(row, { value: laneValue(overLane), afterId: null, beforeId: manual ? base[overLane]?.[0] ?? null : null });
      toast.success(`Moved to ${laneByKey.get(overLane)?.label}`);
      return;
    }
    const lane = laneOf(current.items, active.id);
    let ids = current.items[lane];
    if (manual && !overId.startsWith("lane:")) {
      const from = ids.indexOf(active.id);
      const to = ids.indexOf(overId);
      if (from >= 0 && to >= 0 && from !== to) ids = arrayMove(ids, from, to);
    }
    const at = ids.indexOf(active.id);
    const moved = lane !== current.from;
    if (!moved && (!manual || base[lane].indexOf(active.id) === at)) return;
    settle(row.id);
    onPlace(row, {
      ...(moved ? { value: laneValue(lane) } : {}),
      afterId: at > 0 ? ids[at - 1] : null,
      beforeId: at < ids.length - 1 ? ids[at + 1] : null,
    });
  };

  const dragCancel = () => setDrag(null);

  const toggle = (id) => {
    if (!onSelect || !(can.update || can.delete)) return;
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    onSelect(next);
  };

  const moveTo = (row, key) => {
    if (blocked(key, row)) { toast.error(`The stage rules don't allow moving to ${laneByKey.get(key)?.label}.`); return; }
    settle(row.id);
    onPlace(row, { value: laneValue(key), afterId: null, beforeId: manual ? base[key].find((id) => id !== row.id) ?? null : null });
  };
  const toEdge = (row, key, top) => {
    const rest = base[key].filter((id) => id !== row.id);
    if (!rest.length || (top ? base[key][0] : base[key].at(-1)) === row.id) return;
    settle(row.id);
    onPlace(row, top ? { afterId: null, beforeId: rest[0] } : { afterId: rest.at(-1), beforeId: null });
  };

  // Arrow keys walk the board; ⌥⇧↑/↓ send a card to the top or bottom of its column, ⌥⇧←/→ to the next column.
  const keyDown = (event, row, key) => {
    if (event.target !== event.currentTarget) return;
    const arrows = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
    if ((event.key === "Enter" || event.key === " ") && !event.altKey) { event.preventDefault(); onOpen(row.id); return; }
    if (event.key.toLowerCase() === "x" && !event.metaKey && !event.ctrlKey && !event.altKey) { event.preventDefault(); toggle(row.id); return; }
    if (!arrows.includes(event.key) || event.metaKey || event.ctrlKey) return;
    event.preventDefault();
    if (event.altKey && event.shiftKey) {
      if (!can.update) return;
      if (event.key === "ArrowUp" || event.key === "ArrowDown") { if (manual) toEdge(row, key, event.key === "ArrowUp"); return; }
      const next = visible[visible.findIndex((lane) => lane.key === key) + (event.key === "ArrowLeft" ? -1 : 1)];
      if (next) moveTo(row, next.key);
      return;
    }
    const card = event.currentTarget;
    const laneEls = [...(boardRef.current?.querySelectorAll("[data-lane-cards]") ?? [])];
    const laneEl = card.closest("[data-lane-cards]");
    const cards = [...laneEl.querySelectorAll("[data-card]")];
    const index = cards.indexOf(card);
    if (event.key === "ArrowUp") cards[index - 1]?.focus();
    else if (event.key === "ArrowDown") cards[index + 1]?.focus();
    else {
      const step = event.key === "ArrowLeft" ? -1 : 1;
      for (let i = laneEls.indexOf(laneEl) + step; i >= 0 && i < laneEls.length; i += step) {
        const next = [...laneEls[i].querySelectorAll("[data-card]")];
        if (next.length) { next[Math.min(index, next.length - 1)].focus(); break; }
      }
    }
  };

  const click = (event, row) => {
    if (now() - lastDrop.current < 250) return;
    if (event.shiftKey || event.metaKey || event.ctrlKey) { toggle(row.id); return; }
    onOpen(row.id);
  };

  // Click and drag on empty board space scrolls sideways (never from a card, a control or a scrollbar).
  const onScrollbar = (element, event) => {
    const box = element.getBoundingClientRect();
    return event.clientX - box.left > element.clientWidth || event.clientY - box.top > element.clientHeight;
  };
  const pan = (event) => {
    const board = boardRef.current;
    if (event.pointerType !== "mouse" || event.button !== 0 || !board || board.scrollWidth <= board.clientWidth) return;
    if (event.target.closest("[data-card],button,a,input,textarea,[role=menuitem]")) return;
    const list = event.target.closest("[data-lane-cards]");
    if (onScrollbar(board, event) || (list && onScrollbar(list, event))) return;
    event.preventDefault();
    const startX = event.clientX;
    const startLeft = board.scrollLeft;
    const move = (e) => { board.scrollLeft = startLeft - (e.clientX - startX); };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      board.classList.remove("cursor-grabbing");
    };
    board.classList.add("cursor-grabbing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const menuFor = (row, key) => {
    const isSelected = selected?.has(row.id);
    return (
      <ContextMenuContent className="w-56">
        <ContextMenuItem onSelect={() => onOpen(row.id)}><PanelRightOpen className="h-4 w-4" />Open<ContextMenuShortcut>↵</ContextMenuShortcut></ContextMenuItem>
        {can.update ? (
          <ContextMenuSub>
            <ContextMenuSubTrigger>Move to</ContextMenuSubTrigger>
            <ContextMenuSubContent className="w-52">
              <ContextMenuRadioGroup value={key} onValueChange={(next) => { if (next !== key) moveTo(row, next); }}>
                {lanes.filter((lane) => lane.key !== NONE).map((lane) => (
                  <ContextMenuRadioItem key={lane.key} value={lane.key} disabled={lane.key !== key && blocked(lane.key, row)}>
                    <span className="flex items-center gap-2"><LaneGlyph lane={lane} />{lane.label}</span>
                  </ContextMenuRadioItem>
                ))}
              </ContextMenuRadioGroup>
            </ContextMenuSubContent>
          </ContextMenuSub>
        ) : null}
        {can.update && manual ? (
          <>
            <ContextMenuItem onSelect={() => toEdge(row, key, true)}><ArrowUpToLine className="h-4 w-4" />Move to top<ContextMenuShortcut>⌥⇧↑</ContextMenuShortcut></ContextMenuItem>
            <ContextMenuItem onSelect={() => toEdge(row, key, false)}><ArrowDownToLine className="h-4 w-4" />Move to bottom<ContextMenuShortcut>⌥⇧↓</ContextMenuShortcut></ContextMenuItem>
          </>
        ) : null}
        {onSelect && (can.update || can.delete) ? (
          <ContextMenuItem onSelect={() => toggle(row.id)}><SquareCheck className="h-4 w-4" />{isSelected ? "Deselect" : "Select"}<ContextMenuShortcut>X</ContextMenuShortcut></ContextMenuItem>
        ) : null}
        {can.delete && onDelete ? (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem variant="destructive" onSelect={() => onDelete(row)}><Trash2 className="h-4 w-4" />Delete</ContextMenuItem>
          </>
        ) : null}
      </ContextMenuContent>
    );
  };

  const face = (row) => (
    <CardFace object={object} row={row} eventId={eventId} timeZone={timeZone} onOpen={onOpen}
      statusLane={statusLanes?.get(row.status) ?? null}
      props={cardFields.filter((field) => hasValue(field, row)).slice(0, MAX_PROPS)} />
  );
  const holder = dragged ? laneOf(items, dragged.id) : null;

  return (
    <DndContext sensors={sensors} collisionDetection={collide} measuring={MEASURING} accessibility={ACCESSIBILITY}
      onDragStart={dragStart} onDragOver={dragOver} onDragEnd={dragEnd} onDragCancel={dragCancel}>
      <div ref={boardRef} onPointerDown={pan} className="scrollbar-subtle flex h-full gap-2.5 overflow-auto px-4 py-3 sm:px-6">
        {visible.map((lane) => {
          const ids = items[lane.key] ?? [];
          return (
            <BoardLane key={lane.key} lane={lane} target={Boolean(drag) && holder === lane.key && lane.key !== drag.from}
              refused={Boolean(drag) && refused(lane.key) && lane.key !== drag.from}
              header={(
                <div className="flex h-10 shrink-0 items-center gap-2 pl-3 pr-1.5">
                  <LaneGlyph lane={lane} />
                  <span className="min-w-0 truncate text-[13px] font-medium text-foreground">{lane.label}</span>
                  <span className="text-[13px] tabular-nums text-text-tertiary">{ids.length}</span>
                  <span className="flex-1" />
                  <div className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover/lane:opacity-100 max-lg:opacity-100">
                    {lane.key !== NONE ? (
                      <ActionMenu label={`${lane.label} options`} triggerClassName="size-6" items={[
                        { icon: EyeOff, label: "Hide column", onSelect: () => setHidden(lane.key, true) },
                        can.create && onAdd && { icon: Plus, label: `New ${object.name.toLowerCase()} here`, onSelect: () => onAdd(by, lane.id) },
                      ]} />
                    ) : null}
                    {can.create && onAdd ? (
                      <Button variant="ghost" size="icon" className="size-6 text-text-secondary" aria-label={`Add to ${lane.label}`} title="Add to this column" onClick={() => onAdd(by, lane.id)}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              )}>
              <SortableContext id={lane.key} items={ids} strategy={manual ? verticalListSortingStrategy : keepOrder}>
                <div data-lane-cards className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2">
                  {ids.map((id) => {
                    const row = rowById.get(id);
                    if (!row) return null;
                    return (
                      <BoardCard key={id} row={row} draggable={Boolean(can.update)} selected={Boolean(selected?.has(id))} open={id === activeId}
                        flash={settled?.id === id ? settled.n : null} menu={menuFor(row, lane.key)}
                        onClick={(event) => click(event, row)} onKeyDown={(event) => keyDown(event, row, lane.key)}>
                        {face(row)}
                      </BoardCard>
                    );
                  })}
                </div>
              </SortableContext>
            </BoardLane>
          );
        })}

        {tucked.length ? (
          <section aria-label="Hidden columns" className="flex w-[min(240px,75vw)] shrink-0 flex-col">
            <p className="flex h-10 shrink-0 items-center px-2.5 text-[13px] font-medium text-text-secondary">Hidden columns</p>
            <div className="flex flex-col gap-0.5">
              {tucked.map((lane) => (
                <HiddenLane key={lane.key} lane={lane} count={base[lane.key].length} onShow={hidden.has(lane.key) ? () => setHidden(lane.key, false) : null} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {typeof document === "undefined" ? null : createPortal(
        <DragOverlay dropAnimation={DROP_ANIMATION}>
          {dragged ? (
            <div className="cursor-grabbing rounded-lg border border-border-strong bg-surface-card px-3 py-2.5 shadow-xl">
              {face(dragged)}
            </div>
          ) : null}
        </DragOverlay>,
        document.body,
      )}
    </DndContext>
  );
}
