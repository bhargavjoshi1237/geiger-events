import test from "node:test";
import assert from "node:assert/strict";
import { splitRegistrationAnswers } from "./registration_answers.js";

const q = (id, label) => ({ id, label });

test("two diet questions are both kept", () => {
  const out = splitRegistrationAnswers([q("a", "Dietary requirements"), q("b", "Allergies")], { a: "Vegetarian", b: "Sesame" });
  assert.equal(out.dietary, "Vegetarian; Sesame");
});

test("diet, access and other answers go to their own places", () => {
  const out = splitRegistrationAnswers(
    [q("a", "Dietary requirements"), q("b", "Accessibility requirements"), q("c", "Company")],
    { a: "Vegan", b: "Wheelchair space", c: "Northwind" },
  );
  assert.deepEqual(out, { dietary: "Vegan", accessibility: "Wheelchair space", answers: { Company: "Northwind" } });
});

test("blank answers are skipped", () => {
  const out = splitRegistrationAnswers([q("a", "Dietary requirements"), q("b", "Allergies")], { a: "", b: "Peanuts" });
  assert.equal(out.dietary, "Peanuts");
});
