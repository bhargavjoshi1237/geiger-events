"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Check, Download, Loader2, MoreHorizontal, Pencil, Plus, Save, Settings2, Trash2, Upload,
} from "lucide-react";
import {
  Button, Checkbox, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DropdownMenu, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, Input, Label, LogoLoading, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@geiger/ui";
import { toast } from "sonner";
import { EditorSectionHeader, EmptyState, SearchInput, SegmentedTabs, Toolbar } from "@/components/internal/shared/screen_kit";
import { liveFieldsOf } from "../state/use_workspace";
import { fetchAllRecords, useRecords } from "../state/use_records";
import { plural } from "../state/format";
import { ObjectIcon } from "../ws_ui";
import { FieldSheet } from "../edit/field_sheet";
import { ObjectSheet } from "../edit/object_sheet";
import { StagesSheet } from "../process/stages_sheet";
import { useProcess } from "../process/use_process";
import { RecordSheet } from "../record/record_sheet";
import { BoardView } from "./board_view";
import { BulkBar } from "./bulk_bar";
import { CsvImportSheet } from "./csv_import";
import { downloadText, fileSafe, recordsToCsv } from "./csv";
import { FilterButton, SortButton, toApiFilter } from "./filter_builder";
import { MatchTicketsDialog, ticketFieldsOf } from "./match_tickets";
import { TableView } from "./table_view";


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
          <div className="space-y-1.5"><Label htmlFor="ws-view-name">Name</Label><Input id="ws-view-name" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Accepted papers" /></div>
          {canShare ? (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={shared} onCheckedChange={(v) => setShared(Boolean(v))} />Share with the team</label>
          ) : null}
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

export function ObjectScreen({ eventId, ws, object }) {
  const { data, can, run } = ws;
  const timeZone = data?.event?.timeZone ?? "UTC";
  const fields = useMemo(() => liveFieldsOf(data, object.id), [data, object.id]);
  const stageRules = useProcess(eventId).processes[object.id];
  const views = useMemo(() => (data?.views ?? []).filter((view) => view.objectId === object.id), [data, object.id]);
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
  const [editMode, setEditMode] = useState(false);
  const [sheet, setSheet] = useState({ open: false, recordId: null, objectId: object.id });
  const [fieldSheet, setFieldSheet] = useState({ open: false, field: null });
  const [objectSheet, setObjectSheet] = useState(false);
  const [stagesSheet, setStagesSheet] = useState(false);
  const [importing, setImporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [matching, setMatching] = useState(false);

  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 250); return () => clearTimeout(timer); }, [search]);

  const apiFilter = toApiFilter(filter);
  const spec = { filter: apiFilter, sort: sort.length ? sort : undefined, search: query || undefined };
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
  const updateView = async () => {
    const result = await run("view.save", { objectId: object.id, viewId: savedView.id, config: currentConfig }, { success: "View updated" });
    if (result.error) return;
  };
  const deleteView = async () => {
    const result = await run("view.delete", { viewId: savedView.id }, { success: "View deleted" });
    if (!result.error) setViewId("table");
  };

  const cellSave = async (row, field, value) => {
    const result = await run("record.update", { recordId: row.id, expectedRevision: row.revision, values: { [field.id]: value } }, { quiet: true });
    if (result.error) return false;
    records.patchRow(result.data.record);
    if (["link_record", "link_event"].includes(field.type) || fields.some((f) => f.type === "lookup" || f.type === "rollup")) records.reload();
    return true;
  };
  const move = async (row, by, value) => {
    const payload = by === "status" ? { status: value } : { values: { [by]: value } };
    const result = await run("record.update", { recordId: row.id, expectedRevision: row.revision, ...payload }, { quiet: true });
    if (!result.error) records.patchRow(result.data.record);
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

  const openRecord = (recordId, targetObjectId) => setSheet({ open: true, recordId, objectId: targetObjectId && targetObjectId !== object.id ? targetObjectId : object.id });
  const groupChoices = [{ id: "status", name: "Status" }, ...fields.filter((field) => field.type === "single_select").map((field) => ({ id: field.id, name: field.name }))];
  const tabs = [
    { label: "Table", value: "table" }, { label: "Board", value: "board" },
    ...views.map((view) => ({ label: view.name, value: view.id })),
  ];
  const loading = records.status === "loading";
  const empty = records.status === "ready" && !records.rows.length;

  return (
    <div className="space-y-4">
      <EditorSectionHeader
        title={<span className="inline-flex items-center gap-2 normal-case"><ObjectIcon icon={object.icon} className="h-5 w-5 text-text-secondary" />{object.plural}</span>}
        description={records.status === "ready" ? plural(records.total, object.name.toLowerCase(), object.plural.toLowerCase()) : " "}
        action={
          <>
            {can.configure ? (
              <Button variant={editMode ? "default" : "outline"} onClick={() => setEditMode((on) => !on)}>
                {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}{editMode ? "Done" : "Edit structure"}
              </Button>
            ) : null}
            {can.create ? <Button variant="outline" onClick={() => setImporting(true)}><Upload className="h-4 w-4" />Import</Button> : null}
            <Button variant="outline" onClick={() => exportRows(false)} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}Export
            </Button>
            {can.create ? <Button onClick={() => setSheet({ open: true, recordId: null, objectId: object.id })}><Plus className="h-4 w-4" />New {object.name.toLowerCase()}</Button> : null}
          </>
        }
      />

      {editMode ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface-subtle px-3 py-2 text-sm text-text-secondary">
          <span className="mr-auto">Editing the structure of {object.plural}. Changes apply straight away and can be undone.</span>
          <Button size="sm" variant="ghost" onClick={() => setObjectSheet(true)}><Settings2 className="h-4 w-4" />List settings</Button>
          {object.statuses?.length ? <Button size="sm" variant="ghost" onClick={() => setStagesSheet(true)}>Stage rules</Button> : null}
          <Button size="sm" variant="ghost" onClick={() => setFieldSheet({ open: true, field: null })}><Plus className="h-4 w-4" />Add field</Button>
        </div>
      ) : null}

      <Toolbar>
        <SegmentedTabs tabs={tabs} value={viewId} onChange={setViewId} />
        <div className="flex items-center gap-2">
          {kind === "board" || groupBy ? (
            <Select value={groupBy ?? "status"} onValueChange={(value) => setGroupBy(value === "status" && kind === "board" ? null : value)}>
              <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Group by" /></SelectTrigger>
              <SelectContent>{groupChoices.map((choice) => <SelectItem key={choice.id} value={choice.id}>By {choice.name.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          <FilterButton filter={filter} onChange={setFilter} fields={fields} statuses={object.statuses ?? []} eventId={eventId} />
          <SortButton sort={sort} onChange={setSort} fields={fields} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" aria-label="View options" className="shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {kind === "table" ? (
                <DropdownMenuItem onSelect={() => setGroupBy(groupBy ? null : "status")}>{groupBy ? "Stop grouping" : "Group rows"}</DropdownMenuItem>
              ) : null}
              {can.update && ticketFieldsOf(fields).length && fields.some((field) => field.type === "email") ? (
                <DropdownMenuItem onSelect={() => setMatching(true)}>Match tickets by email</DropdownMenuItem>
              ) : null}
              {columns.some((column) => column.hidden) ? (
                <DropdownMenuItem onSelect={() => setColumns(columns.map((column) => ({ fieldId: column.fieldId, ...(column.width ? { width: column.width } : {}) })))}>Show hidden fields</DropdownMenuItem>
              ) : null}
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
      </Toolbar>

      {selected.size ? (
        <BulkBar object={object} fields={fields} count={selected.size} can={can} eventId={eventId} timeZone={timeZone} stageRules={stageRules}
          onApply={bulkApply} onExport={() => exportRows(true)} onDelete={bulkDelete} onClear={() => setSelected(new Set())} />
      ) : null}

      {loading ? (
        <div className="flex justify-center rounded-xl border border-border bg-surface-subtle py-16"><LogoLoading size={48} aria-label={`Loading ${object.plural}`} /></div>
      ) : records.status === "error" ? (
        <EmptyState title="Couldn't load records" description={records.error?.message} action={<Button variant="outline" onClick={records.reload}>Try again</Button>} />
      ) : empty && !apiFilter && !query && !editMode ? (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={(props) => <ObjectIcon icon={object.icon} {...props} />} title={`No ${object.plural.toLowerCase()} yet`}
            description={can.create ? `Add the first one, or import a CSV.` : undefined}
            action={can.create ? <Button onClick={() => setSheet({ open: true, recordId: null, objectId: object.id })}><Plus className="h-4 w-4" />New {object.name.toLowerCase()}</Button> : null} />
        </div>
      ) : kind === "board" ? (
        <BoardView object={object} fields={fields} columns={columns} rows={records.rows} groupBy={groupBy} eventId={eventId} timeZone={timeZone}
          can={can} stageRules={stageRules} onOpen={openRecord} onMove={move} />
      ) : (
        <>
          <TableView object={object} fields={fields} columns={columns} rows={records.rows} eventId={eventId} timeZone={timeZone} can={can}
            editMode={editMode} selected={selected} onSelect={setSelected} onOpen={openRecord} onCellSave={cellSave} groupBy={groupBy}
            onEditField={(field) => setFieldSheet({ open: true, field })} onAddField={() => setFieldSheet({ open: true, field: null })}
            onHideField={(fieldId) => setColumns(columns.map((column) => (column.fieldId === fieldId ? { ...column, hidden: true } : column)))}
            onDeleteField={deleteField} onReorder={reorder}
            onResize={(fieldId, width) => setColumns((current) => current.map((column) => (column.fieldId === fieldId ? { ...column, width: Math.round(width) } : column)))} />
          {empty ? <p className="py-6 text-center text-sm text-text-secondary">Nothing matches. Try another search or filter.</p> : null}
        </>
      )}
      {records.hasMore && !loading ? (
        <div className="flex justify-center"><Button variant="outline" onClick={records.loadMore}>Show more · {plural(records.total - records.rows.length, "more")}</Button></div>
      ) : null}

      <RecordSheet open={sheet.open} onOpenChange={(open) => setSheet((s) => ({ ...s, open }))} eventId={eventId} data={data}
        objectId={sheet.objectId} recordId={sheet.recordId} timeZone={timeZone} can={can} run={run}
        onSaved={() => records.reload()} onOpenRecord={(id, targetObjectId) => setSheet({ open: true, recordId: id, objectId: targetObjectId ?? sheet.objectId })} />
      <FieldSheet open={fieldSheet.open} onOpenChange={(open) => setFieldSheet((s) => ({ ...s, open }))} data={data} objectId={object.id}
        field={fieldSheet.field ? fields.find((field) => field.id === fieldSheet.field.id) ?? fieldSheet.field : null} run={run} onDeleted={records.reload} />
      <ObjectSheet open={objectSheet} onOpenChange={setObjectSheet} data={data} object={object} run={run} />
      <StagesSheet open={stagesSheet} onOpenChange={setStagesSheet} eventId={eventId} ws={{ data, objects: data.objects.filter((item) => !item.deletedAt) }} object={object} />
      <CsvImportSheet open={importing} onOpenChange={setImporting} eventId={eventId} object={object} fields={fields} onDone={records.reload} />
      <SaveViewDialog open={saving} onOpenChange={setSaving} canShare={can.configure} onSave={saveView} />
      {matching ? <MatchTicketsDialog open onOpenChange={setMatching} eventId={eventId} object={object} fields={fields} onDone={records.reload} /> : null}
    </div>
  );
}
