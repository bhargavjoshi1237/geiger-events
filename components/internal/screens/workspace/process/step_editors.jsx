"use client";

import { Plus, X } from "lucide-react";
import {
  Button, Checkbox, Input, Label, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea,
} from "@geiger/ui";
import { getType } from "@/lib/workspace/schema/types/index.js";
import { liveFieldsOf } from "../state/use_workspace";
import { Muted, OptionChip } from "../ws_ui";
import { FieldInput } from "../record/field_input";
import { TemplateInput, TemplateRichText } from "./template_input";
import { CodeStepEditor } from "./code_step";

const KEEP = "__keep__";
const TEMPLATABLE = new Set(["short_text", "long_text", "email", "phone", "url", "number", "currency", "percent", "rating", "date", "datetime", "duration"]);

function modeOf(value) {
  if (value === null) return "clear";
  if (value === "@today") return "today";
  if (value === "@now") return "now";
  if (value === "@record") return "record";
  if (typeof value === "string" && value.includes("{{")) return "template";
  return "fixed";
}

function modesFor(field, subjectId) {
  const modes = [{ value: "fixed", label: "Set to" }];
  if (TEMPLATABLE.has(field.type)) modes.push({ value: "template", label: "Fill in from" });
  if (field.type === "date" || field.type === "datetime") modes.push({ value: "today", label: "Today" });
  if (field.type === "datetime") modes.push({ value: "now", label: "Now" });
  if (field.type === "link_record" && field.config.targetObjectId === subjectId) modes.push({ value: "record", label: "The triggering record" });
  modes.push({ value: "clear", label: "Clear it" });
  return modes;
}

const initialFor = (mode, field) => ({ clear: null, today: "@today", now: "@now", record: "@record", template: "{{", fixed: field.type === "checkbox" ? true : undefined })[mode];

