"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  ChevronDown,
  ChevronRight,
  Layers,
  Loader2,
  MoreHorizontal,
  Package,
  Plus,
  SlidersHorizontal,
  Trash2,
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
import {
  listItems,
  createItem,
  updateItem,
  softDeleteItem,
  recordMovement,
  listAllocations,
} from "@/lib/supabase/inventory";
import { uploadInventoryImage } from "@/lib/supabase/storage";
import { buildItemTree, allocatedByItem } from "@/lib/inventory/demand";

import { ItemDetailDrawer } from "./item_detail_drawer";
import { ItemImagePicker, ItemThumb } from "./item_image";
import {
  CATEGORY_FILTER_OPTIONS,
  EMPTY_ITEM_DRAFT,
  EMPTY_VARIANT_DRAFT,
  ITEM_CATEGORIES,
  STOCK_STATUS_FILTER_OPTIONS,
  STOCK_STATUS_MAP,
  currency,
  qty,
  stockStatus,
} from "./constants";

function NumField({ label, hint, value, onChange, placeholder = "0" }) {
  return (
    <Field label={label} hint={hint}>
      <Input
        type="number"
        min="0"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="bg-surface-card"
      />
    </Field>
  );
}

function CreateItemDialog({ open, onOpenChange, onCreate, pending }) {
  const [draft, setDraft] = useState(EMPTY_ITEM_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the item a name.");
      return;
    }
    onCreate(draft, () => setDraft(EMPTY_ITEM_DRAFT));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>New inventory item</DialogTitle>
          <DialogDescription>
            Add a product to the catalog. You can add sizes or colours as variants
            once it exists.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Photo">
            <ItemImagePicker
              file={draft.imageFile}
              onFile={set("imageFile")}
              category={draft.category}
            />
          </Field>

          <Field label="Name">
            <Input
              value={draft.name}
              placeholder="Conference t-shirt"
              onChange={(e) => set("name")(e.target.value)}
              className="bg-surface-card"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="SKU" hint="Optional">
              <Input
                value={draft.sku}
                placeholder="TSHIRT-2026"
                onChange={(e) => set("sku")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="Category">
              <Select value={draft.category} onValueChange={set("category")}>
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

          <div className="grid gap-4 sm:grid-cols-3">
            <NumField
              label="Unit cost"
              hint="What you pay"
              value={draft.unitCost}
              onChange={set("unitCost")}
            />
            <NumField
              label="Unit price"
              hint="What you charge"
              value={draft.unitPrice}
              onChange={set("unitPrice")}
            />
            <NumField
              label="Reorder at"
              hint="0 = no alert"
              value={draft.reorderPoint}
              onChange={set("reorderPoint")}
            />
          </div>

          <NumField
            label="Opening stock"
            hint="Recorded as a receive movement"
            value={draft.openingStock}
            onChange={set("openingStock")}
          />

          <Field label="Description" hint="Optional">
            <Textarea
              value={draft.description}
              placeholder="Unisex fit, organic cotton."
              onChange={(e) => set("description")(e.target.value)}
              className="bg-surface-card"
            />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddVariantDialog({ open, onOpenChange, parent, onCreate, pending }) {
  const [draft, setDraft] = useState(EMPTY_VARIANT_DRAFT);
  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = () => {
    if (!draft.variantLabel.trim()) {
      toast.error("Name the variant (e.g. Large).");
      return;
    }
    onCreate(draft, () => setDraft(EMPTY_VARIANT_DRAFT));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add variant</DialogTitle>
          <DialogDescription>
            Variants of {parent?.name || "this item"} hold their own stock. The
            parent shows the combined total.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Field label="Photo" hint="Optional — falls back to the group photo">
            <ItemImagePicker
              file={draft.imageFile}
              onFile={set("imageFile")}
              category={parent?.category}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Variant">
              <Input
                value={draft.variantLabel}
                placeholder="Large"
                onChange={(e) => set("variantLabel")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
            <Field label="SKU" hint="Optional">
              <Input
                value={draft.sku}
                placeholder="TSHIRT-2026-L"
                onChange={(e) => set("sku")(e.target.value)}
                className="bg-surface-card"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <NumField
              label="Unit cost"
              value={draft.unitCost}
              onChange={set("unitCost")}
            />
            <NumField
              label="Unit price"
              value={draft.unitPrice}
              onChange={set("unitPrice")}
            />
            <NumField
              label="Reorder at"
              value={draft.reorderPoint}
              onChange={set("reorderPoint")}
            />
          </div>

          <NumField
            label="Opening stock"
            hint="Recorded as a receive movement"
            value={draft.openingStock}
            onChange={set("openingStock")}
          />
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
            disabled={pending}
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Add variant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InventoryItemsScreen() {
  const { projectId } = useProject();
  const [items, setItems] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [stock, setStock] = useState("all");
  const [expanded, setExpanded] = useState(() => new Set());
  const [openId, setOpenId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [variantParent, setVariantParent] = useState(null);
  const [pending, setPending] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([listItems(projectId), listAllocations(projectId)]).then(
      ([rows, allocs]) => {
        if (!alive) return;
        setItems(rows ?? []);
        setAllocations(allocs ?? []);
        setLoading(false);
      },
    );
    return () => {
      alive = false;
    };
  }, [projectId]);

  const allocated = useMemo(() => allocatedByItem(allocations), [allocations]);
  const tree = useMemo(() => buildItemTree(items), [items]);

  const filteredTree = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matches = (row, rollup) => {
      if (category !== "all" && row.category !== category) return false;
      if (
        stock !== "all" &&
        stockStatus(
          rollup ? rollup.onHand : row.onHand,
          rollup ? rollup.reorderPoint : row.reorderPoint,
        ) !== stock
      )
        return false;
      if (q && !`${row.name} ${row.variantLabel} ${row.sku}`.toLowerCase().includes(q))
        return false;
      return true;
    };

    return tree
      .map((group) => {
        const keptVariants = group.variants.filter((v) =>
          matches({ ...v, category: group.category }, null),
        );
        if (matches(group, group)) return { ...group, variants: group.variants };
        if (keptVariants.length) return { ...group, variants: keptVariants };
        return null;
      })
      .filter(Boolean);
  }, [tree, search, category, stock]);

  const rows = useMemo(() => {
    const out = [];
    for (const group of filteredTree) {
      out.push({ ...group, rowType: "group" });
      if (expanded.has(group.id)) {
        for (const v of group.variants) {
          out.push({ ...v, rowType: "variant", parent: group });
        }
      }
    }
    return out;
  }, [filteredTree, expanded]);

  const stats = useMemo(() => {
    const leafCount = items.filter(
      (i) => !items.some((c) => c.parentId === i.id),
    ).length;
    const value = tree.reduce((s, g) => s + g.stockValue, 0);
    const low = tree.filter((g) => g.worstStatus !== "In stock").length;
    const committed = [...allocated.values()].reduce((s, n) => s + n, 0);
    return [
      {
        label: "Items",
        value: String(tree.length),
        footer: `${leafCount} stocked SKU${leafCount === 1 ? "" : "s"}`,
      },
      { label: "Stock value", value: currency(value), footer: "At unit cost" },
      {
        label: "Needs attention",
        value: String(low),
        footer: "Low or out of stock",
      },
      {
        label: "Allocated",
        value: qty(committed),
        footer: "Committed to events",
      },
    ];
  }, [items, tree, allocated]);

  const hasGroups = useMemo(
    () => filteredTree.some((g) => g.variants.length > 0),
    [filteredTree],
  );

  const openItem = useMemo(
    () => (openId ? items.find((i) => i.id === openId) || null : null),
    [openId, items],
  );

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleCreate = async (draft, reset, parent = null) => {
    setPending(true);
    const user = await getUser();
    const id = crypto.randomUUID();
    const optimistic = {
      id,
      projectId,
      parentId: parent?.id ?? null,
      sku: draft.sku || "",
      name: parent ? parent.name : draft.name.trim(),
      variantLabel: draft.variantLabel || "",
      category: parent ? parent.category : draft.category,
      description: draft.description || "",
      imageUrl: "",
      unitCost: Number(draft.unitCost) || 0,
      unitPrice: Number(draft.unitPrice) || 0,
      currency: "USD",
      reorderPoint: Number(draft.reorderPoint) || 0,
      onHand: 0,
      active: true,
      config: {},
      createdBy: user?.id ?? null,
      createdAt: new Date().toISOString(),
    };

    setItems((prev) => [optimistic, ...prev]);
    const created = await createItem(optimistic);
    if (!created) {
      setItems((prev) => prev.filter((i) => i.id !== id));
      setPending(false);
      toast.error("Couldn't save the item.");
      return;
    }

    const opening = Number(draft.openingStock) || 0;
    if (opening > 0) {
      const movement = await recordMovement({
        projectId,
        itemId: id,
        kind: "receive",
        qty: opening,
        reason: "Opening stock",
        createdBy: user?.id ?? null,
      });
      if (movement) created.onHand = opening;
      else toast.error("Item saved, but the opening stock didn't record.");
    }

    if (draft.imageFile) {
      const uploaded = await uploadInventoryImage(id, draft.imageFile);
      if (uploaded?.url && (await updateItem(id, { imageUrl: uploaded.url }))) {
        created.imageUrl = uploaded.url;
      } else {
        toast.error("Item saved, but the photo didn't upload.");
      }
    }

    setItems((prev) => prev.map((i) => (i.id === id ? created : i)));
    if (parent) setExpanded((prev) => new Set(prev).add(parent.id));
    setPending(false);
    reset();
    setCreating(false);
    setVariantParent(null);
    toast.success(parent ? "Variant added." : "Item created.");
  };

  const applyItemPatch = (id, patch) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  const confirmDelete = (item) => {
    setDeleteTarget(null);
    const removed = items.filter((i) => i.id === item.id || i.parentId === item.id);
    setItems((prev) =>
      prev.filter((i) => i.id !== item.id && i.parentId !== item.id),
    );
    if (openId === item.id) setOpenId(null);
    toast.success("Item deleted.");
    softDeleteItem(item.id).then((ok) => {
      if (!ok) {
        setItems((prev) => [...removed, ...prev]);
        toast.error("Couldn't delete the item.");
      }
    });
  };

  const columns = [
    {
      key: "item",
      header: "Item",
      className: "w-full",
      headClassName: "w-full",
      render: (row) => {
        const isVariant = row.rowType === "variant";
        const hasVariants = row.rowType === "group" && row.variants.length > 0;
        return (
          <div className="flex items-center gap-3">
            {hasVariants ? (
              <button
                type="button"
                aria-label={expanded.has(row.id) ? "Collapse variants" : "Expand variants"}
                onClick={(e) => {
                  e.stopPropagation();
                  toggle(row.id);
                }}
                className="rounded p-0.5 text-text-tertiary hover:bg-surface-hover hover:text-foreground"
              >
                {expanded.has(row.id) ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : hasGroups ? (
              <span className="w-5 shrink-0" />
            ) : null}
            <ItemThumb
              item={row}
              items={items}
              size={isVariant ? "sm" : "md"}
              className={isVariant ? "ml-4" : ""}
            />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium text-foreground">
                {isVariant ? row.variantLabel || "Variant" : row.name}
              </span>
              <span className="truncate text-xs text-text-secondary">
                {[row.sku || null, isVariant ? null : row.category]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </span>
            </div>
            {hasVariants ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-card px-2 py-0.5 text-[11px] text-text-tertiary">
                <Layers className="h-3 w-3" />
                {row.variants.length}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      key: "stock",
      header: "On hand",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (row) => (
        <span className="font-semibold text-foreground">{qty(row.onHand)}</span>
      ),
    },
    {
      key: "allocated",
      header: "Allocated",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums text-text-secondary",
      headClassName: "whitespace-nowrap",
      render: (row) => {
        const committed =
          row.rowType === "group" && row.variants.length
            ? row.variants.reduce((s, v) => s + (allocated.get(v.id) || 0), 0)
            : allocated.get(row.id) || 0;
        return <span>{committed ? qty(committed) : "—"}</span>;
      },
    },
    {
      key: "available",
      header: "Available",
      align: "right",
      className: "whitespace-nowrap text-right tabular-nums",
      headClassName: "whitespace-nowrap",
      render: (row) => {
        const committed =
          row.rowType === "group" && row.variants.length
            ? row.variants.reduce((s, v) => s + (allocated.get(v.id) || 0), 0)
            : allocated.get(row.id) || 0;
        const available = row.onHand - committed;
        return (
          <span
            className={
              available < 0 ? "font-semibold text-red-400" : "text-text-secondary"
            }
          >
            {qty(available)}
          </span>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      className: "whitespace-nowrap",
      headClassName: "whitespace-nowrap",
      render: (row) => (
        <StatusPill
          status={
            row.rowType === "group"
              ? row.worstStatus
              : stockStatus(row.onHand, row.reorderPoint)
          }
          map={STOCK_STATUS_MAP}
        />
      ),
    },
    {
      key: "value",
      header: "Value",
      align: "right",
      className: "whitespace-nowrap text-right font-semibold tabular-nums text-white",
      headClassName: "whitespace-nowrap",
      render: (row) =>
        currency(
          row.rowType === "group" && row.variants.length
            ? row.stockValue
            : row.onHand * row.unitCost,
        ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      className: "text-right",
      render: (row) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Item actions"
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
                onClick={() => setOpenId(row.id)}
              >
                <SlidersHorizontal className="h-4 w-4" /> Open item
              </DropdownMenuItem>
              {row.rowType === "group" ? (
                <DropdownMenuItem
                  className="cursor-pointer gap-2 text-muted-foreground focus:bg-surface-hover focus:text-foreground"
                  onClick={() => setVariantParent(row)}
                >
                  <Layers className="h-4 w-4" /> Add variant
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator className="bg-surface-strong" />
              <DropdownMenuItem
                className="cursor-pointer gap-2 text-red-300 focus:bg-red-500/10 focus:text-red-300"
                onClick={() => setDeleteTarget(row)}
              >
                <Trash2 className="h-4 w-4 text-red-300" /> Delete
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
        title="Items"
        description="Your merch and stock catalog. Track what you hold, what's committed to upcoming events, and what needs reordering."
        actions={
          <Button
            className="bg-primary gap-2 text-primary-foreground hover:bg-primary/90"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" /> New item
          </Button>
        }
      />

      <StatsBar stats={stats} />

      <Toolbar>
        <div className="flex items-center gap-2">
          <FilterDropdown
            value={category}
            onValueChange={setCategory}
            options={CATEGORY_FILTER_OPTIONS}
            height="h-9"
          />
          <FilterDropdown
            value={stock}
            onValueChange={setStock}
            options={STOCK_STATUS_FILTER_OPTIONS}
            height="h-9"
          />
        </div>
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search name, variant, SKU…"
        />
      </Toolbar>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading inventory…
        </div>
      ) : (
        <DataTable
          columns={columns}
          data={rows}
          getRowKey={(row) => row.id}
          onRowClick={(row) => setOpenId(row.id)}
          empty={
            <div className="rounded-xl border border-border bg-surface-subtle">
              <EmptyState
                icon={items.length ? Boxes : Package}
                title={items.length ? "No items match your filters" : "No items yet"}
                description={
                  items.length
                    ? "Try clearing the search or filters."
                    : "Add your merch, swag and supplies to start tracking stock."
                }
                action={
                  items.length ? (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSearch("");
                        setCategory("all");
                        setStock("all");
                      }}
                    >
                      Clear filters
                    </Button>
                  ) : (
                    <Button
                      className="bg-primary gap-2 text-primary-foreground hover:bg-primary/90"
                      onClick={() => setCreating(true)}
                    >
                      <Plus className="h-4 w-4" /> New item
                    </Button>
                  )
                }
              />
            </div>
          }
        />
      )}

      <CreateItemDialog
        key={creating ? "create-open" : "create-closed"}
        open={creating}
        onOpenChange={setCreating}
        pending={pending}
        onCreate={(draft, reset) => handleCreate(draft, reset)}
      />

      <AddVariantDialog
        key={variantParent ? `variant-${variantParent.id}` : "variant-closed"}
        open={!!variantParent}
        onOpenChange={(o) => !o && setVariantParent(null)}
        parent={variantParent}
        pending={pending}
        onCreate={(draft, reset) => handleCreate(draft, reset, variantParent)}
      />

      <ItemDetailDrawer
        item={openItem}
        items={items}
        projectId={projectId}
        onOpenChange={(o) => !o && setOpenId(null)}
        onPatch={applyItemPatch}
        onAddVariant={(parent) => {
          setOpenId(null);
          setVariantParent(parent);
        }}
      />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete item</DialogTitle>
            <DialogDescription>
              Delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span>?
              {deleteTarget?.variants?.length
                ? ` Its ${deleteTarget.variants.length} variant${
                    deleteTarget.variants.length === 1 ? "" : "s"
                  } and stock ledger go too.`
                : " Its stock ledger goes too."}{" "}
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              className="bg-red-500/90 text-white hover:bg-red-500"
              onClick={() => confirmDelete(deleteTarget)}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainScreenWrapper>
  );
}

export default InventoryItemsScreen;
