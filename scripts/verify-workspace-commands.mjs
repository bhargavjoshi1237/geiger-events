import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Exercises events.workspace_command and events.workspace_query; called by verify-workspace-db.mjs.
export async function verifyCommands({ db, one, all, project, otherProject, event, otherEvent, venue, otherVenue, owner, viewer, outsider }) {
  let assertions = 0;
  const raw = async (command, actor = owner, ev = event) =>
    (await one("select events.workspace_command($1,$2,$3,$4) as value", [project, ev, actor, command])).value;
  const envelope = (action, payload = {}) => ({ action, commandId: randomUUID(), requestHash: randomUUID(), ...payload });
  const run = async (action, payload = {}, actor = owner, ev = event) => { const result = await raw(envelope(action, payload), actor, ev); assertions++; return result; };
  const deny = async (action, payload, code, message, actor = owner, ev = event) => {
    await assert.rejects(raw(envelope(action, payload), actor, ev), (error) => {
      if (error.code === code && (!message || error.message === message)) return true;
      console.error(`expected ${code} ${message ?? ""} for ${action}, got`, error.code, error.message);
      return false;
    }, `${action} should fail with ${code} ${message ?? ""}`);
    assertions++;
  };
  const query = async (plan) => (await one("select events.workspace_query($1,$2,$3) as value", [project, event, plan])).value;
  const record = async (id) => one("select * from events.workspace_records where id = $1", [id]);

  // Workspace lifecycle and permissions
  await deny("object.create", { object: { key: "x", name: "X", plural: "Xs", numberPrefix: "X" } }, "22023", "Workspace required");
  await deny("workspace.create", {}, "42501", null, viewer);
  await deny("workspace.create", {}, "42501", null, outsider);
  await deny("workspace.create", {}, "42501", null, owner, randomUUID());
  const create = envelope("workspace.create", { createdFrom: { kind: "empty" } });
  const created = await raw(create);
  eq(created.created, true);
  eq(await raw(create), created, "replaying workspace.create returns the same response");
  await deny("workspace.create", {}, "22023", "Workspace exists");

  // Objects and fields
  const papersId = randomUUID(), reviewsId = randomUUID();
  const titleId = randomUUID(), scoreId = randomUUID(), codeId = randomUUID(), tagsId = randomUUID();
  const papers = await run("object.create", {
    object: { id: papersId, key: "papers", name: "Paper", plural: "Papers", numberPrefix: "PAP",
      statuses: [{ key: "submitted", label: "Submitted", color: "gray" }, { key: "accepted", label: "Accepted", color: "green" }] },
    fields: [
      { id: titleId, key: "title", name: "Title", type: "short_text", required: true },
      { id: scoreId, key: "score", name: "Score", type: "number", config: { decimals: 0 } },
      { id: codeId, key: "code", name: "Code", type: "short_text", isUnique: true },
      { id: tagsId, key: "tags", name: "Tags", type: "multi_select", config: { options: [{ id: "opt_a", label: "AI" }, { id: "opt_b", label: "Bio" }] } },
    ],
    titleFieldKey: "title",
  });
  eq(papers.object.titleFieldId, titleId, "title field set by key");
  eq(papers.fields.length, 4);
  ok(papers.changeId, "structure change returns its id");
  await deny("object.create", { object: { key: "papers", name: "Dup", plural: "Dups", numberPrefix: "D" } }, "22023", "Object key taken");
  await deny("object.create", { object: { key: "x", name: "X", plural: "Xs", numberPrefix: "X" } }, "42501", null, viewer);
  const linkId = randomUUID(), markId = randomUUID(), contactLinkId = randomUUID(), spaceLinkId = randomUUID();
  await run("object.create", {
    object: { id: reviewsId, key: "reviews", name: "Review", plural: "Reviews", numberPrefix: "REV" },
    fields: [
      { id: linkId, key: "paper", name: "Paper", type: "link_record", config: { targetObjectId: papersId, multiple: false } },
      { id: markId, key: "mark", name: "Mark", type: "number", config: { decimals: 0 } },
      { id: contactLinkId, key: "reviewer", name: "Reviewer", type: "link_event", config: { target: "contact", multiple: false } },
      { id: spaceLinkId, key: "room", name: "Room", type: "link_event", config: { target: "venue_space", multiple: true } },
    ],
  });
  const backId = randomUUID(), countId = randomUUID(), avgId = randomUUID(), lookupId = randomUUID();
  await run("field.create", { objectId: papersId, field: { id: backId, key: "reviews", name: "Reviews", type: "link_record", config: { targetObjectId: reviewsId, multiple: true } } });
  await run("field.create", { objectId: papersId, field: { id: countId, key: "review_count", name: "Review count", type: "rollup", config: { linkFieldId: backId, fn: "count" } } });
  await run("field.create", { objectId: papersId, field: { id: avgId, key: "avg_mark", name: "Average mark", type: "rollup", config: { linkFieldId: backId, targetFieldId: markId, fn: "avg" } } });
  await run("field.create", { objectId: papersId, field: { id: lookupId, key: "marks", name: "Marks", type: "lookup", config: { linkFieldId: backId, targetFieldId: markId } } });
  await deny("field.create", { objectId: papersId, field: { key: "score", name: "Score 2", type: "number" } }, "22023", "Field key taken");
  await deny("field.create", { objectId: papersId, field: { key: "score2", name: "score", type: "number" } }, "22023", "Field name taken");

  // Records: numbering, revisions, replay, unique values
  const p1 = (await run("record.create", { objectId: papersId, title: "Deep nets", status: "submitted", values: { [titleId]: "Deep nets", [scoreId]: 4, [codeId]: "A1", [tagsId]: ["opt_a"] } })).record;
  eq([p1.number, p1.title, p1.revision], [1, "Deep nets", 1]);
  const p2 = (await run("record.create", { objectId: papersId, values: { [titleId]: "Proteins", [scoreId]: 2, [tagsId]: ["opt_b"] } })).record;
  eq([p2.number, p2.title], [2, "PAP-2"], "title falls back to the record number");
  await deny("record.create", { objectId: papersId, values: { [titleId]: "Dup", [codeId]: "a1" } }, "23505", "Unique value: code");
  await deny("record.create", { objectId: papersId, values: { [markId]: 1 } }, "22023", "Field not on object");
  await deny("record.create", { objectId: papersId, values: { [countId]: 1 } }, "22023", "Read-only field");
  await deny("record.create", { objectId: papersId, status: "nope", values: {} }, "22023", "Unknown status");
  await deny("record.create", { objectId: papersId, values: {} }, "42501", null, viewer);
  const update = envelope("record.update", { recordId: p1.id, expectedRevision: 1, values: { [scoreId]: 5, [codeId]: null } });
  const updated = await raw(update);
  eq([updated.record.revision, updated.record.values[scoreId], updated.record.values[codeId]], [2, 5, undefined], "null removes a value");
  eq(await raw(update), updated, "replayed update returns the stored response");
  await assert.rejects(raw({ ...update, requestHash: randomUUID() }), { code: "23505", message: "Command ID reused" }); assertions++;
  await deny("record.update", { recordId: p1.id, expectedRevision: 1, values: { [scoreId]: 6 } }, "40001");
  const change = await one("select before, after from events.workspace_changes where record_id = $1 and action = 'record.update' order by created_at desc limit 1", [p1.id]);
  eq(change.before.values, { [scoreId]: 4, [codeId]: "A1" }, "change log keeps the before values");
  await run("record.create", { objectId: papersId, values: { [titleId]: "Reuse", [codeId]: "A1" } });
  await deny("record.update", { recordId: p2.id, expectedRevision: 1, values: { [codeId]: "a1" } }, "23505", "Unique value: code");

  // Links and their scope
  const contact = randomUUID(), foreignContact = randomUUID(), space = randomUUID(), foreignSpace = randomUUID();
  await db.query("insert into events.contacts(id, project_id, name, email) values ($1,$2,'Ann','ann@x.test'), ($3,$4,'Eve','eve@x.test')", [contact, project, foreignContact, otherProject]);
  await db.query("insert into events.venue_spaces(id, project_id, venue_id, name) values ($1,$2,$3,'Hall A'), ($4,$2,$5,'Elsewhere')", [space, project, venue, foreignSpace, otherVenue]);
  const r1 = (await run("record.create", { objectId: reviewsId, values: { [markId]: 4 }, links: [{ fieldId: linkId, targets: [{ kind: "record", id: p1.id }] }, { fieldId: contactLinkId, targets: [{ kind: "contact", id: contact }] }, { fieldId: spaceLinkId, targets: [{ kind: "venue_space", id: space }] }] })).record;
  const r2 = (await run("record.create", { objectId: reviewsId, values: { [markId]: 2 } })).record;
  await deny("record.create", { objectId: reviewsId, links: [{ fieldId: contactLinkId, targets: [{ kind: "contact", id: foreignContact }] }] }, "22023", "Link target out of scope");
  await deny("record.create", { objectId: reviewsId, links: [{ fieldId: spaceLinkId, targets: [{ kind: "venue_space", id: foreignSpace }] }] }, "22023", "Link target out of scope");
  await deny("record.create", { objectId: reviewsId, links: [{ fieldId: linkId, targets: [{ kind: "record", id: r2.id }] }] }, "22023", "Link target wrong list");
  await deny("record.create", { objectId: reviewsId, links: [{ fieldId: linkId, targets: [{ kind: "record", id: p1.id }, { kind: "record", id: p2.id }] }] }, "22023", "Single link only");
  await deny("record.create", { objectId: reviewsId, links: [{ fieldId: contactLinkId, targets: [{ kind: "order", id: randomUUID() }] }] }, "22023", "Link target out of scope");
  await run("record.update", { recordId: p1.id, expectedRevision: 2, links: [{ fieldId: backId, targets: [{ kind: "record", id: r1.id }, { kind: "record", id: r2.id }] }] });

  // Query: filters, computed fields, search, sort, injection
  const base = { objectId: papersId, sort: [{ source: "system", column: "number", cast: "numeric", dir: "asc" }], limit: 50, offset: 0, deleted: false,
    computed: [{ alias: "c0", fieldId: countId, kind: "rollup", fn: "count", linkFieldId: backId, targetFieldId: null, cast: "numeric" },
      { alias: "c1", fieldId: avgId, kind: "rollup", fn: "avg", linkFieldId: backId, targetFieldId: markId, cast: "numeric" },
      { alias: "c2", fieldId: lookupId, kind: "lookup", fn: null, linkFieldId: backId, targetFieldId: markId, cast: "text" }] };
  const page = await query({ ...base });
  eq(page.total, 3);
  eq(page.rows[0].computed, { [countId]: 2, [avgId]: 3, [lookupId]: "4, 2" }, "rollups and lookups computed");
  const gte = await query({ ...base, filter: { op: "and", items: [{ source: "value", fieldId: scoreId, cast: "numeric", operator: "gte", value: 3 }] } });
  eq(gte.rows.map((row) => row.number), [1]);
  const either = await query({ ...base, filter: { op: "or", items: [
    { source: "system", column: "status", cast: "text", operator: "eq", value: "SUBMITTED" },
    { source: "value", fieldId: tagsId, cast: "text[]", operator: "has_any", value: ["opt_b"] }] } });
  eq(either.rows.map((row) => row.number), [1, 2]);
  const rolled = await query({ ...base, filter: { op: "and", items: [{ source: "computed", alias: "c0", cast: "numeric", operator: "gt", value: 1 }] } });
  eq(rolled.rows.map((row) => row.number), [1]);
  const linked = await query({ ...base, filter: { op: "and", items: [{ source: "link", fieldId: backId, cast: "link", operator: "has_any", value: [r2.id] }] } });
  eq(linked.rows.map((row) => row.number), [1]);
  const empty = await query({ ...base, filter: { op: "and", items: [{ source: "link", fieldId: backId, cast: "link", operator: "is_empty" }] } });
  eq(empty.rows.map((row) => row.number), [2, 3]);
  const found = await query({ ...base, search: ["prot"] });
  eq(found.rows.map((row) => row.number), [2]);
  const byNumber = await query({ ...base, search: ["3"] });
  eq(byNumber.rows.map((row) => row.number), [3]);
  const sorted = await query({ ...base, sort: [{ source: "value", fieldId: scoreId, cast: "numeric", dir: "desc" }] });
  eq(sorted.rows.map((row) => row.number), [1, 2, 3], "nulls sort last");
  const paged = await query({ ...base, limit: 1, offset: 1 });
  eq([paged.total, paged.rows.map((row) => row.number)], [3, [2]]);
  for (const bad of [
    { op: "and", items: [{ source: "value", fieldId: "x') or 1=1--", cast: "text", operator: "eq", value: "x" }] },
    { op: "and", items: [{ source: "value", fieldId: scoreId, cast: "text", operator: "eq; drop table events.workspace_records", value: "x" }] },
    { op: "and", items: [{ source: "system", column: "id; select 1", cast: "text", operator: "eq", value: "x" }] },
    { op: "and", items: [{ source: "value", fieldId: markId, cast: "numeric", operator: "eq", value: 1 }] },
  ]) {
    await assert.rejects(query({ ...base, filter: bad })); assertions++;
  }
  const quoted = await query({ ...base, filter: { op: "and", items: [{ source: "value", fieldId: titleId, cast: "text", operator: "contains", value: "'); drop table x; --" }] } });
  eq(quoted.total, 0, "quotes in values are data");
  await assert.rejects(query({ ...base, computed: [{ alias: "c0; drop", fieldId: countId, kind: "rollup", fn: "count", linkFieldId: backId }] })); assertions++;
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(query(base), { code: "42501" }); assertions++;
    await assert.rejects(raw(envelope("records.delete", { recordIds: [p1.id] })), { code: "42501" }); assertions++;
    await db.exec("reset role");
  }

  // Bulk, delete, restore, undo
  const bulk = await run("records.bulk", { updates: [{ recordId: p1.id, status: "accepted", values: { [tagsId]: null } }, { recordId: p2.id, status: "accepted", values: { [tagsId]: null }, title: "" }] });
  eq(bulk.count, 2);
  eq((await record(p2.id)).data[tagsId], undefined, "bulk can clear a field");
  const removed = await run("records.delete", { recordIds: [p2.id] });
  eq(removed.count, 1);
  eq((await query({ ...base })).total, 2);
  eq((await query({ ...base, deleted: true })).rows.map((row) => row.number), [2]);
  await run("change.undo", { changeId: removed.changeId });
  eq((await record(p2.id)).deleted_at, null, "undo restores deleted records");
  await deny("change.undo", { changeId: removed.changeId }, "22023", "Change cannot be undone");
  await deny("records.delete", { recordIds: [p2.id] }, "42501", null, viewer);

  // Field changes: conversions, uniqueness, delete/restore, undo
  const scoreField = await one("select revision from events.workspace_fields where id = $1", [scoreId]);
  const typeChange = await run("field.update", { fieldId: scoreId, expectedRevision: Number(scoreField.revision), patch: { type: "short_text", config: {} },
    conversions: [{ recordId: p1.id, value: "5" }, { recordId: p2.id, value: "2" }] });
  eq((await record(p1.id)).data[scoreId], "5");
  await run("change.undo", { changeId: typeChange.changeId });
  eq([(await one("select type from events.workspace_fields where id = $1", [scoreId])).type, (await record(p1.id)).data[scoreId]], ["number", 5], "undo restores type and values");
  await deny("field.update", { fieldId: scoreId, expectedRevision: 1, patch: { name: "Points" } }, "40001");
  await run("record.create", { objectId: papersId, values: { [titleId]: "reuse" } });
  const titleField = await one("select revision from events.workspace_fields where id = $1", [titleId]);
  await deny("field.update", { fieldId: titleId, expectedRevision: Number(titleField.revision), patch: { isUnique: true } }, "23505", null);
  const delField = await run("field.delete", { fieldId: tagsId });
  eq((await one("select deleted_at is not null as gone from events.workspace_fields where id = $1", [tagsId])).gone, true);
  await deny("record.update", { recordId: p1.id, expectedRevision: Number((await record(p1.id)).revision), values: { [tagsId]: ["opt_a"] } }, "22023", "Field not on object");
  await run("change.undo", { changeId: delField.changeId });
  eq((await one("select deleted_at from events.workspace_fields where id = $1", [tagsId])).deleted_at, null, "undo restores a deleted field");
  await deny("field.delete", { fieldId: titleId }, "22023", "Field in use");

  // Objects: in-use guard, status removal and undo
  await deny("object.delete", { objectId: papersId }, "22023", "Object in use");
  const paperObj = await one("select revision from events.workspace_objects where id = $1", [papersId]);
  const statusChange = await run("object.update", { objectId: papersId, expectedRevision: Number(paperObj.revision), patch: { statuses: [{ key: "submitted", label: "Submitted", color: "gray" }] } });
  eq((await record(p1.id)).status, null, "removed status clears records");
  await run("change.undo", { changeId: statusChange.changeId });
  eq((await record(p1.id)).status, "accepted", "undo puts statuses back");

  // Recompute, views, comments, import
  await run("records.recompute", { objectId: papersId, updates: [{ recordId: p1.id, values: { [titleId]: "Deep nets v2" }, title: "Deep nets v2" }] });
  eq((await record(p1.id)).title, "Deep nets v2");
  const personal = await run("view.save", { objectId: papersId, name: "Mine", shared: false, config: { kind: "table" } }, viewer);
  eq(personal.view.shared, false);
  await deny("view.save", { objectId: papersId, name: "Team", shared: true, config: {} }, "42501", null, viewer);
  await deny("view.delete", { viewId: personal.view.id }, "22023", "Unknown view", owner);
  await run("view.delete", { viewId: personal.view.id }, viewer);
  const comment = await run("comment.add", { recordId: p1.id, body: "Looks good" });
  eq(comment.comment.body, "Looks good");
  const fixed = randomUUID();
  const imported = await run("records.import", { objectId: papersId, rows: [{ id: fixed, values: { [titleId]: "Imported" } }, { values: { [titleId]: "Second" } }] });
  eq(imported.count, 2);
  const again = await run("records.import", { objectId: papersId, rows: [{ id: fixed, values: { [titleId]: "Imported" } }] });
  eq(again.count, 0, "importing the same id twice is skipped");

  // Copy helpers and the daily purge
  const noted = (await run("record.create", { objectId: papersId, note: "Copied from Summit 2025", values: { [titleId]: "Copied" } })).record;
  eq((await one("select after->>'note' as note from events.workspace_changes where record_id = $1", [noted.id])).note, "Copied from Summit 2025");
  await run("records.recompute", { objectId: reviewsId, updates: [{ recordId: r2.id, links: [{ fieldId: linkId, targets: [{ kind: "record", id: noted.id }] }] }] });
  eq((await all("select target_id from events.workspace_links where source_record_id = $1", [r2.id])).map((row) => row.target_id), [noted.id]);
  await db.query("update events.workspace_records set deleted_at = now() - interval '40 days' where id = $1", [noted.id]);
  await db.query("insert into events.workspace_files(project_id, event_id, field_id, path, name, size, created_by, created_at) values ($1,$2,$3,'p/orphan.pdf','orphan.pdf',1,$4, now() - interval '2 days')", [project, event, titleId, owner]);
  const purged = (await one("select events.workspace_purge(now() - interval '30 days') as value")).value;
  eq([purged.records, purged.paths], [1, ["p/orphan.pdf"]], "purge removes old trash and orphan files");
  eq(await record(noted.id), undefined);
  eq((await all("select 1 from events.workspace_links where source_record_id = $1", [r2.id])).length, 0, "links to purged records are removed");

  // Workspace delete cascades
  await run("workspace.delete", {});
  eq((await one("select count(*)::int as n from events.workspace_records where event_id = $1", [event])).n, 0);
  eq((await all("select * from events.workspace_objects where event_id = $1", [event])).length, 0);
  return assertions;

  function eq(actual, expected, message) { assert.deepEqual(actual, expected, message); assertions++; }
  function ok(value, message) { assert.ok(value, message); assertions++; }
}
