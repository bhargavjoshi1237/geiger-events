"use client";

import { Button } from "@geiger/ui";
import { useId } from "react";
import { draftFromForm, formPayload, formValue } from "./workflow_client";

export const fieldClass = "min-h-10 w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
export const ROLES = ["presenter", "evaluator", "staff", "volunteer", "participant"];
export const optionsFor = (rows, label = "name") => rows.map((row) => ({ value: row.id, label: row[label] || row.id }));
export const choices = (values) => values.map((value) => ({ value, label: value.replaceAll("_", " ") }));
export const optionalDate = (key, label) => ({ key, label: `${label} (UTC)`, type: "date", optional: true, nullable: true });

export function WorkflowCard({ title, description, children }) {
  return <section className="min-w-0 break-words rounded-xl border border-border bg-surface-card p-4 sm:p-5">
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    <div className="mt-4 space-y-4">{children}</div>
  </section>;
}

export function Field({ field, value, onChange, disabled }) {
  const id = useId();
  return <div className="block space-y-1.5 text-sm">
    <label htmlFor={field.type === "roles" ? undefined : id} className="font-medium text-foreground">{field.label}{field.optional ? <span className="ml-1 font-normal text-muted-foreground">optional</span> : null}</label>
    {field.type === "roles" ? <div role="group" aria-label={field.label} className="flex flex-wrap gap-x-4 gap-y-2">{ROLES.map((role) => <label key={role} className="flex items-center gap-2 capitalize">
      <input type="checkbox" name={field.key} value={role} checked={(value || []).includes(role)} disabled={disabled} onChange={(event) => onChange(event.target.checked ? [...(value || []), role] : (value || []).filter((item) => item !== role))} />{role}</label>)}</div>
      : field.options ? <select id={id} name={field.key} className={fieldClass} value={value ?? field.default ?? ""} required={!field.optional} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        <option value="">{field.optional ? "None" : "Choose…"}</option>{field.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      : field.type === "textarea" ? <textarea id={id} name={field.key} className={`${fieldClass} min-h-24`} value={value ?? ""} maxLength={field.maxLength ?? 2000} disabled={disabled} required={!field.optional} onChange={(event) => onChange(event.target.value)} />
      : <input id={id} name={field.key} className={fieldClass} type={field.type === "date" ? "datetime-local" : field.type || "text"} value={value ?? field.default ?? ""}
        required={!field.optional} disabled={disabled} min={field.min} max={field.max} step={field.step} maxLength={field.maxLength ?? 200} placeholder={field.placeholder}
        autoComplete={field.type === "email" ? "email" : "off"} onInput={field.type === "date" ? (event) => onChange(event.currentTarget.value) : undefined}
        onChange={field.type === "date" ? undefined : (event) => onChange(event.target.value)} />}
    {field.help ? <span className="block text-xs text-muted-foreground">{field.help}</span> : null}
  </div>;
}

export function ActionForm({ workflow, formKey, action, fields, rows = [], title, description, rowLabel = "name", submitLabel = "Save", transform }) {
  const draft = workflow.drafts[formKey] || {};
  const update = (key, value) => workflow.setDraft(formKey, { ...draft, [key]: value });
  const disabled = workflow.busy || workflow.uncertain;
  const submit = async (event) => {
    event.preventDefault();
    try {
      const currentDraft = draftFromForm(fields, draft, new FormData(event.currentTarget));
      workflow.setDraft(formKey, currentDraft);
      let payload = formPayload(fields, currentDraft);
      if (draft.id) payload.id = draft.id;
      if (transform) payload = transform(payload, currentDraft);
      const response = await workflow.submit(action, payload, formKey);
      if (!response.error) workflow.setDraft(formKey, {});
    } catch (error) { update("_error", error.message || "Check your entries."); }
  };
  return <WorkflowCard title={title} description={description}>
    {rows.length ? <label className="block space-y-1.5 text-sm"><span className="font-medium">Create or edit</span>
      <select className={fieldClass} value={draft.id || ""} disabled={disabled} onChange={(event) => {
        const row = rows.find((item) => item.id === event.target.value);
        workflow.setDraft(formKey, row ? Object.fromEntries([["id", row.id], ...fields.map((field) => [field.key, formValue(row[field.key], field.type)])]) : {});
      }}><option value="">Create new</option>{rows.map((row) => <option key={row.id} value={row.id}>{row[rowLabel] || row.id}</option>)}</select></label> : null}
    <form onSubmit={submit} className="space-y-4">
      <fieldset disabled={disabled} className="grid min-w-0 gap-4 sm:grid-cols-2">{fields.map((field) => <div key={field.key} className={field.type === "textarea" || field.type === "roles" ? "sm:col-span-2" : ""}>
        <Field field={field} value={draft[field.key]} onChange={(value) => update(field.key, value)} disabled={disabled} /></div>)}</fieldset>
      {draft._error ? <p role="alert" className="text-sm text-destructive">{draft._error}</p> : null}
      <Button type="submit" disabled={disabled}>{workflow.busy ? "Saving…" : submitLabel}</Button>
    </form>
  </WorkflowCard>;
}

export function Empty({ children = "No entries yet." }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">{children}</p>;
}

export function WorkflowStatus({ workflow }) {
  return <div className="space-y-3" aria-live="polite">
    {workflow.error ? <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
      <p>{workflow.error.message || "Couldn't complete this request."}</p>
      {workflow.error.status === 403 ? <p className="mt-1">Your account does not have permission for this operation.</p> : null}
      {workflow.error.code === "revision_conflict" || workflow.error.status === 409 ? <p className="mt-1">Your unsaved entries are kept. Load the latest version, review your entries and save again.</p> : null}
      {workflow.error.status === 503 ? <p className="mt-1">The workflow service is not configured. Ask your administrator to complete setup.</p> : null}
    </div> : null}
    {workflow.uncertain ? <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <p>The outcome is uncertain. Retry the original command before making another change. Your draft is kept.</p>
      <Button className="mt-2" variant="outline" disabled={workflow.busy} onClick={workflow.retry}>Retry original command</Button>
    </div> : null}
    {workflow.outcome ? <p className="text-sm text-emerald-700 dark:text-emerald-400">Command saved · revision {workflow.outcome.revision}. {workflow.error ? "The latest view could not be loaded." : "The view is up to date."}</p> : null}
  </div>;
}
