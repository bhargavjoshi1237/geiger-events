import { test } from "node:test";
import assert from "node:assert/strict";

import { parseManifest } from "./csv.js";

test("parses section,row,seat into grouped sections", () => {
  const { sections, errors } = parseManifest(
    "section,row,seat\nOrchestra,A,1\nOrchestra,A,2\nBalcony,A,1\n",
  );
  assert.equal(errors.length, 0);
  assert.equal(sections.length, 2);
  assert.equal(sections[0].name, "Orchestra");
  assert.equal(sections[0].seats.length, 2);
});

test("derives rows and seatsPerRow into the section layout", () => {
  const { sections } = parseManifest(
    "section,row,seat\nOrch,A,1\nOrch,A,2\nOrch,B,1\nOrch,B,2\n",
  );
  assert.equal(sections[0].layout.rows, 2);
  assert.equal(sections[0].layout.seatsPerRow, 2);
});

test("keeps the file's own row and seat labels", () => {
  const { sections } = parseManifest("section,row,seat\nOrch,AA,101\nOrch,AA,103\n");
  assert.equal(sections[0].rows[0].label, "AA");
  assert.deepEqual(
    sections[0].seats.map((s) => s.seatLabel),
    ["101", "103"],
  );
});

test("detects a numeric row-label scheme", () => {
  const { sections } = parseManifest("section,row,seat\nOrch,1,1\nOrch,2,1\n");
  assert.equal(sections[0].layout.rowLabels, "numeric");
});

test("reads an optional kind column", () => {
  const { sections } = parseManifest("section,row,seat,kind\nOrch,A,1,wheelchair\n");
  assert.equal(sections[0].seats[0].kind, "wheelchair");
});

test("tolerates header case, spacing, and quoted values", () => {
  const { sections, errors } = parseManifest(' Section , Row , Seat \n"Grand Circle",A,1\n');
  assert.equal(errors.length, 0);
  assert.equal(sections[0].name, "Grand Circle");
});

test("handles a quoted field containing a comma", () => {
  const { sections } = parseManifest('section,row,seat\n"Stalls, Left",A,1\n');
  assert.equal(sections[0].name, "Stalls, Left");
});

test("reports a missing required header instead of throwing", () => {
  const { sections, errors } = parseManifest("section,row\nOrch,A\n");
  assert.equal(sections.length, 0);
  assert.match(errors[0], /seat/i);
});

test("reports duplicate seats rather than silently dropping them", () => {
  const { errors } = parseManifest("section,row,seat\nOrch,A,1\nOrch,A,1\n");
  assert.match(errors[0], /duplicate/i);
});

test("ignores blank lines and an unknown kind falls back to standard", () => {
  const { sections, errors } = parseManifest("section,row,seat,kind\nOrch,A,1,sofa\n\n\n");
  assert.equal(errors.length, 0);
  assert.equal(sections[0].seats[0].kind, "standard");
});

test("an empty file reports an error rather than throwing", () => {
  const { sections, errors } = parseManifest("");
  assert.equal(sections.length, 0);
  assert.equal(errors.length, 1);
});
