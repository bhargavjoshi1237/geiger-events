import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Exercises the process migration: wider actor kinds, the system command, the change → queue trigger, queue leasing,
// approval decisions and housekeeping. Called by verify-workspace-db.mjs after the Portals checks, on its own event.
export async function verifyProcess({ db, one, all, project, owner }) {
  let assertions = 0;
  const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const ok = (value, message) => { assert.ok(value, message); assertions++; };
  const fails = async (promise, code, message, label) => {
    await assert.rejects(promise, (error) => {
      if (error.code === code && (!message || error.message === message)) return true;
      console.error(`expected ${code} ${message ?? ""} for ${label}, got`, error.code, error.message);
      return false;
    }, label);
    assertions++;
  };
  const envelope = (action, payload = {}) => ({ action, commandId: randomUUID(), requestHash: randomUUID(), ...payload });
  const event = randomUUID();
  await db.query("insert into events.events(id, project_id) values ($1,$2)", [event, project]);
  const staff = async (action, payload = {}) => (await one("select events.workspace_command($1,$2,$3,$4) as value", [project, event, owner, envelope(action, payload)])).value;
  const system = async (kind, actor, depth, command) =>
    (await one("select events.workspace_system_command($1,$2,$3,$4,$5,$6) as value", [project, event, kind, actor, depth, command])).value;
  const rev = async (id) => Number((await one("select revision from events.workspace_records where id = $1", [id])).revision);
  const changeItems = async () => all("select change_id, record_id, depth from events.workspace_queue where event_id = $1 and kind = 'change' order by created_at", [event]);

  await staff("workspace.create", { createdFrom: { kind: "empty" } });
  const listId = randomUUID(), fTitle = randomUUID(), fScore = randomUUID();
  await staff("object.create", { object: { id: listId, key: "papers", name: "Paper", plural: "Papers", numberPrefix: "PAP",
    statuses: [{ key: "submitted", label: "Submitted", color: "blue" }, { key: "accepted", label: "Accepted", color: "green" }] },
    fields: [{ id: fTitle, key: "title", name: "Title", type: "short_text" }, { id: fScore, key: "score", name: "Score", type: "number", config: { decimals: 0 } }],
    titleFieldKey: "title" });
  const create = async (title) => (await staff("record.create", { objectId: listId, title, values: { [fTitle]: title }, status: "submitted" })).record;
  const update = async (record, values) => staff("record.update", { recordId: record.id, expectedRevision: await rev(record.id), values });

  // The change → queue trigger
  const a = await create("A");
  eq((await changeItems()).length, 0, "no automations: nothing queued");
  const automation = (await one(`insert into events.workspace_automations (project_id, event_id, name, enabled, trigger)
    values ($1,$2,'Notify',false,$3) returning id`, [project, event, { kind: "record.updated", objectId: listId }])).id;
  await update(a, { [fScore]: 1 });
  eq((await changeItems()).length, 0, "a disabled automation queues nothing");
  await one(`insert into events.workspace_automations (project_id, event_id, name, enabled, trigger)
    values ($1,$2,'Daily',true,$3) returning id`, [project, event, { kind: "schedule", every: "day", time: "09:00" }]);
  await update(a, { [fScore]: 2 });
  eq((await changeItems()).length, 0, "timed automations don't listen to changes");
  await db.query("update events.workspace_automations set enabled = true where id = $1", [automation]);
  await update(a, { [fScore]: 3 });
  const b = await create("B");
  const items = await changeItems();
  eq(items.map((item) => [item.record_id, item.depth]), [[a.id, 0], [b.id, 0]], "updates and creates are queued at depth 0");
  const latest = await one("select id, action from events.workspace_changes where record_id = $1 order by created_at desc, id desc limit 1", [b.id]);
  eq([items[1].change_id, latest.action], [latest.id, "record.create"], "the queue item points at its change");
  const removed = await staff("records.delete", { recordIds: [b.id], objectId: listId });
  eq((await changeItems()).length, 2, "deletes are not queued");
  await staff("change.undo", { changeId: removed.changeId });
  eq((await changeItems()).length, 2, "undo is not queued");
  ok((await all("select 1 from events.workspace_changes where event_id = $1 and undo_of is not null", [event])).length > 0, "the undo was logged");

  // The system command: actors, depth, receipts
  await fails(system("staff", owner, 0, envelope("record.update", { recordId: a.id, values: {} })), "42501", "Not allowed", "only system kinds");
  await fails(system("automation", randomUUID(), 0, envelope("record.update", { recordId: a.id, values: {} })), "42501", "Not allowed", "unknown automation");
  await fails(system("automation", automation, 0, envelope("object.create", { object: { key: "x" } })), "42501", "Not allowed", "no structure changes");
  await fails(system("automation", automation, 0, { action: "record.update", commandId: "nope", requestHash: "h" }), "22023", "Invalid command", "command ids are uuids");
  const byAutomation = envelope("record.update", { recordId: a.id, expectedRevision: await rev(a.id), values: { [fScore]: 4 }, status: "accepted" });
  const saved = await system("automation", automation, 1, byAutomation);
  eq([saved.record.values[fScore], saved.record.status], [4, "accepted"], "an automation updates a record");
  eq(await one("select actor_kind, actor_id from events.workspace_changes where record_id = $1 order by created_at desc, id desc limit 1", [a.id]),
    { actor_kind: "automation", actor_id: automation }, "the change names the automation");
  eq((await changeItems()).at(-1).depth, 1, "its change is queued one level deeper");
  eq(await system("automation", automation, 1, byAutomation), saved, "replay returns the stored response");
  await fails(system("automation", automation, 1, { ...byAutomation, requestHash: randomUUID() }), "23505", "Command ID reused", "reused command id");
  eq((await one("select actor_kind from events.workspace_command_receipts where actor_id = $1", [automation])).actor_kind, "automation", "receipts keep the kind");
  const created = await system("automation", automation, 2, envelope("record.create", { objectId: listId, title: "C", values: { [fTitle]: "C" }, status: "submitted" }));
  eq((await changeItems()).at(-1).depth, 2, "creates carry the depth too");
  const note = await system("automation", automation, 0, envelope("comment.add", { recordId: created.record.id, body: "Checked" }));
  eq(await one("select actor_kind, created_by from events.workspace_comments where id = $1", [note.comment.id]), { actor_kind: "automation", created_by: automation }, "automation comments");
  const approval = (await one(`insert into events.workspace_approvals (project_id, event_id, record_id, title, approvers)
    values ($1,$2,$3,'Check',$4) returning id`, [project, event, a.id, [owner]])).id;
  await system("automation", approval, 0, envelope("comment.add", { recordId: a.id, body: "Decided" }));
  ok(true, "an approval may act as the system actor");
  const key = randomUUID();
  await db.query("insert into events.api_keys (id, project_id, name, prefix, key_hash) values ($1,$2,'k','gev_live_x',$3)", [key, project, randomUUID()]);
  const viaApi = await system("api", key, 0, envelope("record.update", { recordId: a.id, expectedRevision: await rev(a.id), values: { [fScore]: 5 } }));
  eq(viaApi.record.values[fScore], 5, "an API key updates a record");
  eq((await one("select actor_kind from events.workspace_changes where actor_id = $1", [key])).actor_kind, "api", "the change names the key");
  await db.query("update events.api_keys set revoked_at = now() where id = $1", [key]);
  await fails(system("api", key, 0, envelope("comment.add", { recordId: a.id, body: "x" })), "42501", "Not allowed", "revoked keys can't write");
  eq(await one("select current_setting('workspace.depth', true) as depth"), { depth: "" }, "the depth doesn't leak past the transaction");

  // Queue leasing
  await db.query("update events.workspace_queue set status = 'done' where event_id = $1", [event]);
  const enqueue = async (due) => (await one(`insert into events.workspace_queue (project_id, event_id, kind, automation_id, due_at)
    values ($1,$2,'manual',$3,$4) returning id`, [project, event, automation, due])).id;
  const past = new Date(Date.now() - 60_000).toISOString();
  const q1 = await enqueue(past), q2 = await enqueue(past), later = await enqueue(new Date(Date.now() + 3_600_000).toISOString());
  const claim = async (limit = 10, eventId = event) => all("select id, status, attempts, locked_until from events.workspace_queue_claim($1, 60, $2, $3)", [limit, project, eventId]);
  eq((await claim(10, randomUUID())).length, 0, "claims are scoped to the event");
  const first = await claim(1);
  eq([first.length, first[0].status, first[0].attempts], [1, "running", 1], "a claim leases one item and counts the attempt");
  ok(new Date(first[0].locked_until) > new Date(), "the lease runs into the future");
  const rest = await claim();
  eq(rest.map((row) => row.id), [first[0].id === q1 ? q2 : q1], "leased items are skipped; future items wait");
  eq((await claim()).length, 0, "nothing left to claim");
  await db.query("update events.workspace_queue set locked_until = now() - interval '1 second' where id = $1", [q1]);
  eq((await claim()).map((row) => [row.id, row.attempts]), [[q1, 2]], "an expired lease is claimed again");
  await db.query("update events.workspace_queue set locked_until = now() - interval '1 second', attempts = 3 where id = $1", [q2]);
  eq((await claim()).length, 0, "three attempts and it stops");
  eq((await one("select status from events.workspace_queue where id = $1", [later])).status, "pending", "the future item stays pending");

  // Approval decisions
  const [u1, u2, u3] = [randomUUID(), randomUUID(), randomUUID()];
  const ask = async (rule, approvers) => (await one(`insert into events.workspace_approvals (project_id, event_id, record_id, title, approvers, rule)
    values ($1,$2,$3,'Approve',$4,$5) returning id`, [project, event, a.id, approvers, rule])).id;
  const decide = async (id, user, decision) =>
    one("select status, decisions, decided_at from events.workspace_approval_decide($1,$2,$3,$4,$5,'note')", [project, event, id, user, decision]);
  const any = await ask("any", [u1, u2]);
  await fails(decide(any, u3, "approve"), "42501", "Not allowed", "only approvers decide");
  await fails(decide(any, u1, "maybe"), "22023", "Invalid command", "approve or reject");
  const anyDone = await decide(any, u1, "approve");
  eq([anyDone.status, anyDone.decisions.length, Boolean(anyDone.decided_at)], ["approved", 1, true], "any: the first approval settles it");
  await fails(decide(any, u2, "reject"), "22023", "Approval decided", "a decided approval is closed");
  const every = await ask("all", [u1, u2]);
  eq((await decide(every, u1, "approve")).status, "pending", "all: one approval isn't enough");
  await fails(decide(every, u1, "approve"), "22023", "Approval decided", "no second vote");
  eq((await decide(every, u2, "approve")).status, "approved", "all: everyone approved");
  const vetoed = await ask("all", [u1, u2]);
  eq((await decide(vetoed, u2, "reject")).status, "rejected", "any rejection rejects");
  await fails(decide(randomUUID(), u1, "approve"), "22023", "Unknown approval", "unknown approval");

  // Housekeeping
  await db.query(`insert into events.workspace_runs (project_id, event_id, automation_id, run_key, status, started_at)
    values ($1,$2,$3,'old','succeeded', now() - interval '100 days'), ($1,$2,$3,'new','succeeded', now())`, [project, event, automation]);
  await db.query("update events.workspace_queue set status = 'done', updated_at = now() - interval '8 days' where id = $1", [later]);
  await db.query("update events.workspace_queue set status = 'failed', updated_at = now() - interval '31 days' where id = $1", [q1]);
  const swept = (await one("select events.workspace_process_housekeeping() as value")).value;
  eq(swept, { runs: 1, queue: 2 }, "old runs and finished items are removed");
  eq(await one("select status, last_error from events.workspace_queue where id = $1", [q2]), { status: "failed", last_error: "Stopped after 3 attempts" }, "stuck items fail");
  eq((await all("select run_key from events.workspace_runs where event_id = $1", [event])).map((row) => row.run_key), ["new"], "recent runs stay");

  // Privileges
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const [sql, params] of [
      ["select events.workspace_system_command($1,$2,'automation',$1,0,'{}')", [project, event]],
      ["select * from events.workspace_queue_claim(1, 60, null, null)", []],
      ["select events.workspace_approval_decide($1,$2,$1,$1,'approve','')", [project, event]],
      ["select events.workspace_process_housekeeping()", []],
      ["select * from events.workspace_automations", []],
    ]) {
      await fails(db.query(sql, params), "42501", null, `${role}: ${sql}`);
    }
    await db.exec("reset role");
  }
  return assertions;
}
