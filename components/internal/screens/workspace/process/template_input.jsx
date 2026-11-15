"use client";

import { useRef, useState } from "react";
import { Bold, Braces, Italic, Link2, List, Underline } from "lucide-react";
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger, Input, Textarea,
} from "@geiger/ui";
import { SYSTEM_PLACEHOLDERS } from "@/lib/workspace/process/template.js";
import { liveFieldsOf } from "../state/use_workspace";

const SKIP = new Set(["attachments"]);

// Every placeholder a template on this list can use: its fields, one hop through links, and the system ones.
export function placeholderGroups(data, objectId, { payload = false } = {}) {
  const fields = objectId ? liveFieldsOf(data, objectId).filter((field) => !SKIP.has(field.type)) : [];
  const links = fields.filter((field) => field.type === "link_record").map((field) => ({
    field, target: data.objects.find((object) => object.id === field.config.targetObjectId),
    fields: liveFieldsOf(data, field.config.targetObjectId).filter((item) => !SKIP.has(item.type) && item.type !== "link_record"),
  })).filter((link) => link.target);
  return { fields, links, system: SYSTEM_PLACEHOLDERS, payload };
}

// "Insert field" menu; calls onPick with the {{Name}} text to insert. `extra` adds placeholders only some templates have.
export function PlaceholderMenu({ data, objectId, payload = false, extra = [], onPick, size = "sm" }) {
  const groups = placeholderGroups(data, objectId, { payload });
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size={size === "icon" ? "icon" : "sm"} className={size === "icon" ? "h-7 w-7" : "h-7 px-2 text-xs"} aria-label="Insert a field">
          <Braces className="h-3.5 w-3.5" />{size === "icon" ? null : "Insert field"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 w-60 overflow-y-auto">
        {groups.fields.length ? <DropdownMenuLabel>This record</DropdownMenuLabel> : null}
        {groups.fields.map((field) => (
          <DropdownMenuItem key={field.id} onSelect={() => onPick(`{{${field.name}}}`)}>{field.name}</DropdownMenuItem>
        ))}
        {groups.links.map((link) => (
          <DropdownMenuSub key={link.field.id}>
            <DropdownMenuSubTrigger><Link2 className="h-3.5 w-3.5" />{link.field.name}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="max-h-72 w-52 overflow-y-auto">
              {link.fields.map((field) => (
                <DropdownMenuItem key={field.id} onSelect={() => onPick(`{{${link.field.name}.${field.name}}}`)}>{field.name}</DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        ))}
        {groups.fields.length ? <DropdownMenuSeparator /> : null}
        <DropdownMenuLabel>General</DropdownMenuLabel>
        {groups.system.filter((item) => objectId || !item.key.startsWith("record.")).map((item) => (
          <DropdownMenuItem key={item.key} onSelect={() => onPick(`{{${item.key}}}`)}>{item.label}</DropdownMenuItem>
        ))}
        {extra.map((item) => <DropdownMenuItem key={item.key} onSelect={() => onPick(`{{${item.key}}}`)}>{item.label}</DropdownMenuItem>)}
        {payload ? <DropdownMenuItem onSelect={() => onPick("{{payload.}}")}>A value from the request…</DropdownMenuItem> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// A one-line or multi-line text that can hold placeholders; inserts at the caret.
export function TemplateInput({ data, objectId, payload, extra, value, onChange, multiline = false, rows = 3, placeholder, id, maxLength }) {
  const ref = useRef(null);
  const insert = (text) => {
    const input = ref.current;
    const current = value ?? "";
    const start = input?.selectionStart ?? current.length;
    const end = input?.selectionEnd ?? current.length;
    onChange(`${current.slice(0, start)}${text}${current.slice(end)}`);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(start + text.length, start + text.length);
    });
  };
  const Field = multiline ? Textarea : Input;
  return (
    <div className="relative">
      <Field ref={ref} id={id} value={value ?? ""} placeholder={placeholder} maxLength={maxLength} {...(multiline ? { rows } : {})}
        onChange={(event) => onChange(event.target.value)} className={multiline ? "pr-10" : "pr-10"} />
      <div className={multiline ? "absolute right-1.5 top-1.5" : "absolute right-1.5 top-1/2 -translate-y-1/2"}>
        <PlaceholderMenu data={data} objectId={objectId} payload={payload} extra={extra} onPick={insert} size="icon" />
      </div>
    </div>
  );
}

// Formatted text (emails) with placeholders inserted at the caret.
export function TemplateRichText({ data, objectId, payload, value, onChange }) {
  const ref = useRef(null);
  const [initial] = useState(value ?? "");
  const sync = () => onChange(ref.current?.innerHTML ?? "");
  const exec = (command, arg) => {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    sync();
  };
  const tools = [["bold", Bold, "Bold"], ["italic", Italic, "Italic"], ["underline", Underline, "Underline"], ["insertUnorderedList", List, "Bullet list"]];
  return (
    <div className="rounded-lg border border-border bg-surface-card">
      <div className="flex items-center gap-1 border-b border-border p-1">
        {tools.map(([command, Icon, label]) => (
          <Button key={command} type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={label}
            onMouseDown={(event) => { event.preventDefault(); exec(command); }}>
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
        <div className="ml-auto"><PlaceholderMenu data={data} objectId={objectId} payload={payload} onPick={(text) => exec("insertText", text)} /></div>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
        className="prose prose-sm min-h-36 max-w-none px-3 py-2 text-sm text-foreground outline-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: initial }} onInput={sync} />
    </div>
  );
}
