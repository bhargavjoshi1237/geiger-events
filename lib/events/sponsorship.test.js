import assert from "node:assert/strict";
import test from "node:test";
import * as sponsorship from "./sponsorship.js";

test("an empty sponsor marquee has no items; populated tracks repeat with unique keys", () => {
  assert.deepEqual(sponsorship.marqueeSponsors([]), []);
  const items = sponsorship.marqueeSponsors([{ id: "one", name: "Sponsor" }]);
  assert.equal(items.length, 8);
  assert.equal(new Set(items.map((item) => item.id)).size, 8);
  assert.ok(items.every((item) => item.name === "Sponsor"));
});

test("reserved slots remain unavailable even when pending sponsors are private", () => {
  const spot = sponsorship.normalizeSpot({
    id: "spot", quantity: 3, reserved: 2,
    fills: [{ id: "fill", status: "confirmed" }],
  });
  assert.deepEqual(sponsorship.spotCounts(spot), { filled: 2, confirmed: 1, left: 1 });
});
