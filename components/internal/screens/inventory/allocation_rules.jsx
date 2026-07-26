"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERIOD_MODE_MAP, PERIOD_MODE_OPTIONS } from "@/lib/inventory/entitlements";
import { itemLabel, qty } from "./constants";
import { ItemThumb } from "./item_image";

// Two pieces of allocation configuration that are too involved to sit inline in
// the allocate dialog: the collection rule (how often someone may collect) and
// publishing the item as a paid add-on.

// --- Collection rule ---------------------------------------------------------

// `value` is { periodMode, periodConfig }. Windows are named time ranges; a
// collection is unique per window and only possible while one is open.
export function PeriodEditor({ value, onChange }) {
  const mode = value?.periodMode || "none";
  const config = value?.periodConfig || {};
  const windows = Array.isArray(config.windows) ? config.windows : [];

  const setConfig = (patch) =>
    onChange({ periodMode: mode, periodConfig: { ...config, ...patch } });

  const setWindow = (id, patch) =>
    setConfig({ windows: windows.map((w) => (w.id === id ? { ...w, ...patch } : w)) });

  const addWindow = () =>
    setConfig({
      windows: [
        ...windows,
        { id: crypto.randomUUID(), label: `Window ${windows.length + 1}`, startAt: "", endAt: "" },
      ],
    });

  return (
    <div className="space-y-4">
      <Field label="Collection rule" hint={PERIOD_MODE_MAP[mode]?.hint}>
        <Select
          value={mode}
          onValueChange={(v) => onChange({ periodMode: v, periodConfig: config })}
        >
          <SelectTrigger className="bg-surface-card">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_MODE_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      {mode === "rolling" ? (
        <Field label="Wait between collections" hint="Hours before the next one is allowed.">
          <Input
            type="number"
            min="0"
            value={config.intervalHours ?? ""}
            placeholder="e.g. 2"
            onChange={(e) => setConfig({ intervalHours: e.target.value })}
            className="bg-surface-card"
          />
        </Field>
      ) : null}

      {mode === "window" ? (
        <Field
          label="Windows"
          hint="Staff can only issue while one of these is open."
        >
          <div className="space-y-2">
            {windows.map((w) => (
              <div
                key={w.id}
                className="grid gap-2 rounded-lg border border-border bg-surface-card p-2.5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center"
              >
                <Input
                  value={w.label || ""}
                  onChange={(e) => setWindow(w.id, { label: e.target.value })}
                  placeholder="Lunch, Friday"
                  className="bg-surface-subtle"
                />
                <Input
                  type="datetime-local"
                  value={w.startAt || ""}
                  onChange={(e) => setWindow(w.id, { startAt: e.target.value })}
                  className="bg-surface-subtle"
                />
                <Input
                  type="datetime-local"
                  value={w.endAt || ""}
                  onChange={(e) => setWindow(w.id, { endAt: e.target.value })}
                  className="bg-surface-subtle"
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove window"
                  onClick={() => setConfig({ windows: windows.filter((x) => x.id !== w.id) })}
                  className="text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              variant="outline"
              size="sm"
              onClick={addWindow}
              className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add window
            </Button>
          </div>
        </Field>
      ) : null}

      <Field
        label="Total cap"
        hint="Lifetime maximum per attendee, whatever the rule above. Leave blank for none."
      >
        <Input
          type="number"
          min="0"
          value={config.totalCap ?? ""}
          placeholder="No cap"
          onChange={(e) => setConfig({ totalCap: e.target.value })}
          className="bg-surface-card"
        />
      </Field>
    </div>
  );
}

// --- Session picker ----------------------------------------------------------

export function SessionPicker({ sessions, selected, onToggle }) {
  if (!sessions.length) {
    return (
      <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-tertiary">
        No sessions yet — build the schedule under Conference → Agenda Builder.
      </p>
    );
  }
  return (
    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-surface-card p-2">
      {sessions.map((s) => (
        <label
          key={s.id}
          className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-hover"
        >
          <Checkbox
            checked={selected.includes(s.id)}
            onCheckedChange={() => onToggle(s.id)}
          />
          {s.name || "Untitled session"}
        </label>
      ))}
    </div>
  );
}

// --- Sell as an add-on -------------------------------------------------------

// Publishes the allocation's item into the event's checkout add-ons. Selling
// reserves stock; the negative movement is written only at hand-out.
export function SellAddonDialog({
  open,
  onOpenChange,
  allocation,
  item,
  allItems,
  available,
  onPublish,
  onUnpublish,
  pending,
}) {
  const sale = allocation?.config?.sale || {};
  const published = Boolean(sale.published);
  const [name, setName] = useState(sale.name || itemLabel(item));
  const [description, setDescription] = useState(sale.description || "");
  const [price, setPrice] = useState(String(sale.price ?? item?.unitPrice ?? ""));
  const [stock, setStock] = useState(
    sale.stock === null || sale.stock === undefined ? String(available ?? "") : String(sale.stock),
  );
  const [allowMultiple, setAllowMultiple] = useState(Boolean(sale.allowMultiple));
  const [maxPerOrder, setMaxPerOrder] = useState(
    sale.maxPerOrder == null ? "" : String(sale.maxPerOrder),
  );

  const capWarning = useMemo(() => {
    const cap = Number(stock);
    return stock !== "" && Number.isFinite(cap) && cap > Number(available || 0);
  }, [stock, available]);

  const submit = () => {
    if (!name.trim()) {
      toast.error("Give the add-on a name.");
      return;
    }
    onPublish({
      name: name.trim(),
      description: description.trim(),
      price: Number(price) || 0,
      stock: stock === "" ? null : Number(stock) || 0,
      allowMultiple,
      maxPerOrder: maxPerOrder === "" ? null : Number(maxPerOrder) || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{published ? "Add-on settings" : "Sell as an add-on"}</DialogTitle>
          <DialogDescription>
            Puts this item in the event&apos;s checkout add-ons. Buying it entitles
            the buyer; stock only leaves the shelf when they collect it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2">
            <ItemThumb item={item} items={allItems} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {itemLabel(item)}
              </p>
              <p className="text-xs text-text-secondary">
                {qty(available)} available to promise
              </p>
            </div>
          </div>

          <Field label="Add-on name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-surface-card"
            />
          </Field>

          <Field label="Description" hint="Shown to buyers at checkout. Optional.">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Official event tee, unisex sizing"
              className="bg-surface-card"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price">
              <Input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="bg-surface-card"
              />
            </Field>
            <Field
              label="Checkout cap"
              hint="How many may be sold. Defaults to what's available."
            >
              <Input
                type="number"
                min="0"
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                placeholder="No cap"
                className="bg-surface-card"
              />
            </Field>
          </div>

          {capWarning ? (
            <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              That cap is higher than the {qty(available)} you can currently promise —
              you may oversell unless you receive more stock.
            </p>
          ) : null}

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-foreground">Allow buying several</p>
              <p className="text-xs text-text-secondary">
                Buyers get a quantity stepper instead of a simple toggle.
              </p>
            </div>
            <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
          </div>

          {allowMultiple ? (
            <Field label="Max per order" hint="Leave blank for no limit.">
              <Input
                type="number"
                min="1"
                value={maxPerOrder}
                onChange={(e) => setMaxPerOrder(e.target.value)}
                placeholder="No limit"
                className="bg-surface-card"
              />
            </Field>
          ) : null}
        </div>

        <DialogFooter className="sm:justify-between">
          {published ? (
            <Button
              variant="ghost"
              className="text-red-300 hover:bg-red-500/10 hover:text-red-300"
              onClick={onUnpublish}
              disabled={pending}
            >
              Remove from checkout
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button className="bg-primary" onClick={submit} disabled={pending}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {published ? "Save" : "Publish"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
