// What a buyer can actually buy, as a flat list they can scan and sort.
//
// A seat map answers "where is section 228?"; it does not answer "where are two
// seats together for under $80?". That is what the offers list is for — the
// panel beside the map on every modern ticketing site. One offer is one ROW in
// one section: the smallest thing a buyer picks in practice, since seats in a
// row sell together and share a price.
//
// Pure: no DB, no React. The screen owns selection and UX.

import { aspectRatio, rotateUnits } from "./geometry.js";

export const ACCESSIBLE_KINDS = new Set(["wheelchair", "companion"]);

export const OFFER_SORTS = [
  { value: "best", label: "Best seats" },
  { value: "price", label: "Lowest price" },
  { value: "section", label: "Section" },
];

// Where a seat sits ACROSS its row, with the section's facing undone.
//
// Bowl sections are rotated, so a row on the left of the venue runs top-to-
// bottom in stored coordinates and a row at the bottom runs right-to-left.
// Sorting by the raw x — which is what "pick the best contiguous block" used to
// do — therefore scrambled the row and handed out blocks that aren't adjacent.
function acrossRow(seat, section, ar) {
  const rotation = -(Number(section?.rotation) || 0);
  const cx = ((Number(section?.x) || 0) + (Number(section?.width) || 0) / 2) * ar;
  const cy = (Number(section?.y) || 0) + (Number(section?.height) || 0) / 2;
  return rotateUnits((Number(seat.x) || 0) * ar, Number(seat.y) || 0, cx, cy, rotation).x;
}

// Seats of one row, in the order a person walking along it would pass them.
export function orderRow(seats, section, aspect = 1) {
  const ar = aspectRatio(aspect);
  return [...(seats || [])].sort((a, b) => acrossRow(a, section, ar) - acrossRow(b, section, ar));
}

// One offer per (section, row) that still has something to sell.
//
//   quantity        how many seats the buyer wants sat together
//   accessibleOnly  only count wheelchair/companion spaces
//   quality         buildRowQuality() output, keyed `sectionId::rowLabel`
//
// `block` is a contiguous run of exactly `quantity` seats when one exists, so
// selecting an offer can hand the buyer real adjacent seats rather than making
// them hunt. `fits` says whether it does.
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
    // GA zones sell by capacity and have no chairs to offer.
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
    // A section with no ticket mapped to it isn't on sale, so it isn't an offer.
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
      // A row the map couldn't score still sells; it just ranks last.
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

// Natural order for row and section labels, so "Row 2" sorts before "Row 10"
// and section 101 before 102 — a plain string sort gets both wrong.
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
  // Price first, then QUALITY — not the row label. A venue that sells at one
  // price ties on every comparison a price sort can make, and falling through
  // to section-then-row is what listed fourteen indistinguishable rows of one
  // section ahead of everything else.
  list.sort((a, b) => a.price - b.price || byQuality(a, b) || byLabel(a, b));
  return list;
}

// The full span of prices on offer, for the range filter's endpoints.
//
// EXACT, not rounded outward. Flooring the minimum put the slider's bottom notch
// BELOW the cheapest seat, so dragging to the end of the range filtered every
// offer out of its own list; and a single price of 2015.3 floored and ceiled
// into {2015, 2016}, which the rail read as a real span and drew a slider for.
// One price is not a range, and the ends of a range have to be reachable.
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

// `maxPrice` of null means "no ceiling", which is what the slider's top notch
// means — otherwise the dearest seat drops out of its own range.
export function filterOffers(offers = [], { maxPrice = null, fittingOnly = false } = {}) {
  return offers.filter((offer) => {
    if (fittingOnly && !offer.fits) return false;
    if (maxPrice !== null && offer.price > maxPrice) return false;
    return true;
  });
}
