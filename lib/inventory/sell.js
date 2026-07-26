// Publishing an inventory item as an event add-on. Pure functions — no React,
// no DB.
//
// An allocation can be "sold": we write a purchasable into the event's
// metadata.purchasables (the same shape the Purchasables editor produces, see
// lib/events/purchasables.js) and point the allocation's addon issuance at it.
// Buying it then entitles the buyer, and the item is handed over at the desk.
//
// Stock timing: selling RESERVES, it does not move stock. on_hand only changes
// when someone physically collects, so the shelf and the ledger always agree.
// The purchasable's `stock` is therefore a checkout cap, not the stock itself.

import { EMPTY_PURCHASABLE, EMPTY_SHOWIF } from "@/lib/events/purchasables";
import { itemLabel } from "@/components/internal/screens/inventory/constants";

// A stable, derivable id so re-publishing updates the same entry instead of
// creating a duplicate add-on.
export const purchasableIdFor = (allocationId) =>
  `pur_inv_${String(allocationId || "").replace(/-/g, "").slice(0, 12)}`;

// Build the add-on record for an allocation's item.
export function buildInventoryPurchasable({
  allocation,
  item,
  name,
  description = "",
  price = 0,
  stock = null,
  allowMultiple = false,
  maxPerOrder = null,
  enabled = true,
}) {
  return {
    ...EMPTY_PURCHASABLE,
    id: purchasableIdFor(allocation?.id),
    name: (name || itemLabel(item) || "Add-on").trim(),
    description: String(description || "").trim(),
    image: item?.imageUrl || "",
    price: Number(price) || 0,
    priceType: "flat",
    pickType: allowMultiple ? "quantity" : "toggle",
    required: false,
    stock: stock === "" || stock == null ? null : Number(stock) || null,
    maxPerOrder:
      maxPerOrder === "" || maxPerOrder == null ? null : Number(maxPerOrder) || null,
    enabled: Boolean(enabled),
    showIf: { ...EMPTY_SHOWIF },
    // Provenance, so the editor and checkout can tell this add-on is backed by
    // real stock rather than being a free-text extra.
    inventoryItemId: allocation?.itemId || item?.id || null,
    inventoryAllocationId: allocation?.id || null,
  };
}

// Replace the matching entry or append it. Returns a new array.
export function mergePurchasable(list, entry) {
  const rows = Array.isArray(list) ? list : [];
  const i = rows.findIndex((p) => p?.id === entry.id);
  if (i === -1) return [...rows, entry];
  return rows.map((p, idx) => (idx === i ? { ...p, ...entry } : p));
}

export function removePurchasable(list, id) {
  return (Array.isArray(list) ? list : []).filter((p) => p?.id !== id);
}

// The sale settings stored on the allocation's config bag.
export function saleConfig(allocation) {
  const sale = allocation?.config?.sale;
  return sale && typeof sale === "object" ? sale : {};
}

export const isPublished = (allocation) => Boolean(saleConfig(allocation).published);
