import test from "node:test";
import assert from "node:assert/strict";
import { normaliseRecordInput } from "./values.js";
import { compileQuery } from "./query.js";
import { parseCsv, toCsv } from "./csv.js";

const P = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const R = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const fid = (n) => `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, "0")}`;
const T1 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const f = (n, objectId, key, name, type, config = {}, extra = {}) =>
  ({ id: fid(n), objectId, key, name, type, config, required: false, isUnique: false, deletedAt: null, ...extra });

function definition() {
  return {
    objects: [
      { id: P, key: "papers", name: "Paper", plural: "Papers", titleFieldId: fid(1), numberPrefix: "PAP",
        statuses: [{ key: "submitted", label: "Submitted" }, { key: "accepted", label: "Accepted" }], deletedAt: null },
      { id: R, key: "reviews", name: "Review", plural: "Reviews", titleFieldId: null, statuses: [], deletedAt: null },
    ],
    fields: [
      f(1, P, "title", "Title", "short_text", { maxLength: 200 }, { required: true }),
      f(2, P, "score", "Score", "number", { decimals: 0 }),
      f(3, P, "double", "Double", "formula", { expression: "{score} * 2", result: "number" }),
      f(4, P, "track", "Track", "single_select", { options: [{ id: "opt_a", label: "AI", color: "gray" }] }),
      f(5, P, "label", "Label", "formula", { expression: "{track} & \": \" & {title}", result: "text" }),
      f(6, P, "reviews", "Reviews", "link_record", { targetObjectId: R, multiple: true }),
      f(7, P, "review_count", "Review count", "rollup", { linkFieldId: fid(6), fn: "count" }),
      f(8, P, "old", "Old", "short_text", {}, { deletedAt: "2026-11-01T00:00:00Z" }),
      f(9, R, "mark", "Mark", "number", { decimals: 0 }),
    ],
  };
}

test("create requires required fields and fills defaults, formulas and title", () => {
  const def = definition();
  assert.throws(() => normaliseRecordInput(def, P, { values: { [fid(2)]: 3 } }), (e) => e.code === "invalid_values" && Boolean(e.fields[fid(1)]));
  const out = normaliseRecordInput(def, P, { values: { [fid(1)]: " Deep nets ", [fid(2)]: 3, [fid(4)]: "opt_a", [fid(6)]: [T1] } });
  assert.equal(out.values[fid(1)], "Deep nets");
  assert.equal(out.values[fid(3)], 6);
  assert.equal(out.values[fid(5)], "AI: Deep nets");
  assert.equal(out.title, "Deep nets");
  assert.equal(out.status, "submitted");
  assert.deepEqual(out.links, [{ fieldId: fid(6), targets: [{ kind: "record", id: T1 }] }]);
  assert.equal(fid(6) in out.values, false);
});

test("updates merge with existing values and only send what changed", () => {
  const def = definition();
  const existing = { values: { [fid(1)]: "A", [fid(2)]: 2, [fid(3)]: 4, [fid(5)]: ": A" }, status: "submitted" };
  const out = normaliseRecordInput(def, P, { values: { [fid(2)]: 5 }, status: "accepted" }, existing);
  assert.deepEqual(out.values, { [fid(2)]: 5, [fid(3)]: 10 });
  assert.equal(out.status, "accepted");
  assert.equal(out.title, "A");
  assert.throws(() => normaliseRecordInput(def, P, { values: { [fid(1)]: "" } }, existing), (e) => Boolean(e.fields?.[fid(1)]));
  assert.throws(() => normaliseRecordInput(def, P, { status: "nope" }, existing), { code: "invalid_values" });
});

test("unknown, deleted and calculated fields are rejected", () => {
  const def = definition();
  assert.throws(() => normaliseRecordInput(def, P, { values: { [fid(8)]: "x", [fid(1)]: "a" } }), { code: "unknown_field" });
  assert.throws(() => normaliseRecordInput(def, P, { values: { [fid(9)]: 1, [fid(1)]: "a" } }), { code: "unknown_field" });
  assert.throws(() => normaliseRecordInput(def, P, { values: { [fid(3)]: 1, [fid(1)]: "a" } }), { code: "read_only" });
});

test("records over the size cap are refused", () => {
  const def = definition();
  def.fields.push(f(20, P, "notes", "Notes", "long_text", { maxChars: 100000 }));
  const big = "x".repeat(100000);
  const values = { [fid(1)]: "a" };
  for (let i = 0; i < 11; i++) {
    def.fields.push(f(30 + i, P, `n${i}`, `N${i}`, "long_text", { maxChars: 100000 }));
    values[fid(30 + i)] = big;
  }
  assert.throws(() => normaliseRecordInput(def, P, { values }), { code: "too_large" });
});

test("query compiler validates fields and operators and lists computed fields", () => {
  const def = definition();
  const plan = compileQuery(def, P, {
    filter: { op: "or", items: [
      { field: fid(2), operator: "gte", value: 3 },
      { op: "and", items: [{ field: "status", operator: "eq", value: "accepted" }, { field: fid(6), operator: "is_not_empty" }] },
      { field: fid(7), operator: "gt", value: 1 },
    ] },
    sort: [{ field: fid(7), dir: "desc" }, { field: "number", dir: "asc" }],
    search: "deep  nets!",
    limit: 20,
  });
  assert.equal(plan.objectId, P);
  assert.equal(plan.filter.op, "or");
  assert.deepEqual(plan.filter.items[0], { source: "value", fieldId: fid(2), cast: "numeric", operator: "gte", value: 3 });
  assert.deepEqual(plan.filter.items[1].items[0], { source: "system", column: "status", cast: "text", operator: "eq", value: "accepted" });
  assert.equal(plan.filter.items[1].items[1].source, "link");
  assert.equal(plan.filter.items[2].source, "computed");
  assert.deepEqual(plan.computed, [{ alias: "c0", fieldId: fid(7), kind: "rollup", fn: "count", linkFieldId: fid(6), targetFieldId: null, cast: "numeric" }]);
  assert.deepEqual(plan.sort[0], { source: "computed", alias: "c0", cast: "numeric", dir: "desc" });
  assert.deepEqual(plan.search, ["deep", "nets"]);
  assert.equal(plan.limit, 20);
  assert.throws(() => compileQuery(def, P, { filter: { op: "and", items: [{ field: fid(2), operator: "contains", value: "x" }] } }), { code: "invalid_filter" });
  assert.throws(() => compileQuery(def, P, { filter: { op: "and", items: [{ field: fid(8), operator: "eq", value: "x" }] } }), { code: "invalid_filter" });
  assert.throws(() => compileQuery(def, P, { filter: { op: "and", items: [{ field: fid(2), operator: "gt", value: "3" }] } }), { code: "invalid_filter" });
  const deep = { op: "and", items: [{ op: "and", items: [{ op: "and", items: [{ op: "and", items: [] }] }] }] };
  assert.throws(() => compileQuery(def, P, { filter: deep }), { code: "invalid_filter" });
});

test("CSV round-trips quotes, commas and newlines", () => {
  const rows = [["Title", "Notes"], ["A, B", "line 1\nline \"2\""], ["", "x"]];
  const text = toCsv(rows);
  assert.deepEqual(parseCsv(`﻿${text.replace(/\n(?=[^"]*$)/g, "\r\n")}`), rows);
  assert.deepEqual(parseCsv("a,b\r\n1,2\r\n"), [["a", "b"], ["1", "2"]]);
});
