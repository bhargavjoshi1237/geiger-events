export const WALL_VIEWS = [
  { key: "cards", label: "Cards" },
  { key: "list", label: "List" },
];

export const DEFAULT_LAYOUT = {
  defaultView: "cards",
  cardMeta: { type: true, host: true, venue: true, price: true },
  header: { bannerUrl: "" },
};

export function resolveLayout(layout) {
  const l = layout && typeof layout === "object" ? layout : {};
  return {
    defaultView: l.defaultView === "list" ? "list" : "cards",
    cardMeta: { ...DEFAULT_LAYOUT.cardMeta, ...(l.cardMeta || {}) },
    header: { ...DEFAULT_LAYOUT.header, ...(l.header || {}) },
  };
}

export function cardPriceLabel(event) {
  const prices = Array.isArray(event?.tickets)
    ? event.tickets.map((t) => Number(t.price) || 0)
    : [];
  if (!prices.length) return null;
  const min = Math.min(...prices);
  return min === 0 ? "Free" : `$${min}`;
}

export function isSoldOut(event) {
  const capacity = Number(event?.capacity) || 0;
  return capacity > 0 && Number(event?.sold) >= capacity;
}
