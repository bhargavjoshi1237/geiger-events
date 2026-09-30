"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Input, Textarea } from "@geiger/ui";
import { operationsClient } from "@/lib/operations/client";

const fieldTypes = ["text", "textarea", "email", "number", "boolean", "select", "date", "reference"];
const keyPattern = /^[a-z][a-z0-9-]{0,62}$/;
const control = "w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground";
const shortKey = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 63);

export function newCustomModule(key, label) {
  return { key, version: 1, label, sourceKind: "custom", enabled: true,
    capabilities: ["records", "forms"], fields: [],
    states: [{ key: "new", label: "New" }, { key: "complete", label: "Complete" }],
    transitions: [{ from: "new", to: "complete" }, { from: "complete", to: "new" }],
    views: ["table", "board"] };
}

export function NewModuleForm({ modules, onAdd }) {
  const [label, setLabel] = useState("");
  const [key, setKey] = useState("");
  const [error, setError] = useState("");
  const add = () => {
    const stable = key || shortKey(label);
    if (!keyPattern.test(stable) || modules.some((item) => item.key === stable) || !label.trim()) {
      setError("Choose a unique key beginning with a letter and a module name."); return;
    }
    onAdd(newCustomModule(stable, label.trim()));
    setLabel(""); setKey(""); setError("");
  };
  return <div className="rounded-xl border border-dashed border-border bg-surface-card p-4">
    <p className="text-sm font-semibold text-foreground">Add your own module</p>
    <p className="mt-1 text-xs text-muted-foreground">The key is permanent; the display name can change.</p>
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
      <label className="text-xs text-muted-foreground">Name<Input className="mt-1" value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Vendor inspection" /></label>
      <label className="text-xs text-muted-foreground">Stable key<Input className="mt-1" value={key} onChange={(event) => setKey(shortKey(event.target.value))} placeholder={shortKey(label) || "vendor-inspection"} /></label>
      <Button type="button" onClick={add} className="self-end"><Plus className="mr-1 h-4 w-4" /> Add</Button>
    </div>
    {error ? <p role="alert" className="mt-2 text-xs text-destructive">{error}</p> : null}
  </div>;
}

