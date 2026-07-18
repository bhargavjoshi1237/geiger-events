"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Package, Plus, Trash2, Pencil } from "lucide-react";

import {
  EditorSectionHeader,
  EmptyState,
  Field,
  SectionCard,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { EMPTY_BUNDLE, bundleTicketCount, bundlePrice } from "@/lib/events/bundles";

// Per-event ticket-bundle editor. Bundles live in the event metadata bag
// (metadata.bundles) and reference the event's OWN tickets (event.tickets[].id),
// so each item picker lists this event's tickets. See lib/events/bundles.js.

function fmtPrice(n) {
  const v = Number(n) || 0;
  return `$${v % 1 === 0 ? v : v.toFixed(2)}`;
}

function BundleDialog({ open, onOpenChange, tickets, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_BUNDLE);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(initial ? { ...EMPTY_BUNDLE, ...initial } : { ...EMPTY_BUNDLE });
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const items = Array.isArray(draft.items) ? draft.items : [];
  // Tickets already chosen — hidden from the other item pickers.
  const usedIds = new Set(items.map((it) => it.ticketId).filter(Boolean));

  const ticketName = useMemo(() => {
    const map = {};
    for (const t of tickets) map[t.id] = t.name;
    return map;
  }, [tickets]);

  const setItem = (idx, patch) =>
    set("items")(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  const addItem = () => set("items")([...items, { ticketId: "", qty: 1 }]);
  const removeItem = (idx) => set("items")(items.filter((_, i) => i !== idx));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the bundle a name.");
      return;
    }
    onSave({
      name: draft.name.trim(),
      description: (draft.description || "").trim(),
      enabled: draft.enabled !== false,
      items: items
        .filter((it) => it.ticketId)
        .map((it) => ({ ticketId: String(it.ticketId), qty: Math.max(1, Number(it.qty) || 1) })),
      pricingMode: draft.pricingMode === "sum" ? "sum" : "fixed",
      price: Number(draft.price) || 0,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit bundle" : "Add bundle"}</DialogTitle>
          <DialogDescription>
            Several of this event&apos;s tickets sold together as one purchase.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Field label="Bundle name" htmlFor="bundle-name">
            <Input
              id="bundle-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Weekend pass"
              autoFocus
            />
          </Field>

          <Field label="Description" hint="Shown to buyers under the bundle name." htmlFor="bundle-desc">
            <Textarea
              id="bundle-desc"
              rows={2}
              value={draft.description || ""}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="e.g. Entry to all three days plus the after-party."
            />
          </Field>

          <SectionCard
            bare
            title="Bundle items"
            description="The tickets included in this bundle. Manage the tickets themselves in the Tickets tab."
          >
            {items.length ? (
              <div className="space-y-3">
                {items.map((it, idx) => {
                  const available = tickets.filter(
                    (t) => t.id === it.ticketId || !usedIds.has(t.id),
                  );
                  return (
                    <div
                      key={idx}
                      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-card p-3"
                    >
                      <Field label="Ticket" className="min-w-[12rem] flex-1">
                        <Select
                          value={it.ticketId || ""}
                          onValueChange={(v) => setItem(idx, { ticketId: v })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Pick a ticket…" />
                          </SelectTrigger>
                          <SelectContent>
                            {available.length ? (
                              available.map((t) => (
                                <SelectItem key={t.id} value={t.id}>
                                  {t.name}
                                </SelectItem>
                              ))
                            ) : (
                              <SelectItem value="none" disabled>
                                {tickets.length ? "All tickets added" : "No tickets yet"}
                              </SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="Qty" className="w-20">
                        <Input
                          type="number"
                          min={1}
                          inputMode="numeric"
                          value={it.qty ?? 1}
                          onChange={(e) => setItem(idx, { qty: Number(e.target.value) || 1 })}
                          className="tabular-nums"
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${ticketName[it.ticketId] || "item"}`}
                        onClick={() => removeItem(idx)}
                        className="mb-1 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-text-secondary">
                {tickets.length
                  ? "No items yet — add the tickets this bundle includes."
                  : "No tickets yet — add tickets in the Tickets tab first."}
              </p>
            )}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={addItem}
              disabled={!tickets.length}
              className="mt-3 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </SectionCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Pricing" hint="Charge one price, or the sum of the items.">
              <Select
                value={draft.pricingMode || "fixed"}
                onValueChange={(v) => set("pricingMode")(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed">Fixed price</SelectItem>
                  <SelectItem value="sum">Sum of items</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {draft.pricingMode !== "sum" ? (
              <Field label="Bundle price">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-text-secondary">$</span>
                  <Input
                    type="number"
                    min={0}
                    inputMode="decimal"
                    value={draft.price ?? 0}
                    onChange={(e) => set("price")(Number(e.target.value) || 0)}
                    className="w-full tabular-nums"
                    placeholder="0"
                  />
                </div>
              </Field>
            ) : null}
          </div>

          <label className="flex items-center justify-between rounded-xl border border-border bg-surface-card p-3 text-sm text-muted-foreground">
            Bundle available
            <Switch
              checked={draft.enabled !== false}
              onCheckedChange={(v) => set("enabled")(v)}
            />
          </label>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {initial ? "Save bundle" : "Add bundle"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function EventBundlesSection({ event, headerItem }) {
  const [bundles, , save] = useEventConfig(event, "bundles", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, bundle } | null

  // The event's own tickets — bundle items reference these ids.
  const tickets = (Array.isArray(event.tickets) ? event.tickets : []).map((t) => ({
    id: String(t.id),
    name: t.name || "Untitled",
    price: Number(t.price) || 0,
  }));

  // { [ticketId]: price } lookup for "sum" pricing summaries.
  const priceById = useMemo(() => {
    const map = {};
    for (const t of tickets) map[t.id] = t.price;
    return map;
  }, [tickets]);

  const list = Array.isArray(bundles) ? bundles : [];

  const openAdd = () => setAddOpen(true);

  const addBundle = (bundle) =>
    save([...list, { ...bundle, id: crypto.randomUUID() }], { successMsg: "Bundle saved." });
  const updateBundle = (index, bundle) =>
    save(
      list.map((b, i) => (i === index ? { ...b, ...bundle } : b)),
      { successMsg: "Bundle saved." },
    );
  const removeBundle = (index) =>
    save(list.filter((_, i) => i !== index), { successMsg: "Bundle removed." });
  const toggleEnabled = (index) =>
    save(list.map((b, i) => (i === index ? { ...b, enabled: !(b.enabled !== false) } : b)));

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Bundles"}
        description={
          headerItem?.desc ||
          "Sell several of this event's tickets together as one purchase at one price."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={openAdd}
          >
            <Plus className="h-4 w-4" /> Add bundle
          </Button>
        }
      />

      {list.length ? (
        <div className="space-y-3">
          {list.map((raw, i) => {
            const b = { ...EMPTY_BUNDLE, ...raw };
            const enabled = b.enabled !== false;
            const count = bundleTicketCount(b);
            const noun = count === 1 ? "item" : "items";
            const priceLabel =
              b.pricingMode === "sum"
                ? `${fmtPrice(bundlePrice(b, priceById))} (sum of items)`
                : fmtPrice(b.price);
            return (
              <div
                key={b.id || i}
                className={cn(
                  "rounded-xl border border-border bg-surface-card p-4 transition-opacity",
                  enabled ? "" : "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{b.name || "Untitled bundle"}</p>
                    <p className="mt-0.5 text-xs text-text-secondary tabular-nums">
                      {count} {noun} · {priceLabel}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleEnabled(i)}
                      aria-label={enabled ? "Disable bundle" : "Enable bundle"}
                      className="mr-1"
                    />
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing({ index: i, bundle: b })}
                      aria-label="Edit bundle"
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeBundle(i)}
                      aria-label="Delete bundle"
                      className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {b.description ? (
                  <p className="mt-3 truncate border-t border-border pt-3 text-xs text-text-tertiary">
                    {b.description}
                  </p>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Package}
          title="No bundles yet"
          description="Group several of this event's tickets into a single purchase at one price."
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={openAdd}
            >
              <Plus className="h-4 w-4" /> Add bundle
            </Button>
          }
        />
      )}

      <BundleDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tickets={tickets}
        onSave={addBundle}
      />
      <BundleDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        tickets={tickets}
        initial={editing?.bundle}
        onSave={(bundle) => {
          updateBundle(editing.index, bundle);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default EventBundlesSection;
