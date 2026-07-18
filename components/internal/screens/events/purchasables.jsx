"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  ShoppingBag,
  Hash,
  ToggleLeft,
  Filter,
} from "lucide-react";

import { EditorSectionHeader, Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { TIME_BANDS, bandLabel, EMPTY_SLOT } from "@/lib/events/slots";
import { EMPTY_PURCHASABLE, EMPTY_SHOWIF } from "@/lib/events/purchasables";

// Additional-purchasables editor. Each purchasable is a conditional add-on the
// buyer sees in the animated checkout step, gated by a fully-configurable
// showIf rule set (band / slots / ticket / quantity / membership / cutoff /
// dependency). Stored in metadata.purchasables via useEventConfig. See
// lib/events/purchasables.js for the shape + the visibility evaluator.

function priceLabel(price) {
  const n = Number(price) || 0;
  return n > 0 ? `$${n.toLocaleString()}` : "Free";
}

// One-line human summary of a purchasable's conditions for the list card.
function conditionSummary(showIf, { slots }) {
  const s = { ...EMPTY_SHOWIF, ...(showIf || {}) };
  const parts = [];
  if (s.bands?.length) parts.push(s.bands.map(bandLabel).join("/"));
  if (s.slotIds?.length) {
    const names = s.slotIds
      .map((id) => slots.find((x) => x.id === id)?.label)
      .filter(Boolean);
    parts.push(names.length ? names.join(", ") : `${s.slotIds.length} slots`);
  }
  if (s.tickets !== "all" && Array.isArray(s.tickets) && s.tickets.length)
    parts.push(`${s.tickets.length} ticket${s.tickets.length > 1 ? "s" : ""}`);
  if (s.minQty != null) parts.push(`≥${s.minQty} tickets`);
  if (s.maxQty != null) parts.push(`≤${s.maxQty} tickets`);
  if (s.membersOnly) parts.push("members");
  if (s.cutoffHours != null) parts.push(`${s.cutoffHours}h before`);
  if (!parts.length) return "Always shown";
  return `${s.match === "any" ? "Any of" : "When"}: ${parts.join(" · ")}`;
}

// A pill toggle used across the conditions builder.
function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-white bg-white text-[#161616]"
          : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
      )}
    >
      {children}
    </button>
  );
}

