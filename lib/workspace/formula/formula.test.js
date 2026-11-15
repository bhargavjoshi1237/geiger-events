import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFormula, formulaRefs, parseFormula, renameRefs } from "./index.js";

const run = (source, values = {}, options = {}) => evaluateFormula(parseFormula(source), values, options);
const rejects = (source, pattern) => assert.throws(() => parseFormula(source), (error) =>
  error.code === "invalid_formula" && pattern.test(error.message));

test("arithmetic follows precedence and parentheses", () => {
  assert.equal(run("1 + 2 * 3"), 7);
  assert.equal(run("(1 + 2) * 3"), 9);
  assert.equal(run("-2 + 10 % 4"), 0);
  assert.equal(run("7 / 0"), null);
});

test("text concatenation and comparisons", () => {
  assert.equal(run(`"Room " & {room}`, { room: "A" }), "Room A");
  assert.equal(run(`{score} >= 4 AND {status} = "ok"`, { score: 4, status: "ok" }), true);
  assert.equal(run(`NOT({flag})`, { flag: false }), true);
  assert.equal(run(`{a} <> {b}`, { a: 1, b: 2 }), true);
});

test("IF, BLANK and ISBLANK treat missing values as blank", () => {
  assert.equal(run(`IF(ISBLANK({x}), "none", {x})`, {}), "none");
  assert.equal(run(`IF({x} = BLANK(), 1, 2)`, { x: "" }), 1);
  assert.equal(run(`IF(FALSE, 1)`), null);
  assert.equal(run(`{missing} + 1`), null);
});

test("aggregate, maths and text functions", () => {
  assert.equal(run("SUM({a}, {b}, 3)", { a: 1, b: null }), 4);
  assert.equal(run("AVERAGE(2, 4)"), 3);
  assert.equal(run("ROUND(2.345, 2)"), 2.35);
  assert.equal(run(`LEN(TRIM("  hi "))`), 2);
  assert.equal(run(`UPPER(LEFT("geiger", 3))`), "GEI");
  assert.equal(run(`CONTAINS("Research talk", "talk")`), true);
  assert.equal(run(`REPLACE("a-b-c", "-", "/")`), "a/b/c");
  assert.equal(run(`VALUE("12.5") + 1`), 13.5);
});

test("date functions", () => {
  assert.equal(run(`DATEDIFF("2026-11-01", "2026-11-14")`), 13);
  assert.equal(run(`DATEDIFF("2026-11-14T10:00:00Z", "2026-11-14T13:30:00Z", "hours")`), 3);
  assert.equal(run(`DATEADD("2026-01-31", 1, "days")`), "2026-02-01");
  assert.equal(run(`YEAR("2026-11-14") * 100 + MONTH("2026-11-14")`), 202611);
  assert.equal(run(`FORMATDATE("2026-03-05", "DD/MM/YYYY")`), "05/03/2026");
  assert.equal(run("TODAY()", {}, { now: new Date("2026-11-14T22:00:00Z"), timeZone: "Asia/Kolkata" }), "2026-11-15");
});

test("references are extracted and can be renamed", () => {
  const ast = parseFormula(`{score} * 2 + {bonus}`);
  assert.deepEqual([...formulaRefs(ast)].sort(), ["bonus", "score"]);
  assert.equal(renameRefs(`{Score} * 2 & "{not a ref}"`, (name) => name.toLowerCase()), `{score} * 2 & "{not a ref}"`);
});

test("bad formulas are rejected with a plain reason", () => {
  rejects("1 +", /end/i);
  rejects("NOPE(1)", /NOPE/);
  rejects(`"open`, /quote/i);
  rejects("{open", /\}/);
  rejects("IF(1)", /IF/);
  rejects("(".repeat(33) + "1" + ")".repeat(33), /nested/i);
  rejects("1+".repeat(1001) + "1", /2000/);
});
