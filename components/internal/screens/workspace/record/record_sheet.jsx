"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Play, RefreshCcw, Trash2 } from "lucide-react";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, Label, LogoLoading, Select,
  SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { SegmentedTabs } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { allowedMoves } from "@/lib/workspace/process/stages.js";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { RecordDocumentsMenu } from "../documents/record_documents";
import { RUN_STATUS, RunBadge } from "../process/runs_view";
import { useProcess } from "../process/use_process";
import { liveFieldsOf } from "../state/use_workspace";
import { recordLabel, timeAgo } from "../state/format";
import { FieldValue, Muted, OptionChip } from "../ws_ui";
import { FieldInput } from "./field_input";

const APPROVAL = { pending: "waiting for a decision", approved: "approved", rejected: "rejected", cancelled: "cancelled" };

const NONE = "__none__";
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

export function RecordSheet({ open, onOpenChange, ...props }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        {open ? <RecordSheetBody key={`${props.objectId}:${props.recordId ?? "new"}`} onOpenChange={onOpenChange} {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}

// Keyed per record so each opening starts fresh; the draft is only built once the record has loaded.
function RecordSheetBody({ onOpenChange, eventId, data, objectId, recordId, timeZone, can, run, onSaved, onOpenRecord }) {
  const object = data?.objects.find((item) => item.id === objectId);
  const fields = useMemo(() => liveFieldsOf(data, objectId), [data, objectId]);
  const process = useProcess(eventId);
  const isNew = !recordId;
  const [detail, setDetail] = useState(null);
  const [version, setVersion] = useState(0);
  // A new record's status stays undefined until picked, so it follows the stage rules once they load.
  const [edits, setEdits] = useState(() => (isNew ? { ...draftFrom(null, fields), status: undefined } : null));
  const [context, setContext] = useState({ key: null, data: null });
  const [running, setRunning] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("details");
  const [comment, setComment] = useState("");

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
  const manual = can.update && !isNew
    ? process.automations.filter((item) => item.enabled && item.trigger?.kind === "manual" && item.trigger.objectId === objectId) : [];

  const changes = () => {
    const values = {};
    for (const field of fields) {
      const type = getType(field.type);
      if (!type.editable) continue;
      const next = draft.values[field.id];
      if (type.cast === "link") {
        if (isNew ? next?.length : !sameIds(next, record?.links?.[field.id] ?? [])) values[field.id] = next ?? [];
      } else {
        const before = isNew ? null : record?.values?.[field.id] ?? null;
        if (JSON.stringify(next ?? null) !== JSON.stringify(before)) values[field.id] = next === "" ? null : next ?? null;
      }
    }
    return values;
  };

  const save = async (force = false) => {
    const values = changes();
    const statusChanged = isNew || status !== (record?.status ?? null);
    if (!isNew && !Object.keys(values).length && !statusChanged) { onOpenChange(false); return; }
    setSaving(true);
    const handle = ["invalid_values", "invalid_input", "move_not_allowed"];
    const extra = force ? { force: true } : {};
    const result = isNew
      ? await run("record.create", { objectId, values, status, ...extra }, { handle, success: `${object.name} added` })
      : await run("record.update", { recordId, expectedRevision: record.revision, values, ...(statusChanged ? { status } : {}), ...extra },
        { handle, success: "Saved" });
    setSaving(false);
    if (result.error) {
      const { code, message, fields: problems } = result.error;
      if (code === "move_not_allowed") {
        toast.error(message, can.configure ? { action: { label: "Move anyway", onClick: () => save(true) } } : undefined);
        return;
      }
      const named = code === "invalid_values" || code === "invalid_input" ? problems ?? {} : {};
      if (Object.keys(named).length) { setErrors(named); setTab("details"); }
      if (code === "invalid_input" || !Object.keys(named).length) toast.error(message);
      return;
    }
    onSaved?.(result.data.record);
    onOpenChange(false);
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
    if (!result.error) { onSaved?.(null); onOpenChange(false); }
  };

  const addComment = async () => {
    const result = await run("comment.add", { recordId, body: comment }, { quiet: true });
    if (!result.error) { setComment(""); load(); }
  };

  return (
    <>
        <SheetHeader className="border-b border-border px-5 py-4">
          <SheetTitle className="truncate pr-8 text-base">
            {isNew ? `New ${object?.name?.toLowerCase() ?? "record"}` : record ? recordLabel(object, record) : "Loading…"}
          </SheetTitle>
          <SheetDescription className="truncate">
            {isNew ? `Add a record to ${object?.plural ?? "this list"}.` : record ? `${object?.numberPrefix}-${record.number} · Changed ${timeAgo(record.updatedAt)}` : " "}
          </SheetDescription>
          {!isNew ? (
            <SegmentedTabs className="mt-2" value={tab} onChange={setTab}
              tabs={[{ label: "Details", value: "details" }, { label: `Activity${detail ? ` · ${detail.activity.length + detail.comments.length}` : ""}`, value: "activity" }]} />
          ) : null}
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading && !detail ? (
            <div className="flex justify-center py-16"><LogoLoading size={40} aria-label="Loading record" /></div>
          ) : tab === "details" ? (
            <div className="space-y-5">
              {object?.statuses?.length ? (
                <div className="space-y-1.5">
                  <Label htmlFor="ws-status">Status</Label>
                  <Select value={status ?? NONE} disabled={!editable} onValueChange={(next) => setDraft((d) => ({ ...d, status: next === NONE ? null : next }))}>
                    <SelectTrigger id="ws-status" className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {showNone ? <SelectItem value={NONE}><Muted>No status</Muted></SelectItem> : null}
                      {statusOptions.map((option) => (
                        <SelectItem key={option.key} value={option.key}>
                          <span className="flex items-center gap-2">
                            <OptionChip option={{ label: option.label, color: option.color }} />
                            {blocked(option.key) ? <Muted className="text-xs">skips the stage rules</Muted> : null}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              {fields.map((field, index) => {
                const type = getType(field.type);
                const inputId = `ws-field-${field.id}`;
                return (
                  <div key={field.id} className="space-y-1.5">
                    <Label htmlFor={inputId} className="flex items-center gap-1">
                      {field.name}{field.required && type.editable ? <span className="text-red-500" aria-hidden>*</span> : null}
                    </Label>
                    {type.editable && editable ? (
                      <FieldInput field={field} id={inputId} autoFocus={isNew && index === 0} eventId={eventId} timeZone={timeZone}
                        value={draft.values[field.id]} onChange={(value) => {
                          setDraft((d) => ({ ...d, values: { ...d.values, [field.id]: value } }));
                          if (errors[field.id]) setErrors((e) => ({ ...e, [field.id]: undefined }));
                        }} />
                    ) : (
                      <div className="min-h-6 text-sm text-foreground">
                        {record ? <FieldValue field={field} record={record} eventId={eventId} timeZone={timeZone} compact={false} onOpenRecord={onOpenRecord} /> : <Muted>Calculated after saving.</Muted>}
                      </div>
                    )}
                    {errors[field.id] ? <p className="text-xs text-red-600 dark:text-red-400">{errors[field.id]}</p> : null}
                  </div>
                );
              })}
              {detail?.backlinks?.length ? (
                <div className="space-y-3 border-t border-border pt-4">
                  {detail.backlinks.map((group) => (
                    <div key={group.fieldId} className="space-y-1.5">
                      <p className="text-sm font-medium text-foreground">{group.objectName} <span className="font-normal text-text-tertiary">· via {group.fieldName} · {group.records.length}</span></p>
                      <div className="flex flex-wrap gap-1.5">
                        {group.records.map((item) => (
                          <button key={item.id} type="button" onClick={() => onOpenRecord?.(item.id, group.objectId)}
                            className="max-w-[16rem] truncate rounded-md border border-border bg-surface-card px-2 py-0.5 text-sm hover:bg-surface-active">
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-5">
              {can.update ? (
                <div className="space-y-2">
                  <Textarea rows={3} placeholder="Add a comment for your team…" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={5000} />
                  <div className="flex justify-end"><Button size="sm" disabled={!comment.trim()} onClick={addComment}>Comment</Button></div>
                </div>
              ) : null}
              <ol className="space-y-3">
                {[
                  ...(detail?.comments ?? []).map((c) => ({ ...c, kind: "comment" })),
                  ...(detail?.activity ?? []).map((a) => ({ ...a, kind: "change" })),
                  ...(context.data?.runs ?? []).map((r) => ({ ...r, kind: "run" })),
                  ...(context.data?.approvals ?? []).map((a) => ({ ...a, at: a.createdAt, kind: "approval" })),
                ]
                  .sort((a, b) => new Date(b.at) - new Date(a.at))
                  .map((entry) => (
                    <li key={`${entry.kind}:${entry.id}`} className={cn("text-sm", entry.kind === "comment" && "rounded-lg border border-border bg-surface-card px-3 py-2")}>
                      {entry.kind === "run" ? (
                        <p className="flex flex-wrap items-center gap-1.5 text-foreground">
                          <span className="font-medium">Automation · {entry.automation}</span><RunBadge status={entry.status} />
                        </p>
                      ) : entry.kind === "approval" ? (
                        <p className="text-foreground">
                          <span className="font-medium">Approval · {entry.title}</span> <span className="text-text-secondary">{APPROVAL[entry.status] ?? entry.status}</span>
                        </p>
                      ) : (
                        <p className="text-foreground">
                          <span className="font-medium">{entry.kind === "comment" ? entry.author : entry.actor}</span>{" "}
                          {entry.kind === "comment" ? null : <span className="text-text-secondary">{describe(entry, fieldsById, object?.statuses ?? [])}</span>}
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

        <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-3">
          <div className="flex items-center gap-2">
            {!isNew && can.delete ? (
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={remove}>
                <Trash2 className="h-4 w-4" />Delete
              </Button>
            ) : !isNew && record ? (
              <Button variant="ghost" size="sm" onClick={load}><RefreshCcw className="h-4 w-4" />Reload</Button>
            ) : null}
            {!isNew && record ? <RecordDocumentsMenu eventId={eventId} data={data} objectId={objectId} recordId={recordId} can={can} onGenerated={load} /> : null}
          </div>
          <div className="flex gap-2">
            {manual.length && record ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" disabled={Boolean(running)}>
                    {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}Run
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Run an automation</DropdownMenuLabel>
                  {manual.map((automation) => (
                    <DropdownMenuItem key={automation.id} onSelect={() => runAutomation(automation)}>{automation.name}</DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            {editable ? (
              <Button onClick={() => save()} disabled={saving || (!isNew && !record)}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{isNew ? "Add" : "Save"}
              </Button>
            ) : null}
          </div>
        </SheetFooter>
    </>
  );
}
