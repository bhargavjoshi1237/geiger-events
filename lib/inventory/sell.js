
import { EMPTY_PURCHASABLE, EMPTY_SHOWIF } from "@/lib/events/purchasables";
import { itemLabel } from "@/components/internal/screens/inventory/constants";

export const purchasableIdFor = (allocationId) =>
  `pur_inv_${String(allocationId || "").replace(/-/g, "").slice(0, 12)}`;

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
    inventoryItemId: allocation?.itemId || item?.id || null,
    inventoryAllocationId: allocation?.id || null,
  };
}

export function mergePurchasable(list, entry) {
  const rows = Array.isArray(list) ? list : [];
  const i = rows.findIndex((p) => p?.id === entry.id);
  if (i === -1) return [...rows, entry];
  return rows.map((p, idx) => (idx === i ? { ...p, ...entry } : p));
}

export function removePurchasable(list, id) {
  return (Array.isArray(list) ? list : []).filter((p) => p?.id !== id);
}

export function saleConfig(allocation) {
  const sale = allocation?.config?.sale;
  return sale && typeof sale === "object" ? sale : {};
}

export const isPublished = (allocation) => Boolean(saleConfig(allocation).published);
