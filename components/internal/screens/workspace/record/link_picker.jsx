"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { Input, Popover, PopoverContent, PopoverTrigger } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { workspaceApi } from "@/lib/workspace/client";
import { EVENT_TARGET_LABELS } from "../state/format";

// Search-and-pick for link fields; value is [{ kind, id, label }]. `api.lookup` swaps in the portal's search.
export function LinkPicker({ field, value, onChange, eventId, api }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const multiple = field.config.multiple ?? field.type === "link_record";
  const kind = field.type === "link_record" ? "record" : field.config.target;
  const noun = field.type === "link_record" ? "records" : `${(EVENT_TARGET_LABELS[kind] ?? "item").toLowerCase()}s`;

  useEffect(() => {
    if (!open) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = api?.lookup
          ? await api.lookup({ fieldId: field.id, q }, controller.signal)
          : await workspaceApi.lookup(eventId, { kind, objectId: field.config.targetObjectId, q }, controller.signal);
        setItems(data?.items ?? []);
      } catch {
        /* superseded by a newer search */
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [open, q, eventId, kind, field.id, field.config.targetObjectId, api]);

  const chosen = new Set(value.map((item) => item.id));
  const pick = (item) => {
    if (chosen.has(item.id)) return onChange(value.filter((link) => link.id !== item.id));
    const next = { kind: item.kind ?? kind, id: item.id, label: item.label, sub: item.sub };
    onChange(multiple ? [...value, next] : [next]);
    if (!multiple) setOpen(false);
    return undefined;
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {value.map((link) => (
        <span key={link.id} className={cn("inline-flex max-w-[16rem] items-center gap-1 rounded-md border border-border bg-surface-card py-0.5 pl-2 pr-1 text-sm",
          link.missing && "text-text-tertiary line-through")}>
          <span className="truncate">{link.label}</span>
          <button type="button" aria-label={`Remove ${link.label}`} className="rounded p-0.5 text-text-tertiary hover:text-foreground"
            onClick={() => onChange(value.filter((item) => item.id !== link.id))}>
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      {multiple || !value.length ? (
        <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQ(""); }}>
          <PopoverTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-sm text-text-secondary hover:text-foreground">
              <Plus className="h-3.5 w-3.5" />{value.length ? "Add" : `Choose ${multiple ? noun : noun.replace(/s$/, "")}`}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-2">
            <Input autoFocus placeholder={`Search ${noun}…`} value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="mt-2 max-h-64 overflow-y-auto">
              {loading && !items.length ? (
                <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin text-text-tertiary" /></div>
              ) : items.length ? items.map((item) => (
                <button key={item.id} type="button" onClick={() => pick(item)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-surface-subtle">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{item.label}</span>
                    {item.sub ? <span className="block truncate text-xs text-text-tertiary">{item.sub}</span> : null}
                  </span>
                  {chosen.has(item.id) ? <Check className="h-4 w-4 shrink-0 text-foreground" /> : null}
                </button>
              )) : (
                <p className="px-2 py-4 text-center text-sm text-text-tertiary">
                  {kind === "venue_space" ? "No rooms found. Set this event's venue to link its spaces." : `No ${noun} found.`}
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}
