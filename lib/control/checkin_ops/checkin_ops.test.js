import test from "node:test";
import assert from "node:assert/strict";

import { buildZoneCards } from "../../checkin/capacity.js";
import { cardView, occupancyFromRow, parseCapacityRule, ruleFromRow } from "./capacity.js";
import { defaultPermissions, generateCode, parseRole, roleView } from "./roles.js";
import { badgeCounts, badgeView, leadView, parseBadgeStatus } from "./views.js";

test("a new role gets defaults and a six-digit code", () => {
  const row = parseRole({ name: " Door A " });
  assert.equal(row.name, "Door A");
  assert.equal(row.type, "staff");
  assert.match(row.access_code, /^\d{6}$/);
  assert.deepEqual(row.permissions, defaultPermissions());
  assert.match(generateCode(), /^\d{6}$/);
});

test("editing a role merges permissions and validates the code", () => {
  const current = { permissions: { canScan: true, canSell: false, canOverride: false, gates: ["g1"], zones: [], legacy: 1 } };
  const row = parseRole({ permissions: { canOverride: true, zones: ["z1", "z1", " "] } }, { current });
  assert.deepEqual(row, { permissions: { canScan: true, canSell: false, canOverride: true, gates: ["g1"], zones: ["z1"], legacy: 1 } });
  assert.throws(() => parseRole({ accessCode: "12" }, { current }), (e) => Boolean(e.fields?.accessCode));
  assert.throws(() => parseRole({ type: "issue" }, { current }), (e) => Boolean(e.fields?.type));
  assert.throws(() => parseRole({ name: "" }, { current }), (e) => Boolean(e.fields?.name));
  assert.throws(() => parseRole({}, { current }), (e) => e.status === 400);
  assert.deepEqual(parseRole({ active: false, accessCode: "AB12cd" }, { current }), { active: false, access_code: "AB12cd" });
});

test("a role's view fills missing permission flags", () => {
  const view = roleView({ id: "r", name: "", type: "issue", access_code: null, active: null, permissions: { canSell: true } });
  assert.equal(view.name, "Untitled role");
  assert.equal(view.type, "staff");
  assert.equal(view.active, true);
  assert.deepEqual(view.permissions, { canScan: true, canSell: true, canOverride: false, gates: [], zones: [] });
});

test("a cap rule is normalised; empty means no cap", () => {
  assert.deepEqual(parseCapacityRule({ zoneKey: "z1", zoneName: " VIP ", hardCap: "120.4", warnPct: 90, reentry: "once" }), {
    zone_key: "z1", zone_name: "VIP", hard_cap: 120, warn_pct: 90, reentry: "once", deleted_at: null,
  });
  assert.equal(parseCapacityRule({ zoneKey: "", hardCap: "" }).hard_cap, null);
  assert.throws(() => parseCapacityRule({ hardCap: -1 }), (e) => Boolean(e.fields?.hardCap));
  assert.throws(() => parseCapacityRule({ warnPct: 0 }), (e) => Boolean(e.fields?.warnPct));
  assert.throws(() => parseCapacityRule({ reentry: "always" }), (e) => Boolean(e.fields?.reentry));
});

test("zone cards combine the event's zones, saved caps and live occupancy", () => {
  const rules = [ruleFromRow({ id: "1", zone_key: "", zone_name: "", hard_cap: 100, warn_pct: 80, reentry: "multi" })];
  const occupancy = [occupancyFromRow({ zone_key: "", zone: "", admitted: 90, exited: 5, occupancy: 85 }), occupancyFromRow({ zone_key: "vip", zone: "VIP", occupancy: 3 })];
  const cards = buildZoneCards({ zones: [{ id: "z1", name: "VIP" }], rules, occupancy }).map(cardView);
  assert.equal(cards[0].venue, true);
  assert.equal(cards[0].level, "warn");
  assert.equal(cards[0].saveKey, "");
  assert.equal(cards[1].name, "VIP");
  assert.equal(cards[1].saveKey, "z1");
  assert.equal(cards[1].cap, null);
  assert.equal(cards[1].occupancy, 3);
});

test("badge status moves follow the dashboard's drawer", () => {
  assert.deepEqual(parseBadgeStatus({ status: "lost", reason: " desk " }, "active"), { status: "lost", reason: "desk" });
  assert.equal(parseBadgeStatus({ status: "active" }, "revoked").status, "active");
  assert.equal(parseBadgeStatus({ status: "revoked" }, "unassigned").status, "revoked");
  assert.throws(() => parseBadgeStatus({ status: "active" }, "active"), (e) => e.status === 409);
  assert.throws(() => parseBadgeStatus({ status: "lost" }, "unassigned"), (e) => e.status === 409);
  assert.throws(() => parseBadgeStatus({ status: "revoked" }, "replaced"), (e) => e.status === 409);
  assert.throws(() => parseBadgeStatus({ status: "unassigned" }, "active"), (e) => e.status === 400);
});

test("badges and leads read their holder and contact from the JSON bags", () => {
  const badge = badgeView({ id: "b", serial: "S1", status: "unassigned", metadata: { holder: { name: "Ada" } } });
  assert.equal(badge.holderName, "Ada");
  assert.equal(badgeView({ id: "c", active: false }).status, "revoked");
  assert.deepEqual(badgeCounts([{ status: "active" }, { status: "lost" }, { status: "active" }]), {
    active: 2, unassigned: 0, lost: 1, revoked: 0, replaced: 0,
  });
  const lead = leadView({ id: "l", attendee_name: "Bo", exhibitor: "Acme", contact: { email: "bo@x.io", company: "Y" } }, "Expo");
  assert.equal(lead.email, "bo@x.io");
  assert.equal(lead.eventName, "Expo");
  assert.equal(lead.phone, "");
});
