"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, LayoutGrid, List, Plus, RotateCcw } from "lucide-react";
import { Button, LogoLoading } from "@geiger/ui";
import { operationsClient } from "@/lib/operations/client";
import { RecordDialog } from "./record_dialog";

function RecordCard({ record, definition, onEdit, onMove, onArchive, archived }) {
  const next = definition.transitions.filter((path) => path.from === record.state);
  return <div className="rounded-xl border border-border bg-surface-card p-4 transition-colors hover:border-primary/30">
    <div className="flex items-start justify-between gap-3"><div className="min-w-0">
      <p className="truncate font-medium text-foreground">{record.title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{record.state} · rev {record.revision}</p></div>
      {!archived ? <Button size="sm" variant="outline" onClick={() => onEdit(record)}>Edit</Button> : null}</div>
    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
      {Object.entries(record.values ?? {}).filter(([, value]) => value !== null).slice(0, 3).map(([key, value]) =>
        <span key={key} className="rounded-md bg-background px-2 py-1">{key}: {String(value)}</span>)}
      {record.references?.length ? <span className="rounded-md bg-background px-2 py-1">{record.references.length} linked</span> : null}
    </div>
    {!archived ? <div className="mt-3 flex flex-wrap gap-2 border-t border-border/60 pt-3">
      {next.map((path) => <Button key={path.to} size="sm" variant="outline" onClick={() => onMove(record, path.to)}>
        Move to {definition.states.find((state) => state.key === path.to)?.label ?? path.to}</Button>)}
      <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onArchive(record)}>
        <Archive className="mr-1 h-3.5 w-3.5" /> Archive</Button>
    </div> : null}
  </div>;
}

