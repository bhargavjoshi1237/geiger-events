import test from "node:test";
import assert from "node:assert/strict";
import { selectSubmission } from "./submission_state.js";

test("uncertain retry reuses command ID; changed payload or rebased revision gets a new one", () => {
  let sequence = 0;
  const makeId = () => `command-${++sequence}`;
  const first = selectSubmission(null, { title: "A", revision: 1 }, makeId);
  assert.equal(selectSubmission(first, { title: "A", revision: 1 }, makeId).commandId, "command-1");
  assert.equal(selectSubmission(first, { title: "B", revision: 1 }, makeId).commandId, "command-2");
  assert.equal(selectSubmission(first, { title: "A", revision: 2 }, makeId).commandId, "command-3");
});
