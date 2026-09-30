"use client";

import { useEffect, useRef, useState } from "react";
import {
  Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, Input, Textarea,
} from "@geiger/ui";
import { operationsClient } from "@/lib/operations/client";
import { selectSubmission } from "./submission_state";

const inputClass = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";

export function RecordDialog({ eventId, definition, record, open, onOpenChange, onSave, onReload }) {
  const [title, setTitle] = useState(record?.title ?? "");
  const [values, setValues] = useState(record?.values ?? {});
  const [references, setReferences] = useState(Object.fromEntries((record?.references ?? [])
    .map((item) => [item.fieldId, item.targetId])));
  const [suggestions, setSuggestions] = useState({});
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [baseRecord, setBaseRecord] = useState(record);
  const [latest, setLatest] = useState(null);
  const pending = useRef(null);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const targets = [...new Set(definition.fields.filter((field) => field.type === "reference")
      .flatMap((field) => field.targetModuleKeys))];
    Promise.all(targets.map(async (key) => {
      const result = await operationsClient.listRecords(eventId, key, { limit: 50 }, controller.signal);
      return [key, result.data?.items ?? []];
    })).then((pairs) => { if (!controller.signal.aborted) setSuggestions(Object.fromEntries(pairs)); })
      .catch(() => {});
    return () => controller.abort();
  }, [eventId, definition, open]);

  const setValue = (id, value) => setValues((current) => ({ ...current, [id]: value }));
  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError(null);
    const draft = { title, values,
      references: Object.entries(references).filter(([, id]) => id).map(([fieldId, targetId]) => ({ fieldId, targetId })) };
    const selected = selectSubmission(pending.current,
      { ...draft, expectedRevision: baseRecord?.revision ?? null }, () => crypto.randomUUID());
    pending.current = selected;
    const result = await onSave(draft, selected.commandId, baseRecord?.revision);
    setSaving(false);
    if (result?.error) {
      if (!["network_error", "request_failed", "internal_error"].includes(result.error.code)) pending.current = null;
      setError(result.error); return;
    }
    pending.current = null;
    onOpenChange(false);
  };

  const inspectLatest = async () => {
    const result = await onReload();
    if (result?.error) setError(result.error);
    else setLatest(result.data);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
      <DialogHeader><DialogTitle>{record ? `Edit ${record.title}` : `New ${definition.label} record`}</DialogTitle>
        <DialogDescription>Private event operation · {definition.key}</DialogDescription></DialogHeader>
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm font-medium text-foreground">Record title <span className="text-destructive">*</span>
          <Input className="mt-1" value={title} onChange={(event) => setTitle(event.target.value)} required maxLength={200} /></label>
        {definition.fields.map((field) => {
          if (field.showWhen && values[field.showWhen.fieldId] !== field.showWhen.equals) return null;
          const value = values[field.id] ?? "";
          return <label key={field.id} className="block text-sm font-medium text-foreground">
            {field.label} {field.required ? <span className="text-destructive">*</span> : null}
            <span className="ml-2 text-xs font-normal text-muted-foreground">{field.id}</span>
            {field.type === "textarea" ? <Textarea className="mt-1" value={value} onChange={(event) => setValue(field.id, event.target.value)} required={field.required} />
              : field.type === "boolean" ? <span className="mt-2 flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <input type="checkbox" checked={value === true} onChange={(event) => setValue(field.id, event.target.checked)} />Yes</span>
              : field.type === "select" ? <select className={`${inputClass} mt-1`} value={value} onChange={(event) => setValue(field.id, event.target.value)} required={field.required}>
                <option value="">Choose…</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select>
              : field.type === "reference" ? <>
                <Input className="mt-1" list={`ops-${field.id}`} value={references[field.id] ?? ""}
                  onChange={(event) => setReferences((current) => ({ ...current, [field.id]: event.target.value }))}
                  placeholder="Choose a record or enter its ID" required={field.required} />
                <datalist id={`ops-${field.id}`}>
                  {field.targetModuleKeys.flatMap((key) => suggestions[key] ?? []).map((item) =>
                    <option key={item.id} value={item.id}>{item.title}</option>)}
                </datalist></>
              : <Input className="mt-1" type={field.type === "number" ? "number" : field.type}
                  value={value} min={field.min} max={field.max} step={field.type === "number" ? "any" : undefined}
                  onChange={(event) => setValue(field.id, field.type === "number" && event.target.value !== ""
                    ? Number(event.target.value) : event.target.value)} required={field.required} />}
          </label>;
        })}
        {error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error.message || "Could not save this record."}
          {error.code === "revision_conflict" ? <p className="mt-1 text-xs">Your edits are still here. {record ? "Load the latest record to compare, then choose its revision before retrying." : "Reload the module configuration before trying a new create command."}</p> : null}
        </div> : null}
        {latest ? <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          <p className="font-medium text-foreground">Latest record: {latest.title} · {latest.state} · revision {latest.revision}</p>
          <p className="mt-1 text-xs text-muted-foreground">Your form remains unchanged. Review it against the latest values before applying this revision.</p>
          <pre className="mt-2 max-h-24 overflow-auto rounded bg-background p-2 text-xs text-muted-foreground">{JSON.stringify(latest.values, null, 2)}</pre>
          <Button type="button" variant="outline" className="mt-2" onClick={() => {
            setBaseRecord(latest); setLatest(null); setError(null); pending.current = null;
          }}>Use latest revision with my edits</Button>
        </div> : null}
        <DialogFooter><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          {record && error?.code === "revision_conflict" ? <Button type="button" variant="outline" onClick={inspectLatest}>Compare latest</Button> : null}
          <Button type="submit" disabled={saving}>{saving ? "Saving…" : record ? "Save record" : "Create record"}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
