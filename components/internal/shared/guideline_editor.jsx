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
import { EmptyState } from "./screen_kit";
import { GUIDELINE_CATEGORY_OPTIONS } from "@/components/internal/screens/registrations/constants";

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
                  <label
                    htmlFor={`${item.id}-category`}
                    className="text-xs font-medium text-text-secondary"
                  >
                    Category
                  </label>
                  <Select
                    value={item.category}
                    onValueChange={(v) => update(item.id, { category: v })}
                  >
                    <SelectTrigger id={`${item.id}-category`}>
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
                  <label
                    htmlFor={`${item.id}-label`}
                    className="text-xs font-medium text-text-secondary"
                  >
                    Guideline
                  </label>
                  <Input
                    id={`${item.id}-label`}
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
        <EmptyState
          icon={Accessibility}
          title="No guidelines yet"
          description="Add dietary and accessibility guidelines so every attendee knows what to expect."
          className="rounded-xl border border-dashed border-border bg-surface-card py-10"
        />
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
