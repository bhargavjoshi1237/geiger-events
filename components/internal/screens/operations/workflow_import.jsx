"use client";

import { Button } from "@geiger/ui";
import { useEffect, useRef, useState } from "react";
import { WorkflowCard, fieldClass } from "./workflow_forms";
import { createWorkflowClient, parseAcceptedItemIds, parseWorkflowImport } from "./workflow_client";

const sourceClient = createWorkflowClient();

export function WorkflowImport({ workflow }) {
  const draft = workflow.drafts.import || { kind: "people", format: "csv", text: "" };
  const disabled = workflow.busy || workflow.uncertain;
  const update = (key, value) => workflow.setDraft("import", { ...draft, [key]: value, error: null });
  const importRows = async (event) => {
    event.preventDefault();
    try {
      const items = parseWorkflowImport(draft.text, draft.format, draft.kind);
      const result = await workflow.submit(draft.kind === "people" ? "importPeople" : "importActivities", { items }, "import");
      if (!result.error) workflow.setDraft("import", { ...draft, text: "", error: null });
    } catch (error) { workflow.setDraft("import", { ...draft, error: error.message }); }
  };
  return <WorkflowCard title="Import people or activities" description="Paste a CSV with column headers or a JSON array. Each batch contains 1–100 entries and saves atomically; split larger imports into separate reviewed batches.">
    <form onSubmit={importRows} className="space-y-4"><fieldset disabled={disabled} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2"><label className="space-y-1.5 text-sm"><span className="font-medium">Import type</span><select className={fieldClass} value={draft.kind} onChange={(event) => update("kind", event.target.value)}><option value="people">People</option><option value="activities">Activities</option></select></label>
        <label className="space-y-1.5 text-sm"><span className="font-medium">Format</span><select className={fieldClass} value={draft.format} onChange={(event) => update("format", event.target.value)}><option value="csv">CSV</option><option value="json">JSON array (advanced)</option></select></label></div>
      <p className="text-xs text-muted-foreground">{draft.kind === "people" ? "People columns: name, email, roles (separated with |), optional id and contactId." : "Activity columns: title, kind, timezone, optional id, resourceId, parentId, startsAt, endsAt and capacity. Dates need ISO timestamps with offsets."}</p>
      <label className="block space-y-1.5 text-sm"><span className="font-medium">Import data</span><textarea className={`${fieldClass} min-h-56 font-mono text-xs`} required value={draft.text} onChange={(event) => update("text", event.target.value)} placeholder={draft.kind === "people" ? "name,email,roles\nMira,mira@example.com,presenter|participant" : "title,kind,timezone\nOpening session,session,Asia/Kolkata"} /></label>
    </fieldset>{draft.error ? <p role="alert" className="text-sm text-destructive">{draft.error}</p> : null}<Button type="submit" disabled={disabled}>Import batch</Button></form>
  </WorkflowCard>;
}

export function WorkflowAcceptedImport({ workflow, eventId }) {
  const formKey = "accepted-import";
  const draft = workflow.drafts[formKey] || { itemIds: "" };
  const disabled = workflow.busy || workflow.uncertain;
  const [source, setSource] = useState(null);
  const [sourceError, setSourceError] = useState(null);
  const [loading, setLoading] = useState(false);
  const request = useRef(null);
  useEffect(() => () => request.current?.abort(), []);
  const acceptedItems = source?.items || [];
  const selected = new Set(draft.itemIds.split(/[\s,]+/).filter(Boolean));
  const update = (itemIds) => workflow.setDraft(formKey, { itemIds, error: null });
  const loadSource = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setSourceError(null);
    try {
      const response = await sourceClient.acceptedItems(eventId, controller.signal);
      if (controller.signal.aborted) return;
      if (response.error) setSourceError(response.error.message);
      else if (!Array.isArray(response.data?.items)) setSourceError("The accepted item list could not be read. Try loading again.");
      else setSource(response.data);
    } catch (error) { if (error.name !== "AbortError") setSourceError("Could not load accepted items. Try again."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  };
  const submit = async (event) => {
    event.preventDefault();
    try {
      const itemIds = parseAcceptedItemIds(new FormData(event.currentTarget).get("itemIds") || "");
      const response = await workflow.submit("importAcceptedItems", { itemIds }, formKey);
      if (!response.error) workflow.setDraft(formKey, { itemIds: "", error: null });
    } catch (error) { workflow.setDraft(formKey, { ...draft, error: error.message }); }
  };
  return <WorkflowCard title="Import accepted conference items" description="Select accepted project papers to add them to this event as unscheduled activities. The server checks acceptance and existing event associations, then loads the original records. Review imported activities to assign rooms and times.">
    <Button type="button" variant="outline" disabled={disabled || loading} onClick={loadSource}>{loading ? "Loading accepted items…" : "Load accepted project papers"}</Button>
    {sourceError ? <p role="alert" className="text-sm text-destructive">{sourceError}</p> : null}
    {source?.truncated ? <p role="status" className="text-sm text-amber-700">Only the first 500 eligible papers are listed. Enter known accepted item IDs below for items outside this list.</p> : null}
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={disabled} className="space-y-4">
        {acceptedItems.length ? <fieldset className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border p-3"><legend className="px-1 text-sm font-medium">Available accepted items</legend>
          {acceptedItems.map((item) => <label key={item.id} className="flex items-start gap-3 rounded-md p-2 text-sm hover:bg-surface-hover">
            <input type="checkbox" className="mt-1" checked={selected.has(item.id)} onChange={(event) => {
              const next = new Set(selected);
              if (event.target.checked) next.add(item.id); else next.delete(item.id);
              update([...next].join("\n"));
            }} />
            <span className="min-w-0"><span className="block font-medium">{item.title || "Untitled accepted item"}</span><span className="block text-xs text-muted-foreground">{[item.authorName, item.format].filter(Boolean).join(" · ")}</span></span>
          </label>)}
        </fieldset> : <p className="text-sm text-muted-foreground">{source ? "No eligible accepted papers were found in this project." : "Load the accepted paper list or enter known accepted item IDs below."} Every selected ID is checked before saving.</p>}
        <label className="block space-y-1.5 text-sm"><span className="font-medium">Accepted item IDs</span><textarea name="itemIds" className={`${fieldClass} min-h-32 font-mono text-xs`} required value={draft.itemIds} onChange={(event) => update(event.target.value)} placeholder="One accepted conference item UUID per line" /></label>
        <p className="text-xs text-muted-foreground">{selected.size} selected. Import 1–100 items at a time. Existing source records are preserved.</p>
      </fieldset>
      {draft.error ? <p role="alert" className="text-sm text-destructive">{draft.error}</p> : null}
      <Button type="submit" disabled={disabled}>Import accepted items</Button>
    </form>
  </WorkflowCard>;
}
