import { test } from "node:test";
import assert from "node:assert/strict";
import { allowedMoves, checkMove, validateProcess } from "./stages.js";
import { changeMatches, nextRunAt, targetDate, validateTrigger } from "./triggers.js";
import { validateSteps, waitMs } from "./steps.js";
import { renderTemplate, templateResolver, templateToKeys, templateToNames } from "./template.js";
import { assignReviewers, conflictOf, reviewScore, scoreSubmission } from "./assign.js";

const P = "00000000-0000-4000-8000-0000000000a1";
const R = "00000000-0000-4000-8000-0000000000a2";
const definition = {
  objects: [
    { id: P, key: "paper", name: "Paper", plural: "Papers", numberPrefix: "PAP", statuses: [
      { key: "submitted", label: "Submitted" }, { key: "review", label: "Under review" }, { key: "accepted", label: "Accepted" }, { key: "rejected", label: "Rejected" },
    ] },
    { id: R, key: "person", name: "Person", plural: "People", numberPrefix: "PER", statuses: [] },
  ],
  fields: [
    { id: "f-title", objectId: P, key: "title", name: "Title", type: "short_text", config: {} },
    { id: "f-note", objectId: P, key: "decision_note", name: "Decision note", type: "long_text", config: {} },
    { id: "f-score", objectId: P, key: "score", name: "Score", type: "number", config: {} },
    { id: "f-due", objectId: P, key: "due", name: "Due", type: "date", config: {} },
    { id: "f-authors", objectId: P, key: "authors", name: "Authors", type: "link_record", config: { targetObjectId: R, multiple: true } },
    { id: "f-email", objectId: R, key: "email", name: "Email", type: "email", config: {} },
    { id: "f-name", objectId: R, key: "name", name: "Name", type: "short_text", config: {} },
  ],
};
const paper = definition.objects[0];

test("stage rules: validation drops unknown statuses and duplicate moves", () => {
  const config = validateProcess(definition, P, {
    enforce: true,
    moves: [{ from: null, to: "submitted" }, { from: "submitted", to: "review" }, { from: "submitted", to: "review" }, { from: "review", to: "nope" }, { from: "review", to: "review" }],
    requires: { accepted: ["f-note", "f-authors", "missing"], ghost: ["f-note"] },
  });
  assert.deepEqual(config.moves, [{ from: null, to: "submitted" }, { from: "submitted", to: "review" }]);
  assert.deepEqual(config.requires, { accepted: ["f-note"] });
});

test("stage rules: moves and requirements", () => {
  const config = validateProcess(definition, P, {
    enforce: true,
    moves: [{ from: null, to: "submitted" }, { from: "submitted", to: "review" }, { from: "review", to: "accepted" }, { from: "review", to: "rejected" }],
    requires: { accepted: ["f-note"] },
  });
  assert.deepEqual(allowedMoves(config, paper, "review"), ["accepted", "rejected"]);
  assert.equal(checkMove(config, paper, { from: "submitted", to: "review" }), null);
  assert.equal(checkMove(config, paper, { from: "submitted", to: "accepted" }).code, "move_not_allowed");
  assert.match(checkMove(config, paper, { from: "submitted", to: "accepted" }).message, /Next: Under review/);
  const missing = checkMove(config, paper, { from: "review", to: "accepted", values: {}, fields: definition.fields });
  assert.equal(missing.code, "stage_requirements");
  assert.deepEqual(Object.keys(missing.fields), ["f-note"]);
  assert.equal(checkMove(config, paper, { from: "review", to: "accepted", values: { "f-note": "Strong" } }), null);
  assert.equal(checkMove(config, paper, { creating: true, to: "review" }).code, "move_not_allowed");
  assert.equal(checkMove(config, paper, { creating: true, to: "submitted" }), null);
  assert.equal(checkMove({ ...config, enforce: false }, paper, { from: "submitted", to: "accepted" }), null);
});

test("triggers: change matching", () => {
  const created = validateTrigger(definition, { kind: "record.created", objectId: P, source: "portal" });
  assert.equal(changeMatches(created, { action: "record.create", objectId: P, actorKind: "portal", after: {} }), true);
  assert.equal(changeMatches(created, { action: "record.create", objectId: P, actorKind: "staff", after: {} }), false);
  const status = validateTrigger(definition, { kind: "status.changed", objectId: P, to: ["accepted"] });
  assert.equal(changeMatches(status, { action: "record.update", objectId: P, before: { status: "review" }, after: { status: "accepted" } }), true);
  assert.equal(changeMatches(status, { action: "record.update", objectId: P, before: { values: {} }, after: { values: { "f-title": "x" } } }), false);
  const updated = validateTrigger(definition, { kind: "record.updated", objectId: P, fields: ["f-score"] });
  assert.equal(changeMatches(updated, { action: "record.update", objectId: P, before: { values: { "f-score": 1 } }, after: { values: { "f-score": 2 } } }), true);
  assert.equal(changeMatches(updated, { action: "record.update", objectId: P, before: { values: { "f-title": "a" } }, after: { values: { "f-title": "b" } } }), false);
  assert.equal(changeMatches(updated, { action: "record.update", objectId: R, before: { values: { "f-score": 1 } }, after: { values: { "f-score": 2 } } }), false);
});

