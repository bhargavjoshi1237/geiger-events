"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button, Input, Popover, PopoverContent, PopoverTrigger } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { COLOR_NAMES, COLOR_SWATCH, newOptionId } from "../state/format";

// Editable list of { id|key, label, color } rows — used for select options and list statuses.
export function OptionsEditor({ items, onChange, idKey = "id", addLabel = "Add option", placeholder = "Option name", makeId = newOptionId }) {
  const update = (index, patch) => onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  const move = (index, delta) => {
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((item, index) => (
        <div key={item[idKey] ?? index} className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <button type="button" aria-label="Choose a colour" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                <span className={cn("h-3.5 w-3.5 rounded-full", COLOR_SWATCH[item.color] ?? COLOR_SWATCH.gray)} />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-auto p-2">
              <div className="grid grid-cols-4 gap-1.5">
                {COLOR_NAMES.map((color) => (
                  <button key={color} type="button" aria-label={color} onClick={() => update(index, { color })}
                    className={cn("flex h-7 w-7 items-center justify-center rounded-md border", item.color === color ? "border-foreground" : "border-transparent hover:border-border")}>
                    <span className={cn("h-4 w-4 rounded-full", COLOR_SWATCH[color])} />
                  </button>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Input value={item.label} placeholder={placeholder} maxLength={100} onChange={(e) => update(index, { label: e.target.value })} />
          <div className="flex shrink-0">
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Move up" disabled={index === 0} onClick={() => move(index, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Move down" disabled={index === items.length - 1} onClick={() => move(index, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label="Remove" onClick={() => onChange(items.filter((_, i) => i !== index))}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => onChange([...items, { [idKey]: makeId(), label: "", color: COLOR_NAMES[items.length % COLOR_NAMES.length] }])}>
        <Plus className="h-4 w-4" />{addLabel}
      </Button>
    </div>
  );
}
