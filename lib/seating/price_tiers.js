
export const PRICE_SCALE = [
  { key: "p1", fill: "bg-rose-400/15", stroke: "border-rose-400/40", dot: "bg-rose-400", hex: "#fb7185" },
  { key: "p2", fill: "bg-amber-400/15", stroke: "border-amber-400/40", dot: "bg-amber-400", hex: "#fbbf24" },
  { key: "p3", fill: "bg-violet-400/15", stroke: "border-violet-400/40", dot: "bg-violet-400", hex: "#a78bfa" },
  { key: "p4", fill: "bg-sky-400/15", stroke: "border-sky-400/40", dot: "bg-sky-400", hex: "#38bdf8" },
  { key: "p5", fill: "bg-teal-400/15", stroke: "border-teal-400/40", dot: "bg-teal-400", hex: "#2dd4bf" },
  { key: "p6", fill: "bg-emerald-400/15", stroke: "border-emerald-400/40", dot: "bg-emerald-400", hex: "#34d399" },
];

export const UNPRICED = {
  key: "none",
  fill: "bg-surface-strong",
  stroke: "border-border",
  dot: "bg-border-strong",
  hex: "#6b7280",
};

function bandFor(index) {
  return PRICE_SCALE[Math.min(index, PRICE_SCALE.length - 1)];
}

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
      label: names?.size === 1 ? [...names][0] : "",
    };
  });

  return { colorById, priceById, legend };
}

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
    (section) => ticketFor(section)?.name || "",
  );

  return { colorBySectionId: colorById, priceBySectionId: priceById, legend };
}

export default buildPriceTiers;
