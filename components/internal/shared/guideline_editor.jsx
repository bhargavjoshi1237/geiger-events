"use client";

import React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Accessibility } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GUIDELINE_CATEGORY_OPTIONS } from "@/components/internal/screens/registrations/constants";

// Controlled editor for a list of dietary & accessibility guideline items —
// reused by the venue and event guideline sections. Each item is
// { id, category: 'dietary' | 'accessibility', label, detail }. Fully
// controlled: the parent owns persistence (mergeVenueMeta / useEventConfig).

const newItem = () => ({
  id: crypto.randomUUID(),
  category: "dietary",
  label: "",
  detail: "",
});

export function GuidelineListEditor({ items = [], onChange }) {
  const update = (id, patch) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  const remove = (id) => onChange(items.filter((it) => it.id !== id));
  const add = () => onChange([...items, newItem()]);
  const move = (index, dir) => {
    const j = index + dir;
    if (j < 0 || j >= items.length) return;
    const next = [...items];
    [next[index], next[j]] = [next[j], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {items.length ? (
        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-surface-card p-3"
            >
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    Category
                  </span>
                  <Select
                    value={item.category}
                    onValueChange={(v) => update(item.id, { category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GUIDELINE_CATEGORY_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-text-secondary">
                    Guideline
                  </span>
                  <Input
                    value={item.label}
                    onChange={(e) => update(item.id, { label: e.target.value })}
                    placeholder="e.g. Step-free entrance on North St"
                  />
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2">
                <Textarea
                  rows={2}
                  value={item.detail}
                  onChange={(e) => update(item.id, { detail: e.target.value })}
                  placeholder="Optional detail shown beneath the guideline."
                  className="flex-1"
                />
                <div className="flex flex-col gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                    aria-label="Move up"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={i === items.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(item.id)}
                    aria-label="Remove guideline"
                    className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary">
          <Accessibility className="h-6 w-6" />
          <p className="text-sm">No guidelines yet</p>
        </div>
      )}

      <Button
        size="sm"
        variant="outline"
        onClick={add}
        className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
      >
        <Plus className="h-4 w-4" /> Add guideline
      </Button>
    </div>
  );
}

export default GuidelineListEditor;
