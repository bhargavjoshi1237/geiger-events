import { test } from "node:test";
import assert from "node:assert/strict";

import { STANDARD_CATALOG } from "./standard_catalog.js";
import { createInstance } from "./catalog.js";
import { planStats } from "./plan.js";
import {
  CAPACITY_STYLES,
  DEFAULT_PLANNING_RULES,
  estimateAllStyles,
  estimateCapacity,
  exitZone,
  normalisePlanningRules,
  polygonGap,
  validatePlanCapacity,
} from "./capacity.js";
import { generateLayout } from "./layout.js";
import {
  autoSeat,
  buildChartGuests,
  dietaryTags,
  indexBlocks,
  mealTally,
  ruleViolations,
  seatingBlocks,
  seatingByBlock,
  surnameKey,
} from "./seating_chart.js";
import { buildCatererSummaryHtml, buildPlaceCardsHtml, buildSeatingListHtml, buildTableSignsHtml } from "./seating_print.js";

const byKey = (key) => STANDARD_CATALOG.find((o) => o.key === key);
const room = (w, l, objects = []) => ({ widthM: w, lengthM: l, outline: { type: "rect" }, setupStyle: "custom", objects });
const at = (key, x, y, extra = {}) => ({ ...createInstance(byKey(key), { x, y }), ...extra });

test("planning rules fill defaults and clamp nonsense", () => {
  const r = normalisePlanningRules({ mainAisleM: 99, areaPerPerson: { theatre: "abc", banquet: 1.4 }, maxSeatsPerRow: 10.6 });
  assert.equal(r.mainAisleM, 4);
  assert.equal(r.areaPerPerson.theatre, DEFAULT_PLANNING_RULES.areaPerPerson.theatre);
  assert.equal(r.areaPerPerson.banquet, 1.4);
  assert.equal(r.maxSeatsPerRow, 11);
  assert.deepEqual(normalisePlanningRules(null), normalisePlanningRules({}));
});

test("area estimates follow the densities and deduct aisles, features and exits", () => {
  const bare = room(20, 15);
  const theatre = estimateCapacity(bare, "theatre");
  const banquet = estimateCapacity(bare, "banquet");
  assert.equal(theatre.method, "area");
  assert.ok(theatre.estimate > banquet.estimate, "theatre packs tighter than banquet");
  assert.ok(theatre.estimate < Math.floor(300 / 0.75), "aisles come off the gross area");
  const withBar = estimateCapacity(room(20, 15, [at("bar-straight", 10, 14), at("emergency-exit", 0.1, 7, { rotation: 90 })]), "banquet");
  assert.ok(withBar.estimate < banquet.estimate);
  assert.ok(withBar.deductions.some((d) => d.key === "exits"));
  assert.equal(estimateCapacity(bare, "reception").standing, true);
});

test("perimeter styles count table edge", () => {
  const all = estimateAllStyles(room(20, 15));
  assert.deepEqual(Object.keys(all), CAPACITY_STYLES);
  assert.equal(all.boardroom.method, "perimeter");
  assert.ok(all.boardroom.estimate > 10 && all.boardroom.estimate < 40);
  assert.ok(all.hollow_square.estimate > all.u_shape.estimate);
  assert.equal(estimateCapacity(room(3, 3), "u_shape").estimate, 0);
});

test("polygon gap measures the clear space between shapes", () => {
  const gap = polygonGap(
    [[0, 0], [1, 0], [1, 1], [0, 1]],
    [[3, 0], [4, 0], [4, 1], [3, 1]],
  );
  assert.ok(Math.abs(gap.distance - 2) < 1e-9);
});

