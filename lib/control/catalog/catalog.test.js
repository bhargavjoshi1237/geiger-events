import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { MODULES, MODULE_BY_ID, STORES } from "./index.js";
import { SECTION_BY_KEY } from "./sections.js";
import { moduleFields } from "../records_engine.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const FIELD_TYPES = new Set([
  "text", "textarea", "number", "email", "url", "select", "tabs", "switch", "list", "ref",
  "date", "time", "datetime", "image", "status", "audience", "access", "readonly",
]);

// Permission overrides must name a key the RBAC config defines, or the engine would deny everyone.
const RBAC_KEYS = new Set([...readFileSync(join(ROOT, "geiger-rbac.config.js"), "utf8").matchAll(/key: "([a-z_.]+)"/g)].map((m) => m[1]));

// The app can only draw icons registered in its ICONS map.
const APP_ICONS = new Set(
  [...readFileSync(join(ROOT, "mobile/src/components/ui/icons.tsx"), "utf8").matchAll(/^\s+"?([a-z0-9-]+)"?: [A-Z]\w*,$/gm)].map((m) => m[1]),
);

// A field key "appears" when the source names it as a string, an object key or a property access.
function mentions(source, key) {
  return new RegExp(`["'\`]${key}["'\`]|\\b${key}\\s*:|\\.${key}\\b`).test(source);
}

test("every module is well formed", () => {
  assert.equal(MODULE_BY_ID.size, MODULES.length, "catalog ids must be unique");
  for (const m of MODULES) {
    const where = m.id;
    assert.ok(STORES[m.store], `${where}: unknown store ${m.store}`);
    assert.ok(SECTION_BY_KEY.has(m.section), `${where}: unknown section ${m.section}`);
    assert.equal(m.id, `${m.store}.${m.module}`, `${where}: id must be store.module`);
    assert.ok(APP_ICONS.has(m.icon), `${where}: icon ${m.icon} isn't in the app's ICONS`);
    if (m.permission) assert.ok(RBAC_KEYS.has(m.permission), `${where}: permission ${m.permission} isn't in geiger-rbac.config.js`);
    assert.ok(m.title && m.singular && m.panels?.length, `${where}: needs title, singular and panels`);
    const fields = moduleFields(m);
    const keys = new Set(fields.map((f) => f.key));
    assert.ok(keys.has("name"), `${where}: needs a name field`);
    for (const key of m.create || []) assert.ok(keys.has(key), `${where}: create field ${key} isn't a field`);
    for (const f of fields) {
      assert.ok(FIELD_TYPES.has(f.type), `${where}.${f.key}: unknown type ${f.type}`);
      if (f.type === "select" || f.type === "tabs") assert.ok(f.options?.length, `${where}.${f.key}: needs options`);
      if (f.type === "ref") assert.ok(MODULE_BY_ID.has(f.refModule), `${where}.${f.key}: ref ${f.refModule} isn't in the catalog`);
      if (f.type === "status") assert.ok(m.statuses?.length, `${where}: a status field needs statuses`);
    }
    if (STORES[m.store].shape === "record") assert.ok(m.statuses?.length || !keys.has("status"), `${where}: record modules list their statuses`);
  }
});

// A dashboard rename must fail here rather than silently drop data from the app.
test("every config field and status still exists in its dashboard source", () => {
  for (const m of MODULES) {
    assert.ok(m.source, `${m.id}: needs its dashboard source path`);
    const source = readFileSync(join(ROOT, m.source), "utf8");
    for (const f of moduleFields(m)) {
      if (f.scope === "root") continue;
      assert.ok(mentions(source, f.key), `${m.id}: config key "${f.key}" no longer appears in ${m.source}`);
    }
    assert.ok(source.includes(`"${m.module}"`) || source.includes(`'${m.module}'`) || source.includes(`${m.module}:`), `${m.id}: module key missing from ${m.source}`);
  }
});

test("every settings page is well formed and still matches its dashboard source", async () => {
  const { SETTINGS, SETTING_BY_ID, EVENT_SETTINGS, EVENT_SETTING_BY_ID } = await import("./index.js");
  const { SETTINGS_STORES, settingFields } = await import("../settings_engine.js");
  assert.equal(SETTING_BY_ID.size, SETTINGS.length, "settings ids must be unique");
  assert.equal(EVENT_SETTING_BY_ID.size, EVENT_SETTINGS.length, "event settings ids must be unique");
  for (const s of EVENT_SETTINGS) assert.equal(s.store, "event", `${s.id}: event settings use the event store`);
  for (const s of [...SETTINGS, ...EVENT_SETTINGS]) {
    assert.ok(SETTINGS_STORES[s.store], `${s.id}: unknown settings store ${s.store}`);
    assert.equal(s.id, `${s.store}.${s.key}`, `${s.id}: id must be store.key`);
    if (s.store !== "event") assert.ok(SECTION_BY_KEY.has(s.section), `${s.id}: unknown section ${s.section}`);
    assert.ok(APP_ICONS.has(s.icon), `${s.id}: icon ${s.icon} isn't in the app's ICONS`);
    assert.ok(s.title && s.panels?.length, `${s.id}: needs a title and panels`);
    const source = readFileSync(join(ROOT, s.source), "utf8");
    for (const f of settingFields(s)) {
      assert.ok(FIELD_TYPES.has(f.type) && f.type !== "status" && f.type !== "ref", `${s.id}.${f.key}: type ${f.type} can't be a setting`);
      assert.equal(f.scope, "config", `${s.id}.${f.key}: settings fields live in config`);
      if (f.type === "select" || f.type === "tabs") assert.ok(f.options?.length, `${s.id}.${f.key}: needs options`);
      assert.ok(mentions(source, f.key), `${s.id}: key "${f.key}" no longer appears in ${s.source}`);
    }
  }
});

// A Manage link must open a screen that exists, or the row would dead-end.
test("every hand-built screen links to an app route that exists", async () => {
  const { SCREENS } = await import("./index.js");
  const { existsSync } = await import("node:fs");
  const ids = new Set();
  for (const s of SCREENS) {
    assert.ok(!ids.has(s.id), `${s.id}: duplicate screen id`);
    ids.add(s.id);
    assert.ok(SECTION_BY_KEY.has(s.section), `${s.id}: unknown section ${s.section}`);
    assert.ok(APP_ICONS.has(s.icon), `${s.id}: icon ${s.icon} isn't in the app's ICONS`);
    assert.ok(s.title && typeof s.route === "string" && s.route.startsWith("/control/"), `${s.id}: needs a title and a /control/ route`);
    const base = join(ROOT, "mobile/src/app", s.route);
    assert.ok(existsSync(`${base}.tsx`) || existsSync(join(base, "index.tsx")), `${s.id}: no app screen at ${s.route}`);
  }
});
