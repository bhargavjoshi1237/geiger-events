import test from "node:test";
import assert from "node:assert/strict";
import { formulaForEditing, validateFieldInput, validateObjectInput } from "./definition.js";
import { analyseFieldChange, analyseFieldDelete, analyseObjectDelete } from "./impact.js";

const PAPERS = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const REVIEWS = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const f = (id, objectId, key, name, type, config = {}, extra = {}) => ({ id, objectId, key, name, type, config, required: false, isUnique: false, deletedAt: null, ...extra });
const fid = (n) => `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, "0")}`;

function definition() {
  return {
    objects: [
      { id: PAPERS, key: "papers", name: "Paper", plural: "Papers", titleFieldId: fid(1), deletedAt: null },
      { id: REVIEWS, key: "reviews", name: "Review", plural: "Reviews", titleFieldId: null, deletedAt: null },
    ],
    fields: [
      f(fid(1), PAPERS, "title", "Title", "short_text", { maxLength: 1000 }),
      f(fid(2), PAPERS, "score", "Score", "number", { decimals: 0 }),
      f(fid(3), PAPERS, "total", "Total", "formula", { expression: "{score} * 2", result: "number" }),
      f(fid(4), REVIEWS, "paper", "Paper", "link_record", { targetObjectId: PAPERS, multiple: false }),
      f(fid(5), REVIEWS, "mark", "Mark", "number", { decimals: 0 }),
      f(fid(6), PAPERS, "reviews", "Reviews", "link_record", { targetObjectId: REVIEWS, multiple: true }),
      f(fid(7), PAPERS, "avg_mark", "Average mark", "rollup", { linkFieldId: fid(6), targetFieldId: fid(5), fn: "avg" }),
    ],
  };
}

test("objects get a unique key, prefix and status keys", () => {
  const out = validateObjectInput({ name: "Paper", plural: "Papers", statuses: [{ label: "Under review" }, { label: "Accepted", color: "green" }] }, { definition: definition() });
  assert.equal(out.key, "paper");
  assert.equal(out.numberPrefix, "PAP");
  assert.deepEqual(out.statuses.map((s) => s.key), ["under_review", "accepted"]);
  const clash = validateObjectInput({ name: "Papers" }, { definition: definition() });
  assert.equal(clash.key, "papers_2");
  assert.throws(() => validateObjectInput({ name: "" }, { definition: definition() }), { code: "invalid_object" });
  assert.throws(() => validateObjectInput({ name: "X", statuses: [{ label: "A" }, { label: "a" }] }, { definition: definition() }), { code: "invalid_object" });
});

test("fields get unique keys and names and validated config", () => {
  const def = definition();
  const out = validateFieldInput({ name: "Track", type: "single_select", config: { options: [{ id: "opt_a", label: "AI" }] } }, { definition: def, objectId: PAPERS });
  assert.equal(out.key, "track");
  assert.throws(() => validateFieldInput({ name: "score", type: "number" }, { definition: def, objectId: PAPERS }), { code: "invalid_field" });
  assert.throws(() => validateFieldInput({ name: "Lost", type: "link_record", config: { targetObjectId: fid(99) } }, { definition: def, objectId: PAPERS }), { code: "invalid_field" });
  assert.throws(() => validateFieldInput({ name: "Calc", type: "formula", config: { expression: "1" }, required: true }, { definition: def, objectId: PAPERS }), { code: "invalid_field" });
  assert.throws(() => validateFieldInput({ name: "Notes", type: "long_text", isUnique: true }, { definition: def, objectId: PAPERS }), { code: "invalid_field" });
});

test("formulas are written with names, stored with keys and checked for cycles", () => {
  const def = definition();
  const out = validateFieldInput({ name: "Double", type: "formula", config: { expression: "{Score} + {Total}", result: "number" } }, { definition: def, objectId: PAPERS });
  assert.equal(out.config.expression, "{score} + {total}");
  assert.equal(formulaForEditing(out.config.expression, def.fields.filter((x) => x.objectId === PAPERS)), "{Score} + {Total}");
  assert.throws(() => validateFieldInput({ name: "Bad", type: "formula", config: { expression: "{Nope} + 1" } }, { definition: def, objectId: PAPERS }), (e) => /Nope/.test(e.message));
  const cyclic = structuredClone(def);
  cyclic.fields.push(f(fid(8), PAPERS, "a", "A", "formula", { expression: "{b} + 1", result: "number" }));
  assert.throws(() => validateFieldInput({ name: "B", type: "formula", config: { expression: "{A} + 1" } }, { definition: cyclic, objectId: PAPERS }), (e) => /itself/.test(e.message));
});

test("lookups and rollups must go through a link field", () => {
  const def = definition();
  assert.throws(() => validateFieldInput({ name: "L", type: "lookup", config: { linkFieldId: fid(2), targetFieldId: fid(5) } }, { definition: def, objectId: PAPERS }), { code: "invalid_field" });
  assert.throws(() => validateFieldInput({ name: "L", type: "lookup", config: { linkFieldId: fid(6), targetFieldId: fid(1) } }, { definition: def, objectId: PAPERS }), { code: "invalid_field" });
  const ok = validateFieldInput({ name: "Marks", type: "lookup", config: { linkFieldId: fid(6), targetFieldId: fid(5) } }, { definition: def, objectId: PAPERS });
  assert.equal(ok.type, "lookup");
  assert.throws(() => validateFieldInput({ name: "S", type: "rollup", config: { linkFieldId: fid(6), targetFieldId: fid(4), fn: "sum" } }, { definition: def, objectId: PAPERS }), { code: "invalid_field" });
});

test("type changes report what converts and what clears", () => {
  const field = f(fid(9), PAPERS, "code", "Code", "short_text");
  const impact = analyseFieldChange(field, { type: "number", config: { decimals: 0 } }, [
    { recordId: "r1", value: "1" }, { recordId: "r2", value: "x" }, { recordId: "r3", value: null },
  ]);
  assert.equal(impact.converts, 1);
  assert.equal(impact.clears, 1);
  assert.equal(impact.destructive, true);
  assert.deepEqual(impact.conversions, [{ recordId: "r1", value: 1 }, { recordId: "r2", value: null }]);
  assert.deepEqual(impact.examples, [{ recordId: "r2", from: "x" }]);
  const options = f(fid(10), PAPERS, "track", "Track", "single_select", { options: [{ id: "opt_a", label: "A", color: "gray" }, { id: "opt_b", label: "B", color: "gray" }] });
  const narrowed = analyseFieldChange(options, { config: { options: [{ id: "opt_a", label: "A" }] } }, [{ recordId: "r1", value: "opt_b" }]);
  assert.equal(narrowed.clears, 1);
  assert.throws(() => analyseFieldChange(field, { type: "link_record", config: { targetObjectId: PAPERS } }, []), { code: "invalid_field" });
});

test("deleting a field or list that others depend on is blocked with a reason", () => {
  const def = definition();
  assert.match(analyseFieldDelete(def.fields[1], def).blocked, /Total/);
  assert.match(analyseFieldDelete(def.fields[0], def).blocked, /title/i);
  assert.match(analyseFieldDelete(def.fields[4], def).blocked, /Average mark/);
  assert.equal(analyseFieldDelete(def.fields[2], def).blocked, null);
  assert.match(analyseObjectDelete(def.objects[0], def).blocked, /Reviews/);
});
