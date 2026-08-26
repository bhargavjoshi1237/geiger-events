import { test } from "node:test";
import assert from "node:assert/strict";

import { resolveItemGrant } from "./access.js";

const base = {
  access: { free: false, membership: { enabled: false, planIds: [] } },
  eventIds: ["e1"],
  projectId: "p1",
  grants: [],
  planIdsByProject: {},
  planExpiry: {},
  planName: {},
  events: { e1: { id: "e1", name: "Summit", seriesId: null } },
};

test("free content is granted with no membership at all", () => {
  const r = resolveItemGrant({ ...base, access: { free: true } });
  assert.equal(r.granted, true);
  assert.equal(r.expiresAt, null);
});

test("restricted content with no matching plan is denied", () => {
  const r = resolveItemGrant(base);
  assert.equal(r.granted, false);
});

test("a content-side grant names the member's plan directly", () => {
  const r = resolveItemGrant({
    ...base,
    access: { free: false, membership: { enabled: true, planIds: ["plan-a"] } },
    planIdsByProject: { p1: new Set(["plan-a"]) },
    planExpiry: { "plan-a": "2027-01-01T00:00:00Z" },
    planName: { "plan-a": "Pro" },
  });
  assert.equal(r.granted, true);
  assert.equal(r.via, "Pro");
  assert.equal(r.expiresAt, "2027-01-01T00:00:00Z");
});

test("two overlapping grants keep the most generous expiry", () => {
  const r = resolveItemGrant({
    ...base,
    access: { free: false, membership: { enabled: true, planIds: ["plan-a", "plan-b"] } },
    planIdsByProject: { p1: new Set(["plan-a", "plan-b"]) },
    planExpiry: { "plan-a": "2026-09-01T00:00:00Z", "plan-b": "2027-01-01T00:00:00Z" },
    planName: { "plan-a": "Basic", "plan-b": "Pro" },
  });
  assert.equal(r.granted, true);
  assert.equal(r.expiresAt, "2027-01-01T00:00:00Z");
});

test("a grant from another project does not leak across projects", () => {
  const r = resolveItemGrant({
    ...base,
    access: { free: false, membership: { enabled: true, planIds: ["plan-a"] } },
    planIdsByProject: { "other-project": new Set(["plan-a"]) },
    planExpiry: { "plan-a": "2027-01-01T00:00:00Z" },
  });
  assert.equal(r.granted, false);
});

test("absent or malformed access falls back to the free default", () => {
  assert.equal(resolveItemGrant({ ...base, access: null }).granted, true);
  assert.equal(resolveItemGrant({ ...base, access: undefined }).granted, true);
  assert.equal(resolveItemGrant({ ...base, access: "nonsense" }).granted, true);
});

test("an expired-but-granted plan still reports its expiry for the caller to check", () => {
  const r = resolveItemGrant({
    ...base,
    access: { free: false, membership: { enabled: true, planIds: ["plan-a"] } },
    planIdsByProject: { p1: new Set(["plan-a"]) },
    planExpiry: { "plan-a": "2020-01-01T00:00:00Z" },
    planName: { "plan-a": "Lapsed" },
  });
  assert.equal(r.granted, true);
  assert.equal(r.expiresAt, "2020-01-01T00:00:00Z");
});
