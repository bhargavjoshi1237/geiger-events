"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ChevronUp, Loader2, Play, RefreshCcw, Trash2, X } from "lucide-react";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Kbd, LoadingArea,
  Separator, Sheet, SheetContent, SheetDescription, SheetTitle, Tabs, TabsList, TabsTrigger, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { allowedMoves } from "@/lib/workspace/process/stages.js";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { RecordDocumentsMenu } from "../documents/record_documents";
import { RUN_STATUS, RunBadge } from "../process/runs_view";
import { useProcess } from "../process/use_process";
import { liveFieldsOf } from "../state/use_workspace";
import { recordLabel, timeAgo } from "../state/format";
import { FieldValue, Muted, ObjectIcon, OptionChip, TypeIcon } from "../ws_ui";
import { FieldInput } from "./field_input";

const APPROVAL = { pending: "waiting for a decision", approved: "approved", rejected: "rejected", cancelled: "cancelled" };
// Underline tabs whose bar sits on the panel's divider line.
const TAB = "flex-none px-0 text-[13px] group-data-[orientation=horizontal]/tabs:after:-bottom-px";
const MULTILINE = new Set(["long_text", "rich_text"]);
const sameIds = (a = [], b = []) => a.length === b.length && a.every((item, i) => item.id === b[i]?.id);

function draftFrom(record, fields) {
  const values = {};
  for (const field of fields) {
    const type = getType(field.type);
    if (type.cast === "link") values[field.id] = record?.links?.[field.id] ?? [];
    else if (type.editable) values[field.id] = record?.values?.[field.id] ?? null;
  }
  return { values, status: record?.status ?? null };
}

// Plain-language summary of one history entry for the Activity tab.
function describe(entry, fieldsById, statuses) {
  switch (entry.action) {
    case "record.create": return entry.after?.note ? `added this record (${entry.after.note.toLowerCase()})` : "added this record";
    case "records.delete": return "moved it to the trash";
    case "records.restore": return "restored it";
    case "change.undo": return "undid a change";
    case "record.update": {
      const names = Object.keys(entry.after?.values ?? {}).map((id) => fieldsById.get(id)?.name ?? "a removed field");
      for (const id of Object.keys(entry.after?.links ?? {})) names.push(fieldsById.get(id)?.name ?? "a link");
      if ("status" in (entry.after ?? {})) {
        const label = statuses.find((status) => status.key === entry.after.status)?.label;
        names.push(label ? `status to ${label}` : "status");
      }
      return names.length ? `changed ${[...new Set(names)].join(", ")}` : "saved without changes";
    }
    default: return "made a change";
  }
}