test("triggers: schedules follow the event's clock across DST", () => {
  const daily = validateTrigger(definition, { kind: "schedule", every: "day", time: "09:00" });
  const next = nextRunAt(daily, new Date("2026-03-28T10:00:00Z"), "Europe/London");
  assert.equal(next.toISOString(), "2026-03-29T08:00:00.000Z");
  const weekly = validateTrigger(definition, { kind: "schedule", every: "week", weekday: 1, time: "07:30" });
  assert.equal(nextRunAt(weekly, new Date("2026-11-14T12:00:00Z"), "UTC").toISOString(), "2026-11-16T07:30:00.000Z");
  const date = validateTrigger(definition, { kind: "date", objectId: P, fieldId: "f-due", offsetDays: -2, time: "08:00" });
  assert.equal(targetDate(date, new Date("2026-11-14T08:00:00Z"), "UTC"), "2026-11-16");
});

test("steps: validation and templates", () => {
  const steps = validateSteps(definition, [
    { kind: "update_record", values: [{ fieldId: "f-note", value: "Reviewed on {{today}} for {{Title}}" }], status: "review" },
    { kind: "send_email", to: [{ kind: "linked", linkFieldId: "f-authors", fieldId: "f-email" }], subject: "Your paper {{Title}}", body: "<p>Hi {{Authors.Name}}</p>" },
    { kind: "wait", amount: 2, unit: "hours" },
  ], { subjectId: P });
  assert.equal(steps[0].values[0].value, "Reviewed on {{today}} for {{title}}");
  assert.equal(steps[1].body, "<p>Hi {{authors.name}}</p>");
  assert.equal(waitMs(steps[2]), 7_200_000);
  assert.match(steps[0].id, /^s_[a-z0-9]{10}$/);
  assert.throws(() => validateSteps(definition, [{ kind: "add_comment", body: "x" }]), /needs a trigger with a record/);
  assert.throws(() => validateSteps(definition, [{ kind: "update_record", values: [{ fieldId: "f-score", value: "abc" }] }], { subjectId: P }), /Score/);
  assert.throws(() => templateToKeys("{{Nope}}", definition, P), /isn't a field/);
  assert.equal(templateToNames("{{authors.email}} {{record.number}}", definition, P), "{{Authors.Email}} {{record.number}}");
});

test("template: rendering escapes HTML and resolves links", () => {
  const record = { number: 7, title: "Graphs", status: "accepted", values: { "f-title": "<Graphs>", "f-score": 4.5 }, links: { "f-authors": [{ id: "x", label: "Ada" }] } };
  const resolve = templateResolver(definition, { object: paper, record, linked: { authors: [{ values: { "f-email": "ada@x.org" } }] }, event: { name: "ICAML" } });
  assert.equal(renderTemplate("{{record.number}} {{title}} {{authors}} {{authors.email}} {{record.status}}", resolve), "PAP-7 <Graphs> Ada ada@x.org Accepted");
  assert.equal(renderTemplate("<b>{{title}}</b>", resolve, { html: true }), "<b>&lt;Graphs&gt;</b>");
  assert.equal(renderTemplate("{{missing}}|{{event.name}}", resolve), "|ICAML");
});

test("assignment: conflicts, limits, topics and determinism", () => {
  const submissions = [
    { id: "s1", topics: new Set(["ml"]), authorIds: new Set(["r1"]), conflictKeys: new Set(["mit"]) },
    { id: "s2", topics: new Set(["db"]), authorIds: new Set(), conflictKeys: new Set() },
  ];
  const reviewers = [
    { id: "r1", topics: new Set(["ml"]), conflictKeys: new Set(), conflictSubmissionIds: new Set() },
    { id: "r2", topics: new Set(["ml"]), conflictKeys: new Set(["mit"]), conflictSubmissionIds: new Set() },
    { id: "r3", topics: new Set(["db"]), conflictKeys: new Set(), conflictSubmissionIds: new Set(["s2"]) },
    { id: "r4", topics: new Set(["ml", "db"]), conflictKeys: new Set(), conflictSubmissionIds: new Set() },
  ];
  assert.equal(conflictOf(submissions[0], reviewers[0]), "is an author");
  assert.equal(conflictOf(submissions[0], reviewers[1]), "shares an affiliation");
  const result = assignReviewers({ submissions, reviewers, perSubmission: 2, maxPerReviewer: 2 });
  const forS1 = result.pairs.filter((pair) => pair.submissionId === "s1").map((pair) => pair.reviewerId).sort();
  const forS2 = result.pairs.filter((pair) => pair.submissionId === "s2").map((pair) => pair.reviewerId).sort();
  assert.deepEqual(forS1, ["r3", "r4"]);
  assert.ok(!forS2.includes("r3"));
  assert.equal(forS2.length, 2);
  assert.deepEqual(result, assignReviewers({ submissions, reviewers, perSubmission: 2, maxPerReviewer: 2 }));
  const tight = assignReviewers({ submissions, reviewers: reviewers.slice(0, 2), perSubmission: 1 });
  assert.equal(tight.unfilled[0].submissionId, "s1");
  assert.equal(tight.unfilled[0].reason, "Every reviewer has a conflict");
});

test("scoring: weighted rubric, spread and unfinished reviews", () => {
  const rubric = [{ fieldId: "a", weight: 2 }, { fieldId: "b", weight: 1 }];
  assert.equal(reviewScore({ a: 4, b: 1 }, rubric), 3);
  assert.equal(reviewScore({ a: 4 }, rubric), null);
  const result = scoreSubmission([
    { status: "done", values: { a: 4, b: 1 } }, { status: "done", values: { a: 5, b: 5 } }, { status: "draft", values: { a: 1, b: 1 } },
  ], rubric, { doneStatuses: ["done"] });
  assert.deepEqual(result, { assigned: 3, done: 2, average: 4, spread: 2, scores: [3, 5] });
});
