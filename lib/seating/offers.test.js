import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildSeatOffers,
  filterOffers,
  offerPriceRange,
  orderRow,
  sortOffers,
} from "./offers.js";
import { generateSeats } from "./generate.js";

const TICKETS = [
  { id: "t-low", name: "Upper", price: 40 },
  { id: "t-high", name: "Floor", price: 150 },
];

const SECTIONS = [
  {
    id: "s1",
    name: "101",
    kind: "seated",
    x: 40,
    y: 60,
    width: 20,
    height: 10,
    rotation: 0,
    layout: { rows: 2, seatsPerRow: 6 },
  },
  {
    id: "s2",
    name: "102",
    kind: "seated",
    x: 40,
    y: 20,
    width: 20,
    height: 10,
    rotation: 180,
    layout: { rows: 2, seatsPerRow: 6 },
  },
];

const TIERS = { s1: "t-high", s2: "t-low" };
const ASPECT = "16/10";

function seatsFor(sections = SECTIONS) {
  const out = [];
  for (const section of sections) {
    generateSeats(section, ASPECT).forEach((seat, i) => {
      out.push({ ...seat, id: `${section.id}-${i}`, sectionId: section.id });
    });
  }
  return out;
}

const build = (opts = {}) =>
  buildSeatOffers({
    sections: SECTIONS,
    seats: seatsFor(),
    sectionTiers: TIERS,
    tickets: TICKETS,
    aspect: ASPECT,
    ...opts,
  });

test("one offer per section and row that has something to sell", () => {
  const offers = build();
  assert.deepEqual(
    [...new Set(offers.map((o) => o.sectionName))].sort(),
    ["101", "102"],
  );
});

test("an offer carries its section's ticket and price", () => {
  const offers = build();
  const floor = offers.find((o) => o.sectionName === "101");
  assert.equal(floor.price, 150);
  assert.equal(floor.ticketId, "t-high");
  assert.equal(floor.ticketName, "Floor");
});

test("a section with no ticket mapped to it is not on sale", () => {
  const offers = build({ sectionTiers: { s1: "t-high" } });
  assert.ok(offers.every((o) => o.sectionId === "s1"));
});

test("GA zones offer nothing — they sell by capacity, not by seat", () => {
  const ga = [{ ...SECTIONS[0], kind: "ga", capacity: 500 }];
  const offers = buildSeatOffers({
    sections: ga,
    seats: seatsFor(SECTIONS.slice(0, 1)),
    sectionTiers: TIERS,
    tickets: TICKETS,
    aspect: ASPECT,
  });
  assert.deepEqual(offers, []);
});

test("an offer's block is the requested number of ADJACENT seats", () => {
  const offers = build({ quantity: 3 });
  for (const offer of offers) {
    assert.ok(offer.fits, `${offer.sectionName} row ${offer.rowLabel} should fit 3`);
    assert.equal(offer.seatIds.length, 3);
    const nums = offer.seatLabels.map(Number);
    assert.deepEqual(nums, [nums[0], nums[0] + 1, nums[0] + 2], `${offer.seatLabels} not adjacent`);
  }
});

test("adjacency holds for a section that has been rotated to face the field", () => {
  const turned = { ...SECTIONS[0], rotation: 90 };
  const seats = generateSeats(turned, ASPECT).map((seat, i) => ({
    ...seat,
    id: `r-${i}`,
    sectionId: turned.id,
  }));
  const ordered = orderRow(
    seats.filter((s) => s.rowLabel === "A"),
    turned,
    ASPECT,
  );
  assert.deepEqual(
    ordered.map((s) => s.seatLabel),
    ["1", "2", "3", "4", "5", "6"],
  );
});

test("a taken seat breaks the block and shrinks what's available", () => {
  const seats = seatsFor();
  const rowA = seats.filter((s) => s.sectionId === "s1" && s.rowLabel === "A");
  const taken = new Set([rowA[2].id]);
  const offers = buildSeatOffers({
    sections: SECTIONS,
    seats,
    taken,
    sectionTiers: TIERS,
    tickets: TICKETS,
    aspect: ASPECT,
    quantity: 4,
  });
  const broken = offers.find((o) => o.sectionId === "s1" && o.rowLabel === "A");
  assert.equal(broken.available, 5);
  assert.equal(broken.fits, false);
  assert.deepEqual(broken.seatIds, []);
});

test("a fully sold row drops off the list entirely", () => {
  const seats = seatsFor();
  const taken = new Set(seats.filter((s) => s.rowLabel === "A").map((s) => s.id));
  const offers = buildSeatOffers({
    sections: SECTIONS,
    seats,
    taken,
    sectionTiers: TIERS,
    tickets: TICKETS,
    aspect: ASPECT,
  });
  assert.ok(offers.every((o) => o.rowLabel !== "A"));
  assert.equal(offers.length, 2);
});

