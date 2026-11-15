"use client";

import { useMemo, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import {
  Button, Checkbox, Input, Label, Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, Sheet,
  SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, Switch, Textarea,
} from "@geiger/ui";
import { FORMULA_FUNCTIONS } from "@/lib/workspace/formula/index.js";
import { formulaForEditing } from "@/lib/workspace/schema/definition.js";
import { getType, TYPE_GROUPS } from "@/lib/workspace/schema/types/index.js";
import { liveFieldsOf } from "../state/use_workspace";
import { EVENT_TARGET_LABELS, TYPE_META, typeIcon } from "../state/format";
import { ImpactDialog } from "./impact_dialog";
import { OptionsEditor } from "./options_editor";

const UNIQUE_TYPES = new Set(["short_text", "email", "phone", "url", "number"]);
const NUMERIC = new Set(["number", "currency", "percent", "rating", "duration"]);
const FIXED_TYPES = new Set(["link_record", "link_event", "attachments", "formula", "lookup", "rollup"]);
const CURRENCIES = ["USD", "EUR", "GBP", "INR", "AUD", "CAD", "SGD", "AED", "JPY", "CHF", "NZD", "ZAR"];
const FILE_PRESETS = [
  { label: "PDF", types: ["application/pdf"] },
  { label: "Images", types: ["image/*"] },
  { label: "Slides & documents", types: ["application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword", "application/vnd.apple.keynote"] },
  { label: "Video", types: ["video/*"] },
];

function Row({ label, hint, children, htmlFor }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

const numberOrUndefined = (text) => (text === "" || text === undefined ? undefined : Number(text));

function NumberSetting({ label, value, onChange, hint, min }) {
  return (
    <Row label={label} hint={hint}>
      <Input type="number" min={min} value={value ?? ""} onChange={(e) => onChange(numberOrUndefined(e.target.value))} />
    </Row>
  );
}

function ConfigEditor({ type, config, setConfig, data, objectId }) {
  const set = (patch) => setConfig({ ...config, ...patch });
  const fields = liveFieldsOf(data, objectId);
  const objects = (data?.objects ?? []).filter((object) => !object.deletedAt);
  switch (type) {
    case "short_text":
      return <NumberSetting label="Maximum length" min={1} value={config.maxLength} onChange={(maxLength) => set({ maxLength })} hint="Leave blank for up to 1,000 characters." />;
    case "long_text":
      return (
        <div className="grid grid-cols-2 gap-3">
          <NumberSetting label="Word limit" min={1} value={config.maxWords} onChange={(maxWords) => set({ maxWords })} hint="Abstracts are often 250." />
          <NumberSetting label="Character limit" min={1} value={config.maxChars} onChange={(maxChars) => set({ maxChars })} />
        </div>
      );
    case "number":
    case "percent":
      return (
        <div className="grid grid-cols-3 gap-3">
          <NumberSetting label="Decimals" min={0} value={config.decimals} onChange={(decimals) => set({ decimals })} />
          <NumberSetting label="Minimum" value={config.min} onChange={(min) => set({ min })} />
          <NumberSetting label="Maximum" value={config.max} onChange={(max) => set({ max })} />
        </div>
      );
    case "currency":
      return (
        <Row label="Currency">
          <Select value={config.currency ?? "USD"} onValueChange={(currency) => set({ currency })}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map((code) => <SelectItem key={code} value={code}>{code}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
      );
    case "rating":
      return <NumberSetting label="Highest rating" min={3} value={config.max ?? 5} onChange={(max) => set({ max })} hint="From 3 to 10 stars." />;
    case "single_select":
    case "multi_select":
      return (
        <Row label="Options">
          <OptionsEditor items={config.options ?? []} onChange={(options) => set({ options })} />
        </Row>
      );
    case "link_record":
      return (
        <div className="space-y-4">
          <Row label="Links to">
            <Select value={config.targetObjectId ?? ""} onValueChange={(targetObjectId) => set({ targetObjectId })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a list" /></SelectTrigger>
              <SelectContent>{objects.map((object) => <SelectItem key={object.id} value={object.id}>{object.plural}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <label className="flex items-center justify-between gap-3 text-sm">
            Allow several links <Switch checked={config.multiple ?? true} onCheckedChange={(multiple) => set({ multiple })} />
          </label>
        </div>
      );
    case "link_event":
      return (
        <div className="space-y-4">
          <Row label="Links to">
            <Select value={config.target ?? ""} onValueChange={(target) => set({ target })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose what to link" /></SelectTrigger>
              <SelectContent>
                {Object.entries(EVENT_TARGET_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}s</SelectItem>)}
              </SelectContent>
            </Select>
          </Row>
          <label className="flex items-center justify-between gap-3 text-sm">
            Allow several links <Switch checked={config.multiple ?? false} onCheckedChange={(multiple) => set({ multiple })} />
          </label>
        </div>
      );
    case "attachments": {
      const accept = config.accept ?? [];
      const has = (preset) => preset.types.every((t) => accept.includes(t));
      const toggle = (preset) => set({ accept: has(preset) ? accept.filter((t) => !preset.types.includes(t)) : [...new Set([...accept, ...preset.types])] });
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <NumberSetting label="Files per record" min={1} value={config.maxFiles ?? 10} onChange={(maxFiles) => set({ maxFiles })} />
            <NumberSetting label="Largest file (MB)" min={1} value={config.maxBytes ? Math.round(config.maxBytes / 1048576) : 50}
              onChange={(mb) => set({ maxBytes: mb === undefined ? undefined : Math.min(50, mb) * 1048576 })} />
          </div>
          <Row label="Allowed types" hint="Leave all unticked to allow any file.">
            <div className="grid grid-cols-2 gap-2">
              {FILE_PRESETS.map((preset) => (
                <label key={preset.label} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={has(preset)} onCheckedChange={() => toggle(preset)} />{preset.label}
                </label>
              ))}
            </div>
          </Row>
        </div>
      );
    }
    case "formula":
      return (
        <div className="space-y-4">
          <Row label="Formula" hint={`Put field names in braces, like {Score} * 2 or IF({Accepted}, "Yes", "No"). Functions: ${FORMULA_FUNCTIONS.join(", ")}.`}>
            <Textarea rows={4} className="font-mono text-sm" value={config.expression ?? ""} onChange={(e) => set({ expression: e.target.value })}
              placeholder="{Score} * 2" />
          </Row>
          <div className="flex flex-wrap gap-1">
            {fields.filter((field) => getType(field.type).stored && field.type !== "attachments").map((field) => (
              <button key={field.id} type="button" className="rounded-md border border-border bg-surface-card px-1.5 py-0.5 text-xs text-text-secondary hover:text-foreground"
                onClick={() => set({ expression: `${config.expression ?? ""}{${field.name}}` })}>{field.name}</button>
            ))}
          </div>
          <Row label="Result">
            <Select value={config.result ?? "text"} onValueChange={(result) => set({ result })}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="number">Number</SelectItem>
                <SelectItem value="boolean">Yes or no</SelectItem>
                <SelectItem value="date">Date</SelectItem>
              </SelectContent>
            </Select>
          </Row>
        </div>
      );
    case "lookup":
    case "rollup": {
      const links = fields.filter((field) => field.type === "link_record");
      const link = links.find((field) => field.id === config.linkFieldId);
      const targets = link ? liveFieldsOf(data, link.config.targetObjectId).filter((field) => !["link_record", "link_event", "lookup", "rollup", "attachments"].includes(field.type)) : [];
      const fn = config.fn ?? "count";
      const choices = type === "rollup" ? targets.filter((field) => NUMERIC.has(field.type) || (field.type === "formula" && field.config.result === "number")) : targets;
      return (
        <div className="space-y-4">
          <Row label="Through the link" hint={links.length ? null : "Add a Link to record field to this list first."}>
            <Select value={config.linkFieldId ?? ""} onValueChange={(linkFieldId) => set({ linkFieldId, targetFieldId: undefined })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Choose a link field" /></SelectTrigger>
              <SelectContent>{links.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          {type === "rollup" ? (
            <Row label="Summary">
              <Select value={fn} onValueChange={(next) => set({ fn: next, ...(next === "count" ? { targetFieldId: undefined } : {}) })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="count">Count linked records</SelectItem>
                  <SelectItem value="sum">Total of a number</SelectItem>
                  <SelectItem value="avg">Average of a number</SelectItem>
                  <SelectItem value="min">Lowest of a number</SelectItem>
                  <SelectItem value="max">Highest of a number</SelectItem>
                </SelectContent>
              </Select>
            </Row>
          ) : null}
          {type === "lookup" || fn !== "count" ? (
            <Row label={type === "lookup" ? "Field to show" : "Number field"}>
              <Select value={config.targetFieldId ?? ""} onValueChange={(targetFieldId) => set({ targetFieldId })} disabled={!link}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Choose a field" /></SelectTrigger>
                <SelectContent>{choices.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
              </Select>
            </Row>
          ) : null}
        </div>
      );
    }
    default:
      return null;
  }
}

function startingConfig(type) {
  if (type === "single_select" || type === "multi_select") return { options: [] };
  if (type === "rollup") return { fn: "count" };
  if (type === "formula") return { expression: "", result: "text" };
  if (type === "link_record") return { multiple: true };
  return {};
}

const clean = (config) => Object.fromEntries(Object.entries(config).filter(([, value]) => value !== undefined && value !== ""));

export function FieldSheet({ open, onOpenChange, data, objectId, field, run, onDeleted }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        {open ? <FieldSheetBody key={field?.id ?? "new"} onOpenChange={onOpenChange} data={data} objectId={objectId} field={field} run={run} onDeleted={onDeleted} /> : null}
      </SheetContent>
    </Sheet>
  );
}

// Fresh state each time the sheet opens (keyed by field), so nothing has to be reset in an effect.
function FieldSheetBody({ onOpenChange, data, objectId, field, run, onDeleted }) {
  const fields = useMemo(() => liveFieldsOf(data, objectId), [data, objectId]);
  const [name, setName] = useState(field?.name ?? "");
  const [type, setType] = useState(field?.type ?? "short_text");
  const [config, setConfig] = useState(() => (field
    ? (field.type === "formula" ? { ...field.config, expression: formulaForEditing(field.config.expression, fields) } : { ...field.config })
    : {}));
  const [required, setRequired] = useState(field?.required ?? false);
  const [isUnique, setUnique] = useState(field?.isUnique ?? false);
  const [busy, setBusy] = useState(false);
  const [impact, setImpact] = useState(null);

  const typeInfo = getType(type);
  const changeType = (next) => { setType(next); if (!field || field.type !== next) setConfig(startingConfig(next)); };

  const submit = async (confirm = false) => {
    setBusy(true);
    const payload = { name: name.trim(), type, config: clean(config), required: typeInfo.editable ? required : false, isUnique: UNIQUE_TYPES.has(type) ? isUnique : false };
    const result = field
      ? await run("field.update", { fieldId: field.id, expectedRevision: field.revision, patch: payload, objectId, ...(confirm ? { confirm: true } : {}) }, { handle: ["confirm_required"] })
      : await run("field.create", { objectId, field: payload });
    setBusy(false);
    if (result.error?.code === "confirm_required") { setImpact(result.error.fields?.impact ?? { clears: 0 }); return; }
    if (!result.error) onOpenChange(false);
  };

  const remove = async () => {
    const result = await run("field.delete", { fieldId: field.id, objectId });
    if (!result.error) { onOpenChange(false); onDeleted?.(); }
  };

  const typeLocked = field && FIXED_TYPES.has(field.type);

  return (
    <>
          <SheetHeader className="border-b border-border px-5 py-4">
            <SheetTitle className="text-base">{field ? "Edit field" : "Add field"}</SheetTitle>
            <SheetDescription>{TYPE_META[type]?.hint}</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
            <Row label="Name" htmlFor="ws-field-name">
              <Input id="ws-field-name" autoFocus value={name} maxLength={100} onChange={(e) => setName(e.target.value)} placeholder="e.g. Abstract" />
            </Row>
            <Row label="Type" hint={typeLocked ? "This kind of field can't change type. Add a new field instead." : null}>
              <Select value={type} onValueChange={changeType} disabled={typeLocked}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_GROUPS.map((group) => (
                    <SelectGroup key={group.group}>
                      <SelectLabel>{group.group}</SelectLabel>
                      {group.types.filter((item) => !field || !FIXED_TYPES.has(item) || item === field.type).map((item) => {
                        const Icon = typeIcon(item);
                        return <SelectItem key={item} value={item}><span className="inline-flex items-center gap-2"><Icon className="h-4 w-4 text-text-secondary" />{getType(item).label}</span></SelectItem>;
                      })}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <ConfigEditor type={type} config={config} setConfig={setConfig} data={data} objectId={objectId} />
            {typeInfo.editable ? (
              <div className="space-y-3 border-t border-border pt-4">
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span><span className="font-medium text-foreground">Required</span><span className="block text-xs text-text-tertiary">A record can&apos;t be saved without it.</span></span>
                  <Switch checked={required} onCheckedChange={setRequired} />
                </label>
                {UNIQUE_TYPES.has(type) ? (
                  <label className="flex items-center justify-between gap-3 text-sm">
                    <span><span className="font-medium text-foreground">No duplicates</span><span className="block text-xs text-text-tertiary">Two records can&apos;t share a value, ignoring capitals.</span></span>
                    <Switch checked={isUnique} onCheckedChange={setUnique} />
                  </label>
                ) : null}
              </div>
            ) : null}
          </div>
          <SheetFooter className="flex-row items-center justify-between gap-2 border-t border-border px-5 py-3">
            <div>
              {field ? (
                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-600 dark:text-red-400" onClick={remove}>
                  <Trash2 className="h-4 w-4" />Delete field
                </Button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={() => submit(false)} disabled={busy || !name.trim()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{field ? "Save" : "Add field"}
              </Button>
            </div>
          </SheetFooter>
      <ImpactDialog impact={impact} fieldName={field?.name ?? name} onCancel={() => setImpact(null)}
        onConfirm={() => { setImpact(null); submit(true); }} />
    </>
  );
}
