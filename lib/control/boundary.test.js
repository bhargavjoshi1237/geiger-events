import test from "node:test";
import assert from "node:assert/strict";

import { eventCutoff, projectsFilter } from "./boundary.js";

test("the event cutoff is UTC today minus one day", () => {
  assert.equal(eventCutoff(new Date("2026-11-08T00:30:00Z")), "2026-11-07");
});

test("projects filter covers org members and the creator of org-less projects", () => {
  assert.equal(
    projectsFilter("u1", ["o1", "o2"]),
    "organization_id.in.(o1,o2),and(organization_id.is.null,created_by.eq.u1)",
  );
  assert.equal(projectsFilter("u1", []), "and(organization_id.is.null,created_by.eq.u1)");
});

test("the projects filter never admits an org-less project outside the creator group", () => {
  for (const filter of [projectsFilter("u1", ["o1"]), projectsFilter("u1", [])]) {
    const outside = filter.replace(/and\([^)]*\)/g, "");
    assert.ok(!outside.includes("organization_id.is.null"));
  }
});