function PurchasableDialog({ open, onOpenChange, tickets, slots, siblings, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_PURCHASABLE);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(
        initial
          ? { ...EMPTY_PURCHASABLE, ...initial, showIf: { ...EMPTY_SHOWIF, ...(initial.showIf || {}) } }
          : { ...EMPTY_PURCHASABLE, showIf: { ...EMPTY_SHOWIF } },
      );
    }
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));
  const setCond = (key, value) =>
    setDraft((d) => ({ ...d, showIf: { ...d.showIf, [key]: value } }));

  // "Allow buying multiple" is a friendly view over pickType: quantity → the
  // buyer gets a stepper (capped by maxPerOrder); toggle → simple add/remove.
  const allowMultiple = draft.pickType === "quantity";
  const setAllowMultiple = (on) =>
    setDraft((d) => ({ ...d, pickType: on ? "quantity" : "toggle" }));

  const toggleInArray = (key, val) =>
    setDraft((d) => {
      const cur = Array.isArray(d.showIf[key]) ? d.showIf[key] : [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      return { ...d, showIf: { ...d.showIf, [key]: next } };
    });

  // tickets condition is "all" or an array of ticket ids.
  const ticketsAll = draft.showIf.tickets === "all";
  const toggleTicket = (id) =>
    setDraft((d) => {
      const cur = Array.isArray(d.showIf.tickets) ? d.showIf.tickets : [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...d, showIf: { ...d.showIf, tickets: next.length ? next : "all" } };
    });

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the purchasable a name.");
      return;
    }
    onSave({
      name: draft.name.trim(),
      description: draft.description.trim(),
      image: draft.image?.trim() || "",
      price: Number(draft.price) || 0,
      priceType: draft.priceType,
      pickType: draft.pickType,
      required: Boolean(draft.required),
      stock:
        draft.stock === "" || draft.stock == null ? null : Number(draft.stock) || null,
      maxPerOrder:
        draft.maxPerOrder === "" || draft.maxPerOrder == null
          ? null
          : Number(draft.maxPerOrder) || null,
      enabled: Boolean(draft.enabled),
      showIf: {
        match: draft.showIf.match === "any" ? "any" : "all",
        bands: draft.showIf.bands || [],
        slotIds: draft.showIf.slotIds || [],
        tickets: draft.showIf.tickets,
        minQty:
          draft.showIf.minQty === "" || draft.showIf.minQty == null
            ? null
            : Number(draft.showIf.minQty) || null,
        maxQty:
          draft.showIf.maxQty === "" || draft.showIf.maxQty == null
            ? null
            : Number(draft.showIf.maxQty) || null,
        membersOnly: Boolean(draft.showIf.membersOnly),
        cutoffHours:
          draft.showIf.cutoffHours === "" || draft.showIf.cutoffHours == null
            ? null
            : Number(draft.showIf.cutoffHours) || null,
        requiresPurchasableId: draft.showIf.requiresPurchasableId || null,
        excludesPurchasableId: draft.showIf.excludesPurchasableId || null,
      },
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit purchasable" : "Add purchasable"}</DialogTitle>
          <DialogDescription>
            An add-on shown after ticket details. Conditions control exactly when
            a buyer sees it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Field label="Name" htmlFor="pur-name">
            <Input
              id="pur-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Fancy dinner"
              autoFocus
            />
          </Field>
          <Field label="Description" hint="Optional" htmlFor="pur-desc">
            <Textarea
              id="pur-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Shown beneath the name at checkout."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price" htmlFor="pur-price">
              <div className="flex items-center gap-1">
                <span className="text-sm text-text-secondary">$</span>
                <Input
                  id="pur-price"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={draft.price}
                  onChange={(e) => set("price")(e.target.value)}
                  className="tabular-nums"
                  placeholder="0"
                />
              </div>
            </Field>
          </div>

          <div className="grid gap-3 rounded-xl border border-border bg-surface-card p-3">
            <div className="space-y-3">
              <label className="flex items-center justify-between text-sm text-muted-foreground">
                <span className="flex flex-col">
                  Allow buying multiple
                  <span className="text-xs text-text-tertiary">
                    Buyers get a quantity stepper for this item.
                  </span>
                </span>
                <Switch checked={allowMultiple} onCheckedChange={setAllowMultiple} />
              </label>
              {allowMultiple ? (
                <Field label="Max quantity per item" hint="Blank = no limit">
                  <Input
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={draft.maxPerOrder ?? ""}
                    onChange={(e) => set("maxPerOrder")(e.target.value)}
                    className="tabular-nums"
                    placeholder="—"
                  />
                </Field>
              ) : null}
            </div>
            <label className="flex items-center justify-between text-sm text-muted-foreground">
              Required to check out
              <Switch checked={draft.required} onCheckedChange={(v) => set("required")(v)} />
            </label>
            <label className="flex items-center justify-between text-sm text-muted-foreground">
              Available
              <Switch checked={draft.enabled} onCheckedChange={(v) => set("enabled")(v)} />
            </label>
          </div>

          {/* Conditions builder — full control over when this is shown. */}
          <div className="space-y-4 rounded-xl border border-border bg-surface-subtle p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Filter className="h-4 w-4 text-muted-foreground" /> Conditions
              </span>
              <Select
                value={draft.showIf.match}
                onValueChange={(v) => setCond("match", v)}
              >
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Match all</SelectItem>
                  <SelectItem value="any">Match any</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="-mt-1 text-xs text-text-secondary">
              Leave everything blank to always show this. Otherwise it appears
              only when the selected rules {draft.showIf.match === "any" ? "— any of them —" : ""} pass.
            </p>

            <Field label="Time band">
              <div className="flex flex-wrap gap-2">
                {TIME_BANDS.map((b) => (
                  <Chip
                    key={b.value}
                    active={draft.showIf.bands?.includes(b.value)}
                    onClick={() => toggleInArray("bands", b.value)}
                  >
                    {b.label}
                  </Chip>
                ))}
              </div>
            </Field>

            {slots.length ? (
              <Field label="Specific slots">
                <div className="flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <Chip
                      key={s.id}
                      active={draft.showIf.slotIds?.includes(s.id)}
                      onClick={() => toggleInArray("slotIds", s.id)}
                    >
                      {s.label}
                    </Chip>
                  ))}
                </div>
              </Field>
            ) : null}

            <Field label="Ticket types">
              <div className="flex flex-wrap gap-2">
                <Chip active={ticketsAll} onClick={() => setCond("tickets", "all")}>
                  All tickets
                </Chip>
                {tickets.map((t) => (
                  <Chip
                    key={t.id}
                    active={!ticketsAll && Array.isArray(draft.showIf.tickets) && draft.showIf.tickets.includes(t.id)}
                    onClick={() => toggleTicket(t.id)}
                  >
                    {t.name}
                  </Chip>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Min tickets" hint="In cart">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={draft.showIf.minQty ?? ""}
                  onChange={(e) => setCond("minQty", e.target.value)}
                  className="tabular-nums"
                  placeholder="—"
                />
              </Field>
              <Field label="Max tickets" hint="In cart">
                <Input
                  type="number"
                  min={1}
                  inputMode="numeric"
                  value={draft.showIf.maxQty ?? ""}
                  onChange={(e) => setCond("maxQty", e.target.value)}
                  className="tabular-nums"
                  placeholder="—"
                />
              </Field>
            </div>

            <Field label="Hide within N hours of the slot" hint="Optional cutoff">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.showIf.cutoffHours ?? ""}
                onChange={(e) => setCond("cutoffHours", e.target.value)}
                className="tabular-nums"
                placeholder="e.g. 24"
              />
            </Field>

            {siblings.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Requires add-on">
                  <Select
                    value={draft.showIf.requiresPurchasableId || "none"}
                    onValueChange={(v) => setCond("requiresPurchasableId", v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {siblings.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Excludes add-on">
                  <Select
                    value={draft.showIf.excludesPurchasableId || "none"}
                    onValueChange={(v) => setCond("excludesPurchasableId", v === "none" ? null : v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {siblings.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            ) : null}

            <label className="flex items-center justify-between rounded-md border border-border bg-surface-card px-3 py-2 text-sm text-muted-foreground">
              Members only
              <Switch
                checked={draft.showIf.membersOnly}
                onCheckedChange={(v) => setCond("membersOnly", v)}
              />
            </label>
          </div>
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
            {initial ? "Save purchasable" : "Add purchasable"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function PurchasablesSection({ event, headerItem }) {
  const [purchasables, , savePurchasables] = useEventConfig(event, "purchasables", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, item } | null

  const tickets = (Array.isArray(event.tickets) ? event.tickets : [])
    .filter((t) => t && t.id)
    .map((t) => ({ id: String(t.id), name: t.name || "Untitled" }));
  const slots = (Array.isArray(event.slots) ? event.slots : [])
    .map((s) => ({ ...EMPTY_SLOT, ...s }))
    .filter((s) => s.id);

  const add = (item) =>
    savePurchasables([...purchasables, { ...item, id: `pur_${Date.now()}` }], {
      successMsg: "Purchasable added.",
    });
  const update = (index, item) =>
    savePurchasables(
      purchasables.map((p, i) => (i === index ? { ...p, ...item } : p)),
      { successMsg: "Purchasable updated." },
    );
  const remove = (index) =>
    savePurchasables(purchasables.filter((_, i) => i !== index), {
      successMsg: "Purchasable removed.",
    });
  const toggleEnabled = (index) =>
    savePurchasables(
      purchasables.map((p, i) => (i === index ? { ...p, enabled: !(p.enabled !== false) } : p)),
    );
  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= purchasables.length) return;
    const copy = [...purchasables];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    savePurchasables(copy);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Purchasables"}
        description={
          headerItem?.desc ||
          "Conditional add-ons shown after ticket details — surfaced only when your rules (time slot, ticket, quantity…) match."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add purchasable
          </Button>
        }
      />

      {purchasables.length ? (
        <div className="space-y-3">
          {purchasables.map((raw, i) => {
            const p = { ...EMPTY_PURCHASABLE, ...raw };
            const enabled = p.enabled !== false;
            const PickIcon = p.pickType === "quantity" ? Hash : ToggleLeft;
            return (
              <div
                key={p.id || i}
                className={cn(
                  "rounded-xl border border-border bg-surface-card p-4 transition-opacity",
                  enabled ? "" : "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                    <PickIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{p.name}</p>
                    {p.description ? (
                      <p className="mt-0.5 text-xs text-text-secondary">{p.description}</p>
                    ) : null}
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-text-tertiary">
                      <Filter className="h-3 w-3" />
                      {conditionSummary(p.showIf, { slots })}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant={Number(p.price) > 0 ? "success" : "neutral"}>
                        {priceLabel(p.price)}
                      </Badge>
                      {p.pickType === "quantity" ? (
                        <Badge variant="neutral">
                          {p.maxPerOrder ? `Up to ${p.maxPerOrder}` : "Multiple"}
                        </Badge>
                      ) : null}
                      {p.required ? <Badge variant="warning">Required</Badge> : null}
                    </div>
                    <div className="flex flex-1 items-center">
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleEnabled(i)}
                        aria-label={enabled ? "Disable purchasable" : "Enable purchasable"}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-3">
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
                    disabled={i === purchasables.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label="Move down"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditing({ index: i, item: p })}
                    aria-label="Edit purchasable"
                    className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => remove(i)}
                    aria-label="Delete purchasable"
                    className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
        >
          <ShoppingBag className="h-6 w-6" />
          <p className="text-sm">Create your first purchasable</p>
        </button>
      )}

      <PurchasableDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        tickets={tickets}
        slots={slots}
        siblings={purchasables.filter((p) => p.id).map((p) => ({ id: p.id, name: p.name }))}
        onSave={add}
      />
      <PurchasableDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        tickets={tickets}
        slots={slots}
        siblings={purchasables
          .filter((p) => p.id && p.id !== editing?.item?.id)
          .map((p) => ({ id: p.id, name: p.name }))}
        initial={editing?.item}
        onSave={(item) => {
          update(editing.index, item);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default PurchasablesSection;
