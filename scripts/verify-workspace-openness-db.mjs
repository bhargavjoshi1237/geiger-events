import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Exercises the openness migration: workspace API scopes, the per-workspace webhook secret and webhook events from the
// change log (with stand-ins for events.webhook_wants/webhook_emit). Called by verify-workspace-db.mjs on its own event.
export async function verifyOpenness({ db, one, all, project, owner }) {
  let assertions = 0;
  const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const fails = async (promise, code, label) => {
    await assert.rejects(promise, (error) => error.code === code || (console.error(`expected ${code} for ${label}, got`, error.code, error.message), false), label);
    assertions++;
  };
  await db.exec(`
    create table if not exists events.webhook_events(id uuid primary key default gen_random_uuid(), project_id uuid, type text, payload jsonb, created_at timestamptz default clock_timestamp());
    create table if not exists events.webhook_wanted(type text);
    create or replace function events.webhook_wants(p_project uuid, p_type text) returns boolean language sql as $$ select exists(select 1 from events.webhook_wanted w where w.type = p_type) $$;
    create or replace function events.webhook_emit(p_project uuid, p_type text, p_data jsonb) returns uuid language sql as $$
      insert into events.webhook_events(project_id, type, payload) values (p_project, p_type, p_data) returning id $$;
  `);
  const envelope = (action, payload = {}) => ({ action, commandId: randomUUID(), requestHash: randomUUID(), ...payload });
  const event = randomUUID();
  await db.query("insert into events.events(id, project_id, name) values ($1,$2,'Openness test')", [event, project]);
  const staff = async (action, payload = {}) => (await one("select events.workspace_command($1,$2,$3,$4) as value", [project, event, owner, envelope(action, payload)])).value;
  const events = async (type) => (await all("select type, payload from events.webhook_events where project_id = $1 and ($2::text is null or type = $2) order by created_at", [project, type ?? null]));
  const want = (...types) => db.query("insert into events.webhook_wanted(type) select unnest($1::text[])", [types]);

  // Scopes
  await db.query("insert into events.api_keys (project_id, name, prefix, key_hash, scopes) values ($1,'ws','gev_live_w',$2,'{read:workspace,write:workspace,read:events}')", [project, randomUUID()]);
  await fails(db.query("insert into events.api_keys (project_id, name, prefix, key_hash, scopes) values ($1,'x','gev_live_x',$2,'{admin:all}')", [project, randomUUID()]), "23514", "unknown scopes are refused");

  // The webhook secret
  await staff("workspace.create", { createdFrom: { kind: "empty" } });
  const secret = (await one("select hook_secret from events.workspace_workspaces where event_id = $1", [event])).hook_secret;
  eq(/^[0-9a-f]{64}$/.test(secret), true, "each workspace gets a 64-hex secret");
  const secrets = await all("select hook_secret from events.workspace_workspaces where project_id = $1", [project]);
  eq(new Set(secrets.map((row) => row.hook_secret)).size, secrets.length, "secrets differ between workspaces, old ones included");

  const listId = randomUUID(), fTitle = randomUUID(), fScore = randomUUID();
  await staff("object.create", { object: { id: listId, key: "papers", name: "Paper", plural: "Papers", numberPrefix: "PAP",
    statuses: [{ key: "submitted", label: "Submitted", color: "blue" }, { key: "accepted", label: "Accepted", color: "green" }] },
    fields: [{ id: fTitle, key: "title", name: "Title", type: "short_text" }, { id: fScore, key: "score", name: "Score", type: "number", config: { decimals: 0 } }],
    titleFieldKey: "title" });
  const create = async (title) => (await staff("record.create", { objectId: listId, title, values: { [fTitle]: title, [fScore]: 1 }, status: "submitted" })).record;
  const rev = async (id) => Number((await one("select revision from events.workspace_records where id = $1", [id])).revision);

  await create("Quiet");
  eq((await events()).length, 0, "nothing is sent while no endpoint wants workspace events");
  await want("workspace.record.created", "workspace.record.updated", "workspace.status.changed", "workspace.record.deleted");
  const a = await create("A");
  const [created] = await events("workspace.record.created");
  eq([created.payload.id, created.payload.list.key, created.payload.values, created.payload.status, created.payload.actor.kind],
    [a.id, "papers", { title: "A", score: 1 }, "submitted", "staff"], "created: values by field key, the list and who did it");
  await staff("record.update", { recordId: a.id, expectedRevision: await rev(a.id), values: { [fScore]: 5 }, status: "accepted" });
  const [updated] = await events("workspace.record.updated");
  eq([updated.payload.values, updated.payload.changed, updated.payload.status], [{ score: 5 }, ["score"], "accepted"], "updated: only what changed");
  const [moved] = await events("workspace.status.changed");
  eq([moved.payload.from, moved.payload.to], ["submitted", "accepted"], "status.changed says from and to");
  await staff("record.update", { recordId: a.id, expectedRevision: await rev(a.id), values: { [fScore]: 6 } });
  eq((await events("workspace.status.changed")).length, 1, "no status event without a status change");
  const b = await create("B");
  const removed = await staff("records.delete", { recordIds: [a.id, b.id], objectId: listId });
  eq((await events("workspace.record.deleted")).map((row) => row.payload.id).sort(), [a.id, b.id].sort(), "one deleted event per record");
  const before = (await events()).length;
  await staff("change.undo", { changeId: removed.changeId });
  eq((await events()).length, before, "undo isn't sent on");

  // Never blocks a save; automations still get queued.
  await db.query(`insert into events.workspace_automations (project_id, event_id, name, enabled, trigger) values ($1,$2,'On change',true,$3)`,
    [project, event, { kind: "record.updated", objectId: listId }]);
  await db.exec("create or replace function events.webhook_emit(p_project uuid, p_type text, p_data jsonb) returns uuid language plpgsql as $$ begin raise exception 'endpoint table locked'; end $$;");
  const c = await create("C");
  await staff("record.update", { recordId: c.id, expectedRevision: await rev(c.id), values: { [fScore]: 9 } });
  eq(Number((await one("select data->>$2 as score from events.workspace_records where id = $1", [c.id, fScore])).score), 9, "the record saves even when sending fails");
  eq((await all("select 1 from events.workspace_queue where record_id = $1 and kind = 'change'", [c.id])).length, 2, "and automations are still queued (the create and the update)");
  return assertions;
}