export function RecordsView({ eventId, definition }) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadedKey, setLoadedKey] = useState(null);
  const [error, setError] = useState(null);
  const [stateFilter, setStateFilter] = useState("");
  const [archived, setArchived] = useState(definition.enabled === false);
  const [view, setView] = useState("table");
  const [dialogRecord, setDialogRecord] = useState(undefined);
  const [archiveCandidate, setArchiveCandidate] = useState(null);
  const filterKey = `${eventId}:${definition.key}:${stateFilter}:${archived}`;
  const displayLoading = loading || loadedKey !== filterKey;

  const load = useCallback(async (cursor = null, signal) => {
    const result = await operationsClient.listRecords(eventId, definition.key,
      { limit: 25, state: stateFilter || undefined, cursor: cursor || undefined,
        archived: archived ? "true" : undefined }, signal);
    if (signal?.aborted) return;
    if (result.error) setError(result.error);
    else { setItems((current) => cursor ? [...current, ...result.data.items] : result.data.items);
      setNextCursor(result.data.nextCursor); setError(null); }
    setLoadedKey(filterKey);
    setLoading(false);
  }, [eventId, definition.key, stateFilter, archived, filterKey]);

  useEffect(() => {
    const controller = new AbortController();
    operationsClient.listRecords(eventId, definition.key,
      { limit: 25, state: stateFilter || undefined, archived: archived ? "true" : undefined },
      controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.error) setError(result.error);
      else { setItems(result.data.items); setNextCursor(result.data.nextCursor); setError(null); }
      setLoadedKey(filterKey); setLoading(false);
    }).catch(() => { if (!controller.signal.aborted) {
      setError({ message: "Couldn't load records." }); setLoading(false);
    } });
    return () => controller.abort();
  }, [eventId, definition.key, stateFilter, archived, filterKey]);

  const refresh = () => { setLoading(true); return load(); };
  const save = async (draft) => {
    const commandId = crypto.randomUUID();
    const result = dialogRecord
      ? await operationsClient.updateRecord(eventId, definition.key, dialogRecord.id,
        { ...draft, expectedRevision: dialogRecord.revision, commandId })
      : await operationsClient.createRecord(eventId, definition.key, { ...draft, commandId });
    if (!result.error) await refresh();
    return result;
  };
  const move = async (record, nextState) => {
    const result = await operationsClient.transitionRecord(eventId, definition.key, record.id,
      { expectedRevision: record.revision, nextState, commandId: crypto.randomUUID() });
    if (result.error) setError(result.error); else await refresh();
  };
  const confirmArchive = async () => {
    const result = await operationsClient.archiveRecord(eventId, definition.key, archiveCandidate.id,
      { expectedRevision: archiveCandidate.revision, commandId: crypto.randomUUID() });
    if (result.error) setError(result.error); else { setArchiveCandidate(null); await refresh(); }
  };

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface-card p-4">
      <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Published module</p>
        <h3 className="mt-1 text-lg font-semibold text-foreground">{definition.label}</h3>
        <p className="text-xs text-muted-foreground">Private records · {definition.states.length} states</p></div>
      {!archived && definition.enabled !== false ? <Button onClick={() => setDialogRecord(null)}><Plus className="mr-1 h-4 w-4" /> New record</Button> : null}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="Filter by state" className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
        value={stateFilter} onChange={(event) => { setStateFilter(event.target.value); setArchiveCandidate(null); }}>
        <option value="">All states</option>{definition.states.map((state) => <option key={state.key} value={state.key}>{state.label}</option>)}
      </select>
      <Button size="sm" variant={archived ? "secondary" : "outline"} disabled={definition.enabled === false} onClick={() => { setArchived((value) => !value); setArchiveCandidate(null); }}>
        <Archive className="mr-1 h-3.5 w-3.5" /> {archived ? "History" : "View history"}</Button>
      {definition.views.includes("board") ? <div className="ml-auto flex gap-1">
        <Button size="sm" variant={view === "table" ? "secondary" : "ghost"} onClick={() => setView("table")} aria-label="Table view"><List className="h-4 w-4" /></Button>
        <Button size="sm" variant={view === "board" ? "secondary" : "ghost"} onClick={() => setView("board")} aria-label="Board view"><LayoutGrid className="h-4 w-4" /></Button>
      </div> : null}
      <Button size="sm" variant="ghost" onClick={refresh} aria-label="Reload records"><RotateCcw className="h-4 w-4" /></Button>
    </div>
    {error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error.message}</p> : null}
    {displayLoading ? <div className="flex items-center gap-3 py-8 text-sm text-muted-foreground"><LogoLoading size={32} />Loading records…</div> : null}
    {!displayLoading && !items.length ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">{archived ? "No archived records." : "No records yet. Add one to start this module."}</div> : null}
    {!displayLoading && view === "board" && !archived ? <div className="grid gap-3 lg:grid-cols-3">
      {definition.states.map((state) => <div key={state.key} className="rounded-xl border border-border bg-background/40 p-3">
        <div className="mb-3 flex items-center justify-between text-sm font-semibold text-foreground"><span>{state.label}</span>
          <span className="text-xs text-muted-foreground">{items.filter((item) => item.state === state.key).length}</span></div>
        <div className="space-y-2">{items.filter((item) => item.state === state.key).map((record) =>
          <RecordCard key={record.id} record={record} definition={definition} onEdit={setDialogRecord} onMove={move} onArchive={setArchiveCandidate} />)}</div>
      </div>)}
    </div> : !displayLoading ? <div className="grid gap-2">{items.map((record) => <RecordCard key={record.id} record={record} definition={definition}
      onEdit={setDialogRecord} onMove={move} onArchive={setArchiveCandidate} archived={archived} />)}</div> : null}
    {!displayLoading && nextCursor ? <Button type="button" variant="outline" onClick={() => load(nextCursor)}>Load more</Button> : null}
    {archiveCandidate ? <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
      <p className="font-semibold text-foreground">Archive {archiveCandidate.title}?</p>
      <p className="mt-1 text-muted-foreground">It remains in private history and can no longer be edited.</p>
      <div className="mt-3 flex gap-2"><Button type="button" variant="outline" onClick={() => setArchiveCandidate(null)}>Cancel</Button>
        <Button type="button" onClick={confirmArchive}>Archive record</Button></div>
    </div> : null}
    {dialogRecord !== undefined ? <RecordDialog key={dialogRecord?.id ?? "new"} eventId={eventId} definition={definition}
      record={dialogRecord} open onOpenChange={(open) => { if (!open) setDialogRecord(undefined); }}
      onSave={save} onReload={refresh} /> : null}
  </div>;
}
