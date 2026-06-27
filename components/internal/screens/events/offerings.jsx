"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  Package,
  Check,
  CircleDot,
  ListChecks,
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

// Offerings editor. Each offering — add-ons or choices a buyer picks at
// checkout — is stored in the event's metadata bag (like tickets/schedule) via
// useEventConfig. The public checkout (event_public_page.jsx) reads enabled
// offerings, filters them by the selected ticket, and folds priced options into
// the order total; the buyer's choices persist on the order's metadata.
//
//   offering = {
//     id, name, description,
//     selectionType: "single" | "multiple",   // radio vs checkboxes
//     required: bool,                          // single only — must pick one
//     enabled: bool,
//     appliesTo: "all" | string[],             // ticket names it's offered with
//     options: [{ id, label, price }],         // price 0 = free choice
//   }

const EMPTY_OFFERING = {
  name: "",
  description: "",
  selectionType: "single",
  required: false,
  enabled: true,
  appliesTo: "all",
  options: [{ id: "opt_1", label: "", price: 0 }],
};

let optCounter = 0;
const newOption = () => {
  optCounter += 1;
  return { id: `opt_${Date.now()}_${optCounter}`, label: "", price: 0 };
};

function priceLabel(price) {
  const n = Number(price) || 0;
  return n > 0 ? `+$${n.toLocaleString()}` : "Free";
}

function appliesSummary(appliesTo) {
  if (appliesTo === "all" || !Array.isArray(appliesTo) || !appliesTo.length) {
    return "All tickets";
  }
  return appliesTo.length === 1
    ? appliesTo[0]
    : `${appliesTo.length} ticket types`;
}

