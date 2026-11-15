import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Exercises the documents migration: templates, certificate codes, the public check function and purge keeping
// certificate files. Called by verify-workspace-db.mjs on its own event.
export async function verifyDocuments({ db, one, all, project, owner }) {
  let assertions = 0;
  const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const ok = (value, message) => { assert.ok(value, message); assertions++; };
  const fails = async (promise, code, label) => {
    await assert.rejects(promise, (error) => error.code === code || (console.error(`expected ${code} for ${label}, got`, error.code, error.message), false), label);
    assertions++;
  };
  const envelope = (action, payload = {}) => ({ action, commandId: randomUUID(), requestHash: randomUUID(), ...payload });
  const event = randomUUID(), other = randomUUID();
  await db.query("insert into events.events(id, project_id, name) values ($1,$2,'ICAML 2026'), ($3,$2,'Other')", [event, project, other]);
  const staff = async (eventId, action, payload = {}) => (await one("select events.workspace_command($1,$2,$3,$4) as value", [project, eventId, owner, envelope(action, payload)])).value;
  await staff(event, "workspace.create", { createdFrom: { kind: "empty" } });
  await staff(other, "workspace.create", { createdFrom: { kind: "empty" } });
  const listId = randomUUID(), fTitle = randomUUID(), fFiles = randomUUID();
  await staff(event, "object.create", { object: { id: listId, key: "papers", name: "Paper", plural: "Papers", numberPrefix: "PAP" },
    fields: [{ id: fTitle, key: "title", name: "Title", type: "short_text" }, { id: fFiles, key: "files", name: "Files", type: "attachments" }], titleFieldKey: "title" });
  const record = (await staff(event, "record.create", { objectId: listId, title: "P1", values: { [fTitle]: "P1" } })).record;

  // Templates
  const doc = (await one(`insert into events.workspace_documents (project_id, event_id, kind, name, object_id, config)
    values ($1,$2,'pdf','Certificate',$3,'{"blocks":[]}') returning id`, [project, event, listId])).id;
  await fails(db.query(`insert into events.workspace_documents (project_id, event_id, kind, name) values ($1,$2,'docx','X')`, [project, event]), "23514", "kind is email or pdf");
  await fails(db.query(`insert into events.workspace_documents (project_id, event_id, kind, name) values ($1,$2,'pdf','')`, [project, event]), "23514", "names are required");
  await fails(db.query(`insert into events.workspace_documents (project_id, event_id, kind, name) values ($1,$2,'pdf','X')`, [project, randomUUID()]), "23503", "documents belong to a workspace");

  // Certificates
  const file = randomUUID();
  await db.query(`insert into events.workspace_files (id, project_id, event_id, field_id, path, name, type, size, created_by, created_at)
    values ($1,$2,$3,$4,'p/cert.pdf','Certificate.pdf','application/pdf',10,$5, now() - interval '3 days'),
           ($6,$2,$3,$4,'p/orphan.pdf','Orphan.pdf','application/pdf',10,$5, now() - interval '3 days')`, [file, project, event, fFiles, owner, randomUUID()]);
  const issue = (code, extra = {}) => db.query(`insert into events.workspace_certificates (project_id, event_id, document_id, record_id, code, title, holder, data, file_id, issued_by, revoked_at, revoked_reason)
    values ($1,$2,$3,$4,$5,'Certificate of presentation','Ana Ruiz',$6,$7,$8,$9,$10)`,
  [project, event, doc, record.id, code, JSON.stringify([{ label: "Paper", value: "P1" }]), extra.file ?? null, owner, extra.revokedAt ?? null, extra.reason ?? null]);
  await issue("ABCD-EFGH-JKMN", { file });
  await fails(issue("ABCD-EFGH-JKMN"), "23505", "codes are unique");
  await fails(issue("abcd-efgh-jkmn"), "23514", "codes are upper case");
  await fails(issue("ABCD-EFGH-JKLO"), "23514", "codes avoid look-alike letters");
  await fails(issue("ABCDEFGHJKMN"), "23514", "codes are grouped");
  await issue("WXYZ-2345-6789", { revokedAt: new Date().toISOString(), reason: "Issued in error" });

  // The public check
  const check = async (eventId, code) => (await one("select events.workspace_certificate_public($1,$2) as value", [eventId, code])).value;
  const valid = await check(event, "ABCD-EFGH-JKMN");
  eq(Object.keys(valid).sort(), ["code", "data", "eventId", "eventName", "holder", "issuedAt", "revokedAt", "revokedReason", "title"], "only public fields");
  eq([valid.holder, valid.eventName, valid.revokedAt, valid.data], ["Ana Ruiz", "ICAML 2026", null, [{ label: "Paper", value: "P1" }]], "a valid certificate");
  eq((await check(event, "abcd-efgh-jkmn")).code, "ABCD-EFGH-JKMN", "codes match in any case");
  eq((await check(event, "WXYZ-2345-6789")).revokedReason, "Issued in error", "revoked certificates say why");
  eq(await check(other, "ABCD-EFGH-JKMN"), null, "a code only checks on its own event");
  eq(await check(event, "NONE-NONE-NONE"), null, "unknown codes");

  // Purge keeps certificate files and documents certificates point at
  await db.query("update events.workspace_documents set deleted_at = now() - interval '40 days' where id = $1", [doc]);
  const gone = await one(`insert into events.workspace_documents (project_id, event_id, kind, name, deleted_at)
    values ($1,$2,'email','Old', now() - interval '40 days') returning id`, [project, event]);
  const purged = (await one("select events.workspace_purge(now() - interval '30 days') as value")).value;
  ok(purged.paths.includes("p/orphan.pdf") && !purged.paths.includes("p/cert.pdf"), "certificate files survive purge");
  eq((await all("select id from events.workspace_documents where id = any($1)", [[doc, gone.id]])).map((row) => row.id), [doc], "trashed documents go unless a certificate needs them");

  // Privileges
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const sql of ["select * from events.workspace_documents", "select * from events.workspace_certificates", `select events.workspace_certificate_public('${event}', 'ABCD-EFGH-JKMN')`]) {
      await fails(db.query(sql), "42501", `${role}: ${sql}`);
    }
    await db.exec("reset role");
  }
  return assertions;
}
