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
  Clock,
  CalendarDays,
  Ticket,
  Timer,
  Link2,
  Ban,
  Users,
  Check,
} from "lucide-react";

import { EditorSectionHeader, Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Badge } from "@geiger/ui/badge";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Switch } from "@geiger/ui/switch";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { TIME_BANDS, bandLabel, EMPTY_SLOT } from "@/lib/events/slots";
import { EMPTY_PURCHASABLE, EMPTY_SHOWIF } from "@/lib/events/purchasables";

function priceLabel(price) {
  const n = Number(price) || 0;
  return n > 0 ? `$${n.toLocaleString("en-US")}` : "Free";
}

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

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
      )}
    >
      {active ? <Check className="h-3 w-3 text-primary" /> : null}
      {children}
    </button>
  );
}

/**
 * Prominent rule separating whole blocks in the dialog. Bleeds past the
 * DialogContent `p-6` so it reaches both edges instead of floating inset.
 */
function SectionRule() {
  return (
    <hr className="-mx-6 w-[calc(100%+3rem)] border-0 border-t-2 border-border" />
  );
}

/** Lighter rule used between individual rows; spans the full content width. */
function RowRule() {
  return <hr className="w-full border-0 border-t border-border/70" />;
}

function SwitchRow({ id, title, description, checked, onCheckedChange }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3.5">
      <label htmlFor={id} className="min-w-0 cursor-pointer select-none">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-text-secondary">{description}</span>
        ) : null}
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}

/**
 * A single opt-in rule: checkbox enables it, its controls collapse open beneath.
 */
