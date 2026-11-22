import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { appConfigView, mergeAppConfig } from "./app_config.js";
import { capacityRows, capacityStats, countRegs, parseCapacityPatch } from "./capacity.js";
import { TEMPLATE_SOURCE, TRIGGER_LABELS, WORKFLOW_TEMPLATES, templateView, workflowFromTemplate } from "./workflow_templates.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");

test("seats count confirmed and checked-in guests by party size, as the dashboard does", () => {
  const c = countRegs([
    { status: "Confirmed", party_size: 3 },
    { status: "Checked-in", party_size: null },
    { status: "Pending", party_size: 2 },
    { status: "Waitlisted", party_size: 1 },
  ]);
  assert.equal(c.seats, 4);
  assert.equal(c.Pending, 1);
  assert.equal(c.total, 4);
});

test("capacity rows add the overbook buffer and flag full events", () => {
  const rows = capacityRows(
    [
      { id: "a", name: "Gala", capacity: 4, capacityBuffer: 1 },
      { id: "b", name: "Talk", capacity: 0, capacityBuffer: null },
    ],
    [
      { event_id: "a", status: "Confirmed", party_size: 5 },
      { event_id: "b", status: "Confirmed", party_size: 2 },
    ],
  );
  assert.deepEqual(
    rows.map((r) => [r.id, r.effective, r.seats, r.fill, r.remaining, r.full]),
    [["a", 5, 5, 100, 0, true], ["b", 0, 2, 0, 0, false]],
  );
  assert.deepEqual(capacityStats(rows), { atCapacity: 1, totalSeats: 4, averageFill: 100 });
});

test("capacity patches take whole numbers only", () => {
  assert.deepEqual(parseCapacityPatch({ capacity: "120", buffer: 5 }), { capacity: 120, buffer: 5 });
  assert.throws(() => parseCapacityPatch({ capacity: -1 }), (e) => e.status === 400);
  assert.throws(() => parseCapacityPatch({ buffer: 1.5 }), (e) => e.status === 400);
  assert.throws(() => parseCapacityPatch({}), (e) => e.status === 400);
});

test("branded app edits merge over what's stored and keep white-label settings", () => {
  const stored = { sections: { watch: true }, home: { welcome: "Hi", shortcuts: ["watch", "community"] }, whiteLabel: { appName: "Acme Live" } };
  const next = mergeAppConfig(stored, { sections: { watch: false }, home: { liveStrip: false } });
  assert.equal(next.sections.watch, false);
  assert.deepEqual(next.home.shortcuts, ["community"], "turning a section off drops its shortcut");
  assert.equal(next.home.liveStrip, false);
  assert.equal(next.home.welcome, "Hi");
  assert.equal(next.whiteLabel.appName, "Acme Live");
  assert.equal(appConfigView(next).whiteLabel.appName, "Acme Live");
});

test("branded app input is validated", () => {
  assert.throws(() => mergeAppConfig({}, { sections: { nope: true } }), (e) => e.status === 400);
  assert.throws(() => mergeAppConfig({}, { sections: { watch: "yes" } }), (e) => e.status === 400);
  assert.throws(() => mergeAppConfig({}, { home: { welcome: "x".repeat(281) } }), (e) => e.status === 400);
  assert.throws(() => mergeAppConfig({}, { home: { shortcuts: ["community", "watch", "live", "orders", "qa"] } }), (e) => e.status === 400);
  assert.throws(() => mergeAppConfig({}, { home: { shortcuts: ["tickets"] } }), (e) => e.status === 400);
});

test("a template becomes a Draft workflow with fresh step ids and canvas positions", () => {
  let n = 0;
  const row = workflowFromTemplate(WORKFLOW_TEMPLATES[0], { projectId: "p", userId: "u", newId: () => `id${++n}` });
  assert.equal(row.status, "Draft");
  assert.equal(row.view_mode, "canvas");
  assert.equal(row.project_id, "p");
  assert.equal(row.created_by, "u");
  assert.deepEqual(row.steps.map((s) => [s.id, s.position.y]), [["step_id2", 0], ["step_id3", 140], ["step_id4", 280]]);
  assert.equal(templateView(WORKFLOW_TEMPLATES[0]).steps, 2);
});

// The templates are a copy of the dashboard's; a renamed or removed one there must fail here.
test("ported templates still match the dashboard's constants", () => {
  const source = readFileSync(join(ROOT, TEMPLATE_SOURCE), "utf8");
  for (const t of WORKFLOW_TEMPLATES) {
    assert.ok(source.includes(`id: "${t.id}"`), `${t.id} is gone from ${TEMPLATE_SOURCE}`);
    assert.ok(source.includes(`name: "${t.name}"`), `${t.id}'s name changed`);
    assert.ok(source.includes(`trigger: "${t.trigger}"`), `${t.id}'s trigger changed`);
    for (const s of t.steps) assert.ok(source.includes(`type: "${s.type}"`), `${t.id} step ${s.type} changed`);
  }
  for (const [key, label] of Object.entries(TRIGGER_LABELS)) {
    const escaped = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(source, new RegExp(`key: "${escaped(key)}",\\s*label: "${escaped(label)}"`), `trigger ${key} label changed`);
  }
  assert.equal((source.match(/id: "tmpl_/g) || []).length, WORKFLOW_TEMPLATES.length, "the dashboard has a template Control doesn't");
});
