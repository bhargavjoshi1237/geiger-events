import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_APP_CONFIG,
  MAX_SHORTCUTS,
  SECTION_KEYS,
  mergeForMember,
  normalizeAppConfig,
} from "./model.js";

test("missing or junk input normalises to the all-on defaults", () => {
  for (const raw of [null, undefined, "x", [], {}]) {
    const c = normalizeAppConfig(raw);
    assert.equal(c.version, 1);
    for (const key of SECTION_KEYS) assert.equal(c.sections[key], true, key);
    assert.deepEqual(c.home, { welcome: "", liveStrip: true, recentOrders: true, shortcuts: ["community", "watch", "memberships"] });
    assert.deepEqual(c.whiteLabel, DEFAULT_APP_CONFIG.whiteLabel);
  }
});

test("explicit false toggles survive; unknown keys and non-booleans are ignored", () => {
  const c = normalizeAppConfig({ sections: { networking: false, watch: "no", bogus: false }, home: { liveStrip: false } });
  assert.equal(c.sections.networking, false);
  assert.equal(c.sections.watch, true);
  assert.equal("bogus" in c.sections, false);
  assert.equal(c.home.liveStrip, false);
  assert.equal(c.home.recentOrders, true);
});

test("welcome is trimmed and capped at 280 characters", () => {
  assert.equal(normalizeAppConfig({ home: { welcome: "  Hi  " } }).home.welcome, "Hi");
  assert.equal(normalizeAppConfig({ home: { welcome: "x".repeat(400) } }).home.welcome.length, 280);
});

test("shortcuts drop unknown, disabled and duplicate keys and cap at the maximum", () => {
  const c = normalizeAppConfig({
    sections: { watch: false },
    home: { shortcuts: ["qa", "watch", "qa", "agenda", "live", "orders", "community", "memberships"] },
  });
  assert.deepEqual(c.home.shortcuts, ["qa", "live", "orders", "community"]);
  assert.equal(c.home.shortcuts.length, MAX_SHORTCUTS);
  assert.deepEqual(normalizeAppConfig({ home: { shortcuts: [] } }).home.shortcuts, []);
});

test("white-label fields fall back on bad enum values and cap strings", () => {
  const c = normalizeAppConfig({ whiteLabel: { themeMode: "neon", androidFormat: "ipa", appName: "a".repeat(200), accent: "#10b981" } });
  assert.equal(c.whiteLabel.themeMode, "dark");
  assert.equal(c.whiteLabel.androidFormat, "apk");
  assert.equal(c.whiteLabel.appName.length, 80);
  assert.equal(c.whiteLabel.accent, "#10b981");
});

test("a member with no connected projects sees everything", () => {
  const m = mergeForMember([]);
  for (const key of SECTION_KEYS) assert.equal(m.sections[key], true, key);
  assert.deepEqual(m.home.shortcuts, ["community", "watch", "memberships"]);
  assert.equal("whiteLabel" in m, false);
});

test("a section stays on when any connected project leaves it on", () => {
  const m = mergeForMember([
    { sections: { networking: false, watch: false } },
    { sections: { networking: false } },
  ]);
  assert.equal(m.sections.networking, false);
  assert.equal(m.sections.watch, true);
});

test("a project that never saved a config counts as all-on", () => {
  const m = mergeForMember([{ sections: { networking: false } }, null]);
  assert.equal(m.sections.networking, true);
});

test("welcome and shortcuts come from the project only when it is the member's only one", () => {
  const solo = mergeForMember([{ home: { welcome: "Hello DevCon", shortcuts: ["live", "qa"] } }]);
  assert.equal(solo.home.welcome, "Hello DevCon");
  assert.deepEqual(solo.home.shortcuts, ["live", "qa"]);

  const many = mergeForMember([{ home: { welcome: "Hello DevCon", shortcuts: ["live"] } }, null]);
  assert.equal(many.home.welcome, "");
  assert.deepEqual(many.home.shortcuts, ["community", "watch", "memberships"]);
});

test("merged shortcuts never point at a section that is off everywhere", () => {
  const m = mergeForMember([{ sections: { watch: false }, home: { shortcuts: ["watch", "live"] } }]);
  assert.deepEqual(m.home.shortcuts, ["live"]);
});
