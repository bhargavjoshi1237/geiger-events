"use client";

import { useRef, useState } from "react";
import { Bold, Italic, List, Loader2, Paperclip, Star, Trash2, Underline, Upload } from "lucide-react";
import {
  Button, Checkbox, Input, Popover, PopoverContent, PopoverTrigger, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, Textarea,
} from "@geiger/ui";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { createClient } from "@/lib/supabase/client";
import { countWords } from "@/lib/workspace/schema/types/text.js";
import { formatDuration, parseDuration } from "@/lib/workspace/schema/types/time.js";
import { localInputToUtc, optionOf, utcToLocalInput } from "../state/format";
import { OptionChip, Muted } from "../ws_ui";
import { LinkPicker } from "./link_picker";

const NONE = "__none__";

// Editable control for one field. `value` is the stored shape (link fields take [{ kind, id, label }]). The portal passes
// `api` ({ lookup, signUpload }) so searches and uploads go through its own routes.
export function FieldInput({ field, value, onChange, eventId, timeZone, autoFocus, id, api }) {
  const config = field.config ?? {};
  switch (field.type) {
    case "short_text":
    case "email":
    case "phone":
    case "url":
      return <Input id={id} autoFocus={autoFocus} value={value ?? ""} onChange={(e) => onChange(e.target.value)}
        type={field.type === "email" ? "email" : field.type === "url" ? "url" : field.type === "phone" ? "tel" : "text"}
        maxLength={field.type === "short_text" ? config.maxLength : undefined} />;
    case "long_text":
      return (
        <div className="space-y-1">
          <Textarea id={id} autoFocus={autoFocus} rows={5} value={value ?? ""} onChange={(e) => onChange(e.target.value)} maxLength={config.maxChars} />
          {config.maxWords ? (
            <p className={cn("text-xs", countWords(value ?? "") > config.maxWords ? "text-red-600 dark:text-red-400" : "text-text-tertiary")}>
              {countWords(value ?? "")} of {config.maxWords} words
            </p>
          ) : null}
        </div>
      );
    case "rich_text":
      return <RichTextInput value={value ?? ""} onChange={onChange} />;
    case "number":
    case "currency":
    case "percent":
      return (
        <div className="relative">
          <Input id={id} autoFocus={autoFocus} type="number" inputMode="decimal" value={value ?? ""}
            step={field.type === "currency" ? "0.01" : config.decimals ? String(10 ** -config.decimals) : "1"}
            min={config.min} max={config.max}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />
          {field.type !== "number" ? (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-tertiary">
              {field.type === "percent" ? "%" : config.currency}
            </span>
          ) : null}
        </div>
      );
    case "rating":
      return (
        <div className="flex items-center gap-1">
          {Array.from({ length: config.max ?? 5 }, (_, i) => (
            <button key={i} type="button" aria-label={`${i + 1} of ${config.max ?? 5}`} onClick={() => onChange(value === i + 1 ? null : i + 1)}>
              <Star className={cn("h-5 w-5", i < (value ?? 0) ? "fill-amber-400 text-amber-400" : "text-border hover:text-amber-300")} />
            </button>
          ))}
        </div>
      );
    case "single_select":
      return (
        <Select value={value ?? NONE} onValueChange={(next) => onChange(next === NONE ? null : next)}>
          <SelectTrigger id={id} className="w-full"><SelectValue placeholder="Choose…" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}><Muted>None</Muted></SelectItem>
            {(config.options ?? []).map((option) => (
              <SelectItem key={option.id} value={option.id}><OptionChip option={option} /></SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    case "multi_select":
      return <MultiSelectInput field={field} value={value ?? []} onChange={onChange} />;
    case "checkbox":
      return <Switch id={id} checked={Boolean(value)} onCheckedChange={(checked) => onChange(checked)} />;
    case "date":
      return <Input id={id} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />;
    case "datetime":
      return (
        <div className="space-y-1">
          <Input id={id} type="datetime-local" value={utcToLocalInput(value, timeZone)} onChange={(e) => onChange(localInputToUtc(e.target.value, timeZone))} />
          <p className="text-xs text-text-tertiary">Times are in the event&apos;s time zone ({timeZone}).</p>
        </div>
      );
    case "duration":
      return <DurationInput id={id} value={value} onChange={onChange} />;
    case "link_record":
    case "link_event":
      if (api && field.type === "link_event") return <Muted className="text-sm">Set by the organisers.</Muted>;
      return <LinkPicker field={field} value={value ?? []} onChange={onChange} eventId={eventId} api={api} />;
    case "attachments":
      return <AttachmentsInput field={field} value={value ?? []} onChange={onChange} eventId={eventId} api={api} />;
    default:
      return <Muted className="text-sm">Calculated automatically.</Muted>;
  }
}

function DurationInput({ id, value, onChange }) {
  const [text, setText] = useState(() => formatDuration(value));
  return (
    <Input id={id} value={text} placeholder="1:30" onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (!text.trim()) return onChange(null);
        const seconds = parseDuration(text);
        if (seconds === undefined) { toast.error("Enter a duration like 1:30 or 90."); return undefined; }
        setText(formatDuration(seconds));
        return onChange(seconds);
      }} />
  );
}

function MultiSelectInput({ field, value, onChange }) {
  const options = field.config.options ?? [];
  const toggle = (id) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="flex min-h-10 w-full flex-wrap items-center gap-1 rounded-lg border border-border bg-surface-card px-3 py-1.5 text-left text-sm">
          {value.length ? value.map((id) => <OptionChip key={id} option={optionOf(field, id)} />) : <Muted>Choose…</Muted>}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 bg-surface-card p-1">
        <div className="max-h-64 overflow-y-auto">
          {options.map((option) => (
            <label key={option.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover">
              <Checkbox checked={value.includes(option.id)} onCheckedChange={() => toggle(option.id)} />
              <OptionChip option={option} />
            </label>
          ))}
          {!options.length ? <p className="px-2 py-3 text-sm text-text-tertiary">No options yet.</p> : null}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Minimal formatted text: bold, italic, underline and bullet lists. The server cleans the markup on save.
function RichTextInput({ value, onChange }) {
  const ref = useRef(null);
  const [initial] = useState(value);
  const exec = (command) => {
    ref.current?.focus();
    document.execCommand(command);
    onChange(ref.current?.innerHTML ?? "");
  };
  const tools = [["bold", Bold, "Bold"], ["italic", Italic, "Italic"], ["underline", Underline, "Underline"], ["insertUnorderedList", List, "Bullet list"]];
  return (
    <div className="rounded-lg border border-border bg-surface-card">
      <div className="flex gap-1 border-b border-border p-1">
        {tools.map(([command, Icon, label]) => (
          <Button key={command} type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={label}
            onMouseDown={(event) => { event.preventDefault(); exec(command); }}>
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true"
        className="prose prose-sm min-h-28 max-w-none px-3 py-2 text-sm text-foreground outline-none dark:prose-invert"
        dangerouslySetInnerHTML={{ __html: initial }}
        onInput={(event) => onChange(event.currentTarget.innerHTML)} />
    </div>
  );
}

function AttachmentsInput({ field, value, onChange, eventId, api }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  const max = field.config.maxFiles ?? 10;
  const upload = async (files) => {
    if (!files.length) return;
    if (value.length + files.length > max) { toast.error(`Attach up to ${max} files.`); return; }
    setBusy(true);
    const added = [];
    try {
      for (const file of files) {
        const body = { fieldId: field.id, name: file.name, size: file.size, type: file.type || "application/octet-stream" };
        const { data, error } = api?.signUpload ? await api.signUpload(body) : await workspaceApi.signUpload(eventId, body);
        if (error) { toast.error(error.message); continue; }
        const { error: uploadError } = await createClient().storage.from("workspace").uploadToSignedUrl(data.path, data.token, file, { contentType: data.file.type });
        if (uploadError) { toast.error(`Couldn't upload ${file.name}.`); continue; }
        added.push(data.file);
      }
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
    if (added.length) onChange([...value, ...added]);
  };
  return (
    <div className="space-y-2">
      {value.map((file) => (
        <div key={file.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2 text-sm">
          <Paperclip className="h-4 w-4 shrink-0 text-text-secondary" />
          <span className="min-w-0 flex-1 truncate">{file.name}</span>
          <span className="shrink-0 text-xs text-text-tertiary">{Math.max(1, Math.round(file.size / 1024)).toLocaleString()} KB</span>
          <Button type="button" size="icon" variant="ghost" className="h-7 w-7" aria-label={`Remove ${file.name}`}
            onClick={() => onChange(value.filter((item) => item.id !== file.id))}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
      <input ref={input} type="file" multiple={max > 1} className="hidden" accept={field.config.accept?.join(",")}
        onChange={(event) => upload([...event.target.files])} />
      {value.length < max ? (
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => input.current?.click()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? "Uploading…" : "Add files"}
        </Button>
      ) : null}
    </div>
  );
}