// The record as a right-hand sheet, for screens without room to dock it (automations, approvals, team pages, phones).
export function RecordSheet({ open, onOpenChange, ...props }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false} className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetTitle className="sr-only">Record</SheetTitle>
        <SheetDescription className="sr-only">View and edit this record.</SheetDescription>
        {open ? <RecordPanel key={`${props.objectId}:${props.recordId ?? "new"}`} onClose={() => onOpenChange(false)} closeOnSave {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function BacklinkGroups({ backlinks, onOpenRecord }) {
  return (
    <div className="grid gap-3">
      {backlinks.map((group) => (
        <div key={group.fieldId} className="grid gap-1.5">
          <p className="text-[13px] font-medium text-foreground">{group.objectName} <span className="font-normal text-text-tertiary">· via {group.fieldName} · {group.records.length}</span></p>
          <div className="flex flex-wrap gap-1.5">
            {group.records.map((item) => (
              <button key={item.id} type="button" onClick={() => onOpenRecord?.(item.id, group.objectId)}
                className="inline-flex h-6 max-w-[16rem] items-center truncate rounded-md border border-border bg-surface-card px-2 text-[13px] hover:bg-surface-active">
                {item.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// One field as a label and a value; editable values turn into an input on click (Enter saves, Esc puts it back).
function FieldRow({ field, editing, editable, alwaysEdit, value, record, error, eventId, timeZone, onEdit, onChange, onSave, onRevert, onOpenRecord }) {
  const type = getType(field.type);
  const live = alwaysEdit || editing;
  const multiline = MULTILINE.has(field.type) || ["attachments", "link_record", "link_event", "multi_select"].includes(field.type);
  return (
    <div className={cn("grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-x-3 sm:grid-cols-[160px_minmax(0,1fr)]", multiline || live ? "items-start py-1" : "min-h-9 items-center")}>
      <span className={cn("flex min-w-0 items-center gap-2 text-[13px] text-text-secondary", (multiline || live) && "h-8")}>
        <TypeIcon type={field.type} className="h-3.5 w-3.5 shrink-0 text-text-tertiary" />
        <span className="truncate">{field.name}</span>{field.required && type.editable ? <span className="text-red-500" aria-hidden>*</span> : null}
      </span>
      <div className="min-w-0">
        {live ? (
          <div className="grid gap-1.5" onKeyDown={(event) => {
            if (alwaysEdit) return;
            if (event.key === "Enter" && !event.shiftKey && !MULTILINE.has(field.type)) { event.preventDefault(); onSave(); }
            if (event.key === "Escape") { event.stopPropagation(); onRevert(); }
          }}>
            <FieldInput field={field} id={`ws-field-${field.id}`} autoFocus={!alwaysEdit} eventId={eventId} timeZone={timeZone} value={value} onChange={onChange} />
            {!alwaysEdit ? (
              <span className="flex items-center justify-end gap-1.5 text-[11px] text-text-secondary">
                <Kbd>Esc</Kbd><span>to undo</span><Kbd>↵</Kbd><span>to save</span>
              </span>
            ) : null}
          </div>
        ) : (
          <div role={editable ? "button" : undefined} tabIndex={editable ? 0 : undefined} onClick={editable ? onEdit : undefined}
            onKeyDown={editable ? (event) => { if (event.target === event.currentTarget && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); onEdit(); } } : undefined}
            className={cn("-ml-2 flex min-h-8 w-[calc(100%+0.5rem)] items-center rounded-md px-2 text-left text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring",
              multiline && "py-1.5", editable ? "cursor-text hover:bg-surface-card" : "cursor-default")}>
            {record ? <FieldValue field={field} record={record} eventId={eventId} timeZone={timeZone} compact={false} onOpenRecord={onOpenRecord} />
              : <Muted>Calculated after saving.</Muted>}
          </div>
        )}
        {error ? <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
      </div>
    </div>
  );
}

// A record's details, activity and links. Docked beside the table on wide screens, or inside RecordSheet.
// `position` ({ index, total, onPrev, onNext }) adds "1 of 13" stepping through the list.
// `initial` ({ status, values }) pre-fills a new record, e.g. one added from a board column.
export function RecordPanel({ onClose, closeOnSave = false, position, initial, eventId, data, objectId, recordId, timeZone, can, run, onSaved, onOpenRecord }) {
  const object = data?.objects.find((item) => item.id === objectId);
  const fields = useMemo(() => liveFieldsOf(data, objectId), [data, objectId]);
  const process = useProcess(eventId);
  const isNew = !recordId;
  const [detail, setDetail] = useState(null);
  const [version, setVersion] = useState(0);
  // A new record's status stays undefined until picked, so it follows the stage rules once they load.
  const [edits, setEdits] = useState(() => {
    if (!isNew) return null;
    const blank = draftFrom(null, fields);
    return { values: { ...blank.values, ...(initial?.values ?? {}) }, status: initial?.status !== undefined ? initial.status : undefined };
  });
  const [editing, setEditing] = useState(null);
  const [context, setContext] = useState({ key: null, data: null });
  const [running, setRunning] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("details");
  const [comment, setComment] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!recordId) return undefined;
    let alive = true;
    workspaceApi.record(eventId, recordId).then(({ data: result }) => {
      if (!alive || !result) return;
      setDetail(result);
      setEdits(null);
      setErrors({});
    });
    return () => { alive = false; };
  }, [eventId, recordId, version]);

  // Automation runs and approvals for this record, loaded when the Activity tab opens.
  const contextKey = tab === "activity" && recordId ? `${recordId}:${version}` : null;
  useEffect(() => {
    if (!contextKey) return undefined;
    const controller = new AbortController();
    process.api.recordContext(recordId, controller.signal)
      .then(({ data: result }) => { if (!controller.signal.aborted) setContext({ key: contextKey, data: result }); }).catch(() => {});
    return () => controller.abort();
  }, [process.api, recordId, contextKey]);

  const load = () => setVersion((n) => n + 1);
  const loading = !isNew && !detail;
  const record = detail?.record;
  const draft = edits ?? draftFrom(record, fields);
  const setDraft = (update) => setEdits((current) => update(current ?? draftFrom(record, fields)));
  const editable = isNew ? can.create : can.update;
  const fieldsById = useMemo(() => new Map((data?.fields ?? []).map((field) => [field.id, field])), [data]);

  // Stage rules: null when moves aren't restricted; blocked options show only to people who may move anyway.
  const currentStatus = isNew ? null : record?.status ?? null;
  const allowed = allowedMoves(process.processes[objectId], object, currentStatus);
  const status = draft.status !== undefined ? draft.status : allowed ? allowed[0] ?? null : object?.statuses?.[0]?.key ?? null;
  const blocked = (key) => Boolean(allowed) && key !== currentStatus && !allowed.includes(key);
  const statusOptions = (object?.statuses ?? []).filter((option) => !blocked(option.key) || can.configure);
  const showNone = !allowed || (!isNew && currentStatus === null);
  const statusOf = (key) => object?.statuses?.find((option) => option.key === key);
  const manual = can.update && !isNew
    ? process.automations.filter((item) => item.enabled && item.trigger?.kind === "manual" && item.trigger.objectId === objectId) : [];

  const changes = (current = draft) => {
    const values = {};
    for (const field of fields) {
      const type = getType(field.type);
      if (!type.editable) continue;
      const next = current.values[field.id];
      if (type.cast === "link") {
        if (isNew ? next?.length : !sameIds(next, record?.links?.[field.id] ?? [])) values[field.id] = next ?? [];
      } else {
        const before = isNew ? null : record?.values?.[field.id] ?? null;
        if (JSON.stringify(next ?? null) !== JSON.stringify(before)) values[field.id] = next === "" ? null : next ?? null;
      }
    }
    return values;
  };
  const dirty = isNew || Boolean(Object.keys(changes()).length) || (status ?? null) !== (record?.status ?? null);

  const save = async ({ force = false, nextStatus, inline = false } = {}) => {
    const values = changes();
    const target = nextStatus !== undefined ? nextStatus : status;
    const statusChanged = isNew || target !== (record?.status ?? null);
    if (!isNew && !Object.keys(values).length && !statusChanged) {
      setEditing(null);
      if (!inline && closeOnSave) onClose?.();
      return;
    }
    setSaving(true);
    const handle = ["invalid_values", "invalid_input", "move_not_allowed"];
    const extra = force ? { force: true } : {};
    const result = isNew
      ? await run("record.create", { objectId, values, status: target, ...extra }, { handle, success: `${object.name} added` })
      : await run("record.update", { recordId, expectedRevision: record.revision, values, ...(statusChanged ? { status: target } : {}), ...extra },
        { handle, success: inline ? undefined : "Saved", quiet: inline });
    setSaving(false);
    if (result.error) {
      const { code, message, fields: problems } = result.error;
      if (code === "move_not_allowed") {
        toast.error(message, can.configure ? { action: { label: "Move anyway", onClick: () => save({ force: true, nextStatus, inline }) } } : undefined);
        return;
      }
      const named = code === "invalid_values" || code === "invalid_input" ? problems ?? {} : {};
      if (Object.keys(named).length) { setErrors(named); setTab("details"); }
      if (code === "invalid_input" || !Object.keys(named).length) toast.error(message);
      return;
    }
    setEditing(null);
    onSaved?.(result.data.record);
    if (isNew || (closeOnSave && !inline)) onClose?.();
    else load();
  };

  const runAutomation = async (automation) => {
    setRunning(automation.id);
    const { data: result, error } = await process.api.command({ action: "automation.run", id: automation.id, recordIds: [recordId] });
    setRunning(null);
    if (error) { toast.error(error.message); return; }
    const first = result.runs?.[0];
    if (!first) toast.success(`${automation.name} queued`);
    else if (first.status === "failed") toast.error(`${automation.name} failed${first.error ? `: ${first.error}` : ""}`);
    else toast.success(`${automation.name}: ${(RUN_STATUS[first.status]?.label ?? first.status).toLowerCase()}`);
    load();
  };

  const remove = async () => {
    const result = await run("records.delete", { recordIds: [recordId], objectId });
    if (!result.error) { onSaved?.(null); onClose?.(); }
  };

  const addComment = async () => {
    if (posting || !comment.trim()) return;
    setPosting(true);
    const result = await run("comment.add", { recordId, body: comment }, { success: "Comment added", undo: false });
    setPosting(false);
    if (!result.error) { setComment(""); load(); }
  };

  const setValue = (field, value) => {
    setDraft((d) => ({ ...d, values: { ...d.values, [field.id]: value } }));
    if (errors[field.id]) setErrors((e) => ({ ...e, [field.id]: undefined }));
  };
  const revert = (field) => {
    setDraft((d) => ({ ...d, values: { ...d.values, [field.id]: draftFrom(record, [field]).values[field.id] } }));
    setEditing(null);
  };

  const backlinks = detail?.backlinks ?? [];
  const activityCount = detail ? detail.activity.length + detail.comments.length : null;
  const lastChange = detail?.activity?.reduce((latest, entry) => (!latest || new Date(entry.at) > new Date(latest.at) ? entry : latest), null);
  const title = isNew ? `New ${object?.name?.toLowerCase() ?? "record"}` : record ? recordLabel(object, record) : "Loading…";
  const current = statusOf(status);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 px-5 pt-3">
        <div className="flex h-7 items-center gap-1.5">
          <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-text-secondary">
            <ObjectIcon icon={object?.icon} className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{object?.plural}</span>
          </span>
          <ChevronRight className="h-3 w-3 shrink-0 text-text-tertiary" />
          <span className="text-xs tabular-nums text-muted-foreground">{isNew ? "New" : record ? `${object?.numberPrefix}-${record.number}` : "…"}</span>
          <span className="flex-1" />
          {position && position.total > 1 && position.index >= 0 ? (
            <>
              <span className="mr-1 text-xs tabular-nums text-text-tertiary">{position.index + 1} of {position.total}</span>
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Previous record" disabled={!position.onPrev} onClick={position.onPrev}><ChevronUp className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="icon" className="h-7 w-7" aria-label="Next record" disabled={!position.onNext} onClick={position.onNext}><ChevronDown className="h-3.5 w-3.5" /></Button>
              <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-[18px]" />
            </>
          ) : null}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="mt-3.5 flex items-center gap-3">
          <h2 className="min-w-0 flex-1 truncate text-xl font-semibold tracking-tight text-foreground">{title}</h2>
          {object?.statuses?.length ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={!editable || saving} className="h-7 shrink-0 gap-1.5 px-2 text-xs font-medium">
                  {current ? <span className="max-w-40 truncate">{current.label}</span> : <Muted className="text-xs">No status</Muted>}
                  <ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-surface-card [&_[data-slot=dropdown-menu-item]:focus]:bg-surface-hover">
                <DropdownMenuLabel className="text-xs font-medium text-text-secondary">Move to</DropdownMenuLabel>
                {showNone ? <DropdownMenuItem onSelect={() => (isNew ? setDraft((d) => ({ ...d, status: null })) : save({ nextStatus: null, inline: true }))}><Muted>No status</Muted></DropdownMenuItem> : null}
                {statusOptions.map((option) => (
                  <DropdownMenuItem key={option.key} onSelect={() => (isNew ? setDraft((d) => ({ ...d, status: option.key })) : save({ nextStatus: option.key, inline: true }))}>
                    <OptionChip option={option} />
                    {blocked(option.key) ? <Muted className="ml-auto text-xs">skips the rules</Muted> : null}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
        {record ? <p className="mt-1.5 text-xs text-text-secondary">Changed {timeAgo(record.updatedAt)}{lastChange?.actor ? ` by ${lastChange.actor}` : ""}</p>
          : isNew ? <p className="mt-1.5 text-xs text-text-secondary">Add a record to {object?.plural ?? "this list"}.</p> : null}
        {!isNew ? (
          <Tabs value={tab} onValueChange={setTab} className="mt-3 gap-0 border-b border-border/70">
            <TabsList variant="line" className="h-9 gap-5 p-0">
              <TabsTrigger value="details" className={TAB}>Details</TabsTrigger>
              <TabsTrigger value="activity" className={TAB}>Activity{activityCount !== null ? <span className="text-xs text-text-tertiary">{activityCount}</span> : null}</TabsTrigger>
              <TabsTrigger value="linked" className={TAB}>Linked{detail ? <span className="text-xs text-text-tertiary">{backlinks.reduce((n, group) => n + group.records.length, 0)}</span> : null}</TabsTrigger>
            </TabsList>
          </Tabs>
        ) : <div className="mt-3 border-b border-border/70" />}
      </div>

      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-2">
        {loading ? (
          <LoadingArea size={40} label="Loading record" />
        ) : tab === "details" ? (
          <div className="grid gap-0.5">
            {fields.map((field) => {
              const type = getType(field.type);
              const canEdit = type.editable && editable;
              return (
                <FieldRow key={field.id} field={field} record={record} eventId={eventId} timeZone={timeZone}
                  editable={canEdit} alwaysEdit={isNew && canEdit} editing={editing === field.id}
                  value={draft.values[field.id]} error={errors[field.id]}
                  onEdit={() => setEditing(field.id)} onChange={(value) => setValue(field, value)}
                  onSave={() => save({ inline: true })} onRevert={() => revert(field)} onOpenRecord={onOpenRecord} />
              );
            })}
            {backlinks.length ? (
              <div className="mt-3 grid gap-3 border-t border-border/70 pt-4">
                <p className="text-xs font-medium text-text-secondary">Linked from other lists</p>
                <BacklinkGroups backlinks={backlinks} onOpenRecord={onOpenRecord} />
              </div>
            ) : null}
          </div>
        ) : tab === "linked" ? (
          <div className="pt-3">
            {backlinks.length ? <BacklinkGroups backlinks={backlinks} onOpenRecord={onOpenRecord} />
              : <p className="py-8 text-center text-sm text-text-secondary">No other records link here yet.</p>}
          </div>
        ) : (
          <div className="grid gap-5 pt-3">
            {can.update ? (
              <div className="grid gap-2">
                <Textarea rows={3} placeholder="Add a comment for your team…" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} disabled={posting}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); addComment(); } }} />
                <div className="flex justify-end">
                  <Button size="sm" disabled={!comment.trim() || posting} onClick={addComment}>
                    {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{posting ? "Posting…" : "Comment"}
                  </Button>
                </div>
              </div>
            ) : null}
            <ol className="grid gap-3">
              {[
                ...(detail?.comments ?? []).map((c) => ({ ...c, kind: "comment" })),
                ...(detail?.activity ?? []).map((a) => ({ ...a, kind: "change" })),
                ...(context.data?.runs ?? []).map((r) => ({ ...r, kind: "run" })),
                ...(context.data?.approvals ?? []).map((a) => ({ ...a, at: a.createdAt, kind: "approval" })),
              ]
                .sort((a, b) => new Date(b.at) - new Date(a.at))
                .map((entry) => (
                  <li key={`${entry.kind}:${entry.id}`} className={cn("text-[13px]", entry.kind === "comment" && "rounded-lg border border-border bg-surface-subtle px-3 py-2")}>
                    {entry.kind === "run" ? (
                      <p className="flex flex-wrap items-center gap-1.5 text-foreground"><span className="font-medium">Automation · {entry.automation}</span><RunBadge status={entry.status} /></p>
                    ) : entry.kind === "approval" ? (
                      <p className="text-foreground"><span className="font-medium">Approval · {entry.title}</span> <span className="text-muted-foreground">{APPROVAL[entry.status] ?? entry.status}</span></p>
                    ) : (
                      <p className="text-foreground">
                        <span className="font-medium">{entry.kind === "comment" ? entry.author : entry.actor}</span>{" "}
                        {entry.kind === "comment" ? null : <span className="text-muted-foreground">{describe(entry, fieldsById, object?.statuses ?? [])}</span>}
                        {entry.undone ? <span className="text-text-tertiary"> (undone)</span> : null}
                      </p>
                    )}
                    {entry.kind === "comment" ? <p className="mt-1 whitespace-pre-wrap text-foreground">{entry.body}</p> : null}
                    {entry.kind === "run" && entry.error ? <p className="mt-1 text-red-600 dark:text-red-400">{entry.error}</p> : null}
                    <p className="mt-0.5 text-xs text-text-tertiary">{timeAgo(entry.at)}</p>
                  </li>
                ))}
            </ol>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-border px-5 py-3">
        {!isNew && can.delete ? (
          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={remove}><Trash2 className="h-4 w-4" />Delete</Button>
        ) : !isNew && record ? (
          <Button variant="ghost" size="sm" onClick={load}><RefreshCcw className="h-4 w-4" />Reload</Button>
        ) : null}
        {!isNew && record ? <RecordDocumentsMenu eventId={eventId} data={data} objectId={objectId} recordId={recordId} can={can} onGenerated={load} /> : null}
        <span className="flex-1" />
        {manual.length && record ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" disabled={Boolean(running)}>
                {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run<ChevronDown className="h-3.5 w-3.5 text-text-secondary" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Run an automation</DropdownMenuLabel>
              {manual.map((automation) => <DropdownMenuItem key={automation.id} onSelect={() => runAutomation(automation)}>{automation.name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
        {editable ? (
          <Button size="sm" onClick={() => save()} disabled={saving || (!isNew && !record) || !dirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isNew ? "Add" : "Save"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
