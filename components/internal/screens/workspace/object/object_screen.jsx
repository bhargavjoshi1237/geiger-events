"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Bookmark, Check, Download, Loader2, MoreHorizontal, Pencil, Plus, Save, SquareKanban, Table2, Ticket, Trash2, Upload,
} from "lucide-react";
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label,
  LoadingArea, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetTitle,
} from "@geiger/ui";
import { toast } from "sonner";
import { EmptyState, SearchInput, SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { liveFieldsOf } from "../state/use_workspace";
import { fetchAllRecords, useRecords } from "../state/use_records";
import { plural } from "../state/format";
import { iconFor, ObjectIcon } from "../ws_ui";
import { FieldSheet } from "../edit/field_sheet";
import { StructurePanel } from "../edit/structure_panel";
import { StagesSheet } from "../process/stages_sheet";
import { useProcess } from "../process/use_process";
import { RecordPanel, RecordSheet } from "../record/record_sheet";
import { PageBar, PageToolbar, Spacer, TOOLBAR_TABS, useWide, WorkspacePage } from "../shell/page";
import { BoardView } from "./board_view";
import { BulkBar } from "./bulk_bar";
import { CsvImportSheet } from "./csv_import";
import { downloadText, fileSafe, recordsToCsv } from "./csv";
import { FieldsButton, FilterButton, FilterChips, SortButton, toApiFilter } from "./filter_builder";
import { MatchTicketsDialog, ticketFieldsOf } from "./match_tickets";
import { TableView } from "./table_view";

const DENSITY_KEY = "ws-density";
const EMPTY_KEY = "ws-board-empty";
const MANUAL = [{ field: "rank", dir: "asc" }];
const countConditions = (node) => (node?.items ?? []).reduce((n, item) => n + (item.items ? countConditions(item) : 1), 0);

// Keeps saved column settings, adds new fields at the end and drops deleted ones.
function mergeColumns(saved, fields) {
  const known = new Set(fields.map((field) => field.id));
  const kept = (saved ?? []).filter((column) => known.has(column.fieldId));
  const seen = new Set(kept.map((column) => column.fieldId));
  return [...kept, ...fields.filter((field) => !seen.has(field.id)).map((field) => ({ fieldId: field.id }))];
}

function SaveViewDialog({ open, onOpenChange, canShare, onSave }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        {open ? <SaveViewBody canShare={canShare} onCancel={() => onOpenChange(false)} onSave={onSave} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SaveViewBody({ canShare, onCancel, onSave }) {
  const [name, setName] = useState("");
  const [shared, setShared] = useState(canShare);
  return (
    <>
      <DialogHeader>
        <DialogTitle>Save view</DialogTitle>
        <DialogDescription>Keeps these columns, filters and sorting under a name.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="space-y-1.5"><Label htmlFor="ws-view-name">Name</Label><Input id="ws-view-name" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Confirmed" /></div>
        {canShare ? <label className="flex items-center gap-2 text-sm"><Checkbox checked={shared} onCheckedChange={(v) => setShared(Boolean(v))} />Share with the team</label> : null}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={!name.trim()} onClick={() => onSave(name.trim(), shared)}>Save view</Button>
      </DialogFooter>
    </>
  );
}

// A view's working settings, loaded from the saved view (or defaults) whenever the chosen view changes.
function viewSettings(key, savedView, viewId, fields) {
  const config = savedView?.config ?? {};
  return {
    key,
    kind: savedView ? config.kind ?? "table" : viewId === "board" ? "board" : "table",
    columns: mergeColumns(config.columns, fields),
    filter: config.filter ?? null,
    sort: config.sort ?? [],
    groupBy: config.groupBy ?? null,
  };
}

function readDensity() {
  try { return window.localStorage.getItem(DENSITY_KEY) === "compact" ? "compact" : "comfortable"; } catch { return "comfortable"; }
}

function readShowEmpty() {
  try { return window.localStorage.getItem(EMPTY_KEY) !== "off"; } catch { return true; }
}

// One list: its views (table, board, saved), filters, the record panel and the Edit structure panel.
export function ObjectScreen({ eventId, ws, object }) {
  const { data, can, run } = ws;
  const timeZone = data?.event?.timeZone ?? "UTC";
  const fields = useMemo(() => liveFieldsOf(data, object.id), [data, object.id]);
  const stageRules = useProcess(eventId).processes[object.id];
  const views = useMemo(() => (data?.views ?? []).filter((view) => view.objectId === object.id), [data, object.id]);
  const wide = useWide();
  const [viewId, setViewId] = useState("table");
  const savedView = views.find((view) => view.id === viewId) ?? null;
  const viewKey = `${viewId}:${savedView?.id ?? ""}`;
  const [settings, setSettings] = useState(() => viewSettings(viewKey, savedView, viewId, fields));
  const [selected, setSelected] = useState(new Set());
  if (settings.key !== viewKey) {
    setSettings(viewSettings(viewKey, savedView, viewId, fields));
    setSelected(new Set());
  }
  const { kind, filter, sort, groupBy } = settings;
  const columns = mergeColumns(settings.columns, fields);
  const change = (key) => (value) => setSettings((current) => ({ ...current, [key]: typeof value === "function" ? value(mergeColumns(current[key], fields)) : value }));
  const setColumns = change("columns");
  const setFilter = change("filter");
  const setSort = change("sort");
  const setGroupBy = change("groupBy");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [panel, setPanel] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [density, setDensity] = useState(readDensity);
  const [showEmpty, setShowEmpty] = useState(readShowEmpty);
  const [fieldSheet, setFieldSheet] = useState({ open: false, field: null });
  const [stagesSheet, setStagesSheet] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [matching, setMatching] = useState(false);
  const editMode = panel?.kind === "structure";
  const compact = Boolean(panel) && wide;

  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);

  const apiFilter = toApiFilter(filter);
  // Boards keep a manual order (cards stay where they're dropped) unless the view sorts them.
  const manual = kind === "board" && !sort.length;
  const spec = { filter: apiFilter, sort: sort.length ? sort : manual ? MANUAL : undefined, search: query || undefined };
  const records = useRecords(eventId, object.id, spec, data);

  const currentConfig = { kind, columns, ...(apiFilter ? { filter: apiFilter } : {}), ...(sort.length ? { sort } : {}), ...(groupBy ? { groupBy } : {}) };
  const dirty = savedView
    ? JSON.stringify({ ...currentConfig }) !== JSON.stringify({ kind: savedView.config.kind ?? "table", columns: mergeColumns(savedView.config.columns, fields), ...(savedView.config.filter ? { filter: savedView.config.filter } : {}), ...(savedView.config.sort ? { sort: savedView.config.sort } : {}), ...(savedView.config.groupBy ? { groupBy: savedView.config.groupBy } : {}) })
    : Boolean(apiFilter || sort.length || groupBy || columns.some((column) => column.hidden || column.width) || columns.map((c) => c.fieldId).join() !== fields.map((f) => f.id).join());
  const canEditView = savedView ? (savedView.shared ? can.configure : true) : true;

  const saveView = async (name, shared) => {
    const result = await run("view.save", { objectId: object.id, name, shared, config: currentConfig }, { success: "View saved" });
    setSaving(false);
    if (!result.error) setViewId(result.data.view.id);
  };
  const updateView = () => run("view.save", { objectId: object.id, viewId: savedView.id, config: currentConfig }, { success: "View updated" });
  const deleteView = async () => {
    const result = await run("view.delete", { viewId: savedView.id }, { success: "View deleted" });
    if (!result.error) setViewId("table");
  };
  const resetView = () => setSettings(viewSettings(viewKey, savedView, viewId, fields));
  const chooseDensity = (next) => {
    setDensity(next);
    try { window.localStorage.setItem(DENSITY_KEY, next); } catch { /* per-viewer convenience only */ }
  };
  const chooseShowEmpty = (next) => {
    setShowEmpty(next);
    try { window.localStorage.setItem(EMPTY_KEY, next ? "on" : "off"); } catch { /* per-viewer convenience only */ }
  };

  const cellSave = async (row, field, value) => {
    const result = await run("record.update", { recordId: row.id, expectedRevision: row.revision, values: { [field.id]: value } }, { quiet: true });
    if (result.error) return false;
    records.patchRow(result.data.record);
    if (["link_record", "link_event"].includes(field.type) || fields.some((f) => f.type === "lookup" || f.type === "rollup")) records.reload();
    return true;
  };
  // A board drop: shows the card in its new place at once, then saves the column change and (in manual order) its position.
  const place = async (row, { value, afterId = null, beforeId = null }, force = false) => {
    const by = groupBy || "status";
    const changed = value !== undefined;
    const patch = !changed ? {} : by === "status" ? { status: value } : { values: { ...row.values, [by]: value } };
    records.placeRow(row.id, patch, { afterId, beforeId });
    if (changed) {
      const payload = by === "status" ? { status: value } : { values: { [by]: value } };
      const result = await run("record.update", { recordId: row.id, expectedRevision: row.revision, ...payload, ...(force ? { force: true } : {}) },
        { quiet: true, handle: ["move_not_allowed"] });
      if (result.error) {
        records.reload();
        if (result.error.code === "move_not_allowed") {
          toast.error(result.error.message, can.configure ? { action: { label: "Move anyway", onClick: () => place(row, { value, afterId, beforeId }, true) } } : undefined);
        }
        return;
      }
      records.patchRow(result.data.record);
    }
    if (manual && (afterId || beforeId)) {
      const ranked = await run("record.rank", { recordId: row.id, afterId, beforeId }, { quiet: true });
      if (ranked.error) records.reload();
    }
  };
  const deleteOne = async (row) => {
    const result = await run("records.delete", { recordIds: [row.id], objectId: object.id }, { success: `Deleted ${row.title || `${object.numberPrefix}-${row.number}`}` });
    if (!result.error) records.reload();
  };
  const bulkApply = async (payload) => {
    const result = await run("records.bulk", { recordIds: [...selected], ...payload }, { success: `Updated ${plural(selected.size, "record")}` });
    if (!result.error) records.reload();
  };
  const bulkDelete = async () => {
    const result = await run("records.delete", { recordIds: [...selected], objectId: object.id });
    if (!result.error) { setSelected(new Set()); records.reload(); }
  };
  const exportRows = async (onlySelected) => {
    setExporting(true);
    try {
      const rows = onlySelected ? records.rows.filter((row) => selected.has(row.id)) : await fetchAllRecords(eventId, object.id, spec);
      const shown = columns.filter((column) => !column.hidden).map((column) => fields.find((field) => field.id === column.fieldId)).filter(Boolean);
      downloadText(`${fileSafe(object.plural)}.csv`, recordsToCsv(object, shown, rows, timeZone));
    } catch (error) {
      toast.error(error.message || "Couldn't export.");
    } finally {
      setExporting(false);
    }
  };
  const reorder = (dragId, dropId) => {
    const order = columns.map((column) => column.fieldId);
    order.splice(order.indexOf(dragId), 1);
    order.splice(order.indexOf(dropId), 0, dragId);
    setColumns(order.map((id) => columns.find((column) => column.fieldId === id)));
    if (editMode) run("field.reorder", { objectId: object.id, order }, { quiet: true });
  };
  const deleteField = (field) => run("field.delete", { fieldId: field.id, objectId: object.id }).then((r) => { if (!r.error) records.reload(); });

  const openRecord = (recordId, targetObjectId) => setPanel({ kind: "record", recordId, objectId: targetObjectId && targetObjectId !== object.id ? targetObjectId : object.id });
  const newRecord = (initial = null) => setPanel({ kind: "record", recordId: null, objectId: object.id, initial, nonce: Date.now() });
  const addToLane = (by, laneId) => newRecord(by === "status" ? { status: laneId } : { values: { [by]: laneId } });
  const groupChoices = [{ id: "status", name: "Status" }, ...fields.filter((field) => field.type === "single_select").map((field) => ({ id: field.id, name: field.name }))];
  const allTabs = [
    { label: "Table", value: "table", icon: Table2 }, { label: "Board", value: "board", icon: SquareKanban },
    ...views.map((view) => ({ label: view.name, value: view.id, icon: Bookmark })),
  ];
  const tabs = compact ? allTabs.filter((tab) => tab.value === "table" || tab.value === "board" || tab.value === viewId) : allTabs;
  const loading = records.status === "loading";
  const empty = records.status === "ready" && !records.rows.length;
  const conditions = countConditions(filter);
  const showChips = !editMode && (conditions > 0 || dirty);
  const listCount = data?.counts?.[object.id];
  const filtered = Boolean(apiFilter || query);
  const hiddenByFilter = filtered && listCount !== undefined && records.status === "ready" ? Math.max(0, listCount - records.total) : 0;
  const noun = (n) => plural(n, object.name.toLowerCase(), object.plural.toLowerCase());
  const record = panel?.kind === "record" ? panel : null;
  const sameList = record && record.objectId === object.id;
  const index = sameList && record.recordId ? records.rows.findIndex((row) => row.id === record.recordId) : -1;
  const position = index >= 0 ? {
    index, total: records.total,
    onPrev: index > 0 ? () => openRecord(records.rows[index - 1].id) : undefined,
    onNext: index < records.rows.length - 1 ? () => openRecord(records.rows[index + 1].id) : undefined,
  } : null;

  const recordProps = record ? {
    eventId, data, objectId: record.objectId, recordId: record.recordId, initial: record.initial, timeZone, can, run, position,
    onSaved: () => records.reload(), onOpenRecord: (id, targetObjectId) => openRecord(id, targetObjectId ?? record.objectId),
  } : null;
  const structure = (
    <StructurePanel eventId={eventId} data={data} object={object} fields={fields} run={run} onClose={() => setPanel(null)}
      onAddField={() => setFieldSheet({ open: true, field: null })} onEditField={(field) => setFieldSheet({ open: true, field })}
      onDeleteField={deleteField} onStageRules={() => setStagesSheet(true)} />
  );

  return (
    <WorkspacePage>
      <PageBar icon={iconFor(object.icon)} title={object.plural}
        note={records.status === "ready" ? noun(listCount ?? records.total) : null}
        actions={editMode ? (
          <Button size="sm" onClick={() => setPanel(null)}><Check className="h-4 w-4" />Done</Button>
        ) : (
          <>
            {can.configure ? <Button variant="outline" size="sm" onClick={() => setPanel({ kind: "structure" })}><Pencil className="h-3.5 w-3.5" />Edit structure</Button> : null}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Import and export" title="Import, export">
                  {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can.create ? <DropdownMenuItem onSelect={() => setImporting(true)}><Upload className="h-4 w-4" />Import a CSV</DropdownMenuItem> : null}
                <DropdownMenuItem disabled={exporting} onSelect={() => exportRows(false)}><Download className="h-4 w-4" />Export as CSV</DropdownMenuItem>
                {can.update && ticketFieldsOf(fields).length && fields.some((field) => field.type === "email") ? (
                  <><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => setMatching(true)}><Ticket className="h-4 w-4" />Match tickets by email</DropdownMenuItem></>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
            {can.create ? <Button size="sm" onClick={() => newRecord()}><Plus className="h-4 w-4" />New {object.name.toLowerCase()}</Button> : null}
          </>
        )} />

      <PageToolbar>
        <div className="flex items-center gap-2">
          <SegmentedTabs {...TOOLBAR_TABS} tabs={tabs} value={viewId} onChange={setViewId} />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-text-secondary" aria-label="Save as a new view" title="New view" onClick={() => setSaving(true)}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          {kind === "board" || groupBy ? (
            <Select value={groupBy ?? "status"} onValueChange={(value) => setGroupBy(value === "status" && kind === "board" ? null : value)}>
              <SelectTrigger className="h-8 w-36 shrink-0"><SelectValue placeholder="Group by" /></SelectTrigger>
              <SelectContent>{groupChoices.map((choice) => <SelectItem key={choice.id} value={choice.id}>By {choice.name.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          <FilterButton filter={filter} onChange={setFilter} fields={fields} statuses={object.statuses ?? []} eventId={eventId} open={filterOpen} onOpenChange={setFilterOpen} />
          <SortButton sort={sort} onChange={setSort} fields={fields} compact={compact} />
          {kind === "table" ? <FieldsButton columns={columns} fields={fields} titleFieldId={object.titleFieldId} onChange={setColumns} compact={compact} /> : (
            <FieldsButton columns={columns} fields={fields} titleFieldId={object.titleFieldId} onChange={setColumns} compact={compact}
              label="Properties" heading="Show on cards" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="View options" title="View options" className="h-8 w-8 shrink-0 text-muted-foreground"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {kind === "table" ? <DropdownMenuItem onSelect={() => setGroupBy(groupBy ? null : "status")}>{groupBy ? "Stop grouping" : "Group rows"}</DropdownMenuItem> : null}
              {kind === "table" ? (
                <>
                  <DropdownMenuLabel className="text-xs font-medium text-text-secondary">Row height</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={density} onValueChange={chooseDensity}>
                    <DropdownMenuRadioItem value="compact">Compact</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="comfortable">Comfortable</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </>
              ) : (
                <>
                  <DropdownMenuLabel className="text-xs font-medium text-text-secondary">Ordering</DropdownMenuLabel>
                  <DropdownMenuRadioGroup value={sort.length ? "sorted" : "manual"} onValueChange={(value) => { if (value === "manual") setSort([]); }}>
                    <DropdownMenuRadioItem value="manual">Manual · drag to reorder</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="sorted" disabled={!sort.length}>By the sort</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuCheckboxItem checked={showEmpty} onCheckedChange={(on) => chooseShowEmpty(on === true)}>Show empty columns</DropdownMenuCheckboxItem>
                </>
              )}
              <DropdownMenuSeparator />
              {savedView && canEditView ? <DropdownMenuItem disabled={!dirty} onSelect={updateView}><Save className="h-4 w-4" />Save changes to “{savedView.name}”</DropdownMenuItem> : null}
              <DropdownMenuItem onSelect={() => setSaving(true)}><Save className="h-4 w-4" />Save as new view</DropdownMenuItem>
              {savedView && canEditView ? (
                <DropdownMenuItem className="text-red-600 dark:text-red-400" onSelect={deleteView}><Trash2 className="h-4 w-4" />Delete view</DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
          <SearchInput value={search} onChange={setSearch} placeholder={`Search ${object.plural.toLowerCase()}…`} />
        </div>
      </PageToolbar>

      {showChips ? (
        <FilterChips filter={filter} onChange={setFilter} fields={fields} statuses={object.statuses ?? []} onOpen={() => setFilterOpen(true)} onAdd={() => setFilterOpen(true)}
          dirtyLabel={dirty && !compact ? `Unsaved changes to ${savedView?.name ?? (kind === "board" ? "Board" : "Table")}` : null}
          onReset={dirty ? resetView : null} onSave={dirty && canEditView ? (savedView ? updateView : () => setSaving(true)) : null} />
      ) : null}

      <div className="relative flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div className="scrollbar-subtle min-h-0 flex-1 overflow-auto">
            {loading ? (
              <LoadingArea size={48} label={`Loading ${object.plural}`} />
            ) : records.status === "error" ? (
              <EmptyState title="Couldn't load records" description={records.error?.message} action={<Button variant="outline" onClick={records.reload}>Try again</Button>} />
            ) : empty && !filtered && !editMode ? (
              <div className="flex h-full items-center justify-center">
                <EmptyState icon={(props) => <ObjectIcon icon={object.icon} {...props} />} title={`No ${object.plural.toLowerCase()} yet`}
                  description={can.create ? "Add the first one, or import a CSV." : undefined}
                  action={can.create ? <Button onClick={() => newRecord()}><Plus className="h-4 w-4" />New {object.name.toLowerCase()}</Button> : null} />
              </div>
            ) : kind === "board" ? (
              <BoardView object={object} fields={fields} columns={columns} rows={records.rows} groupBy={groupBy} eventId={eventId} timeZone={timeZone}
                can={can} stageRules={stageRules} manual={manual} showEmpty={showEmpty} selected={selected} onSelect={setSelected}
                onOpen={openRecord} onPlace={place} onAdd={addToLane} onDelete={deleteOne} activeId={sameList ? record.recordId : null} />
            ) : (
              <>
                <TableView object={object} fields={fields} columns={columns} rows={records.rows} eventId={eventId} timeZone={timeZone} can={can}
                  editMode={editMode} selected={selected} onSelect={setSelected} onOpen={openRecord} onCellSave={cellSave} groupBy={groupBy}
                  activeId={sameList ? record.recordId : null} density={density}
                  onEditField={(field) => setFieldSheet({ open: true, field })}
                  onHideField={(fieldId) => setColumns(columns.map((column) => (column.fieldId === fieldId ? { ...column, hidden: true } : column)))}
                  onDeleteField={deleteField} onReorder={reorder}
                  onResize={(fieldId, width) => setColumns((current) => current.map((column) => (column.fieldId === fieldId ? { ...column, width: Math.round(width) } : column)))} />
                {empty ? <p className="py-10 text-center text-sm text-text-secondary">Nothing matches. Try another search or filter.</p> : null}
              </>
            )}
          </div>
          {kind === "table" && records.status === "ready" && records.rows.length ? (
            <div className="flex h-9 shrink-0 items-center gap-3 border-t border-border/70 px-4 text-xs text-text-secondary sm:px-6">
              <span className="tabular-nums">{records.rows.length.toLocaleString()} of {noun(records.total)}</span>
              {records.hasMore ? (
                <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={records.loadMore}>Show more · {(records.total - records.rows.length).toLocaleString()} more</Button>
              ) : null}
              <Spacer />
              {hiddenByFilter ? <span className="hidden sm:inline">{hiddenByFilter.toLocaleString()} hidden because of the {query && !apiFilter ? "search" : "filter"}</span> : null}
            </div>
          ) : kind === "board" && records.hasMore && !loading ? (
            <div className="flex h-9 shrink-0 items-center gap-3 border-t border-border/70 px-4 text-xs text-text-secondary sm:px-6">
              <span className="tabular-nums">{records.rows.length.toLocaleString()} of {noun(records.total)}</span>
              <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={records.loadMore}>Show more</Button>
            </div>
          ) : null}
          {selected.size ? (
            <BulkBar object={object} fields={fields} count={selected.size} can={can} eventId={eventId} timeZone={timeZone} stageRules={stageRules}
              onApply={bulkApply} onExport={() => exportRows(true)} onDelete={bulkDelete} onClear={() => setSelected(new Set())} />
          ) : null}
        </div>

        {wide && record ? (
          <aside className="flex w-[min(580px,55%)] shrink-0 flex-col border-l border-border bg-background shadow-[-16px_0_40px_rgba(0,0,0,0.25)]">
            <RecordPanel key={`${record.objectId}:${record.recordId ?? `new-${record.nonce}`}`} onClose={() => setPanel(null)} {...recordProps} />
          </aside>
        ) : null}
        {wide && editMode ? <aside className="flex w-[360px] shrink-0 flex-col border-l border-border bg-background">{structure}</aside> : null}
      </div>

      {!wide ? (
        <>
          <RecordSheet open={Boolean(record)} onOpenChange={(open) => { if (!open) setPanel(null); }} {...(recordProps ?? { eventId, data, timeZone, can, run })} />
          <Sheet open={editMode} onOpenChange={(open) => { if (!open) setPanel(null); }}>
            <SheetContent showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
              <SheetTitle className="sr-only">Structure of {object.plural}</SheetTitle>
              <SheetDescription className="sr-only">Fields, stages and list settings.</SheetDescription>
              {editMode ? structure : null}
            </SheetContent>
          </Sheet>
        </>
      ) : null}
      <FieldSheet open={fieldSheet.open} onOpenChange={(open) => setFieldSheet((s) => ({ ...s, open }))} data={data} objectId={object.id}
        field={fieldSheet.field ? fields.find((field) => field.id === fieldSheet.field.id) ?? fieldSheet.field : null} run={run} onDeleted={records.reload} />
      <StagesSheet open={stagesSheet} onOpenChange={setStagesSheet} eventId={eventId} ws={{ data, objects: data.objects.filter((item) => !item.deletedAt) }} object={object} />
      <CsvImportSheet open={importing} onOpenChange={setImporting} eventId={eventId} object={object} fields={fields} onDone={records.reload} />
      <SaveViewDialog open={saving} onOpenChange={setSaving} canShare={can.configure} onSave={saveView} />
      {matching ? <MatchTicketsDialog open onOpenChange={setMatching} eventId={eventId} object={object} fields={fields} onDone={records.reload} /> : null}
    </WorkspacePage>
  );
}
