
import { aspectRatio, rotateUnits } from "./geometry.js";

export const ACCESSIBLE_KINDS = new Set(["wheelchair", "companion"]);

export const OFFER_SORTS = [
  { value: "best", label: "Best seats" },
  { value: "price", label: "Lowest price" },
  { value: "section", label: "Section" },
];

function acrossRow(seat, section, ar) {
  const rotation = -(Number(section?.rotation) || 0);
  const cx = ((Number(section?.x) || 0) + (Number(section?.width) || 0) / 2) * ar;
  const cy = (Number(section?.y) || 0) + (Number(section?.height) || 0) / 2;
  return rotateUnits((Number(seat.x) || 0) * ar, Number(seat.y) || 0, cx, cy, rotation).x;
}

export function orderRow(seats, section, aspect = 1) {
  const ar = aspectRatio(aspect);
  return [...(seats || [])].sort((a, b) => acrossRow(a, section, ar) - acrossRow(b, section, ar));
}

export function buildSeatOffers({
  sections = [],
  seats = [],
  taken = null,
  sectionTiers = {},
  tickets = [],
  aspect = 1,
  quantity = 1,
  accessibleOnly = false,
  quality = null,
} = {}) {
  const ar = aspectRatio(aspect);
  const isTaken = taken instanceof Set ? (id) => taken.has(id) : () => false;
  const ticketById = new Map((tickets || []).map((t) => [t.id, t]));
  const sectionById = new Map((sections || []).map((s) => [s.id, s]));
  const qty = Math.max(1, Number(quantity) || 1);

  const rows = new Map();
  for (const seat of seats || []) {
    const section = sectionById.get(seat.sectionId);
    if (!section || section.kind === "ga") continue;
    const key = `${seat.sectionId}::${seat.rowLabel}`;
    const group = rows.get(key);
    if (group) group.seats.push(seat);
    else rows.set(key, { section, rowLabel: seat.rowLabel, seats: [seat] });
  }

  const offers = [];
  for (const group of rows.values()) {
    const ticketId = sectionTiers?.[group.section.id];
    const ticket = ticketById.get(ticketId);
    if (!ticket) continue;

    const ordered = orderRow(group.seats, group.section, ar);
    const usable = (s) =>
      !isTaken(s.id) && (!accessibleOnly || ACCESSIBLE_KINDS.has(s.kind));

    let run = [];
    let block = null;
    let open = 0;
    for (const seat of ordered) {
      if (!usable(seat)) {
        run = [];
        continue;
      }
      open += 1;
      run.push(seat);
      if (!block && run.length >= qty) block = run.slice(0, qty);
    }
    if (open === 0) continue;

    const key = `${group.section.id}::${group.rowLabel}`;
    offers.push({
      id: key,
      quality: Number(quality?.[key]?.score) || 0,
      sectionId: group.section.id,
      sectionName: group.section.name || "Section",
      rowLabel: group.rowLabel,
      ticketId,
      ticketName: ticket.name || "",
      price: Number(ticket.price) || 0,
      available: open,
      fits: Boolean(block),
      seatIds: block ? block.map((s) => s.id) : [],
      seatLabels: block ? block.map((s) => s.seatLabel) : [],
    });
  }

  return offers;
}

function naturally(a, b) {
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
}

const byQuality = (a, b) => (Number(b.quality) || 0) - (Number(a.quality) || 0);
const byLabel = (a, b) =>
  naturally(a.sectionName, b.sectionName) || naturally(a.rowLabel, b.rowLabel);

export function sortOffers(offers = [], mode = "price") {
  const list = [...offers];
  if (mode === "section") {
    list.sort(byLabel);
    return list;
  }
  if (mode === "best") {
    list.sort((a, b) => byQuality(a, b) || a.price - b.price || byLabel(a, b));
    return list;
  }
  list.sort((a, b) => a.price - b.price || byQuality(a, b) || byLabel(a, b));
  return list;
}

export function offerPriceRange(offers = []) {
  if (!offers.length) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const offer of offers) {
    if (offer.price < min) min = offer.price;
    if (offer.price > max) max = offer.price;
  }
  return { min, max };
}

export function filterOffers(offers = [], { maxPrice = null, fittingOnly = false } = {}) {
  return offers.filter((offer) => {
    if (fittingOnly && !offer.fits) return false;
    if (maxPrice !== null && offer.price > maxPrice) return false;
    return true;
  });
}
