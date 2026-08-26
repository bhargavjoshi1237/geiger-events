
export const EMPTY_BUNDLE = {
  name: "",
  description: "",
  enabled: true,
  items: [],
  pricingMode: "fixed",
  price: 0,
};

export function normalizeBundle(bundle) {
  if (!bundle) return null;
  const items = Array.isArray(bundle.items) ? bundle.items : [];
  return {
    ...EMPTY_BUNDLE,
    ...bundle,
    enabled: bundle.enabled !== false,
    pricingMode: bundle.pricingMode === "sum" ? "sum" : "fixed",
    price: Number(bundle.price) || 0,
    items: items
      .filter((it) => it && it.ticketId)
      .map((it) => ({ ticketId: String(it.ticketId), qty: Math.max(1, Number(it.qty) || 1) })),
  };
}

export function bundlesEnabled(event) {
  return !!event?.ticketRules?.bundles;
}

export function eventBundles(event) {
  if (!bundlesEnabled(event)) return [];
  const raw = Array.isArray(event?.bundles) ? event.bundles : [];
  return raw
    .map(normalizeBundle)
    .filter((b) => b && b.enabled && b.items.length);
}

export function bundleTicketCount(bundle) {
  const b = normalizeBundle(bundle);
  return b ? b.items.reduce((n, it) => n + it.qty, 0) : 0;
}

export function bundlePrice(bundle, ticketPriceById = {}) {
  const b = normalizeBundle(bundle);
  if (!b) return 0;
  if (b.pricingMode === "sum") {
    const total = b.items.reduce(
      (sum, it) => sum + (Number(ticketPriceById[it.ticketId]) || 0) * it.qty,
      0,
    );
    return Math.round(total * 100) / 100;
  }
  return b.price;
}

export function buildBundleRecord(bundle, ticketNameById = {}, ticketPriceById = {}) {
  const b = normalizeBundle(bundle);
  if (!b) return null;
  return {
    id: b.id,
    name: b.name,
    price: bundlePrice(b, ticketPriceById),
    items: b.items.map((it) => ({
      ticketId: it.ticketId,
      name: ticketNameById[it.ticketId] || "Ticket",
      qty: it.qty,
    })),
  };
}
