// Layout config for the Event Wall's public page — separate from the brand
// theme (colors/typography) so the two edit independently. Stored in the wall's
// metadata bag under `layout`. Constants only (config, not data), shared by the
// editor (design.jsx) and the renderer (wall_public_page.jsx).
//
// The wall renders one structure: a date-grouped agenda beside a calendar
// sidebar. What's configurable is which view it opens in and how much meta each
// row carries — the column/card-style/spotlight choices the old grid exposed
// have no meaning in an agenda and are gone.

export const WALL_VIEWS = [
  { key: "cards", label: "Cards" }, // roomy rows with the event's cover
  { key: "list", label: "List" }, // compact one-line rows
];

export const DEFAULT_LAYOUT = {
  defaultView: "cards",
  cardMeta: { type: true, host: true, venue: true, price: true },
  header: { bannerUrl: "" },
};

// Normalize a possibly-partial saved layout to the full shape. Walls saved
// against the old grid config still resolve — their unknown keys are dropped
// and the agenda defaults fill in.
export function resolveLayout(layout) {
  const l = layout && typeof layout === "object" ? layout : {};
  return {
    defaultView: l.defaultView === "list" ? "list" : "cards",
    cardMeta: { ...DEFAULT_LAYOUT.cardMeta, ...(l.cardMeta || {}) },
    header: { ...DEFAULT_LAYOUT.header, ...(l.header || {}) },
  };
}

// Lead ticket price label for a row ("Free" / "$25"), or null when the event
// has no configured tickets (so the price chip hides even if toggled on).
export function cardPriceLabel(event) {
  const prices = Array.isArray(event?.tickets)
    ? event.tickets.map((t) => Number(t.price) || 0)
    : [];
  if (!prices.length) return null;
  const min = Math.min(...prices);
  return min === 0 ? "Free" : `$${min}`;
}

// Sold-out events show a waitlist chip in place of the price, matching what the
// event page itself offers the buyer.
export function isSoldOut(event) {
  const capacity = Number(event?.capacity) || 0;
  return capacity > 0 && Number(event?.sold) >= capacity;
}