export function ModuleEditor({ eventId, definition, modules, published, dirty, onChange, onRemove, onArchive }) {
  const [fieldName, setFieldName] = useState("");
  const [fieldKey, setFieldKey] = useState("");
  const [fieldType, setFieldType] = useState("text");
  const [stateName, setStateName] = useState("");
  const [error, setError] = useState("");
  const [impact, setImpact] = useState(null);
  const patch = (changes) => onChange({ ...definition, ...changes });
  const patchField = (index, changes) => patch({ fields: definition.fields.map((field, at) =>
    at === index ? { ...field, ...changes } : field) });
  const addField = () => {
    const id = fieldKey || shortKey(fieldName);
    if (!fieldName.trim() || !keyPattern.test(id) || definition.fields.some((field) => field.id === id)) {
      setError("Choose a unique field ID and name."); return;
    }
    const field = { id, label: fieldName.trim(), type: fieldType };
    if (fieldType === "select") field.options = ["Option A", "Option B"];
    if (fieldType === "reference") {
      const target = modules.find((item) => item.key !== definition.key && item.enabled !== false);
      if (!target) { setError("Add another active module before adding a reference field."); return; }
      field.targetModuleKeys = [target.key];
    }
    patch({ fields: [...definition.fields, field] });
    setFieldName(""); setFieldKey(""); setError("");
  };
  const addState = () => {
    const key = shortKey(stateName);
    if (!keyPattern.test(key) || definition.states.some((state) => state.key === key)) {
      setError("Choose a new state name."); return;
    }
    patch({ states: [...definition.states, { key, label: stateName.trim() }] });
    setStateName(""); setError("");
  };
  const inspectArchive = async () => {
    const result = await operationsClient.moduleImpact(eventId, definition.key);
    if (result.error) setError(result.error.message);
    else setImpact(result.data);
  };

  return <div className="space-y-5">
    <div className="rounded-xl border border-border bg-surface-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-primary">Module definition</p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">{definition.label}</h3>
          <p className="text-xs text-muted-foreground">ID: {definition.key} · Version {definition.version} · {definition.sourceKind}</p></div>
        {published ? <Button type="button" variant="outline" onClick={inspectArchive} disabled={dirty || definition.enabled === false}>Review archive</Button>
          : <Button type="button" variant="outline" onClick={onRemove}><Trash2 className="mr-1 h-4 w-4" /> Remove draft</Button>}
      </div>
      <label className="mt-5 block text-sm text-muted-foreground">Display name
        <Input className="mt-1" value={definition.label} onChange={(event) => patch({ label: event.target.value })} /></label>
      <p className="mt-3 text-xs text-muted-foreground">Records and edit forms are available. Scheduling, attendance, evaluation and messaging will appear only after their engines are implemented.</p>
      {impact ? <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
        <p className="font-semibold text-foreground">Archive {definition.label}?</p>
        <p className="mt-1 text-muted-foreground">{impact.recordCount} records will remain in private history. Normal module access will stop.</p>
        {impact.dependents.length ? <p className="mt-1 text-amber-600">Dependent modules: {impact.dependents.join(", ")}. Remove these dependencies first.</p> : null}
        <div className="mt-3 flex gap-2"><Button type="button" variant="outline" onClick={() => setImpact(null)}>Cancel</Button>
          <Button type="button" disabled={impact.dependents.length > 0} onClick={async () => {
            const result = await onArchive(); if (!result?.error) setImpact(null);
          }}>Archive module</Button></div>
      </div> : null}
    </div>
    <div className="rounded-xl border border-border bg-surface-card p-5">
      <div className="flex items-center justify-between"><div><h3 className="font-semibold text-foreground">Fields</h3>
        <p className="text-xs text-muted-foreground">Names may repeat. IDs identify stored values and cannot change.</p></div>
        <span className="text-xs text-muted-foreground">{definition.fields.length} / 40</span></div>
      <div className="mt-4 space-y-3">{definition.fields.map((field, index) =>
        <div key={field.id} className="rounded-lg border border-border/70 bg-background/40 p-3">
          <div className="flex items-start gap-2"><div className="grid flex-1 gap-2 sm:grid-cols-2">
            <label className="text-xs text-muted-foreground">Label<Input className="mt-1" value={field.label} onChange={(event) => patchField(index, { label: event.target.value })} /></label>
            <div className="text-xs text-muted-foreground">Type<div className="mt-1 rounded-md border border-border px-3 py-2 text-sm text-foreground">{field.type} · {field.id}</div></div>
          </div><button type="button" className="mt-5 text-muted-foreground hover:text-destructive" aria-label={`Remove ${field.label}`} onClick={() => patch({ fields: definition.fields.filter((_, at) => at !== index) })}><Trash2 className="h-4 w-4" /></button></div>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={field.required === true} onChange={(event) => patchField(index, { required: event.target.checked })} />Required</label>
            {field.type === "select" ? <label className="flex-1 text-xs text-muted-foreground">Options, comma separated
              <Input className="mt-1" value={field.options.join(", ")} onChange={(event) => patchField(index, { options: event.target.value.split(",").map((value) => value.trim()).filter(Boolean) })} /></label> : null}
            {field.type === "reference" ? <label className="text-xs text-muted-foreground">Target module
              <select className={`${control} mt-1`} value={field.targetModuleKeys[0] ?? ""} onChange={(event) => patchField(index, { targetModuleKeys: [event.target.value] })}>
                {modules.filter((item) => item.key !== definition.key).map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select></label> : null}
          </div>
        </div>)}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_130px_auto]">
        <Input aria-label="New field label" value={fieldName} onChange={(event) => setFieldName(event.target.value)} placeholder="Field label" />
        <Input aria-label="New field ID" value={fieldKey} onChange={(event) => setFieldKey(shortKey(event.target.value))} placeholder={shortKey(fieldName) || "stable-field-id"} />
        <select aria-label="Field type" className={control} value={fieldType} onChange={(event) => setFieldType(event.target.value)}>{fieldTypes.map((type) => <option key={type}>{type}</option>)}</select>
        <Button type="button" variant="outline" disabled={definition.fields.length >= 40} onClick={addField}><Plus className="h-4 w-4" /></Button>
      </div>
    </div>
    <div className="rounded-xl border border-border bg-surface-card p-5">
      <h3 className="font-semibold text-foreground">States and transitions</h3>
      <p className="mt-1 text-xs text-muted-foreground">A record starts in the first state. Add explicit paths for every allowed move.</p>
      <div className="mt-4 flex flex-wrap gap-2">{definition.states.map((state, index) =>
        <label key={state.key} className="rounded-lg border border-border bg-background/50 p-2 text-xs text-muted-foreground">{state.key}
          <Input className="mt-1 w-36" value={state.label} onChange={(event) => patch({ states: definition.states.map((item, at) => at === index ? { ...item, label: event.target.value } : item) })} />
        </label>)}</div>
      <div className="mt-3 flex gap-2"><Input aria-label="New state" value={stateName} onChange={(event) => setStateName(event.target.value)} placeholder="New state" className="max-w-xs" />
        <Button type="button" variant="outline" onClick={addState}>Add state</Button></div>
      <div className="mt-4 flex flex-wrap gap-2">{definition.transitions.map((path) =>
        <span key={`${path.from}:${path.to}`} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">{path.from} → {path.to}
          <button type="button" className="ml-2 hover:text-destructive" aria-label={`Remove transition ${path.from} to ${path.to}`} onClick={() => patch({ transitions: definition.transitions.filter((item) => item !== path) })}>×</button></span>)}</div>
      <TransitionAdder definition={definition} onAdd={(path) => patch({ transitions: [...definition.transitions, path] })} />
    </div>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
  </div>;
}

function TransitionAdder({ definition, onAdd }) {
  const [from, setFrom] = useState(definition.states[0]?.key ?? "");
  const [to, setTo] = useState(definition.states[1]?.key ?? "");
  const add = () => { if (from && to && from !== to && !definition.transitions.some((path) => path.from === from && path.to === to)) onAdd({ from, to }); };
  return <div className="mt-3 flex flex-wrap items-center gap-2">
    <select aria-label="From state" className={control} value={from} onChange={(event) => setFrom(event.target.value)}>{definition.states.map((state) => <option key={state.key} value={state.key}>{state.label}</option>)}</select>
    <span className="text-muted-foreground">→</span>
    <select aria-label="To state" className={control} value={to} onChange={(event) => setTo(event.target.value)}>{definition.states.map((state) => <option key={state.key} value={state.key}>{state.label}</option>)}</select>
    <Button type="button" variant="outline" onClick={add}>Allow move</Button>
  </div>;
}
