// Colour-by-price for a seat or hall map. Pure: given the sections, the
// section -> ticket mapping the event already stores, and the event's tickets,
// it buckets the distinct prices onto a fixed scale and hands back a colour per
// section plus the legend to render under the map.
//
// Nothing here is configurable by the organiser — the map colours itself from
// the pricing they have already set on the Tickets tab.

// Ordered most-expensive first. Tailwind colour utilities at /15 bg + /40
// border, matching how the rest of the app renders status and severity.
export const PRICE_SCALE = [
  { key: "p1", fill: "bg-rose-400/15", stroke: "border-rose-400/40", dot: "bg-rose-400" },
  { key: "p2", fill: "bg-amber-400/15", stroke: "border-amber-400/40", dot: "bg-amber-400" },
  { key: "p3", fill: "bg-violet-400/15", stroke: "border-violet-400/40", dot: "bg-violet-400" },
  { key: "p4", fill: "bg-sky-400/15", stroke: "border-sky-400/40", dot: "bg-sky-400" },
  { key: "p5", fill: "bg-teal-400/15", stroke: "border-teal-400/40", dot: "bg-teal-400" },
  { key: "p6", fill: "bg-emerald-400/15", stroke: "border-emerald-400/40", dot: "bg-emerald-400" },
];

// A section with no ticket mapped to it isn't sellable, so it reads as inert
// rather than as a seventh price band.
export const UNPRICED = {
  key: "none",
  fill: "bg-surface-strong",
  stroke: "border-border",
  dot: "bg-border-strong",
};

// More distinct prices than the scale has steps: everything past the last band
// shares the cheapest colour rather than wrapping back round to the dearest.
function bandFor(index) {
  return PRICE_SCALE[Math.min(index, PRICE_SCALE.length - 1)];
}

// The general form: colour any set of priced things by their price. `priceOf`
// returns a number, or null/undefined for something that isn't sellable.
// `nameOf` optionally names a band when every item at that price agrees.
//
// -> { colorById, legend, priceById }
export function buildPriceBands(items = [], priceOf = () => null, nameOf = null) {
  const priceById = {};
  const prices = new Set();

  for (const item of items || []) {
    const price = priceOf(item);
    if (price === null || price === undefined) continue;
    const value = Number(price) || 0;
    priceById[item.id] = value;
    prices.add(value);
  }

  const ordered = [...prices].sort((a, b) => b - a);
  const bandByPrice = new Map();
  ordered.forEach((price, i) => bandByPrice.set(price, bandFor(i)));

  const colorById = {};
  const counts = new Map();
  const namesByPrice = new Map();

  for (const item of items || []) {
    const price = priceById[item.id];
    if (price === undefined) {
      colorById[item.id] = UNPRICED;
      continue;
    }
    colorById[item.id] = bandByPrice.get(price);
    counts.set(price, (counts.get(price) || 0) + 1);

    const name = nameOf?.(item);
    if (name) {
      if (!namesByPrice.has(price)) namesByPrice.set(price, new Set());
      namesByPrice.get(price).add(name);
    }
  }

  const legend = ordered.map((price) => {
    const names = namesByPrice.get(price);
    return {
      ...bandByPrice.get(price),
      price,
      sections: counts.get(price) || 0,
      // One agreed name labels the band; two different ones leave it unlabelled
      // rather than picking a winner arbitrarily.
      label: names?.size === 1 ? [...names][0] : "",
    };
  });

  return { colorById, priceById, legend };
}

// sections   [{ id, kind }]
// sectionMap { [sectionId]: ticketId }   (event.metadata.seating.sectionTiers)
// tickets    [{ id, name, price }]
//
// -> { colorBySectionId, legend, priceBySectionId }
//
// `legend` is ordered dearest first and carries how many sections sit in each
// band, so the map can label itself without a second pass over the sections.
export function buildPriceTiers(sections = [], sectionMap = {}, tickets = []) {
  const ticketById = new Map();
  for (const ticket of tickets || []) ticketById.set(ticket.id, ticket);
  const ticketFor = (section) => ticketById.get(sectionMap?.[section.id]);

  const { colorById, priceById, legend } = buildPriceBands(
    sections,
    (section) => {
      const ticket = ticketFor(section);
      return ticket ? Number(ticket.price) || 0 : null;
    },
    // The band takes its ticket's name, which is how the organiser thinks about
    // it ("Premium", "Gold").
    (section) => ticketFor(section)?.name || "",
  );

  return { colorBySectionId: colorById, priceBySectionId: priceById, legend };
}

export default buildPriceTiers;
