"use client";

import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";
import {
  Button, Checkbox, Input, Label, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { liveFieldsOf } from "../state/use_workspace";
import { Muted } from "../ws_ui";
import { TemplateInput } from "../process/template_input";

export function Row({ label, hint, children, className }) {
  return (
    <div className={cn("grid min-w-0 gap-1.5", className)}>
      <Label className="text-xs font-medium text-text-secondary">{label}</Label>
      {children}
      {hint ? <p className="text-xs text-text-tertiary">{hint}</p> : null}
    </div>
  );
}

const ALIGNS = [["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]];

export function AlignPicker({ value = "left", onChange }) {
  return (
    <div className="inline-flex rounded-md border border-border p-0.5" role="radiogroup" aria-label="Alignment">
      {ALIGNS.map(([key, Icon]) => (
        <button key={key} type="button" role="radio" aria-checked={value === key} aria-label={`Align ${key}`} onClick={() => onChange(key)}
          className={cn("flex h-7 w-8 items-center justify-center rounded text-text-secondary", value === key && "bg-surface-active text-foreground")}>
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}

function NumberInput({ value, min, max, onChange, suffix }) {
  return (
    <div className="flex items-center gap-2">
      <Input type="number" min={min} max={max} className="h-9 w-24" value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? min : Math.max(min, Math.min(max, Number(e.target.value))))} />
      {suffix ? <span className="text-sm text-text-secondary">{suffix}</span> : null}
    </div>
  );
}

export function FieldChecklist({ fields, value, onChange, placeholder = "Choose fields" }) {
  const chosen = new Set(value ?? []);
  const names = fields.filter((field) => chosen.has(field.id)).map((field) => field.name);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" className="h-9 w-full justify-start font-normal">
          <span className="truncate">{names.length ? names.join(", ") : <Muted>{placeholder}</Muted>}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-72 overflow-y-auto p-1">
        {fields.length ? fields.map((field) => (
          <label key={field.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface-hover">
            <Checkbox checked={chosen.has(field.id)} onCheckedChange={(on) => {
              const next = (value ?? []).filter((id) => id !== field.id);
              onChange(on ? [...next, field.id] : next);
            }} />
            <span className="min-w-0 flex-1 truncate">{field.name}</span>
          </label>
        )) : <p className="px-2 py-3 text-sm text-text-secondary">No fields to choose.</p>}
      </PopoverContent>
    </Popover>
  );
}

const shownFields = (data, objectId) => liveFieldsOf(data, objectId).filter((field) => field.type !== "attachments");

// Settings for each kind of block; every editor gets the block and returns the changed block through onChange.
export const BLOCK_EDITORS = {
  heading({ ctx, block, onChange }) {
    return (
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Row label="Text"><TemplateInput data={ctx.data} objectId={ctx.objectId} extra={ctx.extra} value={block.text} onChange={(text) => onChange({ ...block, text })} /></Row>
        <Row label="Size">
          <Select value={String(block.level ?? 1)} onValueChange={(level) => onChange({ ...block, level: Number(level) })}>
            <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">Large</SelectItem><SelectItem value="2">Medium</SelectItem><SelectItem value="3">Small</SelectItem></SelectContent>
          </Select>
        </Row>
        <Row label="Align"><AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} /></Row>
      </div>
    );
  },

  text({ ctx, block, onChange }) {
    return (
      <div className="space-y-3">
        <Row label="Text"><TemplateInput data={ctx.data} objectId={ctx.objectId} extra={ctx.extra} multiline rows={4} value={block.text} onChange={(text) => onChange({ ...block, text })} /></Row>
        <div className="flex flex-wrap items-end gap-4">
          <Row label="Size"><NumberInput value={block.size ?? 11} min={7} max={28} suffix="pt" onChange={(size) => onChange({ ...block, size })} /></Row>
          <Row label="Align"><AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} /></Row>
          <label className="flex h-9 items-center gap-2 text-sm"><Switch checked={block.bold === true} onCheckedChange={(bold) => onChange({ ...block, bold })} />Bold</label>
          <label className="flex h-9 items-center gap-2 text-sm"><Switch checked={block.muted === true} onCheckedChange={(muted) => onChange({ ...block, muted })} />Grey</label>
        </div>
      </div>
    );
  },

  field({ ctx, block, onChange }) {
    const fields = shownFields(ctx.data, ctx.objectId);
    return (
      <div className="flex flex-wrap items-end gap-3">
        <Row label="Field" className="min-w-48 flex-1">
          <Select value={block.fieldId ?? ""} onValueChange={(fieldId) => onChange({ ...block, fieldId })}>
            <SelectTrigger className="h-9"><SelectValue placeholder={ctx.objectId ? "Choose a field" : "Choose the document's list first"} /></SelectTrigger>
            <SelectContent>{fields.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
          </Select>
        </Row>
        <Row label="Align"><AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} /></Row>
        <label className="flex h-9 items-center gap-2 text-sm"><Switch checked={block.label !== false} onCheckedChange={(label) => onChange({ ...block, label })} />Show the field name</label>
      </div>
    );
  },

  image({ block, onChange }) {
    return (
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <Row label="Image address" hint="An https:// link to a PNG or JPEG, up to 5 MB.">
          <Input value={block.url ?? ""} placeholder="https://example.org/logo.png" onChange={(e) => onChange({ ...block, url: e.target.value })} />
        </Row>
        <Row label="Width"><NumberInput value={block.width ?? 40} min={5} max={250} suffix="mm" onChange={(width) => onChange({ ...block, width })} /></Row>
        <Row label="Align"><AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} /></Row>
      </div>
    );
  },

  qr({ ctx, block, onChange }) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <Row label="Holds" className="min-w-48 flex-1">
            <Select value={block.source ?? "text"} onValueChange={(source) => onChange({ ...block, source })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ctx.certificate ? <SelectItem value="verify">The certificate check link</SelectItem> : null}
                <SelectItem value="text">Text or a link I choose</SelectItem>
              </SelectContent>
            </Select>
          </Row>
          <Row label="Size"><NumberInput value={block.size ?? 30} min={12} max={90} suffix="mm" onChange={(size) => onChange({ ...block, size })} /></Row>
          <Row label="Align"><AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} /></Row>
        </div>
        {block.source === "verify" ? null : (
          <Row label="Text or link"><TemplateInput data={ctx.data} objectId={ctx.objectId} extra={ctx.extra} value={block.text} onChange={(text) => onChange({ ...block, text })} placeholder="{{record.link}}" /></Row>
        )}
        <Row label="Caption (optional)"><TemplateInput data={ctx.data} objectId={ctx.objectId} extra={ctx.extra} value={block.caption} onChange={(caption) => onChange({ ...block, caption })} /></Row>
      </div>
    );
  },

  signature({ ctx, block, onChange }) {
    return (
      <div className="space-y-3">
        <Row label="Signature image (optional)" hint="An https:// link to a PNG or JPEG. Leave empty to sign by hand.">
          <Input value={block.url ?? ""} placeholder="https://example.org/signature.png" onChange={(e) => onChange({ ...block, url: e.target.value })} />
        </Row>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Name"><TemplateInput data={ctx.data} objectId={ctx.objectId} extra={ctx.extra} value={block.name} onChange={(name) => onChange({ ...block, name })} placeholder="Dr Ana Ruiz" /></Row>
          <Row label="Role"><TemplateInput data={ctx.data} objectId={ctx.objectId} extra={ctx.extra} value={block.role} onChange={(role) => onChange({ ...block, role })} placeholder="Programme chair" /></Row>
        </div>
        <Row label="Align"><AlignPicker value={block.align} onChange={(align) => onChange({ ...block, align })} /></Row>
      </div>
    );
  },

  spacer({ block, onChange }) {
    return <Row label="Height"><NumberInput value={block.height ?? 8} min={1} max={150} suffix="mm" onChange={(height) => onChange({ ...block, height })} /></Row>;
  },

  divider() {
    return <p className="text-sm text-text-secondary">A thin line across the page.</p>;
  },

  table({ ctx, block, onChange }) {
    const links = liveFieldsOf(ctx.data, ctx.objectId).filter((field) => field.type === "link_record");
    const link = links.find((field) => field.id === block.linkFieldId);
    const columns = link ? shownFields(ctx.data, link.config.targetObjectId) : [];
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label="Records linked through">
            <Select value={block.linkFieldId ?? ""} onValueChange={(linkFieldId) => onChange({ ...block, linkFieldId, columns: [] })}>
              <SelectTrigger className="h-9"><SelectValue placeholder={links.length ? "Choose a link field" : "This list has no link fields"} /></SelectTrigger>
              <SelectContent>{links.map((field) => <SelectItem key={field.id} value={field.id}>{field.name}</SelectItem>)}</SelectContent>
            </Select>
          </Row>
          <Row label="Columns (up to 6)"><FieldChecklist fields={columns} value={block.columns} onChange={(next) => onChange({ ...block, columns: next.slice(0, 6) })} /></Row>
        </div>
        <Row label="Title (optional)"><TemplateInput data={ctx.data} objectId={ctx.objectId} extra={ctx.extra} value={block.title} onChange={(title) => onChange({ ...block, title })} /></Row>
      </div>
    );
  },
};
