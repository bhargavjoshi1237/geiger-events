import test from "node:test";
import assert from "node:assert/strict";

import { c, options } from "./catalog/builders.js";
import { parseSettingsPatch, publicSetting, settingsView } from "./settings_engine.js";

const kiosk = {
  id: "checkin.kiosk",
  store: "checkin",
  key: "kiosk",
  defaults: { enabled: false, mode: "self", idleSeconds: 30 },
  panels: [
    {
      title: "Kiosk",
      fields: [
        c("enabled", "Kiosk mode", "switch"),
        c("mode", "Mode", "select", { options: options(["self", "staffed"]) }),
        c("idleSeconds", "Idle reset", "number", { min: 5 }),
        c("theme", "Theme", "readonly"),
      ],
    },
  ],
  source: "x",
};

test("the view fills defaults and shows only this setting's keys", () => {
  assert.deepEqual(settingsView(kiosk, { enabled: true, secret: 1 }), { enabled: true, mode: "self", idleSeconds: 30 });
  assert.deepEqual(settingsView(kiosk, null), { enabled: false, mode: "self", idleSeconds: 30 });
});

test("a patch merges over what's stored so keys the app doesn't know survive", () => {
  const next = parseSettingsPatch(kiosk, { config: { enabled: true, idleSeconds: "45" } }, { mode: "staffed", templates: [1] });
  assert.deepEqual(next, { enabled: true, mode: "staffed", idleSeconds: 45, templates: [1] });
});

test("unknown, read-only and invalid settings are refused", () => {
  assert.throws(() => parseSettingsPatch(kiosk, { config: { nope: 1 } }, {}), (e) => e.status === 400);
  assert.throws(() => parseSettingsPatch(kiosk, { config: { theme: "x" } }, {}), (e) => e.status === 400);
  assert.throws(() => parseSettingsPatch(kiosk, { config: { mode: "robot" } }, {}), (e) => e.status === 400);
  assert.throws(() => parseSettingsPatch(kiosk, { config: { idleSeconds: 1 } }, {}), (e) => e.status === 400);
  assert.throws(() => parseSettingsPatch(kiosk, { config: {} }, {}), (e) => e.status === 400);
});

test("the public descriptor hides the source path", () => {
  assert.equal("source" in publicSetting(kiosk), false);
});

const faq = {
  id: "event.faq",
  store: "event",
  key: "faq",
  shape: "list",
  itemIdPrefix: "faq",
  defaults: [],
  panels: [{ title: "Question", fields: [c("q", "Question", "text"), c("a", "Answer", "textarea")] }],
  source: "x",
};

test("list sections merge each item onto its stored self and give new items ids", () => {
  const stored = [{ id: "faq_1", q: "Parking?", a: "Yes", icon: "car" }, { q: "Food?", a: "No", order: 2 }];
  const next = parseSettingsPatch(faq, { items: [{ _i: 1, q: "Food?", a: "Vendors on site" }, { id: "faq_1", q: "Parking?", a: "Yes" }, { q: "Wifi?", a: "Free" }] }, stored);
  assert.equal(next.length, 3);
  assert.deepEqual(next[0], { q: "Food?", a: "Vendors on site", order: 2, id: next[0].id });
  assert.match(next[0].id, /^faq_/);
  assert.deepEqual(next[1], { id: "faq_1", q: "Parking?", a: "Yes", icon: "car" });
  assert.equal(next[2].q, "Wifi?");
  assert.deepEqual(settingsView(faq, stored).items[1], { _i: 1, q: "Food?", a: "No" });
  assert.throws(() => parseSettingsPatch(faq, { items: "nope" }, stored), (e) => e.status === 400);
  assert.throws(() => parseSettingsPatch(faq, { items: [{ q: "x", secret: 1 }] }, stored), (e) => e.status === 400);
});

test("value sections store the single value itself", () => {
  const description = { id: "event.description", store: "event", key: "description", shape: "value", panels: [{ title: "About", fields: [c("description", "Description", "textarea")] }], source: "x" };
  assert.deepEqual(settingsView(description, "Hello"), { description: "Hello" });
  assert.equal(parseSettingsPatch(description, { config: { description: " New " } }, "Hello"), "New");
});
