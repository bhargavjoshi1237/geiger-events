"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2, MessageSquare, Paperclip } from "lucide-react";
import { Badge, Button, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea } from "@geiger/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { timeAgo } from "@/components/internal/screens/workspace/state/format";
import { Muted, OptionChip } from "@/components/internal/screens/workspace/ws_ui";
import { FieldInput } from "@/components/internal/screens/workspace/record/field_input";
import { BlockError, BlockFrame, BlockLoading, BlockMessage, Restricted } from "./block_frame";
import { useFileViewer, useList, usePortalView } from "./portal_context";
import { useBlockData } from "./use_block_data";
import { CellValue, StatusChip, statusChoices } from "./values";

const WIDE = new Set(["long_text", "rich_text", "attachments"]);
const sameLinks = (a = [], b = []) => a.length === b.length && a.every((item, i) => item.id === b[i]?.id);

function startValues(record, fields) {
  const values = {};
  for (const field of fields) values[field.id] = getType(field.type).cast === "link" ? record.links?.[field.id] ?? [] : record.values?.[field.id] ?? null;
  return values;
}

function Files({ record, field }) {
  const viewer = useFileViewer();
  const files = record.values?.[field.id] ?? [];
  if (!files.length) return <Muted className="text-sm">No files</Muted>;
  return (
    <div className="grid gap-2">
      {files.map((file) => (
        <button key={file.id} type="button" onClick={() => viewer?.open(file, { recordId: record.id, fieldId: field.id })}
          className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2.5 text-left hover:border-foreground/25">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-text-secondary">
            {file.type === "application/pdf" ? <FileText className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-foreground">{file.name}</span>
            <span className="block text-xs text-text-tertiary">{Math.max(1, Math.round((file.size ?? 0) / 1024)).toLocaleString()} KB</span>
          </span>
          <span className="shrink-0 text-xs text-text-secondary">{file.type === "application/pdf" || file.type?.startsWith("image/") ? "View" : "Download"}</span>
        </button>
      ))}
    </div>
  );
}

export function Comments({ record, initial, canComment }) {
  const { api } = usePortalView();
  const [comments, setComments] = useState(initial ?? []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    const { data, error } = await api.command({ action: "comment.add", recordId: record.id, body: text });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setText("");
    setComments(data.comments ?? []);
  };

  return (
    <div className="grid gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground"><MessageSquare className="h-4 w-4 text-text-secondary" />Comments</h3>
      {comments.length ? (
        <ol className="grid gap-2">
          {comments.map((comment) => (
            <li key={comment.id} className={cn("rounded-lg border border-border px-3 py-2.5", comment.mine ? "bg-surface-subtle" : "bg-surface-card")}>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium text-foreground">{comment.mine ? "You" : comment.author}</span>
                {comment.team ? <Badge variant="neutral" className="px-1.5 py-0 text-[11px]">Organiser</Badge> : null}
                <span className="text-xs text-text-tertiary">{timeAgo(comment.at)}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{comment.body}</p>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-text-secondary">No comments yet.</p>}
      {canComment ? (
        <div className="grid gap-2">
          <Textarea rows={3} maxLength={5000} placeholder={api.readOnly ? api.readOnly : "Write a comment…"} disabled={Boolean(api.readOnly)}
            value={text} onChange={(event) => setText(event.target.value)} />
          <div className="flex justify-end">
            <Button size="sm" disabled={busy || !text.trim() || Boolean(api.readOnly)} onClick={send}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Comment
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const ACTIVITY = { "record.create": "You added this", "record.update": "You made changes", "records.delete": "You deleted this", "comment.add": "You commented" };

// One record: its fields in sections, fields the viewer may change as inputs with a save bar, files and comments.
export function RecordDetails({ record: initial, comments, config, activity = [] }) {
  const { api, eventId, timeZone, refresh } = usePortalView();
  const { list } = useList(config.objectId ?? initial.objectId);
  const [record, setRecord] = useState(initial);
  const [values, setValues] = useState(null);
  const [status, setStatus] = useState(undefined);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const editable = useMemo(() => new Set(config.edit !== false && !api.readOnly ? record.access?.editable ?? [] : []), [config.edit, api.readOnly, record]);
  const sections = useMemo(() => {
    const visible = (list?.fields ?? []).filter((field) => record.access?.fields?.[field.id] && record.access.fields[field.id] !== "hidden");
    const byId = new Map(visible.map((field) => [field.id, field]));
    const chosen = (config.sections ?? []).filter((section) => section.fields?.length);
    if (!chosen.length) return [{ title: "", fields: visible.filter((field) => field.id !== list?.titleFieldId || editable.has(field.id)) }];
    return chosen.map((section) => ({ title: section.title, fields: section.fields.map((id) => byId.get(id)).filter(Boolean) })).filter((section) => section.fields.length);
  }, [list, record, config.sections, editable]);
  const fields = sections.flatMap((section) => section.fields);
  const draft = values ?? startValues(record, fields);
  const scopedApi = useMemo(() => ({ ...api, signUpload: (body) => api.signUpload({ ...body, recordId: record.id }) }), [api, record.id]);

  const changes = () => {
    const out = {};
    for (const field of fields) {
      if (!editable.has(field.id)) continue;
      const next = draft[field.id];
      if (getType(field.type).cast === "link") { if (!sameLinks(next, record.links?.[field.id] ?? [])) out[field.id] = next ?? []; }
      else if (JSON.stringify(next ?? null) !== JSON.stringify(record.values?.[field.id] ?? null)) out[field.id] = next === "" ? null : next ?? null;
    }
    return out;
  };
  const changed = changes();
  const dirty = Object.keys(changed).length > 0 || (status !== undefined && status !== record.status);

  const save = async () => {
    setSaving(true);
    const { data, error } = await api.command({
      action: "record.update", recordId: record.id, expectedRevision: record.revision, values: changed,
      ...(status !== undefined && status !== record.status ? { status } : {}),
    });
    setSaving(false);
    if (error) {
      if (error.fields) setErrors(error.fields);
      toast.error(error.message);
      return;
    }
    if (data?.record) setRecord(data.record);
    setValues(null);
    setStatus(undefined);
    setErrors({});
    toast.success("Saved");
    refresh();
  };

  if (!list) return <Restricted />;

  return (
    <div className="@container/block">
      <div className="grid gap-6 p-4 @xl/block:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{record.title || `${list.numberPrefix}-${record.number}`}</h2>
            <p className="mt-0.5 text-xs text-text-tertiary">{list.numberPrefix}-{record.number} · Updated {timeAgo(record.updatedAt)}</p>
          </div>
          {list.statuses?.length ? (
            record.access?.status && !api.readOnly ? (
              <Select value={status ?? record.status ?? ""} onValueChange={setStatus}>
                <SelectTrigger className="w-48" aria-label="Status"><SelectValue placeholder="No status" /></SelectTrigger>
                <SelectContent>
                  {statusChoices(list, record.status).map((item) => <SelectItem key={item.key} value={item.key}><OptionChip option={{ label: item.label, color: item.color }} /></SelectItem>)}
                </SelectContent>
              </Select>
            ) : <StatusChip list={list} status={record.status} />
          ) : null}
        </div>

        {sections.map((section, index) => (
          <section key={index} className="grid gap-4">
            {section.title ? <h3 className="border-b border-border pb-2 text-sm font-semibold text-foreground">{section.title}</h3> : null}
            <div className="grid gap-x-6 gap-y-4 @xl/block:grid-cols-2">
              {section.fields.map((field) => {
                const id = `wp-${record.id}-${field.id}`;
                const canEdit = editable.has(field.id) && getType(field.type).editable;
                return (
                  <div key={field.id} className={cn("grid min-w-0 content-start gap-1.5", WIDE.has(field.type) && "@xl/block:col-span-2")}>
                    <Label htmlFor={canEdit ? id : undefined} className={cn("text-xs font-medium", canEdit ? "text-foreground" : "text-text-secondary")}>
                      {field.name}{canEdit && field.required ? <span className="ml-0.5 text-red-500" aria-hidden>*</span> : null}
                    </Label>
                    {canEdit ? (
                      <FieldInput id={id} field={field} value={draft[field.id]} eventId={eventId} timeZone={timeZone} api={scopedApi}
                        onChange={(next) => {
                          setValues({ ...draft, [field.id]: next });
                          if (errors[field.id]) setErrors((current) => ({ ...current, [field.id]: undefined }));
                        }} />
                    ) : field.type === "attachments" ? (
                      <Files record={record} field={field} />
                    ) : (
                      <div className="flex min-h-6 min-w-0 text-sm text-foreground"><CellValue list={list} fieldId={field.id} record={record} compact={false} /></div>
                    )}
                    {errors[field.id] ? <p className="text-xs text-red-600 dark:text-red-400">{errors[field.id]}</p> : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {config.comments && (record.access?.comment || comments?.length) ? (
          <div className="border-t border-border pt-5"><Comments record={record} initial={comments} canComment={record.access?.comment} /></div>
        ) : null}

        {config.activity && activity.length ? (
          <div className="grid gap-2 border-t border-border pt-5">
            <h3 className="text-sm font-semibold text-foreground">Your activity</h3>
            <ol className="grid gap-1.5">
              {activity.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-foreground">{ACTIVITY[entry.action] ?? "You made a change"}</span>
                  <span className="text-xs text-text-tertiary">{timeAgo(entry.at)}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>

      {dirty ? (
        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border bg-surface-subtle px-4 py-3 @xl/block:px-6">
          <span className="text-sm text-text-secondary">You have unsaved changes.</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={saving} onClick={() => { setValues(null); setStatus(undefined); setErrors({}); }}>Discard</Button>
            <Button size="sm" disabled={saving} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}Save changes</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function RecordBlock({ block, fill }) {
  const config = block.config;
  const { record: pageRecord, comments: pageComments, activity } = usePortalView();
  const fromPage = config.target === "page";
  const { data, error, loading, reload } = useBlockData(block, {}, { enabled: !fromPage });

  let body;
  if (fromPage) {
    body = pageRecord ? <RecordDetails key={pageRecord.id} record={pageRecord} comments={pageComments} config={config} activity={activity} />
      : <BlockMessage title="No record" text="This shows the record a record page is opened for." />;
  } else if (loading) body = <BlockLoading label="Loading details" />;
  else if (error) body = <BlockError error={error} onRetry={reload} />;
  else if (!data?.record) body = data?.restricted ? <Restricted /> : <BlockMessage title="Nothing to show yet" text="Your details appear here once you're signed in." />;
  else body = <RecordDetails key={`${data.record.id}:${data.record.revision}`} record={data.record} comments={data.comments} config={config} />;

  return <BlockFrame title={config.title} fill={fill}>{body}</BlockFrame>;
}
