// Layout config for the Event Wall's public grid — separate from the brand
// theme (colors/typography) so the two edit independently. Stored in the wall's
// metadata bag under `layout`. Constants only (config, not data), shared by the
// editor (design.jsx) and the renderer (wall_public_page.jsx).

export const WALL_COLUMNS = [
  { key: "auto", label: "Auto" },
  { key: "2", label: "2" },
  { key: "3", label: "3" },
  { key: "4", label: "4" },
];

export const CARD_STYLES = [
  { key: "classic", label: "Classic" }, // image on top, meta below
  { key: "overlay", label: "Overlay" }, // name/meta over a darkened image
];

export const FEATURED_STYLES = [
  { key: "badge", label: "In-grid badge" }, // today's behavior
  { key: "spotlight", label: "Spotlight" }, // large hero row above the grid
];

export const HEADER_ALIGNS = [
  { key: "center", label: "Center" },
  { key: "left", label: "Left" },
];

export const DEFAULT_LAYOUT = {
  columns: "auto",
  cardStyle: "classic",
  cardMeta: { type: true, date: true, venue: true, price: false },
  featuredStyle: "badge",
  header: { align: "center", bannerUrl: "" },
};

// Normalize a possibly-partial saved layout to the full shape.
export function resolveLayout(layout) {
  const l = layout && typeof layout === "object" ? layout : {};
  return {
    columns: l.columns || "auto",
    cardStyle: l.cardStyle || "classic",
    cardMeta: { ...DEFAULT_LAYOUT.cardMeta, ...(l.cardMeta || {}) },
    featuredStyle: l.featuredStyle || "badge",
    header: { ...DEFAULT_LAYOUT.header, ...(l.header || {}) },
  };
}

// Lead ticket price label for a card ("Free" / "From $25"), or null when the
// event has no configured tickets (so the price line hides even if toggled on).
export function cardPriceLabel(event) {
  const prices = Array.isArray(event?.tickets)
    ? event.tickets.map((t) => Number(t.price) || 0)
    : [];
  if (!prices.length) return null;
  const min = Math.min(...prices);
  return min === 0 ? "Free" : `From $${min}`;
}
