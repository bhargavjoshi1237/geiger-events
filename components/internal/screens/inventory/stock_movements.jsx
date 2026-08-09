"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeftRight, History, Loader2, Plus } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import {
  DataTable,
  EmptyState,
  Field,
  ScreenHeader,
  SearchInput,
  StatsBar,
  StatusPill,
  Toolbar,
} from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import FilterDropdown from "@/components/internal/screens/overview/filter_dropdown";
import { useProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import { listEvents } from "@/lib/supabase/events";
import { listItems, listMovements, recordMovement } from "@/lib/supabase/inventory";
import { stockableItems } from "@/lib/inventory/demand";

import { ItemThumb } from "./item_image";
import {
  MOVEMENT_KIND_FILTER_OPTIONS,
  MOVEMENT_KIND_MAP,
  MOVEMENT_KIND_OPTIONS,
  formatDateTime,
  itemLabel,
  movementDirection,
  qty,
  signedQty,
} from "./constants";

// Record a movement against any stocked item. Only leaf items are selectable —
// a parent with variants holds no stock of its own.
// `items` are the selectable leaves; `allItems` is the full catalog, needed so a
// variant's thumbnail can fall back to its parent's photo.
function RecordMovementDialog({
  open,
  onOpenChange,
  items,
  allItems,
  onConfirm,
  pending,
}) {
  const [itemId, setItemId] = useState("");
  const [kind, setKind] = useState("receive");
  const [amount, setAmount] = useState("");
  const [direction, setDirection] = useState("in");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");

  const fixed = movementDirection(kind);
  const effective = fixed === "either" ? direction : fixed;
  const item = items.find((i) => i.id === itemId) || null;

  const submit = () => {
    if (!itemId) {
      toast.error("Pick an item.");
      return;
    }
    const value = Number(amount) || 0;
    if (value <= 0) {
      toast.error("Enter a quantity above zero.");
      return;
    }
    const signed = effective === "out" ? -value : value;
    if (signed < 0 && Math.abs(signed) > Number(item?.onHand || 0)) {
      toast.error(`Only ${qty(item?.onHand)} on hand for ${itemLabel(item)}.`);
      return;
    }
    onConfirm({ itemId, kind, qty: signed, reason, note });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record stock movement</DialogTitle>
          <DialogDescription>
            The ledger is append-only — correct a mistake with an opposite
            movement rather than an edit.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Item">
            <div className="flex items-center gap-2.5">
              <ItemThumb item={item} items={allItems} />
              <Select value={itemId} onValueChange={setItemId}>
                <SelectTrigger className="flex-1 bg-surface-card">
                  <SelectValue placeholder="Choose an item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {itemLabel(i)} · {qty(i.onHand)} on hand
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </Field>

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
            <Field label="Direction">
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

export function StockMovementsScreen() {
  const { projectId } = useProject();
  const [movements, setMovements] = useState([]);
  const [items, setItems] = useState([]);
  const [eventNames, setEventNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("all");
  const [itemFilter, setItemFilter] = useState("all");
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listMovements(projectId),
      listItems(projectId),
      listEvents(projectId),
    ]).then(([moves, rows, events]) => {
      if (!alive) return;
      setMovements(moves ?? []);
      setItems(rows ?? []);
      const map = {};
      for (const e of events ?? []) map[e.id] = e.name;
      setEventNames(map);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const itemsById = useMemo(
    () => new Map(items.map((i) => [i.id, i])),
    [items],
  );
  const stocked = useMemo(() => stockableItems(items), [items]);

  const itemFilterOptions = useMemo(
    () => [
      { value: "all", label: "All items" },
      ...stocked.map((i) => ({ value: i.id, label: itemLabel(i) })),
    ],
    [stocked],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return movements.filter((m) => {
      if (kind !== "all" && m.kind !== kind) return false;
      if (itemFilter !== "all" && m.itemId !== itemFilter) return false;
      if (q) {
        const label = itemLabel(itemsById.get(m.itemId));
        const hay = `${label} ${m.reason} ${m.note} ${m.reference}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [movements, search, kind, itemFilter, itemsById]);

  const stats = useMemo(() => {
    const sum = (predicate) =>
      movements
        .filter(predicate)
        .reduce((s, m) => s + Math.abs(Number(m.qty) || 0), 0);
    const received = sum((m) => m.kind === "receive" || m.kind === "return");
    const issued = sum((m) => m.kind === "issue" || m.kind === "transfer");
    const wasted = sum((m) => m.kind === "waste");
    const net = movements.reduce((s, m) => s + (Number(m.qty) || 0), 0);
    return [
      { label: "Into stock", value: qty(received), footer: "Received + returned" },
      { label: "Out of stock", value: qty(issued), footer: "Issued + transferred" },
      { label: "Written off", value: qty(wasted), footer: "Waste and damage" },
      { label: "Net change", value: signedQty(net), footer: "Across all movements" },
    ];
  }, [movements]);

  const handleRecord = async ({ itemId, kind: moveKind, qty: signed, reason, note }) => {
    setPending(true);
    const user = await getUser();
    const created = await recordMovement({
      projectId,
      itemId,
      kind: moveKind,
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
    setItems((prev) =>
      prev.map((i) =>
        i.id === itemId ? { ...i, onHand: Number(i.onHand || 0) + signed } : i,
      ),
    );
    setCreating(false);
    toast.success("Stock updated.");
  };

  const columns = [
    {
      key: "item",
      header: "Item",
      // Takes the table's spare width so the rest hug their values.
      className: "w-full",
      headClassName: "w-full",
      render: (m) => {
        const item = itemsById.get(m.itemId);
        return (
          <div className="flex items-center gap-3">
            <ItemThumb item={item} items={items} />
            <div className="flex flex-col gap-1">
              <span className="font-medium text-foreground">
                {item ? itemLabel(item) : "Deleted item"}
              </span>
              <span className="text-xs text-text-secondary">
                {[m.reason || null, m.reference || null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            </div>
          </div>
        );
      },
    },
    {
      key: "kind",
      header: "Movement",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (m) => <StatusPill status={m.kind} map={MOVEMENT_KIND_MAP} />,
    },
    {
      key: "event",
      header: "Event",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (m) => (
        <span className="text-sm text-text-secondary">
          {m.eventId ? eventNames[m.eventId] || "Untitled event" : "—"}
        </span>
      ),
    },
    {
      key: "qty",
      header: "Change",
      align: "right",
      className: "whitespace-nowrap text-right font-semibold tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (m) => (
        <span className={m.qty < 0 ? "text-red-400" : "text-emerald-400"}>
          {signedQty(m.qty)}
        </span>
      ),
    },
    {
      key: "date",
      header: "Recorded",
      align: "right",
      className: "whitespace-nowrap text-right text-text-tertiary",
      headClassName: "whitespace-nowrap",
      render: (m) => <span className="text-xs">{formatDateTime(m.createdAt)}</span>,
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Stock Movements"
        description="Every change to stock, newest first. The ledger is append-only — on-hand is derived from it, so it can never drift."
        actions={
          <Button
            className="bg-primary gap-2"
            onClick={() => setCreating(true)}
            disabled={!stocked.length}
          >
            <Plus className="h-4 w-4" /> Record movement
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={kind}
            onValueChange={setKind}
            options={MOVEMENT_KIND_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={itemFilter}
            onValueChange={setItemFilter}
            options={itemFilterOptions}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search item, reason, reference…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading movements…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          getRowKey={(m) => m.id}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={movements.length ? ArrowLeftRight : History}
                title={
                  movements.length
                    ? "No movements match your filters"
                    : "No movements yet"
                }
                description={
                  movements.length
                    ? "Try clearing the search or filters."
                    : "Receiving stock, issuing it to an event, or writing it off will show up here."
                }
                action={
                  movements.length ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearch("");
                        setKind("all");
                        setItemFilter("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          }
        />
      )}

      <RecordMovementDialog
        key={creating ? "record-open" : "record-closed"}
        open={creating}
        onOpenChange={setCreating}
        items={stocked}
        allItems={items}
        pending={pending}
        onConfirm={handleRecord}
      />
    </MainScreenWrapper>
  );
}

export default StockMovementsScreen;
