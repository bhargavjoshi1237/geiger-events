"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CalendarDays,
  Layers,
  Loader2,
  Package,
  Plus,
  Save,
} from "lucide-react";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { ItemImageCard, ItemThumb } from "./item_image";

import { getUser } from "@/lib/supabase/user";
import { listEvents } from "@/lib/supabase/events";
import {
  listMovements,
  listAllocations,
  recordMovement,
  updateItem,
} from "@/lib/supabase/inventory";
import { rollupItem } from "@/lib/inventory/demand";
import {
  ALLOCATION_STATUS_MAP,
  ITEM_CATEGORIES,
  ISSUANCE_MAP,
  MOVEMENT_KIND_MAP,
  MOVEMENT_KIND_OPTIONS,
  STOCK_STATUS_MAP,
  currency,
  formatDateTime,
  itemLabel,
  movementDirection,
  qty,
  signedQty,
  stockStatus,
} from "./constants";

// --- Record-movement dialog --------------------------------------------------

// The one way stock changes. `kind` fixes the sign — only "adjust" lets the user
// choose a direction, so you can't accidentally receive a write-off.
function MovementDialog({ open, onOpenChange, item, initialKind, onConfirm, pending }) {
  const [kind, setKind] = useState(initialKind || "receive");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("in");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const fixed = movementDirection(kind);
  const effective = fixed === "either" ? direction : fixed;

  const submit = () => {
    const value = Number(amount) || 0;
    if (value <= 0) {
      toast.error("Enter a quantity above zero.");
      return;
    }
    const signed = effective === "out" ? -value : value;
    if (signed < 0 && Math.abs(signed) > Number(item?.onHand || 0)) {
      toast.error(
        `Only ${qty(item?.onHand)} on hand — you can't take out ${qty(value)}.`,
      );
      return;
    }
    onConfirm({ kind, qty: signed, reason, note });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record stock movement</DialogTitle>
          <DialogDescription>
            {itemLabel(item)} — {qty(item?.onHand)} on hand. Movements are
            append-only; correct a mistake with an opposite movement.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Movement">
            <Select value={kind} onValueChange={setKind}>
              <SelectTrigger className="bg-surface-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_KIND_OPTIONS.map((k) => (
                  <SelectItem key={k.value} value={k.value}>
                    {k.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {fixed === "either" ? (
            <Field label="Direction" hint="An adjustment can go either way">
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in">Add to stock</SelectItem>
                  <SelectItem value="out">Remove from stock</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          ) : null}

          <Field
            label="Quantity"
            hint={effective === "out" ? "Comes out of stock" : "Goes into stock"}
          >
            <Input
              type="number"
              min="0"
              value={amount}
              placeholder="0"
              onChange={(e) => setAmount(e.target.value)}
              className="bg-surface-card"
            />
          </Field>

          <Field label="Reason" hint="Optional">
            <Input
              value={reason}
              placeholder="Delivery from supplier"
              onChange={(e) => setReason(e.target.value)}
              className="bg-surface-card"
            />
          </Field>

          <Field label="Note" hint="Optional">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="bg-surface-card"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record movement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Drawer body -------------------------------------------------------------

function StatLine({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-card px-3 py-2.5">
      <span className="text-[11px] uppercase tracking-wide text-text-tertiary">
        {label}
      </span>
      <span className={`text-sm font-semibold tabular-nums ${tone || "text-foreground"}`}>
        {value}
      </span>
    </div>
  );
}

function ItemDrawerBody({ item, items, projectId, onPatch, onAddVariant }) {
  const [form, setForm] = useState(item);
  const [saving, setSaving] = useState(false);
  const [movements, setMovements] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  // Holds the kind the dialog opens on, so "Receive" and "Issue" aren't the
  // same button; null means closed.
  const [movementKind, setMovementKind] = useState(null);
  const [pending, setPending] = useState(false);

  const variants = useMemo(
    () => items.filter((i) => i.parentId === item.id),
    [items, item.id],
  );
  const isGroup = variants.length > 0;

  useEffect(() => {
    let alive = true;
    Promise.all([
      listMovements(projectId, { itemId: item.id }),
      listAllocations(projectId, { itemId: item.id }),
      listEvents(projectId),
    ]).then(([moves, allocs, events]) => {
      if (!alive) return;
      setMovements(moves ?? []);
      setAllocations(allocs ?? []);
      const map = {};
      for (const e of events ?? []) map[e.id] = e.name;
      setEventNames(map);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, item.id]);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setSaving(true);
    const patch = {
      name: form.name,
      variantLabel: form.variantLabel,
      sku: form.sku,
      category: form.category,
      description: form.description,
      unitCost: Number(form.unitCost) || 0,
      unitPrice: Number(form.unitPrice) || 0,
      reorderPoint: Number(form.reorderPoint) || 0,
    };
    onPatch(item.id, patch);
    const saved = await updateItem(item.id, patch);
    setSaving(false);
    if (saved) toast.success("Item saved.");
    else toast.error("Couldn't save the item.");
  };

  // The photo is persisted on its own, not with the Save button, so uploading
  // feels immediate and can't be lost by closing the drawer.
  const handleImage = async (url) => {
    onPatch(item.id, { imageUrl: url });
    setForm((f) => ({ ...f, imageUrl: url }));
    const saved = await updateItem(item.id, { imageUrl: url });
    if (!saved) toast.error("Couldn't save the photo.");
  };

  const handleMovement = async ({ kind, qty: signed, reason, note }) => {
    setPending(true);
    const user = await getUser();
    const created = await recordMovement({
      projectId,
      itemId: item.id,
      kind,
      qty: signed,
      reason,
      note,
      createdBy: user?.id ?? null,
    });
    setPending(false);
    if (!created) {
      toast.error("Couldn't record the movement.");
      return;
    }
    setMovements((prev) => [created, ...prev]);
    const nextOnHand = Number(item.onHand || 0) + signed;
    onPatch(item.id, { onHand: nextOnHand });
    setForm((f) => ({ ...f, onHand: nextOnHand }));
    setMovementKind(null);
    toast.success("Stock updated.");
  };

  // One source of truth for the rollup — a group's figures come from its
  // variants, and worstStatus ranks out-of-stock above low-stock.
  const { onHand, stockValue: value, worstStatus } = useMemo(
    () => rollupItem(item, variants),
    [item, variants],
  );

  return (
    <>
      <SheetHeader className="border-b border-border px-5 py-4">
        <SheetTitle className="text-base">{itemLabel(item)}</SheetTitle>
        {/* Stock status rides on the meta line, right-aligned, rather than
            spending a whole stat tile on a single pill. */}
        <div className="flex items-center justify-between gap-3">
          <SheetDescription className="truncate">
            {[item.sku || null, item.category].filter(Boolean).join(" · ")}
          </SheetDescription>
          <StatusPill status={worstStatus} map={STOCK_STATUS_MAP} />
        </div>
      </SheetHeader>

      <ItemImageCard item={item} items={items} onChange={handleImage} />

      <div className="grid grid-cols-2 gap-2 px-5 py-4">
        <StatLine label="On hand" value={qty(onHand)} />
        <StatLine label="Stock value" value={currency(value)} />
      </div>

      {/* Suite tabs (@geiger/ui), same usage as Venue Sourcing / Housing &
          Travel — gap-0 so each panel's own pt-4 sets the spacing. */}
      <Tabs defaultValue="overview" className="gap-0 px-5 pb-6">
        <TabsList className="w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="stock">Stock</TabsTrigger>
          <TabsTrigger value="allocations">Events</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
        </TabsList>

        {/* Overview — editable fields, saved as one patch. */}
        <TabsContent value="overview" className="space-y-4 pt-4">
          <Field label="Name">
            <Input
              value={form.name}
              onChange={(e) => set("name")(e.target.value)}
              className="bg-surface-card"
            />
          </Field>

          {item.parentId ? (
            <Field label="Variant">
              <Input
                value={form.variantLabel}
                onChange={(e) => set("variantLabel")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <Field label="SKU">
              <Input
                value={form.sku}
                onChange={(e) => set("sku")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={set("category")}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ITEM_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Unit cost">
              <Input
                type="number"
                min="0"
                value={form.unitCost}
                onChange={(e) => set("unitCost")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Unit price">
              <Input
                type="number"
                min="0"
                value={form.unitPrice}
                onChange={(e) => set("unitPrice")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Reorder at">
              <Input
                type="number"
                min="0"
                value={form.reorderPoint}
                onChange={(e) => set("reorderPoint")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
          </div>

          <Field label="Description">
            <Textarea
              value={form.description}
              onChange={(e) => set("description")(e.target.value)}
              className="bg-surface-card h-[200px]"
            />
          </Field>

          <Button className="bg-primary w-full gap-2" onClick={save} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save Changes
          </Button>
        </TabsContent>

        {/* Stock — the item's ledger, newest first. */}
        <TabsContent value="stock" className="space-y-3 pt-4">
          {isGroup ? (
            <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-secondary">
              This item has variants, so stock is held on each variant. Open a
              variant to move its stock.
            </p>
          ) : (
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setMovementKind("receive")}
              >
                <ArrowDownToLine className="h-4 w-4" /> Receive
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => setMovementKind("issue")}
              >
                <ArrowUpFromLine className="h-4 w-4" /> Issue / adjust
              </Button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
            </div>
          ) : movements.length ? (
            <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
              {movements.map((m) => (
                <div key={m.id} className="flex items-start gap-3 px-3 py-2.5">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <StatusPill status={m.kind} map={MOVEMENT_KIND_MAP} />
                      <span
                        className={`text-sm font-semibold tabular-nums ${
                          m.qty < 0 ? "text-red-400" : "text-emerald-400"
                        }`}
                      >
                        {signedQty(m.qty)}
                      </span>
                    </div>
                    {m.reason || m.note ? (
                      <p className="mt-1 text-xs text-text-secondary">
                        {[m.reason, m.note].filter(Boolean).join(" — ")}
                      </p>
                    ) : null}
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {formatDateTime(m.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Package}
              title="No movements yet"
              description="Receiving stock or issuing it to an event will show up here."
            />
          )}
        </TabsContent>

        {/* Events — where this item is committed. */}
        <TabsContent value="allocations" className="space-y-3 pt-4">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading allocations…
            </div>
          ) : allocations.length ? (
            <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
              {allocations.map((a) => (
                <div key={a.id} className="px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-foreground">
                      {eventNames[a.eventId] || "Untitled event"}
                    </span>
                    <StatusPill status={a.status} map={ALLOCATION_STATUS_MAP} />
                  </div>
                  <p className="mt-1 text-xs text-text-secondary">
                    {qty(a.plannedQty)} planned · {qty(a.issuedQty)} issued ·{" "}
                    {ISSUANCE_MAP[a.issuance]?.label || "Internal"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Not allocated yet"
              description="Commit this item to an event from Event Allocations."
            />
          )}
        </TabsContent>

        {/* Variants — the leaf rows that actually hold stock. */}
        <TabsContent value="variants" className="space-y-3 pt-4">
          {item.parentId ? (
            <p className="rounded-lg border border-border bg-surface-card px-3 py-2 text-xs text-text-secondary">
              This is itself a variant. Variants cannot be nested further.
            </p>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => onAddVariant(item)}
              >
                <Plus className="h-4 w-4" /> Add variant
              </Button>
              {variants.length ? (
                <div className="divide-y divide-border rounded-lg border border-border bg-surface-card">
                  {variants.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between gap-2 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <ItemThumb item={v} items={items} size="sm" />
                        <div>
                          <span className="text-sm font-medium text-foreground">
                            {v.variantLabel || "Variant"}
                          </span>
                          <p className="text-xs text-text-secondary">
                            {v.sku || "—"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {qty(v.onHand)}
                        </span>
                        <StatusPill
                          status={stockStatus(v.onHand, v.reorderPoint)}
                          map={STOCK_STATUS_MAP}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Layers}
                  title="No variants"
                  description="Add sizes or colours to hold stock separately."
                />
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <MovementDialog
        key={movementKind || "movement-closed"}
        open={!!movementKind}
        onOpenChange={(o) => !o && setMovementKind(null)}
        item={item}
        initialKind={movementKind}
        pending={pending}
        onConfirm={handleMovement}
      />
    </>
  );
}

export function ItemDetailDrawer({
  item,
  items,
  projectId,
  onOpenChange,
  onPatch,
  onAddVariant,
}) {
  return (
    <Sheet open={!!item} onOpenChange={onOpenChange}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {item ? (
          <ItemDrawerBody
            key={item.id}
            item={item}
            items={items}
            projectId={projectId}
            onPatch={onPatch}
            onAddVariant={onAddVariant}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export default ItemDetailDrawer;
