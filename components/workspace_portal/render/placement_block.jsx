"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Wand2 } from "lucide-react";
import { Button } from "@geiger/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { autoPlace, placementState } from "@/lib/workspace/components/placement.js";
import { BlockError, BlockFrame, BlockLoading, Restricted } from "./block_frame";
import { useList, useOpenRecord, usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";
import { CellValue, fieldName, isVisibleOn } from "./values";

const TRAY = "__tray__";
const titleOf = (list, row) => row.title || `${list?.numberPrefix ?? "REC"}-${row.number}`;

// Items placed into places (rooms, booths, shifts) through a link field: capacity, fill, an unplaced tray and auto-place.
export function PlacementBlock({ block, fill }) {
  const config = block.config;
  const { api, refresh } = usePortalView();
  const { list, byId } = useList(config.source?.objectId);
  const linkField = byId.get(config.linkField);
  const { list: placesList } = useList(linkField?.config?.targetObjectId);
  const { data, error, loading, refreshing, reload } = useBlockData(block, {});
  const openRecord = useOpenRecord();
  const [dragging, setDragging] = useState(null);
  const [over, setOver] = useState(null);
  const [moved, setMoved] = useState({});
  const [placing, setPlacing] = useState(null);

  const canMove = (row) => !api.readOnly && row.access?.editable?.includes(config.linkField);
  const placeIds = (row) => moved[row.id] ?? (row.links?.[config.linkField] ?? []).map((link) => link.id);
  const rows = (data?.rows ?? []).map((row) => ({ ...row, links: { ...row.links, [config.linkField]: placeIds(row).map((id) => ({ kind: "record", id })) } }));
  const places = data?.places ?? [];
  const state = placementState({ items: rows, places, linkFieldId: config.linkField, capacityFieldId: config.capacityField, startField: config.startField, endField: config.endField });
  const doubled = new Set(state.overlaps.map((entry) => entry.itemId));

  const save = async (row, ids) => {
    setMoved((current) => ({ ...current, [row.id]: ids }));
    const { error: failed } = await api.command({
      action: "record.update", recordId: row.id, expectedRevision: row.revision, values: { [config.linkField]: ids.map((id) => ({ kind: "record", id })) },
    });
    if (failed) {
      toast.error(failed.message);
      setMoved((current) => { const copy = { ...current }; delete copy[row.id]; return copy; });
      return false;
    }
    return true;
  };

  // Dropping moves an item out of the place it was dragged from (or the tray) into the target.
  const drop = async (target) => {
    const current = dragging;
    setDragging(null);
    setOver(null);
    if (!current) return;
    const row = rows.find((item) => item.id === current.id);
    if (!row || current.from === target) return;
    const ids = placeIds(row).filter((id) => id !== current.from);
    const next = target === TRAY ? ids : linkField?.config?.multiple ? [...ids, target] : [target];
    if (await save(row, next)) refresh();
  };

  const runAutoPlace = async () => {
    const editable = rows.filter(canMove);
    const pairs = autoPlace({ items: editable, places, linkFieldId: config.linkField, capacityFieldId: config.capacityField, match: config.match, limit: 200 });
    if (!pairs.length) { toast.info("Nothing to place — there's no open room that fits."); return; }
    let done = 0;
    for (const pair of pairs) {
      setPlacing({ done, total: pairs.length });
      const row = rows.find((item) => item.id === pair.itemId);
      if (row && (await save(row, linkField?.config?.multiple ? [...placeIds(row), pair.placeId] : [pair.placeId]))) done += 1;
    }
    setPlacing(null);
    toast.success(`Placed ${done} of ${pairs.length}`);
    refresh();
  };

  const card = (row, from) => (
    <article key={`${from}:${row.id}`} draggable={canMove(row)}
      onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDragging({ id: row.id, from }); }}
      onDragEnd={() => { setDragging(null); setOver(null); }}
      onClick={config.open ? () => openRecord(row) : undefined}
      className={cn("rounded-md border border-border bg-surface-card px-2.5 py-2 text-sm", config.open && "cursor-pointer hover:border-foreground/25",
        canMove(row) && "active:cursor-grabbing", dragging?.id === row.id && "opacity-50")}>
      <p className="flex items-center gap-1 font-medium text-foreground">
        {doubled.has(row.id) ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Placed in two places at the same time" /> : null}
        <span className="truncate">{titleOf(list, row)}</span>
      </p>
      {(config.fields ?? []).filter((id) => id !== list?.titleFieldId && isVisibleOn(row, id)).map((id) => (
        <p key={id} className="mt-1 flex min-w-0 gap-1 truncate text-xs"><span className="shrink-0 text-text-tertiary">{fieldName(list, id)}</span><span className="flex min-w-0 text-foreground"><CellValue list={list} fieldId={id} record={row} /></span></p>
      ))}
    </article>
  );

  const zone = (key) => ({
    onDragOver: (event) => { if (dragging) { event.preventDefault(); setOver(key); } },
    onDragLeave: () => setOver((current) => (current === key ? null : current)),
    onDrop: (event) => { event.preventDefault(); drop(key); },
  });

  const actions = config.autoPlace && !api.readOnly && rows.some(canMove) && state.tray.length ? (
    <Button size="sm" variant="outline" onClick={runAutoPlace} disabled={Boolean(placing)}>
      {placing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}{placing ? `Placing ${placing.done + 1} of ${placing.total}` : "Auto-place"}
    </Button>
  ) : null;

  let body;
  if (!list || !linkField) body = <Restricted />;
  else if (loading) body = <BlockLoading label="Loading placement" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (data?.restricted || data?.placesRestricted) body = <Restricted />;
  else {
    body = (
      <div className={cn("@container/block grid gap-4 p-4 transition-opacity @3xl/block:grid-cols-[16rem_minmax(0,1fr)]", refreshing && "opacity-60")}>
        <section {...zone(TRAY)} className={cn("flex flex-col gap-2 rounded-lg border border-dashed border-border bg-surface-subtle p-2", over === TRAY && "border-foreground/30")}>
          <p className="px-1 text-xs font-medium text-text-secondary">Not placed <span className="tabular-nums text-text-tertiary">{state.tray.length}</span></p>
          {state.tray.length ? state.tray.map((row) => card(row, TRAY)) : <p className="px-1 pb-1 text-xs text-text-tertiary">Everything is placed.</p>}
        </section>
        <div className="grid content-start gap-3 @xl/block:grid-cols-2 @5xl/block:grid-cols-3">
          {state.places.map((entry) => (
            <section key={entry.id} {...zone(entry.id)}
              className={cn("flex flex-col gap-2 rounded-lg border bg-surface-subtle p-2", entry.over ? "border-amber-500/70" : "border-border", over === entry.id && "border-foreground/30")}>
              <div className="flex items-center gap-2 px-1">
                <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{titleOf(placesList, entry.place)}</p>
                <span className={cn("shrink-0 text-xs tabular-nums", entry.over ? "font-medium text-amber-700 dark:text-amber-400" : "text-text-tertiary")}>
                  {entry.capacity === null ? entry.used : `${entry.used} / ${entry.capacity}`}
                </span>
              </div>
              {entry.capacity ? (
                <div className="h-1 overflow-hidden rounded-full bg-border" aria-hidden>
                  <div className={cn("h-full rounded-full", entry.over ? "bg-amber-500" : "bg-foreground/60")} style={{ width: `${Math.min(100, (entry.used / entry.capacity) * 100)}%` }} />
                </div>
              ) : null}
              {entry.items.map((row) => card(row, entry.id))}
              {!entry.items.length ? <p className="px-1 pb-1 text-xs text-text-tertiary">Drop here</p> : null}
            </section>
          ))}
          {!state.places.length ? <p className="text-sm text-text-secondary">No {placesList?.plural?.toLowerCase() ?? "places"} to place into yet.</p> : null}
        </div>
      </div>
    );
  }

  return <BlockFrame title={config.title} actions={actions} fill={fill}>{body}</BlockFrame>;
}