test("validation flags blocked exits, narrow gaps, long rows and occupancy", () => {
  const exit = at("emergency-exit", 10, 0.075);
  const zone = exitZone(exit, 1.5);
  assert.equal(zone.length, 4);
  const blocker = at("round-60", 10, 1.4, { label: "1" });
  const a = at("round-60", 4, 7, { label: "2" });
  const b = at("round-60", 6.9, 7, { label: "3" });
  const row = Array.from({ length: 18 }, (_, i) => at("chair-theatre", 2 + i * 0.5, 12));
  const plan = { ...room(20, 15, [exit, blocker, a, b, ...row]), setupStyle: "banquet" };
  const result = validatePlanCapacity(plan, { space: { name: "Hall", capacities: { banquet: 20 }, config: { maxOccupancy: 30 } } });
  const kinds = result.issues.map((i) => i.kind);
  assert.ok(kinds.includes("exit_blocked"));
  assert.ok(kinds.includes("narrow_aisle"));
  assert.ok(kinds.includes("long_row"));
  assert.ok(kinds.includes("over_stated"));
  assert.ok(kinds.includes("max_occupancy"));
  assert.ok(result.flaggedIds.includes(exit.id) && result.flaggedIds.includes(blocker.id));
  assert.ok(result.counts.egress >= 3);
  assert.equal(result.capacity, 20);
});

test("a clean plan has no egress issues", () => {
  const plan = { ...room(20, 15, [at("round-60", 5, 7, { label: "1" }), at("round-60", 12, 7, { label: "2" })]), setupStyle: "banquet" };
  const result = validatePlanCapacity(plan, {});
  assert.equal(result.counts.egress, 0);
  assert.equal(result.seats, 16);
});

for (const style of ["theatre", "classroom", "banquet", "cabaret", "boardroom", "u_shape", "hollow_square"]) {
  test(`generated ${style} layout fits, doesn't clash and keeps exits clear`, () => {
    const exit = at("emergency-exit", 0.075, 7.5, { rotation: 90 });
    const base = room(24, 18, [exit, at("pillar", 12, 9)]);
    const out = generateLayout(base, style, { stage: true, bar: true, danceFloor: true });
    assert.ok(out.seats > 0, `${style} seats something`);
    const plan = { ...base, objects: out.objects, setupStyle: style };
    const stats = planStats(plan);
    assert.deepEqual(stats.outsideIds, [], "nothing outside the room");
    assert.deepEqual(stats.overlappingIds, [], "no overlaps");
    const check = validatePlanCapacity(plan, {});
    assert.ok(!check.issues.some((i) => i.kind === "exit_blocked"), "exit stays clear");
    assert.ok(!check.issues.some((i) => i.kind === "narrow_aisle" || i.kind === "long_row"), JSON.stringify(check.issues.map((i) => i.detail)));
    assert.ok(out.objects.includes(exit), "fixtures are kept");
  });
}

test("layout stops near the target and respects the front wall", () => {
  const out = generateLayout(room(20, 15), "banquet", { attendees: 40, tableKey: "round-60" });
  assert.ok(out.seats >= 40 && out.seats < 48);
  assert.equal(out.tables, 5);
  assert.deepEqual(out.generated.map((o) => o.label).sort(), ["1", "2", "3", "4", "5"]);
  const left = generateLayout(room(20, 15), "theatre", { front: "left", attendees: 30 });
  assert.ok(left.generated.every((o) => o.rotation === 270));
  const reception = generateLayout(room(20, 15), "reception", { attendees: 80, bar: true });
  assert.equal(reception.guests, 80);
  assert.equal(reception.seats, 0);
  assert.equal(generateLayout(room(20, 15), "custom").generated.length, 0);
});

test("dietary notes become tags", () => {
  assert.deepEqual(dietaryTags("Vegan, nut allergy"), ["vegan", "nut_allergy"]);
  assert.deepEqual(dietaryTags("vegetarian"), ["vegetarian"]);
  assert.deepEqual(dietaryTags("None"), []);
  assert.deepEqual(dietaryTags("no mushrooms please"), ["other"]);
  assert.equal(surnameKey("Ada Lovelace"), "lovelace ada");
});

function chart() {
  const t1 = at("round-60", 4, 4, { label: "1" });
  const t2 = at("round-60", 8, 4, { label: "2" });
  const chairs = Array.from({ length: 6 }, (_, i) => at("chair-theatre", 2 + i * 0.5, 10));
  const objects = [t1, t2, ...chairs];
  const roster = [
    ...Array.from({ length: 5 }, (_, i) => ({ key: `order:o1:${i}`, id: "o1", name: `Big ${i}`, tier: "VIP" })),
    { key: "reg:r1", id: "r1", name: "Ann Apart", tier: "GA" },
    { key: "reg:r2", id: "r2", name: "Bob Apart", tier: "GA" },
    { key: "reg:r3", id: "r3", name: "Cat Solo", tier: "GA" },
  ];
  return { t1, t2, chairs, objects, roster };
}