function OfferingDialog({ open, onOpenChange, ticketTypes, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_OFFERING);

  // Re-seed the draft whenever the dialog opens (render-phase reset).
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(
        initial
          ? { ...EMPTY_OFFERING, ...initial, options: initial.options?.length ? initial.options : [newOption()] }
          : { ...EMPTY_OFFERING, options: [newOption()] },
      );
    }
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const setOption = (id, key, value) =>
    setDraft((d) => ({
      ...d,
      options: d.options.map((o) => (o.id === id ? { ...o, [key]: value } : o)),
    }));
  const addOption = () =>
    setDraft((d) => ({ ...d, options: [...d.options, newOption()] }));
  const removeOption = (id) =>
    setDraft((d) => ({
      ...d,
      options: d.options.filter((o) => o.id !== id),
    }));

  // appliesTo is either "all" or an array of ticket names.
  const isAll = draft.appliesTo === "all";
  const toggleAll = () => set("appliesTo")("all");
  const toggleTicket = (name) => {
    setDraft((d) => {
      const current = Array.isArray(d.appliesTo) ? d.appliesTo : [];
      const next = current.includes(name)
        ? current.filter((t) => t !== name)
        : [...current, name];
      return { ...d, appliesTo: next.length ? next : "all" };
    });
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the offering a name.");
      return;
    }
    const options = draft.options
      .map((o) => ({
        id: o.id,
        label: o.label.trim(),
        price: Number(o.price) || 0,
      }))
      .filter((o) => o.label);
    if (!options.length) {
      toast.error("Add at least one option with a label.");
      return;
    }
    onSave({
      name: draft.name.trim(),
      description: draft.description.trim(),
      selectionType: draft.selectionType,
      required: draft.selectionType === "single" ? Boolean(draft.required) : false,
      enabled: Boolean(draft.enabled),
      appliesTo: draft.appliesTo,
      options,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit offering" : "Add offering"}</DialogTitle>
          <DialogDescription>
            An add-on or choice buyers pick at checkout. Priced options add to the
            order total; leave a price at 0 for a free choice.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Field label="Name" htmlFor="off-name">
            <Input
              id="off-name"
              value={draft.name}
              onChange={(e) => set("name")(e.target.value)}
              placeholder="e.g. Add-ons, Meal preference"
              autoFocus
            />
          </Field>
          <Field label="Description" hint="Optional" htmlFor="off-desc">
            <Textarea
              id="off-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Shown beneath the offering name at checkout."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Selection">
              <Select
                value={draft.selectionType}
                onValueChange={(v) => set("selectionType")(v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Single choice (radio)</SelectItem>
                  <SelectItem value="multiple">
                    Multiple choice (checkbox)
                  </SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {draft.selectionType === "single" ? (
              <Field label="Requirement">
                <label className="flex h-9 items-center justify-between rounded-md border border-border bg-surface-card px-3 text-sm text-muted-foreground">
                  Require a choice
                  <Switch
                    checked={draft.required}
                    onCheckedChange={(v) => set("required")(v)}
                  />
                </label>
              </Field>
            ) : null}
          </div>

          <Field label="Offered with">
            <p className="-mt-0.5 text-xs text-text-secondary">
              Which ticket types see this offering at checkout.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={toggleAll}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isAll
                    ? "border-white bg-white text-[#161616]"
                    : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                )}
              >
                All tickets
              </button>
              {ticketTypes.map((name) => {
                const active =
                  !isAll &&
                  Array.isArray(draft.appliesTo) &&
                  draft.appliesTo.includes(name);
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleTicket(name)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-white bg-white text-[#161616]"
                        : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                    )}
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Options">
            <div className="space-y-2">
              {draft.options.map((o) => (
                <div key={o.id} className="flex items-center gap-2">
                  <Input
                    value={o.label}
                    onChange={(e) => setOption(o.id, "label", e.target.value)}
                    placeholder="Option label"
                    className="flex-1"
                  />
                  <div className="flex w-28 shrink-0 items-center gap-1">
                    <span className="text-sm text-text-secondary">$</span>
                    <Input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      value={o.price}
                      onChange={(e) => setOption(o.id, "price", e.target.value)}
                      className="tabular-nums"
                      placeholder="0"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={draft.options.length <= 1}
                    onClick={() => removeOption(o.id)}
                    aria-label="Remove option"
                    className="shrink-0 text-text-secondary hover:bg-red-500/10 hover:text-red-400 disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={addOption}
              className="mt-2 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            >
              <Plus className="h-4 w-4" /> Add option
            </Button>
          </Field>
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
            {initial ? "Save offering" : "Add offering"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OfferingsSection({ event, headerItem }) {
  const [offerings, , saveOfferings] = useEventConfig(event, "offerings", []);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, offering } | null

  // Ticket names come from the event's configured tiers (Ticket Types tab).
  const ticketTypes = (Array.isArray(event.tickets) ? event.tickets : [])
    .map((t) => t.name)
    .filter(Boolean);

  const addOffering = (offering) =>
    saveOfferings([...offerings, { ...offering, id: `off_${Date.now()}` }], {
      successMsg: "Offering added.",
    });

  const updateOffering = (index, offering) =>
    saveOfferings(
      offerings.map((o, i) => (i === index ? { ...o, ...offering } : o)),
      { successMsg: "Offering updated." },
    );

  const removeOffering = (index) =>
    saveOfferings(offerings.filter((_, i) => i !== index), {
      successMsg: "Offering removed.",
    });

  const toggleEnabled = (index) =>
    saveOfferings(
      offerings.map((o, i) => (i === index ? { ...o, enabled: !o.enabled } : o)),
    );

  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= offerings.length) return;
    const copy = [...offerings];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveOfferings(copy);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Offerings"}
        description={
          headerItem?.desc ||
          "Add-ons and choices buyers pick at checkout — optionally priced and limited to certain tickets."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" /> Add offering
          </Button>
        }
      />

      {offerings.length ? (
        <div className="space-y-3">
          {offerings.map((o, i) => {
            const SelIcon = o.selectionType === "multiple" ? ListChecks : CircleDot;
            return (
              <div
                key={o.id || i}
                className={cn(
                  "rounded-xl border border-border bg-surface-card p-4 transition-opacity",
                  o.enabled ? "" : "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                    <SelIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">
                      {o.name}
                    </p>
                    {o.description ? (
                      <p className="mt-0.5 text-xs text-text-secondary">
                        {o.description}
                      </p>
                    ) : null}
                    <p className="mt-1 text-xs text-text-tertiary">
                      {appliesSummary(o.appliesTo)}
                    </p>
                  </div>
                  {/* Right rail: badges pinned to the edge, switch centred in the
                      remaining height beneath them. */}
                  <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant="neutral">
                        {o.selectionType === "multiple" ? "Multiple" : "Single"}
                      </Badge>
                      {o.required ? (
                        <Badge variant="warning">Required</Badge>
                      ) : null}
                    </div>
                    <div className="flex flex-1 items-center">
                      <Switch
                        checked={o.enabled}
                        onCheckedChange={() => toggleEnabled(i)}
                        aria-label={o.enabled ? "Disable offering" : "Enable offering"}
                      />
                    </div>
                  </div>
                </div>

                {/* Option chips share the footer row with the row-action icons so
                    the actions sit against content instead of an empty strip. */}
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {(o.options || []).map((opt) => (
                      <span
                        key={opt.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface-subtle px-2 py-1 text-xs text-muted-foreground"
                      >
                        {opt.label}
                        <span
                          className={cn(
                            "tabular-nums",
                            Number(opt.price) > 0
                              ? "text-emerald-400"
                              : "text-text-tertiary",
                          )}
                        >
                          {priceLabel(opt.price)}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
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
                      disabled={i === offerings.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Move down"
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing({ index: i, offering: o })}
                      aria-label="Edit offering"
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeOffering(i)}
                      aria-label="Delete offering"
                      className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
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
          <Package className="h-6 w-6" />
          <p className="text-sm">Create your first offering</p>
        </button>
      )}

      <OfferingDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        ticketTypes={ticketTypes}
        onSave={addOffering}
      />
      <OfferingDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        ticketTypes={ticketTypes}
        initial={editing?.offering}
        onSave={(offering) => {
          updateOffering(editing.index, offering);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default OfferingsSection;
