"use client";

import { createElement } from "react";
import { Check, Lock, Paperclip, Star } from "lucide-react";
import { LucideIcon } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { OPTION_COLORS, optionOf, typeIcon, valueText } from "./state/format";

export function ObjectIcon({ icon, className = "h-4 w-4" }) {
  return <LucideIcon name={icon || "database"} className={className} />;
}

// A field type's icon (the lookup returns a static lucide component).
export function TypeIcon({ type, className = "h-3.5 w-3.5" }) {
  return createElement(typeIcon(type), { className });
}

// One stable icon component per icon name, so nav items and header bars don't remount it on every render.
const iconCache = new Map();
export function iconFor(name) {
  if (!iconCache.has(name)) {
    const Icon = (props) => <LucideIcon name={name || "database"} {...props} />;
    Icon.displayName = `WorkspaceIcon(${name})`;
    iconCache.set(name, Icon);
  }
  return iconCache.get(name);
}

export function OptionChip({ option, className }) {
  if (!option) return null;
  return (
    <span className={cn("inline-flex max-w-full items-center truncate rounded-md border px-1.5 py-0.5 text-xs font-medium", OPTION_COLORS[option.color] ?? OPTION_COLORS.gray, className)}>
      {option.label}
    </span>
  );
}

// Event links (tickets, orders) carry a detail line: status, total, check-in time.
const DETAILED = new Set(["ticket", "order"]);

export function LinkChip({ link, onClick, detail = false }) {
  const sub = DETAILED.has(link.kind) ? link.sub : "";
  return (
    <button type="button" onClick={onClick} disabled={!onClick} title={link.restricted ? "You can't open this record" : sub || undefined}
      className={cn("inline-flex items-center gap-1 truncate rounded-md border border-border bg-surface-card px-1.5 py-0.5 text-xs text-foreground",
        detail && sub ? "max-w-full" : "max-w-[14rem]",
        link.missing && "text-text-tertiary line-through", link.restricted && "text-text-tertiary", onClick && "hover:bg-surface-active")}>
      {link.restricted && !link.missing ? <Lock className="h-3 w-3 shrink-0" /> : null}
      <span className="truncate">{link.label}</span>
      {detail && sub ? <span className="truncate text-text-tertiary">· {sub}</span> : null}
    </button>
  );
}

export function Muted({ children, className }) {
  return <span className={cn("text-text-tertiary", className)}>{children}</span>;
}

async function openFile(eventId, file) {
  const { data } = await workspaceApi.download(eventId, file.id);
  if (data?.url) window.open(data.url, "_blank", "noopener,noreferrer");
}

// Read-only rendering of one field's value inside a table cell, card or record sheet. The portal passes onOpenFile and onOpenLink.
export function FieldValue({ field, record, eventId, timeZone, onOpenRecord, onOpenLink, onOpenFile, compact = true }) {
  const openLink = onOpenLink ?? (onOpenRecord ? (link) => onOpenRecord(link.id) : null);
  const value = record.values?.[field.id];
  const computed = record.computed?.[field.id];
  switch (field.type) {
    case "single_select":
      return <OptionChip option={optionOf(field, value)} />;
    case "multi_select": {
      const options = (value ?? []).map((id) => optionOf(field, id)).filter(Boolean);
      if (!compact) {
        return <span className="flex flex-wrap gap-1">{options.map((option) => <OptionChip key={option.id} option={option} />)}</span>;
      }
      // Lists and cards keep one line: the first two chips, then a +N count, so a long selection never grows the row.
      const rest = options.length - 2;
      return (
        <span className="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden" title={options.map((option) => option.label).join(", ")}>
          {options.slice(0, 2).map((option) => <OptionChip key={option.id} option={option} className="min-w-0" />)}
          {rest > 0 ? <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-xs font-medium tabular-nums text-text-secondary">+{rest}</span> : null}
        </span>
      );
    }
    case "checkbox":
      return value ? <Check className="h-4 w-4 text-foreground" aria-label="Yes" /> : null;
    case "rating":
      return value ? (
        <span className="inline-flex items-center gap-0.5" aria-label={`${value} of ${field.config.max ?? 5}`}>
          {Array.from({ length: field.config.max ?? 5 }, (_, i) => (
            <Star key={i} className={cn("h-3.5 w-3.5", i < value ? "fill-amber-400 text-amber-400" : "text-border")} />
          ))}
        </span>
      ) : null;
    case "link_record":
    case "link_event": {
      const links = record.links?.[field.id] ?? [];
      return (
        <span className={cn("flex gap-1", compact ? "flex-nowrap overflow-hidden" : "flex-wrap")}>
          {links.map((link, index) => (
            <LinkChip key={link.id ? `${link.kind}:${link.id}` : `hidden-${index}`} link={link} detail={!compact}
              onClick={link.kind === "record" && openLink && !link.missing && !link.restricted ? (event) => { event.stopPropagation(); openLink(link); } : undefined} />
          ))}
        </span>
      );
    }
    case "attachments": {
      const files = value ?? [];
      if (!files.length) return null;
      if (compact) {
        return <span className="inline-flex items-center gap-1 text-sm text-text-secondary"><Paperclip className="h-3.5 w-3.5" />{files.length === 1 ? files[0].name : `${files.length} files`}</span>;
      }
      return (
        <span className="flex flex-col gap-1">
          {files.map((file) => (
            <button key={file.id} type="button" onClick={() => (onOpenFile ? onOpenFile(file, field) : openFile(eventId, file))}
              className="inline-flex items-center gap-1.5 text-left text-sm text-foreground underline-offset-2 hover:underline">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-text-secondary" /><span className="truncate">{file.name}</span>
            </button>
          ))}
        </span>
      );
    }
    case "email":
      return value ? <a href={`mailto:${value}`} onClick={(e) => e.stopPropagation()} className="truncate text-foreground underline-offset-2 hover:underline">{value}</a> : null;
    case "url":
      return value ? <a href={value} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="truncate text-foreground underline-offset-2 hover:underline">{value.replace(/^https?:\/\//, "")}</a> : null;
    case "rich_text":
      if (!value) return null;
      return compact
        ? <span className="truncate">{valueText(field, value)}</span>
        : <div className="prose prose-sm max-w-none text-foreground dark:prose-invert" dangerouslySetInnerHTML={{ __html: value }} />;
    case "long_text":
      return value ? <span className={compact ? "truncate" : "whitespace-pre-wrap"}>{value}</span> : null;
    default: {
      const text = valueText(field, value, { timeZone, computed: ["lookup", "rollup"].includes(field.type) ? computed : undefined });
      return text ? <span className={cn("truncate", ["number", "currency", "percent", "rollup", "duration"].includes(field.type) && "tabular-nums")}>{text}</span> : null;
    }
  }
}
