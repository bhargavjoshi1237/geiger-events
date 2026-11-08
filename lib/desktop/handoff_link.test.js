import test from "node:test";
import assert from "node:assert/strict";

import { handoffDeepLink } from "./handoff_link.js";

const ok = { error: "", tokenHash: "th", type: "magiclink", email: "a@b.test" };

test("desktop states keep returning to the desktop shell", () => {
  const link = handoffDeepLink({ ...ok, state: "A".repeat(40) });
  assert.ok(link.startsWith("geiger-events://auth?"));
  assert.equal(new URLSearchParams(link.split("?")[1]).get("token_hash"), "th");
});

test("a mobile_ state returns to the mobile app", () => {
  const link = handoffDeepLink({ ...ok, state: `mobile_${"b".repeat(40)}` });
  assert.ok(link.startsWith("geigerevents://team-auth?"));
  const params = new URLSearchParams(link.split("?")[1]);
  assert.equal(params.get("state"), `mobile_${"b".repeat(40)}`);
  assert.equal(params.get("type"), "magiclink");
});

test("errors carry only the error and state", () => {
  const link = handoffDeepLink({ error: "mint_failed", tokenHash: "", type: "", email: "", state: `mobile_${"c".repeat(40)}` });
  const params = new URLSearchParams(link.split("?")[1]);
  assert.deepEqual([...params.keys()].sort(), ["error", "state"]);
});
