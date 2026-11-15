import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Checks the board-order fix: records.rank exists, workspace_query sorts by 'rank' and still honours the portal policy.
export async function verifyBoardOrder({ db, one, project, owner }) {
  let assertions = 0;
  const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const envelope = (action, payload = {}) => ({ action, commandId: randomUUID(), requestHash: randomUUID(), ...payload });
  const event = randomUUID();
  await db.query("insert into events.events(id, project_id, name) values ($1,$2,'Board order test')", [event, project]);
  const staff = async (action, payload = {}) => (await one("select events.workspace_command($1,$2,$3,$4) as value", [project, event, owner, envelope(action, payload)])).value;
  const query = async (plan) => (await one("select events.workspace_query($1,$2,$3) as value", [project, event, plan])).value;

  eq(await one("select count(*)::int as n from information_schema.columns where table_schema = 'events' and table_name = 'workspace_records' and column_name = 'rank'"), { n: 1 }, "records.rank exists");

  await staff("workspace.create", { createdFrom: { kind: "empty" } });
  const listId = randomUUID(), fTitle = randomUUID();
  await staff("object.create", { object: { id: listId, key: "tasks", name: "Task", plural: "Tasks", numberPrefix: "TSK",
    statuses: [{ key: "todo", label: "To do", color: "gray" }] },
    fields: [{ id: fTitle, key: "title", name: "Title", type: "short_text" }], titleFieldKey: "title" });
  const create = async (title) => (await staff("record.create", { objectId: listId, title, values: { [fTitle]: title }, status: "todo" })).record;
  await create("A");
  const b = await create("B"), c = await create("C");

  const base = { objectId: listId, filter: null, search: null, limit: 50, offset: 0, deleted: false, computed: [] };
  const manual = { ...base, sort: [{ source: "system", column: "rank", cast: "numeric", dir: "asc" }] };
  const titles = (page) => page.rows.map((row) => row.title);
  eq(titles(await query(manual)), ["A", "B", "C"], "unranked records keep their number order");
  await db.query("update events.workspace_records set rank = 0.5 where id = $1", [c.id]);
  eq(titles(await query(manual)), ["C", "A", "B"], "a ranked card moves to its place");

  const byId = await query({ ...manual, policy: { source: "system", column: "id", cast: "text", operator: "eq", value: b.id } });
  eq([byId.total, titles(byId)], [1, ["B"]], "the portal policy still limits rows");
  const flagged = await query({ ...manual, policyParts: [{ alias: "p0", condition: { source: "system", column: "title", cast: "text", operator: "eq", value: "A" } }] });
  eq(flagged.rows.map((row) => [row.title, row.policy?.p0]), [["C", false], ["A", true], ["B", false]], "per-row policy flags still come back");
  return assertions;
}
