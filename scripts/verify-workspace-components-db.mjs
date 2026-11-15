import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Exercises the components migration: a check-in queues work for the event's check-in automations, and a workspace
// failure never stops the check-in itself. Called by verify-workspace-db.mjs on its own event.
export async function verifyComponents({ db, one, all, project, owner }) {
  let assertions = 0;
  const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const envelope = (action, payload = {}) => ({ action, commandId: randomUUID(), requestHash: randomUUID(), ...payload });
  const event = randomUUID(), other = randomUUID();
  await db.query("insert into events.events(id, project_id, name) values ($1,$2,'Check-in test'), ($3,$2,'Other')", [event, project, other]);
  await one("select events.workspace_command($1,$2,$3,$4) as value", [project, event, owner, envelope("workspace.create", { createdFrom: { kind: "empty" } })]);
  const registration = randomUUID(), order = randomUUID();
  await db.query("insert into events.registrations(id, event_id, name, email) values ($1,$2,'Ana','Ana@X.test')", [registration, event]);
  await db.query("insert into events.event_orders(id, event_id, buyer_name, buyer_email) values ($1,$2,'Ben','BEN@x.test')", [order, event]);
  const items = async () => all("select payload from events.workspace_queue where event_id = $1 and kind = 'checkin' order by created_at", [event]);
  const checkIn = (values) => one(`insert into events.checkin_attendance (event_id, project_id, registration_id, order_id, attendee_name, ticket_code, gate, status, method)
    values ($1,$2,$3,$4,$5,$6,'North',$7,'qr') returning id`, [values.event ?? event, project, values.registration ?? null, values.order ?? null, values.name ?? "", values.code ?? null, values.status ?? "in"]);

  await checkIn({ registration, name: "Ana" });
  eq((await items()).length, 0, "no check-in automation, nothing queued");
  const automation = (await one(`insert into events.workspace_automations (project_id, event_id, name, enabled, trigger)
    values ($1,$2,'Welcome',false,'{"kind":"checkin","objectId":null}') returning id`, [project, event])).id;
  await checkIn({ registration, name: "Ana" });
  eq((await items()).length, 0, "a disabled automation queues nothing");
  await db.query("update events.workspace_automations set enabled = true where id = $1", [automation]);
  await db.query(`insert into events.workspace_automations (project_id, event_id, name, enabled, trigger)
    values ($1,$2,'Second',true,'{"kind":"checkin"}')`, [project, event]);
  const first = await checkIn({ registration, name: "Ana", code: "ABCD1234" });
  let queued = await items();
  eq(queued.length, 1, "one item per check-in, however many automations listen");
  eq([queued[0].payload.checkinId, queued[0].payload.registrationId, queued[0].payload.email, queued[0].payload.gate, queued[0].payload.ticketCode],
    [first.id, registration, "ana@x.test", "North", "ABCD1234"], "the payload carries the ticket holder");
  await checkIn({ order, name: "Ben" });
  queued = await items();
  eq([queued[1].payload.orderId, queued[1].payload.email], [order, "ben@x.test"], "orders give the buyer's email");
  await checkIn({ registration, status: "out" });
  await checkIn({ registration, event: other });
  eq((await items()).length, 2, "check-outs and other events are ignored");

  // A broken queue must never block the door.
  await db.exec("alter table events.workspace_queue rename to workspace_queue_moved");
  const survived = await checkIn({ registration, name: "Ana" });
  eq(Boolean(survived.id), true, "the check-in is saved even when queueing fails");
  await db.exec("alter table events.workspace_queue_moved rename to workspace_queue");
  eq((await items()).length, 2, "and nothing half-written is left behind");
  return assertions;
}