function ConditionCard({ id, icon: Icon, title, hint, checked, onCheckedChange, children }) {
  return (
    <div
      className={cn(
        "rounded-xl border transition-colors",
        checked
          ? "border-primary/40 bg-primary/[0.04]"
          : "border-border bg-surface-card/60 hover:bg-surface-active/40",
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(v) => onCheckedChange(v === true)}
          className="mt-0.5"
        />
        <div className="min-w-0 flex-1">
          <label
            htmlFor={id}
            className="block cursor-pointer select-none text-sm font-medium text-foreground"
          >
            {title}
          </label>
          {hint ? <p className="mt-0.5 text-xs text-text-secondary">{hint}</p> : null}
        </div>
        {Icon ? (
          <span
            className={cn(
              "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-colors",
              checked
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border bg-surface-subtle text-text-tertiary",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      {checked ? (
        <div className="border-t border-dashed border-border px-3 pb-3 pt-3">{children}</div>
      ) : null}
    </div>
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
  const patchCond = (patch) =>
    setDraft((d) => ({ ...d, showIf: { ...d.showIf, ...patch } }));

  const allowMultiple = draft.pickType === "quantity";
  const setAllowMultiple = (on) =>
    setDraft((d) => ({ ...d, pickType: on ? "quantity" : "toggle" }));

  const toggleInArray = (key, val) =>
    setDraft((d) => {
      const cur = Array.isArray(d.showIf[key]) ? d.showIf[key] : [];
      const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val];
      return { ...d, showIf: { ...d.showIf, [key]: next } };
    });

  const ticketsAll = draft.showIf.tickets === "all";
  const toggleTicket = (id) =>
    setDraft((d) => {
      const cur = Array.isArray(d.showIf.tickets) ? d.showIf.tickets : [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...d, showIf: { ...d.showIf, tickets: next.length ? next : "all" } };
    });

  // Which condition rules are switched on (drives the checkbox rows).
  const bandsOn = (draft.showIf.bands || []).length > 0;
  const slotIdsOn = (draft.showIf.slotIds || []).length > 0;
  const ticketsOn =
    !ticketsAll && Array.isArray(draft.showIf.tickets) && draft.showIf.tickets.length > 0;
  const qtyOn = draft.showIf.minQty != null || draft.showIf.maxQty != null;
  const cutoffOn = draft.showIf.cutoffHours != null;
  const requiresOn = Boolean(draft.showIf.requiresPurchasableId);
  const excludesOn = Boolean(draft.showIf.excludesPurchasableId);

  const activeCount = [
    bandsOn,
    slotIdsOn,
    ticketsOn,
    qtyOn,
    cutoffOn,
    requiresOn,
    excludesOn,
    Boolean(draft.showIf.membersOnly),
  ].filter(Boolean).length;

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

          <Field label="Price" htmlFor="pur-price" hint="Leave at 0 for a free add-on">
            <div className="relative w-full">
              <span
                className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm text-text-secondary"
                style={{ left: "var(--input-box-padding-x, 0.75rem)" }}
              >
                $
              </span>
              {/* @geiger/ui's Input pins padding-x with !important, so a pl-*
                  utility is silently dropped and the $ lands on the text. The
                  [data-lead] rule in globals.css reserves the gutter instead —
                  same trick icon_input.jsx uses for leading icons. */}
              <Input
                id="pur-price"
                type="number"
                min={0}
                inputMode="decimal"
                value={draft.price}
                onChange={(e) => set("price")(e.target.value)}
                data-lead=""
                className="w-full tabular-nums"
                placeholder="0"
              />
            </div>
          </Field>

          <SectionRule />

          <div>
            <SwitchRow
              id="pur-multiple"
              title="Allow buying multiple"
              description="Buyers get a quantity stepper for this item."
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
            />
            {allowMultiple ? (
              <div className="pb-1">
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
              </div>
            ) : null}
            <RowRule />
            <SwitchRow
              id="pur-required"
              title="Required to check out"
              description="Buyers cannot finish checkout without picking it."
              checked={draft.required}
              onCheckedChange={(v) => set("required")(v)}
            />
            <RowRule />
            <SwitchRow
              id="pur-available"
              title="Available"
              description="Turn off to hide this add-on without deleting it."
              checked={draft.enabled}
              onCheckedChange={(v) => set("enabled")(v)}
            />
          </div>

          <SectionRule />

          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Filter className="h-4 w-4 text-muted-foreground" /> Conditions
                </p>
                <p className="mt-0.5 text-xs text-text-secondary">
                  {activeCount
                    ? `${activeCount} rule${activeCount > 1 ? "s" : ""} on — shown when ${
                        draft.showIf.match === "any" ? "any rule" : "every rule"
                      } passes.`
                    : "No rules on — this add-on is shown to everyone."}
                </p>
              </div>
              <Select
                value={draft.showIf.match}
                onValueChange={(v) => setCond("match", v)}
              >
                <SelectTrigger className="h-8 w-32 shrink-0 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Match all</SelectItem>
                  <SelectItem value="any">Match any</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <ConditionCard
                id="cnd-band"
                icon={Clock}
                title="Time band"
                hint="Only offer it during these parts of the day."
                checked={bandsOn}
                onCheckedChange={(on) => patchCond({ bands: on ? [TIME_BANDS[0].value] : [] })}
              >
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
              </ConditionCard>

              {slots.length ? (
                <ConditionCard
                  id="cnd-slots"
                  icon={CalendarDays}
                  title="Specific slots"
                  hint="Only offer it for these slots."
                  checked={slotIdsOn}
                  onCheckedChange={(on) =>
                    patchCond({ slotIds: on && slots.length ? [slots[0].id] : [] })
                  }
                >
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
                </ConditionCard>
              ) : null}

              {tickets.length ? (
                <ConditionCard
                  id="cnd-tickets"
                  icon={Ticket}
                  title="Ticket types"
                  hint="Only offer it to buyers holding these tickets."
                  checked={ticketsOn}
                  onCheckedChange={(on) =>
                    patchCond({ tickets: on && tickets.length ? [tickets[0].id] : "all" })
                  }
                >
                  <div className="flex flex-wrap gap-2">
                    {tickets.map((t) => (
                      <Chip
                        key={t.id}
                        active={
                          !ticketsAll &&
                          Array.isArray(draft.showIf.tickets) &&
                          draft.showIf.tickets.includes(t.id)
                        }
                        onClick={() => toggleTicket(t.id)}
                      >
                        {t.name}
                      </Chip>
                    ))}
                  </div>
                </ConditionCard>
              ) : null}

              <ConditionCard
                id="cnd-qty"
                icon={Hash}
                title="Tickets in cart"
                hint="Show it only between a minimum and maximum cart size."
                checked={qtyOn}
                onCheckedChange={(on) =>
                  patchCond({ minQty: on ? "" : null, maxQty: on ? "" : null })
                }
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Minimum" hint="Blank = no minimum">
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
                  <Field label="Maximum" hint="Blank = no maximum">
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
              </ConditionCard>

              <ConditionCard
                id="cnd-cutoff"
                icon={Timer}
                title="Cut-off before the slot"
                hint="Hide it once the slot is closer than this many hours."
                checked={cutoffOn}
                onCheckedChange={(on) => patchCond({ cutoffHours: on ? 24 : null })}
              >
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    inputMode="numeric"
                    value={draft.showIf.cutoffHours ?? ""}
                    onChange={(e) => setCond("cutoffHours", e.target.value)}
                    className="tabular-nums"
                    placeholder="24"
                  />
                  <span className="shrink-0 text-xs text-text-secondary">hours before</span>
                </div>
              </ConditionCard>

              {siblings.length ? (
                <>
                  <ConditionCard
                    id="cnd-requires"
                    icon={Link2}
                    title="Requires another add-on"
                    hint="Only show it once that add-on is in the cart."
                    checked={requiresOn}
                    onCheckedChange={(on) =>
                      patchCond({ requiresPurchasableId: on ? siblings[0].id : null })
                    }
                  >
                    <Select
                      value={draft.showIf.requiresPurchasableId || "none"}
                      onValueChange={(v) => setCond("requiresPurchasableId", v === "none" ? null : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick an add-on" />
                      </SelectTrigger>
                      <SelectContent>
                        {siblings.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ConditionCard>

                  <ConditionCard
                    id="cnd-excludes"
                    icon={Ban}
                    title="Excludes another add-on"
                    hint="Hide it whenever that add-on is in the cart."
                    checked={excludesOn}
                    onCheckedChange={(on) =>
                      patchCond({ excludesPurchasableId: on ? siblings[0].id : null })
                    }
                  >
                    <Select
                      value={draft.showIf.excludesPurchasableId || "none"}
                      onValueChange={(v) => setCond("excludesPurchasableId", v === "none" ? null : v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Pick an add-on" />
                      </SelectTrigger>
                      <SelectContent>
                        {siblings.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </ConditionCard>
                </>
              ) : null}

              <ConditionCard
                id="cnd-members"
                icon={Users}
                title="Members only"
                hint="Only signed-in members see this add-on."
                checked={Boolean(draft.showIf.membersOnly)}
                onCheckedChange={(on) => patchCond({ membersOnly: on })}
              />
            </div>
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
  const [editing, setEditing] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

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
                    <ShoppingBag className="h-4 w-4" />
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
                    onClick={() => setDeleteTarget(i)}
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

      <Dialog
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete purchasable</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-foreground">
                {deleteTarget != null ? purchasables[deleteTarget]?.name : ""}
              </span>
              ? This action can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => {
                remove(deleteTarget);
                setDeleteTarget(null);
              }}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default PurchasablesSection;
