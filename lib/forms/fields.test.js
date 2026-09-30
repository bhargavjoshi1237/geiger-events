import assert from "node:assert/strict";
import test from "node:test";
import * as fields from "./fields.js";

test("untrusted answer entries cannot supply objects or null to the inbox", () => {
  const valid = { id: "question", label: "Question", value: "Answer" };
  assert.deepEqual(fields.normalizeAnswers([
    null, 2, {}, valid,
    { id: "bad", label: {}, value: "text" },
    { id: "bad", label: "Bad", value: { nested: "object" } },
    { id: "bad", label: "Bad", value: ["array"] },
  ]), [valid]);
  assert.deepEqual(fields.normalizeAnswers({}), []);
});

test("answer normalization preserves unchecked checkboxes and numeric zero", () => {
  const answers = [
    { id: "consent", label: "Consent", value: false },
    { id: "count", label: "Count", value: 0 },
  ];
  assert.deepEqual(fields.normalizeAnswers(answers), answers);
});
