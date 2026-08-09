"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Building2,
  Loader2,
  MoreHorizontal,
  PackageCheck,
  Plus,
  Receipt,
  Trash2,
  X,
} from "lucide-react";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@geiger/ui";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { listItems } from "@/lib/supabase/inventory";
import {
  listSuppliers,
  createSupplier,
  softDeleteSupplier,
  listPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  softDeletePurchaseOrder,
  receivePurchaseOrder,
} from "@/lib/supabase/inventory_purchasing";
import { stockableItems } from "@/lib/inventory/demand";

import { ItemThumb } from "./item_image";
import {
  EMPTY_SUPPLIER_DRAFT,
  PO_STATUS_FILTER_OPTIONS,
  PO_STATUS_MAP,
  PO_STATUS_OPTIONS,
  currency,
  formatDate,
  itemLabel,
  poRef,
  qty,
} from "./constants";

// --- Supplier dialog ---------------------------------------------------------

function SupplierDialog({ open, onOpenChange, onCreate, pending }) {
  const [draft, setDraft] = useState(EMPTY_SUPPLIER_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the supplier a name.");
      return;
    }
    onCreate(draft);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New supplier</DialogTitle>
          <DialogDescription>
            Who you buy stock from. Purchase orders are raised against a supplier.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Name">
            <Input
              value={draft.name}
              placeholder="Northside Print Co."
              onChange={(e) => set("name")(e.target.value)}
              className="bg-surface-card"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact" hint="Optional">
              <Input
                value={draft.contactName}
                onChange={(e) => set("contactName")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Email" hint="Optional">
              <Input
                type="email"
                value={draft.email}
                onChange={(e) => set("email")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Phone" hint="Optional">
              <Input
                value={draft.phone}
                onChange={(e) => set("phone")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Lead time" hint="Days from order to delivery">
              <Input
                type="number"
                min="0"
                value={draft.leadTimeDays}
                placeholder="0"
                onChange={(e) => set("leadTimeDays")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
          </div>

          <Field label="Website" hint="Optional">
            <Input
              value={draft.website}
              placeholder="https://"
              onChange={(e) => set("website")(e.target.value)}
              className="bg-surface-card"
            />
          </Field>

          <Field label="Notes" hint="Optional">
            <Textarea
              value={draft.notes}
              onChange={(e) => set("notes")(e.target.value)}
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
            Add supplier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Purchase order builder --------------------------------------------------

// `items` are the selectable leaves; `allItems` is the full catalog, so a
// variant's thumbnail can fall back to its parent's photo.
function PurchaseOrderDialog({
  open,
  onOpenChange,
  suppliers,
  items,
  allItems,
  onCreate,
  pending,
}) {
  const [supplierId, setSupplierId] = useState("");
  const [code, setCode] = useState("");
  const [expectedAt, setExpectedAt] = useState("");
  const [status, setStatus] = useState("Draft");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([{ itemId: "", qty: "", unitCost: "" }]);

  const setLine = (index, key, value) =>
    setLines((prev) =>
      prev.map((l, i) => (i === index ? { ...l, [key]: value } : l)),
    );

  const addLine = () =>
    setLines((prev) => [...prev, { itemId: "", qty: "", unitCost: "" }]);

  const removeLine = (index) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== index)));

  // Default the unit cost from the item so most lines need only a quantity.
  const pickItem = (index, itemId) => {
    const item = items.find((i) => i.id === itemId);
    setLines((prev) =>
      prev.map((l, i) =>
        i === index
          ? {
              ...l,
              itemId,
              unitCost: l.unitCost || String(item?.unitCost || ""),
            }
          : l,
      ),
    );
  };

  const total = useMemo(
    () =>
      lines.reduce(
        (s, l) => s + (Number(l.qty) || 0) * (Number(l.unitCost) || 0),
        0,
      ),
    [lines],
  );

  const submit = () => {
    const usable = lines.filter((l) => l.itemId && Number(l.qty) > 0);
    if (!usable.length) {
      toast.error("Add at least one line with an item and quantity.");
      return;
    }
    onCreate({
      supplierId: supplierId || null,
      code,
      status,
      expectedAt,
      notes,
      total,
      lines: usable.map((l) => {
        const item = items.find((i) => i.id === l.itemId);
        return {
          itemId: l.itemId,
          name: itemLabel(item),
          qty: Number(l.qty) || 0,
          unitCost: Number(l.unitCost) || 0,
          receivedQty: 0,
        };
      }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>New purchase order</DialogTitle>
          <DialogDescription>
            Raise an order against a supplier. Receiving it later is what puts the
            stock into your catalog.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Supplier">
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue placeholder="Choose a supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Reference" hint="Optional — a code is generated if blank">
              <Input
                value={code}
                placeholder="PO-2026-014"
                onChange={(e) => setCode(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expected" hint="Optional">
              <Input
                type="date"
                value={expectedAt}
                onChange={(e) => setExpectedAt(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PO_STATUS_OPTIONS.filter(
                    (s) => s.value === "Draft" || s.value === "Ordered",
                  ).map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label="Lines">
            <div className="space-y-2">
              {lines.map((line, index) => (
                <div key={index} className="flex items-end gap-2">
                  <ItemThumb
                    item={items.find((i) => i.id === line.itemId) || null}
                    items={allItems}
                    className="mb-0.5"
                  />
                  <div className="flex-1">
                    <Select
                      value={line.itemId}
                      onValueChange={(v) => pickItem(index, v)}
                    >
                      <SelectTrigger className="bg-surface-card">
                        <SelectValue placeholder="Choose an item" />
                      </SelectTrigger>
                      <SelectContent>
                        {items.map((i) => (
                          <SelectItem key={i.id} value={i.id}>
                            {itemLabel(i)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Input
                    type="number"
                    min="0"
                    value={line.qty}
                    placeholder="Qty"
                    onChange={(e) => setLine(index, "qty", e.target.value)}
                    className="w-24 bg-surface-card"
                  />
                  <Input
                    type="number"
                    min="0"
                    value={line.unitCost}
                    placeholder="Cost"
                    onChange={(e) => setLine(index, "unitCost", e.target.value)}
                    className="w-28 bg-surface-card"
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Remove line"
                    disabled={lines.length === 1}
                    onClick={() => removeLine(index)}
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" className="w-full gap-2" onClick={addLine}>
                <Plus className="h-4 w-4" /> Add line
              </Button>
            </div>
          </Field>

          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-card px-3 py-2">
            <span className="text-sm text-text-secondary">Order total</span>
            <span className="text-sm font-semibold text-foreground">
              {currency(total)}
            </span>
          </div>

          <Field label="Notes" hint="Optional">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            Create purchase order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Receive outstanding quantities, line by line. Defaults to receiving in full.
function ReceiveDialog({ open, onOpenChange, po, items, onConfirm, pending }) {
  const lines = useMemo(() => (Array.isArray(po?.lines) ? po.lines : []), [po]);
  const [amounts, setAmounts] = useState(() =>
    lines.map((l) => String(Math.max(0, l.qty - l.receivedQty))),
  );

  const submit = () => {
    const received = amounts.map((a) => Number(a) || 0);
    if (!received.some((n) => n > 0)) {
      toast.error("Enter a quantity on at least one line.");
      return;
    }
    onConfirm(received);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive {poRef(po)}</DialogTitle>
          <DialogDescription>
            Each line you receive writes a stock movement, so on-hand goes up by
            exactly what arrived.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {lines.map((line, index) => {
            const outstanding = Math.max(0, line.qty - line.receivedQty);
            return (
              <div
                key={index}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface-card px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <ItemThumb
                    item={items.find((i) => i.id === line.itemId) || null}
                    items={items}
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {line.name}
                    </p>
                    <p className="text-xs text-text-secondary">
                      {qty(line.receivedQty)} of {qty(line.qty)} received ·{" "}
                      {qty(outstanding)} outstanding
                    </p>
                  </div>
                </div>
                <Input
                  type="number"
                  min="0"
                  max={outstanding}
                  value={amounts[index] ?? ""}
                  disabled={!outstanding}
                  onChange={(e) =>
                    setAmounts((prev) =>
                      prev.map((a, i) => (i === index ? e.target.value : a)),
                    )
                  }
                  className="w-24 bg-surface-subtle"
                />
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary" onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Receive into stock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Screen ------------------------------------------------------------------

export function SuppliersPurchaseOrdersScreen() {
  const { projectId } = useProject();
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [poOpen, setPoOpen] = useState(false);
  const [receiving, setReceiving] = useState(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listSuppliers(projectId),
      listPurchaseOrders(projectId),
      listItems(projectId),
    ]).then(([sups, pos, rows]) => {
      if (!alive) return;
      setSuppliers(sups ?? []);
      setOrders(pos ?? []);
      setItems(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const stocked = useMemo(() => stockableItems(items), [items]);
  const itemsById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const suppliersById = useMemo(
    () => new Map(suppliers.map((s) => [s.id, s])),
    [suppliers],
  );

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((po) => {
      if (statusFilter !== "all" && po.status !== statusFilter) return false;
      if (q) {
        const supplier = suppliersById.get(po.supplierId)?.name || "";
        if (!`${poRef(po)} ${supplier} ${po.notes}`.toLowerCase().includes(q))
          return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, suppliersById]);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;
    return suppliers.filter((s) =>
      `${s.name} ${s.contactName} ${s.email}`.toLowerCase().includes(q),
    );
  }, [suppliers, search]);

  const stats = useMemo(() => {
    const open = orders.filter(
      (po) => po.status === "Ordered" || po.status === "Partial",
    );
    const onOrder = open.reduce(
      (s, po) =>
        s +
        (Array.isArray(po.lines) ? po.lines : []).reduce(
          (t, l) => t + Math.max(0, Number(l.qty || 0) - Number(l.receivedQty || 0)),
          0,
        ),
      0,
    );
    const committed = open.reduce((s, po) => s + Number(po.total || 0), 0);
    return [
      { label: "Suppliers", value: String(suppliers.length), footer: "On file" },
      {
        label: "Open orders",
        value: String(open.length),
        footer: `${orders.length} all-time`,
      },
      { label: "Units on order", value: qty(onOrder), footer: "Not yet received" },
      { label: "Committed spend", value: currency(committed), footer: "Open orders" },
    ];
  }, [suppliers, orders]);

  const handleCreateSupplier = async (draft) => {
    setPending(true);
    const user = await getUser();
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      name: draft.name.trim(),
      contactName: draft.contactName || "",
      email: draft.email || "",
      phone: draft.phone || "",
      website: draft.website || "",
      leadTimeDays: Number(draft.leadTimeDays) || 0,
      notes: draft.notes || "",
      config: {},
      createdBy: user?.id ?? null,
      createdAt: new Date().toISOString(),
    };
    setSuppliers((prev) => [optimistic, ...prev]);
    const created = await createSupplier(optimistic);
    setPending(false);
    if (!created) {
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      toast.error("Couldn't save the supplier.");
      return;
    }
    setSuppliers((prev) => prev.map((s) => (s.id === id ? created : s)));
    setSupplierOpen(false);
    toast.success("Supplier added.");
  };

  const handleDeleteSupplier = async (supplier) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== supplier.id));
    toast.success("Supplier removed.");
    const ok = await softDeleteSupplier(supplier.id);
    if (!ok) {
      setSuppliers((prev) => [supplier, ...prev]);
      toast.error("Couldn't remove the supplier.");
    }
  };

  const handleCreatePo = async (draft) => {
    setPending(true);
    const user = await getUser();
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      ...draft,
      code: draft.code || "",
      currency: "USD",
      orderedAt: draft.status === "Ordered" ? new Date().toISOString().slice(0, 10) : "",
      receivedAt: "",
      config: {},
      createdBy: user?.id ?? null,
      createdAt: new Date().toISOString(),
    };
    setOrders((prev) => [optimistic, ...prev]);
    const created = await createPurchaseOrder(optimistic);
    setPending(false);
    if (!created) {
      setOrders((prev) => prev.filter((p) => p.id !== id));
      toast.error("Couldn't save the purchase order.");
      return;
    }
    setOrders((prev) => prev.map((p) => (p.id === id ? created : p)));
    setPoOpen(false);
    toast.success("Purchase order created.");
  };

  const handleStatus = async (po, status) => {
    setOrders((prev) => prev.map((p) => (p.id === po.id ? { ...p, status } : p)));
    const patch = { status };
    if (status === "Ordered" && !po.orderedAt) {
      patch.orderedAt = new Date().toISOString().slice(0, 10);
    }
    const saved = await updatePurchaseOrder(po.id, patch);
    if (!saved) {
      setOrders((prev) =>
        prev.map((p) => (p.id === po.id ? { ...p, status: po.status } : p)),
      );
      toast.error("Couldn't update the purchase order.");
    }
  };

  const handleDeletePo = async (po) => {
    setOrders((prev) => prev.filter((p) => p.id !== po.id));
    toast.success("Purchase order removed.");
    const ok = await softDeletePurchaseOrder(po.id);
    if (!ok) {
      setOrders((prev) => [po, ...prev]);
      toast.error("Couldn't remove the purchase order.");
    }
  };

  // Receiving writes the movements first, so a failure leaves stock untouched.
  const handleReceive = async (received) => {
    setPending(true);
    const saved = await receivePurchaseOrder(receiving, received);
    setPending(false);
    if (!saved) {
      toast.error("Couldn't receive this purchase order.");
      return;
    }
    setOrders((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
    // Sum per item — the same item can legitimately appear on more than one line.
    const receivedByItem = new Map();
    const tally = (lines, sign) => {
      for (const l of lines || []) {
        receivedByItem.set(
          l.itemId,
          (receivedByItem.get(l.itemId) || 0) + sign * Number(l.receivedQty || 0),
        );
      }
    };
    tally(receiving.lines, -1);
    tally(saved.lines, 1);
    setItems((prev) =>
      prev.map((item) => {
        const delta = receivedByItem.get(item.id) || 0;
        return delta ? { ...item, onHand: Number(item.onHand || 0) + delta } : item;
      }),
    );
    setReceiving(null);
    toast.success("Stock received.");
  };

  const orderColumns = [
    {
      key: "po",
      header: "Purchase order",
      // Takes the table's spare width so the rest hug their values.
      className: "w-full",
      headClassName: "w-full whitespace-nowrap",
      render: (po) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{poRef(po)}</span>
          <span className="truncate text-xs text-text-secondary">
            {suppliersById.get(po.supplierId)?.name || "No supplier"}
          </span>
        </div>
      ),
    },
    {
      key: "lines",
      header: "Lines",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      // A stack of product photos makes an order recognisable at a glance;
      // anything past the first three collapses into a "+N".
      render: (po) => {
        const lines = po.lines || [];
        const shown = lines.slice(0, 3);
        return (
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {shown.map((line, index) => (
                <ItemThumb
                  key={`${line.itemId}-${index}`}
                  item={itemsById.get(line.itemId) || null}
                  items={items}
                  size="sm"
                  className="ring-2 ring-surface-subtle"
                />
              ))}
            </div>
            <span className="text-sm text-text-secondary">
              {lines.length > shown.length
                ? `+${lines.length - shown.length}`
                : `${lines.length} line${lines.length === 1 ? "" : "s"}`}
            </span>
          </div>
        );
      },
    },
    {
      key: "received",
      header: "Received",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (po) => {
        const lines = po.lines || [];
        const ordered = lines.reduce((s, l) => s + Number(l.qty || 0), 0);
        const got = lines.reduce((s, l) => s + Number(l.receivedQty || 0), 0);
        return `${qty(got)} / ${qty(ordered)}`;
      },
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (po) => <StatusPill status={po.status} map={PO_STATUS_MAP} />,
    },
    {
      key: "expected",
      header: "Expected",
      align: "right",
      className: "whitespace-nowrap text-right text-text-tertiary",
      headClassName: "whitespace-nowrap",
      render: (po) => <span className="text-xs">{formatDate(po.expectedAt)}</span>,
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      className: "whitespace-nowrap text-right font-semibold tabular-nums text-white",
      headClassName: "whitespace-nowrap",
      render: (po) => currency(po.total),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (po) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Purchase order actions"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48 border-border bg-surface-card shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                disabled={po.status === "Received" || po.status === "Cancelled"}
                onClick={() => setReceiving(po)}
              >
                <PackageCheck className="h-4 w-4" /> Receive stock
              </DropdownMenuItem>
              {po.status === "Draft" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => handleStatus(po, "Ordered")}
                >
                  <Receipt className="h-4 w-4" /> Mark ordered
                </DropdownMenuItem>
              ) : null}
              {po.status !== "Cancelled" && po.status !== "Received" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => handleStatus(po, "Cancelled")}
                >
                  Cancel order
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => handleDeletePo(po)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  const supplierColumns = [
    {
      key: "supplier",
      header: "Supplier",
      // Takes the table's spare width so the rest hug their values.
      className: "w-full",
      headClassName: "w-full",
      render: (s) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium text-foreground">{s.name}</span>
          <span className="truncate text-xs text-text-secondary">
            {s.contactName || "—"}
          </span>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (s) => (
        <span className="text-sm text-text-secondary">
          {[s.email || null, s.phone || null].filter(Boolean).join(" · ") || "—"}
        </span>
      ),
    },
    {
      key: "lead",
      header: "Lead time",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (s) => (s.leadTimeDays ? `${s.leadTimeDays} days` : "—"),
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (s) => String(orders.filter((po) => po.supplierId === s.id).length),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Supplier actions"
                className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-44 border-border bg-surface-card shadow-xl"
            >
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => handleDeleteSupplier(s)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Remove
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Suppliers & Purchase Orders"
        description="Who you buy from, and what's on its way. Receiving a purchase order is the only route stock enters your catalog."
        actions={
          tab === "orders" ? (
            <Button
              className="bg-primary gap-2"
              onClick={() => setPoOpen(true)}
              disabled={!stocked.length}
            >
              <Plus className="h-4 w-4" /> New purchase order
            </Button>
          ) : (
            <Button className="bg-primary gap-2" onClick={() => setSupplierOpen(true)}>
              <Plus className="h-4 w-4" /> New supplier
            </Button>
          )
        }
      />

      <StatsBar stats={stats} />

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" className="gap-1.5">
            <Receipt className="h-4 w-4" /> Purchase orders
          </TabsTrigger>
          <TabsTrigger value="suppliers" className="gap-1.5">
            <Building2 className="h-4 w-4" /> Suppliers
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders" className="space-y-4">
          <Toolbar>
            <FilterDropdown
              value={statusFilter}
              onValueChange={setStatusFilter}
              options={PO_STATUS_FILTER_OPTIONS}
              height="h-9"
            />
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search reference or supplier…"
            />
          </Toolbar>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading purchase orders…
            </div>
          ) : (
            <DataTable
              columns={orderColumns}
              data={filteredOrders}
              getRowKey={(po) => po.id}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={Receipt}
                    title={
                      orders.length
                        ? "No purchase orders match your filters"
                        : "No purchase orders yet"
                    }
                    description={
                      orders.length
                        ? "Try clearing the search or filters."
                        : "Raise an order against a supplier, then receive it to put stock into your catalog."
                    }
                  />
                </div>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Toolbar>
            <span className="text-sm text-text-tertiary">
              {suppliers.length} supplier{suppliers.length === 1 ? "" : "s"}
            </span>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search supplier or contact…"
            />
          </Toolbar>

          {loading ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading suppliers…
            </div>
          ) : (
            <DataTable
              columns={supplierColumns}
              data={filteredSuppliers}
              getRowKey={(s) => s.id}
              empty={
                <div className="rounded-xl border border-border bg-surface-subtle">
                  <EmptyState
                    icon={Building2}
                    title={
                      suppliers.length
                        ? "No suppliers match your search"
                        : "No suppliers yet"
                    }
                    description={
                      suppliers.length
                        ? "Try a different search."
                        : "Add the vendors you buy merch and supplies from."
                    }
                  />
                </div>
              }
            />
          )}
        </TabsContent>
      </Tabs>

      <SupplierDialog
        key={supplierOpen ? "supplier-open" : "supplier-closed"}
        open={supplierOpen}
        onOpenChange={setSupplierOpen}
        pending={pending}
        onCreate={handleCreateSupplier}
      />

      <PurchaseOrderDialog
        key={poOpen ? "po-open" : "po-closed"}
        open={poOpen}
        onOpenChange={setPoOpen}
        suppliers={suppliers}
        items={stocked}
        allItems={items}
        pending={pending}
        onCreate={handleCreatePo}
      />

      <ReceiveDialog
        key={receiving ? `receive-${receiving.id}` : "receive-closed"}
        open={!!receiving}
        onOpenChange={(o) => !o && setReceiving(null)}
        po={receiving}
        items={items}
        pending={pending}
        onConfirm={handleReceive}
      />
    </MainScreenWrapper>
  );
}

export default SuppliersPurchaseOrdersScreen;