test("the accessible filter counts only wheelchair and companion spaces", () => {
  const seats = seatsFor().map((s, i) =>
    i < 2 ? { ...s, kind: "wheelchair" } : s,
  );
  const offers = buildSeatOffers({
    sections: SECTIONS,
    seats,
    sectionTiers: TIERS,
    tickets: TICKETS,
    aspect: ASPECT,
    accessibleOnly: true,
  });
  assert.equal(offers.length, 1);
  assert.equal(offers[0].available, 2);
});

test("sorting by price puts the cheapest row first", () => {
  const sorted = sortOffers(build(), "price");
  assert.equal(sorted[0].price, 40);
  assert.equal(sorted[sorted.length - 1].price, 150);
});

test("sorting by section groups rows together in natural order", () => {
  const offers = [
    { sectionName: "102", rowLabel: "B", price: 10 },
    { sectionName: "101", rowLabel: "10", price: 99 },
    { sectionName: "101", rowLabel: "2", price: 99 },
  ];
  assert.deepEqual(
    sortOffers(offers, "section").map((o) => `${o.sectionName}${o.rowLabel}`),
    ["1012", "10110", "102B"],
  );
});

test("sorting by price breaks ties on seat quality, not on row label", () => {
  const offers = [
    { sectionName: "104", rowLabel: "A", price: 100, quality: 0.30 },
    { sectionName: "104", rowLabel: "B", price: 100, quality: 0.20 },
    { sectionName: "230", rowLabel: "C", price: 100, quality: 0.95 },
  ];
  assert.deepEqual(
    sortOffers(offers, "price").map((o) => o.sectionName + o.rowLabel),
    ["230C", "104A", "104B"],
  );
});

test("sorting by best puts the finest seat first whatever it costs", () => {
  const offers = [
    { sectionName: "104", rowLabel: "A", price: 40, quality: 0.2 },
    { sectionName: "230", rowLabel: "C", price: 900, quality: 0.9 },
  ];
  assert.equal(sortOffers(offers, "best")[0].sectionName, "230");
});

test("an offer carries the quality of its row when one is supplied", () => {
  const seats = seatsFor();
  const quality = { "s1::A": { score: 0.75 } };
  const offers = buildSeatOffers({
    sections: SECTIONS,
    seats,
    sectionTiers: TIERS,
    tickets: TICKETS,
    aspect: ASPECT,
    quality,
  });
  const rowA = offers.find((o) => o.sectionId === "s1" && o.rowLabel === "A");
  assert.equal(rowA.quality, 0.75);
  const other = offers.find((o) => o.rowLabel !== "A");
  assert.equal(other.quality, 0);
});

test("the price range spans the cheapest and dearest offer", () => {
  assert.deepEqual(offerPriceRange(build()), { min: 40, max: 150 });
  assert.deepEqual(offerPriceRange([]), { min: 0, max: 0 });
});

test("the price filter keeps the dearest seat inside its own range", () => {
  const offers = build();
  const { max } = offerPriceRange(offers);
  assert.equal(filterOffers(offers, { maxPrice: max }).length, offers.length);
  assert.ok(filterOffers(offers, { maxPrice: 40 }).every((o) => o.price <= 40));
  assert.equal(filterOffers(offers, { maxPrice: null }).length, offers.length);
});

test("one price on sale reports no range at all", () => {
  const offers = [{ price: 2015.3 }, { price: 2015.3 }, { price: 2015.3 }];
  assert.deepEqual(offerPriceRange(offers), { min: 2015.3, max: 2015.3 });
});

test("the cheapest offer survives the bottom of its own range", () => {
  const offers = [{ price: 40.5 }, { price: 90.25 }, { price: 150.75 }];
  const range = offerPriceRange(offers);
  const atFloor = filterOffers(offers, { maxPrice: range.min });
  assert.ok(atFloor.length > 0, "the bottom of the range must not empty the list");
  assert.equal(atFloor[0].price, 40.5);
});

test("the filter can drop rows that can't seat the party together", () => {
  const offers = [
    { price: 10, fits: true },
    { price: 10, fits: false },
  ];
  assert.equal(filterOffers(offers, { fittingOnly: true }).length, 1);
});

test("empty input degrades rather than throwing", () => {
  assert.deepEqual(buildSeatOffers(), []);
  assert.deepEqual(sortOffers(), []);
  assert.deepEqual(filterOffers(), []);
  assert.deepEqual(orderRow(), []);
});