// Field values a step writes: a fixed value, text with placeholders, a token, or clearing it.
export function ValuesEditor({ data, eventId, timeZone, objectId, subjectId, payload, value, onChange }) {
  const fields = liveFieldsOf(data, objectId).filter((field) => getType(field.type).editable);
  const items = value ?? [];
  const used = new Set(items.map((item) => item.fieldId));
  const set = (index, next) => onChange(items.map((item, i) => (i === index ? next : item)));
  const add = () => {
    const field = fields.find((item) => !used.has(item.id));
    if (field) onChange([...items, { fieldId: field.id, value: initialFor("fixed", field) }]);
  };
  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const field = fields.find((entry) => entry.id === item.fieldId);
        if (!field) return null;
        const mode = modeOf(item.value);
        return (
          <div key={item.fieldId} className="grid gap-2 rounded-lg border border-border p-2 sm:grid-cols-[minmax(0,10rem)_minmax(0,9rem)_minmax(0,1fr)_auto] sm:items-start">
            <Select value={field.id} onValueChange={(fieldId) => {
              const next = fields.find((entry) => entry.id === fieldId);
              set(index, { fieldId, value: initialFor("fixed", next) });
            }}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fields.filter((entry) => entry.id === field.id || !used.has(entry.id)).map((entry) => <SelectItem key={entry.id} value={entry.id}>{entry.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={mode} onValueChange={(next) => set(index, { ...item, value: initialFor(next, field) })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>{modesFor(field, subjectId).map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
            </Select>
            <div className="min-w-0">
              {mode === "fixed" ? (
                <FieldInput field={field} value={item.value ?? (getType(field.type).cast === "link" ? [] : null)} eventId={eventId} timeZone={timeZone}
                  onChange={(next) => set(index, { ...item, value: next })} />
              ) : mode === "template" ? (
                <TemplateInput data={data} objectId={subjectId} payload={payload} value={item.value} onChange={(next) => set(index, { ...item, value: next })}
                  placeholder="{{Title}}" />
              ) : <p className="py-2 text-sm text-text-secondary">{modesFor(field, subjectId).find((option) => option.value === mode)?.label}</p>}
            </div>
            <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Remove" onClick={() => onChange(items.filter((_, i) => i !== index))}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}
      {fields.some((field) => !used.has(field.id)) ? (
        <Button type="button" variant="outline" size="sm" onClick={add}><Plus className="h-4 w-4" />Set a field</Button>
      ) : null}
    </div>
  );
}

export function StatusSelect({ object, value, onChange, keepLabel = "Don't change" }) {
  if (!object?.statuses?.length) return null;
  return (
    <Select value={value ?? KEEP} onValueChange={(next) => onChange(next === KEEP ? null : next)}>
      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={KEEP}><Muted>{keepLabel}</Muted></SelectItem>
        {object.statuses.map((status) => <SelectItem key={status.key} value={status.key}><OptionChip option={status} /></SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function Row({ label, hint, children }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs font-medium text-text-secondary">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

function MemberPicker({ members, value, onChange, placeholder = "Choose people" }) {
  const chosen = new Set(value ?? []);
  const names = members.filter((member) => chosen.has(member.userId)).map((member) => member.name);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-9 w-full justify-start font-normal">
          <span className="truncate">{names.length ? names.join(", ") : <Muted>{placeholder}</Muted>}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-72 overflow-y-auto p-1">
        {members.length ? members.map((member) => (
          <label key={member.userId} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover">
            <Checkbox checked={chosen.has(member.userId)} onCheckedChange={(on) => {
              const next = new Set(chosen);
              if (on) next.add(member.userId); else next.delete(member.userId);
              onChange([...next]);
            }} />
            <span className="min-w-0 flex-1 truncate">{member.name}</span>
          </label>
        )) : <p className="px-2 py-3 text-sm text-text-secondary">No team members yet.</p>}
      </PopoverContent>
    </Popover>
  );
}

// Who gets an email: email fields on the record or a linked record, team members, fixed addresses.
function RecipientsEditor({ data, subjectId, members, payload, value, onChange }) {
  const items = value ?? [];
  const fields = subjectId ? liveFieldsOf(data, subjectId) : [];
  const emailFields = fields.filter((field) => field.type === "email");
  const linked = fields.filter((field) => field.type === "link_record").flatMap((link) => liveFieldsOf(data, link.config.targetObjectId)
    .filter((field) => field.type === "email").map((field) => ({ link, field })));
  const options = [
    ...emailFields.map((field) => ({ key: `field:${field.id}`, label: field.name, item: { kind: "field", fieldId: field.id } })),
    ...linked.map(({ link, field }) => ({ key: `linked:${link.id}:${field.id}`, label: `${link.name} → ${field.name}`, item: { kind: "linked", linkFieldId: link.id, fieldId: field.id } })),
  ];
  const keyOf = (item) => (item.kind === "field" ? `field:${item.fieldId}` : item.kind === "linked" ? `linked:${item.linkFieldId}:${item.fieldId}` : item.kind);
  const set = (index, next) => onChange(items.map((item, i) => (i === index ? next : item)));
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={index} className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            {item.kind === "team" ? <MemberPicker members={members} value={item.userIds} onChange={(userIds) => set(index, { ...item, userIds })} placeholder="Choose team members" />
              : item.kind === "address" ? <Input type="email" value={item.address ?? ""} placeholder="name@example.com" onChange={(e) => set(index, { ...item, address: e.target.value })} />
                : item.kind === "payload" ? <Input value={item.path ?? ""} placeholder="payload.email" onChange={(e) => set(index, { ...item, path: e.target.value })} />
                  : <p className="flex h-9 items-center rounded-md border border-border px-3 text-sm">{options.find((option) => option.key === keyOf(item))?.label ?? "Removed field"}</p>}
          </div>
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Remove" onClick={() => onChange(items.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button>
        </div>
      ))}
      <Select value="" onValueChange={(key) => {
        if (key === "team") onChange([...items, { kind: "team", userIds: [] }]);
        else if (key === "address") onChange([...items, { kind: "address", address: "" }]);
        else if (key === "payload") onChange([...items, { kind: "payload", path: "payload.email" }]);
        else onChange([...items, options.find((option) => option.key === key).item]);
      }}>
        <SelectTrigger className="h-9 w-56"><SelectValue placeholder="Add recipient" /></SelectTrigger>
        <SelectContent>
          {options.filter((option) => !items.some((item) => keyOf(item) === option.key)).map((option) => <SelectItem key={option.key} value={option.key}>{option.label}</SelectItem>)}
          <SelectItem value="team">Team members</SelectItem>
          <SelectItem value="address">An email address</SelectItem>
          {payload ? <SelectItem value="payload">An address in the request</SelectItem> : null}
        </SelectContent>
      </Select>
    </div>
  );
}

function ListSelect({ data, value, onChange, placeholder = "Choose a list" }) {
  return (
    <Select value={value ?? ""} onValueChange={onChange}>
      <SelectTrigger className="h-9"><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>{data.objects.filter((object) => !object.deletedAt).map((object) => <SelectItem key={object.id} value={object.id}>{object.plural}</SelectItem>)}</SelectContent>
    </Select>
  );
}

const objectOf = (data, id) => data.objects.find((object) => object.id === id && !object.deletedAt);

// Settings for each kind of step. Every editor gets the step and returns the changed step through onChange.
export const STEP_EDITORS = {
  update_record({ ctx, step, onChange }) {
    return (
      <div className="space-y-3">
        <Row label="Set these fields"><ValuesEditor {...ctx} objectId={ctx.subjectId} value={step.values} onChange={(values) => onChange({ ...step, values })} /></Row>
        {objectOf(ctx.data, ctx.subjectId)?.statuses?.length ? (
          <Row label="Move to status"><StatusSelect object={objectOf(ctx.data, ctx.subjectId)} value={step.status} onChange={(status) => onChange({ ...step, status })} /></Row>
        ) : null}
      </div>
    );
  },

  update_linked({ ctx, step, onChange }) {
    const links = liveFieldsOf(ctx.data, ctx.subjectId).filter((field) => field.type === "link_record");
    const link = links.find((field) => field.id === step.linkFieldId);
    const target = link ? objectOf(ctx.data, link.config.targetObjectId) : null;
    return (
      <div className="space-y-3">
        <Row label="Records linked through">
          <Select value={step.linkFieldId ?? ""} onValueChange={(linkFieldId) => onChange({ ...step, linkFieldId, values: [], status: null })}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Choose a link field" /></SelectTrigger>
            <SelectContent>{links.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
        {target ? (
          <>
            <Row label={`Set these fields on each linked ${target.name.toLowerCase()}`}>
              <ValuesEditor {...ctx} objectId={target.id} value={step.values} onChange={(values) => onChange({ ...step, values })} />
            </Row>
            {target.statuses?.length ? <Row label="Move them to"><StatusSelect object={target} value={step.status} onChange={(status) => onChange({ ...step, status })} /></Row> : null}
          </>
        ) : null}
      </div>
    );
  },

  create_record({ ctx, step, onChange }) {
    const target = objectOf(ctx.data, step.objectId);
    return (
      <div className="space-y-3">
        <Row label="Add to"><ListSelect data={ctx.data} value={step.objectId} onChange={(objectId) => onChange({ ...step, objectId, values: [], status: null })} /></Row>
        {target ? (
          <>
            <Row label="With these values" hint={ctx.subjectId ? "To link the new record back, set a link field to “The triggering record”." : null}>
              <ValuesEditor {...ctx} objectId={target.id} value={step.values} onChange={(values) => onChange({ ...step, values })} />
            </Row>
            {target.statuses?.length ? <Row label="Status"><StatusSelect object={target} value={step.status} onChange={(status) => onChange({ ...step, status })} keepLabel="Default" /></Row> : null}
          </>
        ) : null}
      </div>
    );
  },

  upsert_record({ ctx, step, onChange }) {
    const target = objectOf(ctx.data, step.objectId);
    const matchable = target ? liveFieldsOf(ctx.data, target.id).filter((field) => ["short_text", "email", "phone", "url", "number"].includes(field.type)) : [];
    return (
      <div className="space-y-3">
        <Row label="Search in"><ListSelect data={ctx.data} value={step.objectId} onChange={(objectId) => onChange({ ...step, objectId, matchFieldId: null, values: [] })} /></Row>
        {target ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Row label="Where">
                <Select value={step.matchFieldId ?? ""} onValueChange={(matchFieldId) => onChange({ ...step, matchFieldId })}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Choose a field" /></SelectTrigger>
                  <SelectContent>{matchable.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
                </Select>
              </Row>
              <Row label="Is">
                <TemplateInput data={ctx.data} objectId={ctx.subjectId} payload={ctx.payload} value={step.matchValue} onChange={(matchValue) => onChange({ ...step, matchValue })}
                  placeholder={ctx.payload ? "{{payload.email}}" : "{{Email}}"} />
              </Row>
            </div>
            <Row label="Then set"><ValuesEditor {...ctx} objectId={target.id} value={step.values} onChange={(values) => onChange({ ...step, values })} /></Row>
            <label className="flex items-center gap-2 text-sm"><Switch checked={step.create !== false} onCheckedChange={(create) => onChange({ ...step, create })} />Create one when nothing matches</label>
          </>
        ) : null}
      </div>
    );
  },

  send_email({ ctx, step, onChange }) {
    const templates = (ctx.documents ?? []).filter((doc) => doc.kind === "email");
    const pdfs = (ctx.documents ?? []).filter((doc) => doc.kind === "pdf" && (!doc.objectId || doc.objectId === ctx.subjectId));
    return (
      <div className="space-y-3">
        <Row label="To"><RecipientsEditor data={ctx.data} subjectId={ctx.subjectId} members={ctx.members} payload={ctx.payload} value={step.to} onChange={(to) => onChange({ ...step, to })} /></Row>
        {templates.length ? (
          <Row label="Message">
            <Select value={step.templateId ?? "__inline__"} onValueChange={(value) => onChange({ ...step, templateId: value === "__inline__" ? null : value })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__inline__">Write it here</SelectItem>
                {templates.map((doc) => <SelectItem key={doc.id} value={doc.id}>Template: {doc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
        ) : null}
        {!step.templateId ? (
          <>
            <Row label="Subject"><TemplateInput data={ctx.data} objectId={ctx.subjectId} payload={ctx.payload} value={step.subject} onChange={(subject) => onChange({ ...step, subject })} maxLength={300} /></Row>
            <Row label="Message"><TemplateRichText data={ctx.data} objectId={ctx.subjectId} payload={ctx.payload} value={step.body} onChange={(body) => onChange({ ...step, body })} /></Row>
          </>
        ) : null}
        {pdfs.length && ctx.subjectId ? (
          <Row label="Include a document link" hint="Adds a private download link to the PDF, made for this record.">
            <Select value={step.attachDocumentId ?? "__none__"} onValueChange={(value) => onChange({ ...step, attachDocumentId: value === "__none__" ? null : value })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No document</SelectItem>
                {pdfs.map((doc) => <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
        ) : null}
        <Row label="Reply-to (optional)"><Input type="email" value={step.replyTo ?? ""} placeholder="programme@example.org" onChange={(e) => onChange({ ...step, replyTo: e.target.value })} /></Row>
      </div>
    );
  },

  ask_approval({ ctx, step, onChange }) {
    const object = objectOf(ctx.data, ctx.subjectId);
    const outcome = (key, label) => (
      <Row label={label}>
        <div className="space-y-2 rounded-lg border border-border p-2">
          {object?.statuses?.length ? <StatusSelect object={object} value={step[key]?.status ?? null} onChange={(status) => onChange({ ...step, [key]: { ...(step[key] ?? {}), status } })} /> : null}
          <ValuesEditor {...ctx} objectId={ctx.subjectId} value={step[key]?.values ?? []} onChange={(values) => onChange({ ...step, [key]: { ...(step[key] ?? {}), values } })} />
        </div>
      </Row>
    );
    return (
      <div className="space-y-3">
        <Row label="Who approves"><MemberPicker members={ctx.members} value={step.approvers} onChange={(approvers) => onChange({ ...step, approvers })} /></Row>
        <Row label="Needs">
          <Select value={step.rule ?? "any"} onValueChange={(rule) => onChange({ ...step, rule })}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="any">Any one of them</SelectItem><SelectItem value="all">All of them</SelectItem></SelectContent>
          </Select>
        </Row>
        <Row label="Title"><TemplateInput data={ctx.data} objectId={ctx.subjectId} value={step.title} onChange={(title) => onChange({ ...step, title })} placeholder="Approve {{Title}}" /></Row>
        <Row label="Message"><TemplateInput data={ctx.data} objectId={ctx.subjectId} multiline value={step.message} onChange={(message) => onChange({ ...step, message })} /></Row>
        {outcome("approve", "When approved")}
        {outcome("reject", "When rejected")}
      </div>
    );
  },

  assign_reviewers({ ctx, step, onChange }) {
    const setups = (ctx.setups ?? []).filter((setup) => setup.config?.submissionsObjectId === ctx.subjectId);
    return (
      <Row label="Review setup" hint={setups.length ? "Picks reviewers for this record with the setup's matching, limits and conflict rules." : "Create a review setup for this list on the Review screen first."}>
        <Select value={step.setupId ?? ""} onValueChange={(setupId) => onChange({ ...step, setupId })}>
          <SelectTrigger className="h-9"><SelectValue placeholder="Choose a review setup" /></SelectTrigger>
          <SelectContent>{setups.map((setup) => <SelectItem key={setup.id} value={setup.id}>{setup.name}</SelectItem>)}</SelectContent>
        </Select>
      </Row>
    );
  },

  generate_document({ ctx, step, onChange }) {
    const pdfs = (ctx.documents ?? []).filter((doc) => doc.kind === "pdf" && (!doc.objectId || doc.objectId === ctx.subjectId));
    const fileFields = liveFieldsOf(ctx.data, ctx.subjectId).filter((field) => field.type === "attachments");
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <Row label="Document">
          <Select value={step.documentId ?? ""} onValueChange={(documentId) => onChange({ ...step, documentId })}>
            <SelectTrigger className="h-9"><SelectValue placeholder={pdfs.length ? "Choose a document" : "No PDF documents yet"} /></SelectTrigger>
            <SelectContent>{pdfs.map((doc) => <SelectItem key={doc.id} value={doc.id}>{doc.name}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
        <Row label="Put it in">
          <Select value={step.fieldId ?? ""} onValueChange={(fieldId) => onChange({ ...step, fieldId })}>
            <SelectTrigger className="h-9"><SelectValue placeholder={fileFields.length ? "Choose a file field" : "Add a file field first"} /></SelectTrigger>
            <SelectContent>{fileFields.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
        <label className="flex items-center gap-2 text-sm sm:col-span-2"><Switch checked={step.replace !== false} onCheckedChange={(replace) => onChange({ ...step, replace })} />Replace an earlier copy of this document</label>
      </div>
    );
  },

  add_comment({ ctx, step, onChange }) {
    return <Row label="Note" hint="Visible to the team on the record's comments."><TemplateInput data={ctx.data} objectId={ctx.subjectId} multiline value={step.body} onChange={(body) => onChange({ ...step, body })} /></Row>;
  },

  webhook({ ctx, step, onChange }) {
    const fields = ctx.subjectId ? liveFieldsOf(ctx.data, ctx.subjectId) : [];
    return (
      <div className="space-y-3">
        <Row label="Address" hint="An https:// address. Requests are signed with the workspace's webhook secret (Geiger-Signature header).">
          <Input value={step.url ?? ""} placeholder="https://example.com/hooks/papers" onChange={(e) => onChange({ ...step, url: e.target.value })} />
        </Row>
        {fields.length ? (
          <label className="flex items-center gap-2 text-sm"><Switch checked={step.includeRecord !== false} onCheckedChange={(includeRecord) => onChange({ ...step, includeRecord })} />Send the record&apos;s fields</label>
        ) : null}
      </div>
    );
  },

  run_code({ ctx, step, onChange }) {
    return <CodeStepEditor ctx={ctx} step={step} onChange={onChange} />;
  },

  wait({ step, onChange }) {
    return (
      <div className="flex items-center gap-2">
        <Input type="number" min={1} max={365} className="h-9 w-24" value={step.amount ?? 1} onChange={(e) => onChange({ ...step, amount: Math.max(1, Number(e.target.value) || 1) })} />
        <Select value={step.unit ?? "days"} onValueChange={(unit) => onChange({ ...step, unit })}>
          <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="minutes">minutes</SelectItem><SelectItem value="hours">hours</SelectItem><SelectItem value="days">days</SelectItem></SelectContent>
        </Select>
        <span className="text-sm text-text-secondary">then carry on</span>
      </div>
    );
  },
};

// A new step's starting settings.
export function blankStep(kind, ctx) {
  switch (kind) {
    case "update_record": return { kind, values: [], status: null };
    case "update_linked": return { kind, linkFieldId: null, values: [] };
    case "create_record": return { kind, objectId: null, values: [] };
    case "upsert_record": return { kind, objectId: null, matchFieldId: null, matchValue: "", values: [], create: true };
    case "send_email": return { kind, to: [], subject: "", body: "" };
    case "ask_approval": return { kind, approvers: [], rule: "any", title: "Approve {{record.title}}", message: "", approve: { status: null, values: [] }, reject: { status: null, values: [] } };
    case "assign_reviewers": return { kind, setupId: (ctx.setups ?? []).find((setup) => setup.config?.submissionsObjectId === ctx.subjectId)?.id ?? null };
    case "generate_document": return { kind, documentId: null, fieldId: null, replace: true };
    case "add_comment": return { kind, body: "" };
    case "webhook": return { kind, url: "", includeRecord: true };
    case "run_code": return { kind, code: "" };
    case "wait": return { kind, amount: 1, unit: "days" };
    default: return { kind };
  }
}

