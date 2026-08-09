import { test } from "node:test";
import assert from "node:assert/strict";

import { buildPriceTiers, PRICE_SCALE, UNPRICED } from "./price_tiers.js";

const TICKETS = [
  { id: "t1", name: "Premium", price: 250 },
  { id: "t2", name: "Gold", price: 120 },
  { id: "t3", name: "Silver", price: 80 },
  { id: "t4", name: "Bronze", price: 45 },
];

const SECTIONS = [
  { id: "a", kind: "seated" },
  { id: "b", kind: "seated" },
  { id: "c", kind: "seated" },
  { id: "d", kind: "seated" },
  { id: "e", kind: "seated" },
];

const MAP = { a: "t1", b: "t2", c: "t2", d: "t3", e: "t4" };

test("distinct prices become bands, dearest first", () => {
  const { legend } = buildPriceTiers(SECTIONS, MAP, TICKETS);
  assert.deepEqual(
    legend.map((l) => l.price),
    [250, 120, 80, 45],
  );
  assert.equal(legend[0].key, PRICE_SCALE[0].key);
  assert.equal(legend[3].key, PRICE_SCALE[3].key);
});

test("sections sharing a price share a colour", () => {
  const { colorBySectionId } = buildPriceTiers(SECTIONS, MAP, TICKETS);
  assert.equal(colorBySectionId.b.key, colorBySectionId.c.key);
  assert.notEqual(colorBySectionId.a.key, colorBySectionId.b.key);
});

test("an unmapped section reads as unpriced, not as another band", () => {
  const { colorBySectionId, legend } = buildPriceTiers(SECTIONS, { a: "t1" }, TICKETS);
  assert.equal(colorBySectionId.a.key, PRICE_SCALE[0].key);
  assert.equal(colorBySectionId.b.key, UNPRICED.key);
  assert.equal(legend.length, 1);
});

test("the legend counts the sections in each band", () => {
  const { legend } = buildPriceTiers(SECTIONS, MAP, TICKETS);
  const gold = legend.find((l) => l.price === 120);
  assert.equal(gold.sections, 2);
});

test("a band named by a single ticket carries that name", () => {
  const { legend } = buildPriceTiers(SECTIONS, MAP, TICKETS);
  assert.equal(legend.find((l) => l.price === 250).label, "Premium");
});

test("two tickets at the same price leave the band unnamed", () => {
  const tickets = [
    { id: "t1", name: "Adult", price: 50 },
    { id: "t2", name: "Senior", price: 50 },
  ];
  const { legend } = buildPriceTiers(
    [
      { id: "a", kind: "seated" },
      { id: "b", kind: "seated" },
    ],
    { a: "t1", b: "t2" },
    tickets,
  );
  assert.equal(legend.length, 1);
  assert.equal(legend[0].label, "");
  assert.equal(legend[0].sections, 2);
});

test("more distinct prices than bands share the cheapest colour", () => {
  const many = Array.from({ length: 9 }, (_, i) => ({ id: `s${i}`, kind: "seated" }));
  const tickets = many.map((_, i) => ({ id: `t${i}`, name: `T${i}`, price: 900 - i * 100 }));
  const map = Object.fromEntries(many.map((s, i) => [s.id, `t${i}`]));

  const { colorBySectionId, legend } = buildPriceTiers(many, map, tickets);
  assert.equal(legend.length, 9);
  const last = PRICE_SCALE[PRICE_SCALE.length - 1].key;
  assert.equal(colorBySectionId.s5.key, last);
  assert.equal(colorBySectionId.s8.key, last);
});

test("empty input degrades rather than throwing", () => {
  const empty = buildPriceTiers();
  assert.deepEqual(empty.legend, []);
  assert.deepEqual(empty.colorBySectionId, {});
  assert.deepEqual(buildPriceTiers([], {}, []).legend, []);
});

test("a free ticket is a real band, not treated as unpriced", () => {
  const { colorBySectionId, legend } = buildPriceTiers(
    [{ id: "a", kind: "seated" }],
    { a: "free" },
    [{ id: "free", name: "Free entry", price: 0 }],
  );
  assert.equal(legend.length, 1);
  assert.equal(legend[0].price, 0);
  assert.notEqual(colorBySectionId.a.key, UNPRICED.key);
});
