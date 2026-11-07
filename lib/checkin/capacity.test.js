import test from "node:test";
import assert from "node:assert/strict";
import { bucketSeries, buildZoneCards, levelFor, percentOf } from "./capacity.js";

test("levels follow the cap and warning threshold", () => {
  assert.equal(levelFor(10, null), "none");
  assert.equal(levelFor(40, 100, 85), "ok");
  assert.equal(levelFor(85, 100, 85), "warn");
  assert.equal(levelFor(100, 100, 85), "full");
  assert.equal(levelFor(101, 100, 85), "over");
  assert.equal(percentOf(50, 200), 25);
  assert.equal(percentOf(0, 0), 0);
});

test("cards: venue first, event zones by id or name, unlisted zones from scans", () => {
  const cards = buildZoneCards({
    zones: [{ id: "z1", name: "VIP" }, { id: "z2", name: "Closed", enabled: false }],
    rules: [
      { zoneKey: "", zoneName: "", hardCap: 500, warnPct: 80 },
      { zoneKey: "old-id", zoneName: "vip", hardCap: 2, warnPct: 85 },
    ],
    occupancy: [
      { nameKey: "", zone: "", occupancy: 420, admitted: 500, exited: 80 },
      { nameKey: "vip", zone: "VIP", occupancy: 3, overCapacityAdmits: 1 },
      { nameKey: "bar", zone: "Bar", occupancy: 7 },
    ],
  });
  assert.deepEqual(cards.map((c) => c.key), ["", "z1", "name:bar"]);
  assert.equal(cards[0].level, "warn");
  assert.equal(cards[1].cap, 2);
  assert.equal(cards[1].level, "over");
  assert.equal(cards[2].unlisted, true);
  assert.equal(cards[2].level, "none");
});

test("series are gap-filled across the shared range", () => {
  const t0 = "2026-11-08T18:00:00Z";
  const t2 = "2026-11-08T18:30:00Z";
  const s = bucketSeries(
    [
      { bucket: t0, nameKey: "", arrivals: 5, exits: 0 },
      { bucket: t2, nameKey: "vip", arrivals: 2, exits: 1 },
    ],
    "vip",
  );
  assert.deepEqual(s.map((p) => [p.arrivals, p.exits]), [[0, 0], [0, 0], [2, 1]]);
});