test("seating blocks: tables first, chairs grouped into rows", () => {
  const { objects } = chart();
  const blocks = seatingBlocks(objects);
  assert.deepEqual(blocks.map((b) => b.label), ["Table 1", "Table 2", "Row 1"]);
  assert.equal(blocks[2].slots.length, 6);
  assert.deepEqual(blocks[2].slots.map((s) => s.seatNo), [1, 2, 3, 4, 5, 6]);
});

test("auto-seat keeps parties together and honours apart and VIP rules", () => {
  const { objects, roster, t2 } = chart();
  const blocks = seatingBlocks(objects);
  const rows = [{ id: "a1", guestKey: "order:o1:0", guestKind: "order", vip: true }];
  const guests = buildChartGuests({ roster, rows, objects });
  const rules = [
    { id: "x", kind: "apart", guests: ["reg:r1", "reg:r2"], items: [] },
    { id: "v", kind: "vip_table", guests: [], items: [t2.id] },
  ];
  const { placements, unplaced } = autoSeat({ blocks, guests, rules });
  assert.equal(unplaced.length, 0);
  const where = new Map(placements.map((p) => [p.guestKey, p.itemId]));
  const party = roster.filter((p) => p.key.startsWith("order:")).map((p) => where.get(p.key));
  assert.equal(new Set(party).size, 1, "the order sits at one table");
  assert.equal(party[0], t2.id, "the VIP party gets the VIP table");
  assert.notEqual(where.get("reg:r1"), where.get("reg:r2"));
  assert.ok(![where.get("reg:r1"), where.get("reg:r2"), where.get("reg:r3")].includes(t2.id), "non-VIPs stay off the VIP table");
  const seatedRows = placements.map((p) => ({ guestKey: p.guestKey, itemId: p.itemId, seatIndex: p.seatIndex, vip: p.guestKey === "order:o1:0" }));
  const seated = buildChartGuests({ roster, rows: seatedRows, objects });
  assert.equal(ruleViolations(rules, seated, indexBlocks(blocks)).length, 0);
});

test("orphans, tallies and printouts", () => {
  const { objects, roster, t1 } = chart();
  const rows = [
    { guestKey: "reg:r1", itemId: t1.id, seatIndex: 0, meal: "Fish" },
    { guestKey: "reg:r2", itemId: "gone", seatIndex: 2, meal: "Beef" },
    { guestKey: "manual:1", guestKind: "manual", guestName: "Walk In", itemId: t1.id, seatIndex: 1, meal: "Fish" },
  ];
  const guests = buildChartGuests({ roster, rows, objects });
  assert.equal(guests.find((g) => g.key === "reg:r2").orphan, true);
  assert.equal(guests.find((g) => g.key === "manual:1").manual, true);
  assert.deepEqual(mealTally(guests.filter((g) => g.seated)), [{ meal: "Fish", count: 2 }]);
  const blocks = seatingBlocks(objects);
  const per = seatingByBlock(blocks, guests);
  assert.equal(per[0].guests.length, 2);
  const tables = per.map((t) => ({
    label: t.block.label,
    seats: t.seats.map((s) => ({ seatNo: s.seatNo, name: s.guest?.name || "", meal: s.guest?.meal || "" })),
    meals: t.meals,
    dietary: [],
  }));
  const meta = { eventName: "Gala <2026>" };
  assert.match(buildSeatingListHtml({ meta, tables }), /Find your table[\s\S]*Ann Apart/);
  assert.match(buildSeatingListHtml({ meta, tables }), /Gala &lt;2026&gt;/);
  assert.equal((buildPlaceCardsHtml({ meta, cards: Array.from({ length: 5 }, (_, i) => ({ name: `G${i}`, table: "Table 1" })) }).match(/class="page"/g) || []).length, 2);
  assert.match(buildTableSignsHtml({ meta, tables }), /class="num">1</);
  assert.match(buildCatererSummaryHtml({ meta, tables }), /Fish/);
});
