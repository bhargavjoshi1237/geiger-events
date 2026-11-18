"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Check, CheckCircle2, CircleAlert, Clock, Loader2, Play, Plus, Trash2, X } from "lucide-react";
import {
  Badge, Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, Input, Label, LucideIcon,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Switch,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { FilterButton, toApiFilter } from "../object/filter_builder";
import { LinkPicker } from "../record/link_picker";
import { liveFieldsOf } from "../state/use_workspace";
import { OptionChip } from "../ws_ui";
import { blankStep, STEP_EDITORS } from "./step_editors";
import { HookAddress } from "./hook_address";

const RECORD_TRIGGERS = new Set(["record.created", "record.updated", "status.changed", "date", "manual"]);
const OPTIONAL_LIST = new Set(["schedule", "hook", "checkin"]);
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function Section({ title, hint, children, action }) {
  return (
    <section className="space-y-3 rounded-xl border border-border bg-surface-subtle p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="grid gap-0.5">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {hint ? <p className="text-xs text-text-secondary">{hint}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

// Picked chips keep their colour and gain a check; the rest fade back until hovered.
function ChoiceChip({ option, on, onClick }) {
  return (
    <button type="button" aria-pressed={on} onClick={onClick}
      className={cn("rounded-md outline-none transition-opacity focus-visible:ring-2 focus-visible:ring-border-strong", on ? "opacity-100" : "opacity-40 hover:opacity-75")}>
      <OptionChip className="gap-1 px-2 py-1" option={{ ...option, label: <>{on ? <Check className="size-3" strokeWidth={3} /> : null}{option.label}</> }} />
    </button>
  );
}

function StatusToggles({ object, value, onChange, anyLabel }) {
  const chosen = new Set(value ?? []);
  return (
    <div className="flex flex-wrap gap-1.5">
      <ChoiceChip option={{ label: anyLabel, color: "gray" }} on={!chosen.size} onClick={() => onChange([])} />
      {(object?.statuses ?? []).map((status) => (
        <ChoiceChip key={status.key} option={status} on={chosen.has(status.key)}
          onClick={() => { const next = new Set(chosen); if (next.has(status.key)) next.delete(status.key); else next.add(status.key); onChange([...next]); }} />
      ))}
    </div>
  );
}

// "When": what starts the automation and its options.
function TriggerEditor({ data, catalog, value, onChange }) {
  const objects = data.objects.filter((object) => !object.deletedAt);
  const object = objects.find((item) => item.id === value.objectId);
  const fields = object ? liveFieldsOf(data, object.id) : [];
  const set = (patch) => onChange({ ...value, ...patch });
  const needsList = RECORD_TRIGGERS.has(value.kind);
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Select value={value.kind} onValueChange={(kind) => onChange({ kind, objectId: value.objectId ?? objects[0]?.id ?? null, time: "09:00" })}>
          <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(catalog).map(([kind, meta]) => (
              <SelectItem key={kind} value={kind}><span className="flex items-center gap-2"><LucideIcon name={meta.icon} className="h-4 w-4" />{meta.label}</span></SelectItem>
            ))}
          </SelectContent>
        </Select>
        {needsList || OPTIONAL_LIST.has(value.kind) ? (
          <Select value={value.objectId ?? "__none__"} onValueChange={(objectId) => onChange({ kind: value.kind, objectId: objectId === "__none__" ? null : objectId, time: value.time ?? "09:00", every: value.every })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPTIONAL_LIST.has(value.kind) ? <SelectItem value="__none__">{value.kind === "schedule" ? "Once, not per record" : "No list"}</SelectItem> : null}
              {objects.map((item) => <SelectItem key={item.id} value={item.id}>{value.kind === "schedule" ? `For each ${item.name.toLowerCase()}` : item.plural}</SelectItem>)}
            </SelectContent>
          </Select>
        ) : null}
      </div>

      {value.kind === "record.created" ? (
        <Select value={value.source ?? "any"} onValueChange={(source) => set({ source })}>
          <SelectTrigger className="h-9 sm:w-72"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">Added by anyone or anything</SelectItem>
            <SelectItem value="portal">Added in the portal (forms)</SelectItem>
            <SelectItem value="team">Added by the team</SelectItem>
          </SelectContent>
        </Select>
      ) : null}

      {value.kind === "record.updated" && object ? (
        <div className="space-y-1.5">
          <Label className="text-xs text-text-secondary">Only when one of these changes (none chosen = any change)</Label>
          <div className="flex flex-wrap gap-1.5">
            {[{ id: "status", name: "Status" }, ...fields.filter((field) => !["formula", "lookup", "rollup"].includes(field.type))].map((field) => {
              const on = (value.fields ?? []).includes(field.id);
              return (
                <button key={field.id} type="button" aria-pressed={on}
                  onClick={() => set({ fields: on ? value.fields.filter((id) => id !== field.id) : [...(value.fields ?? []), field.id] })}
                  className={cn("inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                    on ? "border-transparent bg-surface-strong text-foreground" : "border-border text-text-secondary hover:text-foreground")}>
                  {on ? <Check className="size-3" strokeWidth={3} /> : null}{field.name}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {value.kind === "status.changed" && object ? (
        object.statuses?.length ? (
          <div className="grid gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-text-secondary">From</Label><StatusToggles object={object} value={value.from} onChange={(from) => set({ from })} anyLabel="Any status" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-text-secondary">To</Label><StatusToggles object={object} value={value.to} onChange={(to) => set({ to })} anyLabel="Any status" /></div>
          </div>
        ) : <p className="text-sm text-text-secondary">{object.plural} have no statuses yet.</p>
      ) : null}

      {value.kind === "date" && object ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Input type="number" min={0} max={365} className="h-9 w-20" value={Math.abs(value.offsetDays ?? 0)}
            onChange={(e) => set({ offsetDays: (value.offsetDays ?? 0) > 0 ? Math.abs(Number(e.target.value) || 0) : -Math.abs(Number(e.target.value) || 0) })} />
          <span>days</span>
          <Select value={(value.offsetDays ?? 0) > 0 ? "after" : "before"} onValueChange={(when) => set({ offsetDays: when === "after" ? Math.abs(value.offsetDays ?? 0) : -Math.abs(value.offsetDays ?? 0) })}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="before">before</SelectItem><SelectItem value="after">after</SelectItem></SelectContent>
          </Select>
          <Select value={value.fieldId ?? ""} onValueChange={(fieldId) => set({ fieldId })}>
            <SelectTrigger className="h-9 w-48"><SelectValue placeholder="Choose a date field" /></SelectTrigger>
            <SelectContent>{fields.filter((field) => field.type === "date" || field.type === "datetime").map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
          </Select>
          <span>at</span>
          <Input type="time" className="h-9 w-28" value={value.time ?? "09:00"} onChange={(e) => set({ time: e.target.value })} />
        </div>
      ) : null}

      {value.kind === "schedule" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Select value={value.every ?? "day"} onValueChange={(every) => set({ every })}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Every day</SelectItem><SelectItem value="weekday">Every weekday</SelectItem>
              <SelectItem value="week">Every week</SelectItem><SelectItem value="month">Every month</SelectItem>
            </SelectContent>
          </Select>
          {value.every === "week" ? (
            <Select value={String(value.weekday ?? 1)} onValueChange={(weekday) => set({ weekday: Number(weekday) })}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((day, index) => <SelectItem key={day} value={String(index)}>on {day}</SelectItem>)}</SelectContent>
            </Select>
          ) : null}
          {value.every === "month" ? (
            <><span>on day</span><Input type="number" min={1} max={28} className="h-9 w-20" value={value.day ?? 1} onChange={(e) => set({ day: Math.min(28, Math.max(1, Number(e.target.value) || 1)) })} /></>
          ) : null}
          <span>at</span>
          <Input type="time" className="h-9 w-28" value={value.time ?? "09:00"} onChange={(e) => set({ time: e.target.value })} />
        </div>
      ) : null}

      {value.kind === "schedule" || value.kind === "date" ? (
        <p className="text-xs text-text-tertiary">Times are in the event&apos;s time zone. Scheduled runs start within minutes while the workspace is in use, and at least once a day otherwise.</p>
      ) : null}
      {value.kind === "manual" ? <p className="text-xs text-text-tertiary">Appears as a Run button on each record of this list.</p> : null}
      {value.kind === "checkin" ? (
        <p className="text-xs text-text-tertiary">
          Steps can use the ticket holder&apos;s details: {"{{payload.name}}, {{payload.email}}, {{payload.ticketCode}}, {{payload.gate}}, {{payload.sessionId}}"}.
          {object ? ` Steps act on the ${object.name.toLowerCase()} linked to their ticket, or with the same email.` : ""}
        </p>
      ) : null}
    </div>
  );
}

function StepCard({ step, index, count, catalog, ctx, onChange, onMove, onRemove }) {
  const meta = catalog[step.kind] ?? { label: step.kind, icon: "circle" };
  const Editor = STEP_EDITORS[step.kind];
  return (
    <div className="rounded-xl border border-border bg-surface-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border text-xs text-text-secondary">{index + 1}</span>
        <LucideIcon name={meta.icon} className="h-4 w-4 text-text-secondary" />
        <span className="text-sm font-medium text-foreground">{meta.label}</span>
        <div className="ml-auto flex items-center">
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move up" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Move down" disabled={index === count - 1} onClick={() => onMove(1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label="Remove step" onClick={onRemove}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>
      <div className="p-3">{Editor ? <Editor ctx={ctx} step={step} onChange={onChange} /> : <p className="text-sm text-text-secondary">This step can&apos;t be edited here.</p>}</div>
    </div>
  );
}

// Unfilled fixed values would be sent as "clear the field", so they're dropped before saving.
const cleanValues = (values) => (values ?? []).filter((item) => item.value !== undefined);
function cleanStep(step) {
  const out = { ...step };
  if (out.values) out.values = cleanValues(out.values);
  if (out.approve) out.approve = { ...out.approve, values: cleanValues(out.approve.values) };
  if (out.reject) out.reject = { ...out.reject, values: cleanValues(out.reject.values) };
  return out;
}

const RUN_STATE = {
  succeeded: { icon: CheckCircle2, label: "Ran successfully", tone: "text-emerald-600 dark:text-emerald-400" },
  failed: { icon: CircleAlert, label: "Failed", tone: "text-red-600 dark:text-red-400" },
  waiting: { icon: Clock, label: "Waiting", tone: "text-amber-600 dark:text-amber-400" },
};
const STEP_STATE = {
  done: { icon: Check, tone: "text-emerald-600 dark:text-emerald-400" },
  failed: { icon: X, tone: "text-red-600 dark:text-red-400" },
  waiting: { icon: Clock, tone: "text-amber-600 dark:text-amber-400" },
};

// One run's outcome: a status line, then each step with what it did.
function RunResult({ run, catalog }) {
  const state = RUN_STATE[run.status] ?? { icon: Loader2, label: run.status, tone: "text-text-secondary" };
  const steps = run.steps ?? [];
  return (
    <li className="overflow-hidden rounded-lg border border-border bg-surface-card">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <state.icon className={cn("size-4", state.tone)} />
        <span className="text-sm font-medium text-foreground">{state.label}</span>
        <span className="ml-auto text-xs text-text-tertiary">{steps.length} step{steps.length === 1 ? "" : "s"}</span>
      </div>
      <ol className="divide-y divide-border/70">
        {steps.map((step, index) => {
          const meta = catalog[step.kind] ?? { label: `Step ${index + 1}`, icon: "circle" };
          const mark = STEP_STATE[step.status] ?? STEP_STATE.done;
          return (
            <li key={step.id ?? index} className="flex items-center gap-3 px-3 py-2.5">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-surface-subtle text-text-secondary"><LucideIcon name={meta.icon} className="size-3.5" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{meta.label}</p>
                <p className={cn("break-words text-xs", step.status === "failed" ? "text-red-600 dark:text-red-400" : "text-text-secondary")}>{step.status === "failed" ? step.error : step.detail || "Done"}</p>
              </div>
              <mark.icon className={cn("size-3.5 shrink-0", mark.tone)} strokeWidth={2.5} />
            </li>
          );
        })}
      </ol>
      {run.error && !steps.some((step) => step.status === "failed") ? <p className="border-t border-border px-3 py-2 text-xs text-red-600 dark:text-red-400">{run.error}</p> : null}
    </li>
  );
}

// Runs a saved automation on chosen records and shows what each step did.
function TryIt({ eventId, process, automation, catalog }) {
  const [records, setRecords] = useState([]);
  const [state, setState] = useState({ busy: false, runs: null });
  const objectId = automation.trigger.objectId;
  const field = { id: "try", type: "link_record", config: { targetObjectId: objectId, multiple: true } };
  const run = async () => {
    setState({ busy: true, runs: null });
    const result = await process.run("automation.run", { id: automation.id, recordIds: records.map((item) => item.id) }, { reload: false });
    setState({ busy: false, runs: result.data?.runs ?? [] });
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-card p-1.5 pl-2">
        <div className="min-w-0 flex-1">
          {objectId ? <LinkPicker field={field} value={records} onChange={setRecords} eventId={eventId} />
            : <span className="text-[13px] text-text-secondary">Runs once, not for a record.</span>}
        </div>
        <Button type="button" size="sm" onClick={run} disabled={state.busy || (objectId && !records.length)}>
          {state.busy ? <Loader2 className="animate-spin" /> : <Play />}Run now
        </Button>
      </div>
      {state.runs ? (
        state.runs.length ? (
          <ul className="space-y-2">{state.runs.map((run) => <RunResult key={run.id} run={run} catalog={catalog} />)}</ul>
        ) : <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[13px] text-text-secondary">Nothing ran. The records may not match the &ldquo;Only if&rdquo; conditions.</p>
      ) : null}
    </div>
  );
}

export function AutomationSheet({ open, onOpenChange, ...props }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-3xl">
        {open ? <AutomationBody key={props.automation?.id ?? "new"} onOpenChange={onOpenChange} {...props} /> : null}
      </SheetContent>
    </Sheet>
  );
}

function AutomationBody({ eventId, ws, process, automation, documents, onOpenChange }) {
  const data = ws.data;
  const catalog = process.data?.catalog ?? { triggers: {}, steps: {} };
  const firstList = ws.objects[0]?.id ?? null;
  const [name, setName] = useState(automation?.name ?? "");
  const [trigger, setTrigger] = useState(automation?.trigger ?? { kind: "record.created", objectId: firstList, source: "any" });
  const [condition, setCondition] = useState(automation?.condition ?? null);
  const [steps, setSteps] = useState(automation?.steps ?? []);
  const [enabled, setEnabled] = useState(automation?.enabled ?? true);
  const [busy, setBusy] = useState(false);
  const subjectId = RECORD_TRIGGERS.has(trigger.kind) || OPTIONAL_LIST.has(trigger.kind) ? trigger.objectId ?? null : null;
  const subject = data.objects.find((object) => object.id === subjectId);
  const payload = trigger.kind === "hook" || trigger.kind === "checkin";
  const ctx = { data, eventId, timeZone: data.event?.timeZone, subjectId, payload, members: process.members, setups: process.setups, documents,
    testCode: (body) => process.api.command({ action: "code.test", ...body }) };
  const available = Object.entries(catalog.steps).filter(([, meta]) => !meta.record || subjectId);

  const changeTrigger = (next) => {
    if (next.objectId !== trigger.objectId) { setCondition(null); setSteps([]); }
    setTrigger(next);
  };

  const save = async () => {
    setBusy(true);
    const result = await process.run("automation.save", {
      ...(automation ? { id: automation.id, expectedRevision: automation.revision } : {}),
      automation: { name, trigger, condition: subjectId ? toApiFilter(condition) ?? null : null, steps: steps.map(cleanStep), enabled },
    }, { success: automation ? "Automation saved" : "Automation created" });
    setBusy(false);
    if (!result.error) onOpenChange(false);
  };

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="text-base">{automation ? automation.name : "New automation"}</SheetTitle>
        <SheetDescription>When something happens, check a condition, then do the steps in order.</SheetDescription>
      </SheetHeader>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5">
        <div className="grid gap-1.5">
          <Label htmlFor="ws-automation-name">Name</Label>
          <Input id="ws-automation-name" autoFocus={!automation} maxLength={120} value={name} placeholder="Email authors when a paper is accepted" onChange={(e) => setName(e.target.value)} />
        </div>
        <Section title="When"><TriggerEditor data={data} catalog={catalog.triggers} value={trigger} onChange={changeTrigger} /></Section>
        {trigger.kind === "hook" && automation ? <Section title="Webhook address" hint="Send a POST with a JSON body to this address to run the automation."><HookAddress process={process} automation={automation} /></Section> : null}
        {subject ? (
          <Section title="Only if" hint={`Leave empty to run for every ${subject.name.toLowerCase()}.`}
            action={<FilterButton filter={condition} onChange={setCondition} fields={liveFieldsOf(data, subject.id)} statuses={subject.statuses ?? []} eventId={eventId}
              label="Conditions" intro="Run when the record matches" emptyText="No conditions. It runs for every record." />}>
            {condition?.items?.length ? <Badge variant="info">{condition.items.length} condition{condition.items.length === 1 ? "" : "s"}</Badge> : null}
          </Section>
        ) : null}
        <Section title="Do" action={(
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button type="button" size="sm" variant="outline"><Plus className="h-4 w-4" />Add step</Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {available.map(([kind, meta]) => (
                <DropdownMenuItem key={kind} onSelect={() => setSteps([...steps, blankStep(kind, ctx)])}><LucideIcon name={meta.icon} className="h-4 w-4" />{meta.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}>
          {steps.length ? (
            <div className="space-y-3">
              {steps.map((step, index) => (
                <StepCard key={step.id ?? index} step={step} index={index} count={steps.length} catalog={catalog.steps} ctx={ctx}
                  onChange={(next) => setSteps(steps.map((item, i) => (i === index ? next : item)))}
                  onRemove={() => setSteps(steps.filter((_, i) => i !== index))}
                  onMove={(dir) => {
                    const next = [...steps];
                    const [item] = next.splice(index, 1);
                    next.splice(index + dir, 0, item);
                    setSteps(next);
                  }} />
              ))}
            </div>
          ) : <p className="text-sm text-text-secondary">No steps yet. Add what should happen.</p>}
        </Section>
        {automation ? (
          <Section title="Try it" hint={automation.trigger.objectId ? "Runs the saved version on the records you choose — for real, including emails." : "Runs the saved version once now — for real, including emails."}>
            <TryIt eventId={eventId} process={process} automation={automation} catalog={catalog.steps} />
          </Section>
        ) : null}
      </div>
      <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-3">
        <label className="flex items-center gap-2 text-sm"><Switch checked={enabled} onCheckedChange={setEnabled} />On</label>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={busy || !name.trim() || !steps.length}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{automation ? "Save" : "Create"}</Button>
        </div>
      </SheetFooter>
    </>
  );
}
