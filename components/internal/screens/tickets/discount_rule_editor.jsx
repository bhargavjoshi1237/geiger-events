"use client";

import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  GripVertical,
  Plus,
  Receipt,
  Sparkles,
  Ticket,
  Trash2,
} from "lucide-react";

import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { Field } from "@/components/internal/shared/screen_kit";
import { Segmented } from "./controls";
import { DISCOUNT_RULE_PRESETS } from "./constants";
import {
  EMPTY_DISCOUNT_RULE,
  normalizeRule,
  ruleConditionLabel,
  ruleValueLabel,
} from "@/lib/events/discount_rules";

// The ordered rule list that decides how much a coupon actually gives.
//
// Rules are evaluated top-down and the FIRST match wins, so position is the
// whole point of this control: the organiser drags the most specific rule
// (say "5+ tickets → 25%") above the general one ("any quantity → 10%").
// Anything that matches nothing falls through to the coupon's base discount,
// which is shown at the bottom as the catch-all.
//
// Reordering is native HTML5 drag-and-drop plus explicit up/down buttons —
// the buttons keep it usable on touch and with a keyboard, where HTML5 dnd
// does not reach.
function RuleCard({ rule, index, total, onChange, onRemove, onMove, drag, setDrag }) {
  const r = normalizeRule(rule);
  const patch = (p) => onChange({ ...r, ...p });
  const [dragOver, setDragOver] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        setDrag(index);
        e.dataTransfer.effectAllowed = "move";
        // Firefox refuses to start a drag without payload.
        e.dataTransfer.setData("text/plain", String(index));
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const from = drag ?? Number(e.dataTransfer.getData("text/plain"));
        if (Number.isInteger(from)) onMove(from, index);
        setDrag(null);
      }}
      onDragEnd={() => {
        setDragOver(false);
        setDrag(null);
      }}
      className={cn(
        "rounded-lg border border-border bg-surface-subtle transition-colors",
        dragOver && "border-primary/60 bg-surface-hover",
        drag === index && "opacity-50",
      )}
    >
      <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
        <span
          className="cursor-grab text-text-tertiary active:cursor-grabbing"
          title="Drag to reorder"
          aria-hidden
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-active text-[11px] font-semibold tabular-nums text-foreground">
          {index + 1}
        </span>
        <Input
          value={r.label}
          onChange={(e) => patch({ label: e.target.value })}
          placeholder={`Rule ${index + 1}`}
          className="h-8 flex-1 border-transparent bg-transparent px-1.5"
          aria-label={`Rule ${index + 1} name`}
        />
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-text-secondary hover:text-foreground"
            disabled={index === 0}
            onClick={() => onMove(index, index - 1)}
            aria-label="Move rule up"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-text-secondary hover:text-foreground"
            disabled={index === total - 1}
            onClick={() => onMove(index, index + 1)}
            aria-label="Move rule down"
          >
            <ArrowDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-text-secondary hover:text-destructive"
            onClick={onRemove}
            aria-label="Delete rule"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 p-3 sm:grid-cols-2">
        <Field label="Min. tickets" hint="Blank = no lower bound.">
          <Input
            type="number"
            min={0}
            className="tabular-nums"
            value={r.minQty ?? ""}
            onChange={(e) =>
              patch({ minQty: e.target.value === "" ? null : Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Max. tickets" hint="Blank = no upper bound.">
          <Input
            type="number"
            min={0}
            className="tabular-nums"
            value={r.maxQty ?? ""}
            onChange={(e) =>
              patch({ maxQty: e.target.value === "" ? null : Number(e.target.value) || 0 })
            }
          />
        </Field>
        <Field label="Valid from">
          <Input
            type="datetime-local"
            value={r.validFrom || ""}
            onChange={(e) => patch({ validFrom: e.target.value })}
          />
        </Field>
        <Field label="Valid until">
          <Input
            type="datetime-local"
            value={r.validUntil || ""}
            onChange={(e) => patch({ validUntil: e.target.value })}
          />
        </Field>
        <Field label="Discount" className="sm:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={r.discountType}
              onValueChange={(v) => patch({ discountType: v })}
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">% off</SelectItem>
                <SelectItem value="flat">$ off</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min={0}
              value={r.value ?? 0}
              onChange={(e) => patch({ value: Number(e.target.value) || 0 })}
              className="w-24 tabular-nums"
            />
            {r.discountType === "flat" ? (
              <Segmented
                value={r.applyPer}
                onChange={(v) => patch({ applyPer: v })}
                options={[
                  { value: "order", label: "Per order", icon: Receipt },
                  { value: "ticket", label: "Per ticket", icon: Ticket },
                ]}
              />
            ) : null}
          </div>
        </Field>
      </div>

      <p className="border-t border-border px-3 py-1.5 text-[11px] text-text-tertiary">
        Applies when: {ruleConditionLabel(r)} → {ruleValueLabel(r)}
      </p>
    </div>
  );
}

export function DiscountRuleEditor({ rules, onChange, baseLabel }) {
  const [drag, setDrag] = useState(null);
  const list = Array.isArray(rules) ? rules : [];

  const set = (next) => onChange(next);

  const addRule = (preset) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `rule-${Date.now()}-${list.length}`;
    set([...list, { ...EMPTY_DISCOUNT_RULE, id, ...(preset || {}) }]);
  };

  const update = (i, rule) => set(list.map((r, idx) => (idx === i ? rule : r)));
  const remove = (i) => set(list.filter((_, idx) => idx !== i));

  const move = (from, to) => {
    if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length)
      return;
    const next = [...list];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    set(next);
  };

  return (
    <div className="space-y-3">
      {list.length ? (
        <div className="space-y-2.5">
          {list.map((rule, i) => (
            <RuleCard
              key={rule.id || i}
              rule={rule}
              index={i}
              total={list.length}
              onChange={(next) => update(i, next)}
              onRemove={() => remove(i)}
              onMove={move}
              drag={drag}
              setDrag={setDrag}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border bg-surface-subtle px-4 py-6 text-center">
          <p className="text-sm text-text-secondary">No rules yet</p>
          <p className="mt-0.5 text-xs text-text-tertiary">
            Every order gets the base discount below. Add a rule to change the
            amount by quantity or date.
          </p>
        </div>
      )}

      {list.length ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-card px-3 py-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-active text-[11px] font-semibold tabular-nums text-text-tertiary">
            {list.length + 1}
          </span>
          <span className="text-xs text-text-secondary">
            {list.length === 1 ? "No rule matches" : "No rule above matches"} →
            base discount ({baseLabel || "0"})
          </span>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => addRule()}
          className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <Plus className="h-4 w-4" /> Add rule
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-text-secondary hover:bg-surface-active hover:text-foreground"
            >
              <Sparkles className="h-4 w-4" /> Start from a preset{" "}
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-64 border-border bg-surface-card shadow-xl"
          >
            <DropdownMenuLabel className="text-xs text-text-tertiary">
              Presets
            </DropdownMenuLabel>
            {DISCOUNT_RULE_PRESETS.map((p) => (
              <DropdownMenuItem
                key={p.label}
                className="cursor-pointer text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                onClick={() => addRule(p.rule)}
              >
                {p.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export default DiscountRuleEditor;
