import assert from "node:assert/strict";
import test from "node:test";
import {
  SECTION_TITLE_MAX,
  customSectionTitle,
  isRenamableSection,
  sectionTitle,
  withSectionTitle,
} from "./section_titles.js";

test("a section without an override keeps its built-in heading", () => {
  assert.equal(sectionTitle({}, "guests"), "Guests");
  assert.equal(sectionTitle({ sectionTitles: { guests: "   " } }, "guests"), "Guests");
  assert.equal(sectionTitle(null, "faq"), "Frequently Asked Questions");
  assert.equal(customSectionTitle({}, "guests"), "");
});

test("an override replaces the heading, trimmed", () => {
  const event = { sectionTitles: { guests: "  Fighters " } };
  assert.equal(sectionTitle(event, "guests"), "Fighters");
  assert.equal(customSectionTitle(event, "guests"), "Fighters");
  assert.equal(sectionTitle(event, "schedule"), "Schedule");
});

test("renaming sets, clears, and caps overrides without touching other sections", () => {
  const renamed = withSectionTitle({ faq: "Questions" }, "guests", " Fighters ");
  assert.deepEqual(renamed, { faq: "Questions", guests: "Fighters" });

  assert.deepEqual(withSectionTitle(renamed, "guests", ""), { faq: "Questions" });
  assert.deepEqual(withSectionTitle(renamed, "guests", "Guests"), { faq: "Questions" });
  assert.equal(withSectionTitle(undefined, "about", "x".repeat(90)).about.length, SECTION_TITLE_MAX);
});

test("only built-in sections are renamable", () => {
  assert.equal(isRenamableSection("guests"), true);
  assert.equal(isRenamableSection("sponsors"), false);
  assert.equal(isRenamableSection("toString"), false);
});
