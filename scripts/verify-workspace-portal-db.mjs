import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

// Exercises the portals migration: related conditions, role policies on reads, aggregates, the guarded portal
// command and the builder's config command. Called by verify-workspace-db.mjs after the Foundation checks.
export async function verifyPortal({ db, one, all, project, event, owner, viewer }) {
  let assertions = 0;
  const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
  const ok = (value, message) => { assert.ok(value, message); assertions++; };
  const envelope = (action, payload = {}) => ({ action, commandId: randomUUID(), requestHash: randomUUID(), ...payload });
  const staff = async (action, payload = {}, actor = owner) =>
    (await one("select events.workspace_command($1,$2,$3,$4) as value", [project, event, actor, envelope(action, payload)])).value;
  const config = async (action, payload = {}, actor = owner) => {
    const value = (await one("select events.workspace_portal_config($1,$2,$3,$4) as value", [project, event, actor, envelope(action, payload)])).value;
    assertions++;
    return value;
  };
  const fails = async (promise, code, message, label) => {
    await assert.rejects(promise, (error) => {
      if (error.code === code && (!message || error.message === message)) return true;
      console.error(`expected ${code} ${message ?? ""} for ${label}, got`, error.code, error.message);
      return false;
    }, label);
    assertions++;
  };
  const query = async (plan) => (await one("select events.workspace_query($1,$2,$3) as value", [project, event, plan])).value;
  const aggregate = async (plan) => (await one("select events.workspace_aggregate($1,$2,$3) as value", [project, event, plan])).value;
  const portal = async (member, person, guard, command) =>
    (await one("select events.workspace_portal_command($1,$2,$3,$4,$5,$6) as value", [project, event, member, person, guard, command])).value;
  const ids = (page) => page.rows.map((row) => row.title).sort();

  // A small research-conference workspace
  await staff("workspace.create", { createdFrom: { kind: "empty" } });
  const peopleId = randomUUID(), papersId = randomUUID(), reviewsId = randomUUID();
  const f = Object.fromEntries(["pName", "pEmail", "pType", "aTitle", "aSecret", "aAuthors", "rTitle", "rPaper", "rReviewer", "rScore", "rRemarks", "rDouble"].map((k) => [k, randomUUID()]));
  await staff("object.create", { object: { id: peopleId, key: "people", name: "Person", plural: "People", numberPrefix: "PER" },
    fields: [
      { id: f.pName, key: "name", name: "Name", type: "short_text" },
      { id: f.pEmail, key: "email", name: "Email", type: "email", isUnique: true },
      { id: f.pType, key: "type", name: "Type", type: "multi_select", config: { options: [{ id: "opt_rev", label: "Reviewer" }, { id: "opt_auth", label: "Author" }] } },
    ], titleFieldKey: "name" });
  await staff("object.create", { object: { id: papersId, key: "papers", name: "Paper", plural: "Papers", numberPrefix: "PAP",
    statuses: [{ key: "draft", label: "Draft", color: "gray" }, { key: "submitted", label: "Submitted", color: "blue" }] },
    fields: [
      { id: f.aTitle, key: "title", name: "Title", type: "short_text" },
      { id: f.aSecret, key: "secret", name: "Secret", type: "short_text" },
      { id: f.aAuthors, key: "authors", name: "Authors", type: "link_record", config: { targetObjectId: peopleId, multiple: true } },
    ], titleFieldKey: "title" });
  await staff("object.create", { object: { id: reviewsId, key: "reviews", name: "Review", plural: "Reviews", numberPrefix: "REV",
    statuses: [{ key: "draft", label: "Draft", color: "gray" }, { key: "submitted", label: "Submitted", color: "green" }] },
    fields: [
      { id: f.rTitle, key: "title", name: "Title", type: "short_text" },
      { id: f.rPaper, key: "paper", name: "Paper", type: "link_record", config: { targetObjectId: papersId, multiple: false } },
      { id: f.rReviewer, key: "reviewer", name: "Reviewer", type: "link_record", config: { targetObjectId: peopleId, multiple: false } },
      { id: f.rScore, key: "score", name: "Score", type: "number", config: { decimals: 0 } },
      { id: f.rRemarks, key: "remarks", name: "Remarks", type: "long_text" },
      { id: f.rDouble, key: "double", name: "Double", type: "formula", config: { expression: "{score} * 2", result: "number" } },
    ], titleFieldKey: "title" });
  const create = async (objectId, title, values, links = [], status) =>
    (await staff("record.create", { objectId, title, values, links, ...(status ? { status } : {}) })).record;
  const link = (fieldId, ...targets) => ({ fieldId, targets: targets.map((id) => ({ kind: "record", id })) });
  const ana = await create(peopleId, "Ana", { [f.pName]: "Ana", [f.pEmail]: "ana@x.test", [f.pType]: ["opt_rev"] });
  const ben = await create(peopleId, "Ben", { [f.pName]: "Ben", [f.pEmail]: "ben@x.test", [f.pType]: ["opt_auth"] });
  const cat = await create(peopleId, "Cat", { [f.pName]: "Cat", [f.pEmail]: "cat@x.test", [f.pType]: ["opt_rev", "opt_auth"] });
  const p1 = await create(papersId, "P1", { [f.aTitle]: "P1", [f.aSecret]: "s1" }, [link(f.aAuthors, ben.id)]);
  const p2 = await create(papersId, "P2", { [f.aTitle]: "P2", [f.aSecret]: "s2" }, [link(f.aAuthors, ben.id, cat.id)]);
  const r1 = await create(reviewsId, "R1", { [f.rTitle]: "R1", [f.rScore]: 3 }, [link(f.rPaper, p1.id), link(f.rReviewer, ana.id)], "draft");
  const r2 = await create(reviewsId, "R2", { [f.rTitle]: "R2", [f.rScore]: 5, [f.rRemarks]: "secretword inside" }, [link(f.rPaper, p2.id), link(f.rReviewer, cat.id)], "draft");
  const r3 = await create(reviewsId, "R3", { [f.rTitle]: "R3", [f.rScore]: 4 }, [link(f.rPaper, p2.id), link(f.rReviewer, ana.id)], "submitted");

  const reviewerIs = (personId) => ({ source: "link", fieldId: f.rReviewer, cast: "link", operator: "has_any", value: [personId] });
  const statusIs = (key) => ({ source: "system", column: "status", cast: "text", operator: "eq", value: key });
  const and = (...items) => ({ op: "and", items });

  // Related conditions
  const reviewedBy = (personId, match = reviewerIs(personId)) => ({ source: "related", direction: "back", fieldId: f.rPaper, match });
  eq(ids(await query({ objectId: papersId, limit: 50, filter: and(reviewedBy(ana.id)) })), ["P1", "P2"], "papers with a review by Ana");
  eq(ids(await query({ objectId: papersId, limit: 50, filter: and(reviewedBy(ana.id, and(reviewerIs(ana.id), statusIs("draft")))) })), ["P1"], "back link with a nested rule");
  const byAuthorEmail = (email) => ({ source: "related", direction: "forward", fieldId: f.rPaper,
    match: { source: "related", direction: "forward", fieldId: f.aAuthors, match: { source: "value", fieldId: f.pEmail, cast: "text", operator: "eq", value: email } } });
  eq(ids(await query({ objectId: reviewsId, limit: 50, filter: and(byAuthorEmail("cat@x.test")) })), ["R2", "R3"], "two hops: reviews of papers Cat wrote");
  const threeHops = { source: "related", direction: "forward", fieldId: f.rPaper, match: { source: "related", direction: "forward", fieldId: f.aAuthors,
    match: { source: "related", direction: "back", fieldId: f.aAuthors } } };
  await fails(query({ objectId: reviewsId, limit: 50, filter: and(threeHops) }), "22023", "Invalid filter", "three hops are refused");
  await fails(query({ objectId: reviewsId, limit: 50, filter: and({ source: "related", direction: "forward", fieldId: f.aAuthors }) }), "22023", "Invalid filter", "related needs a link on this list");
  await fails(query({ objectId: papersId, limit: 50, filter: and({ source: "related", direction: "back", fieldId: f.rReviewer }) }), "22023", "Invalid filter", "backlink must point at this list");

  eq(ids(await query({ objectId: reviewsId, limit: 50, policy: { source: "system", column: "id", cast: "text", operator: "any_of", value: [r1.id, r3.id] } })), ["R1", "R3"], "record ids");
  await fails(query({ objectId: reviewsId, limit: 50, filter: and({ source: "system", column: "id", cast: "text", operator: "contains", value: "a" }) }), "22023", "Invalid filter", "ids only match exactly");

  // Policy on reads: rows, totals, per-row flags, search over visible fields only
  const anaPolicy = { op: "or", items: [reviewerIs(ana.id)] };
  const mine = await query({ objectId: reviewsId, limit: 50, policy: anaPolicy, filter: null });
  eq([mine.total, ids(mine)], [2, ["R1", "R3"]], "policy limits rows and the total");
  eq((await query({ objectId: reviewsId, limit: 50, policy: { op: "or", items: [] } })).total, 0, "an empty policy shows nothing");
  const flagged = await query({ objectId: reviewsId, limit: 50, policyParts: [{ alias: "p0", condition: reviewerIs(ana.id) }, { alias: "p1", condition: statusIs("submitted") }] });
  eq(flagged.rows.map((row) => [row.title, row.policy.p0, row.policy.p1]), [["R1", true, false], ["R2", false, false], ["R3", true, true]], "per-row role flags");
  ok(!("policy" in (await query({ objectId: reviewsId, limit: 1 })).rows[0]), "staff reads keep their shape");
  eq((await query({ objectId: reviewsId, limit: 50, search: ["secretword"] })).total, 1, "full-text search sees every field");
  eq((await query({ objectId: reviewsId, limit: 50, search: ["secretword"], searchFields: [f.rTitle] })).total, 0, "portal search skips hidden fields");
  eq((await query({ objectId: reviewsId, limit: 50, search: ["secretword"], searchFields: [f.rRemarks] })).total, 1, "portal search covers visible fields");
  eq((await query({ objectId: reviewsId, limit: 50, search: ["r2"], searchFields: [] })).total, 1, "portal search always covers the title");
  await fails(query({ objectId: reviewsId, limit: 50, search: ["x"], searchFields: [f.aTitle] }), "22023", "Invalid filter", "search fields must be on the list");
  await fails(query({ objectId: reviewsId, limit: 50, policyParts: [{ alias: "bad", condition: reviewerIs(ana.id) }] }), "22023", "Invalid filter", "policy part aliases are checked");

  // Aggregates
  eq((await aggregate({ objectId: reviewsId, measures: [{ alias: "m0", fn: "count" }, { alias: "m1", fn: "sum", fieldId: f.rScore }] })).values, { m0: 3, m1: 12 }, "count and sum");
  eq((await aggregate({ objectId: reviewsId, policy: anaPolicy, measures: [{ alias: "m0", fn: "avg", fieldId: f.rScore }] })).values, { m0: 3.5 }, "aggregates respect the policy");
  eq((await aggregate({ objectId: reviewsId, measures: [{ alias: "m0", fn: "count" }], groupBy: { source: "system", column: "status" } })).groups,
    [{ key: "draft", values: { m0: 2 } }, { key: "submitted", values: { m0: 1 } }], "grouped by status");
  eq((await aggregate({ objectId: peopleId, measures: [{ alias: "m0", fn: "count" }], groupBy: { source: "value", fieldId: f.pType, cast: "text[]" } })).groups,
    [{ key: "opt_auth", values: { m0: 2 } }, { key: "opt_rev", values: { m0: 2 } }], "grouped by a multi-choice field");
  ok((await aggregate({ objectId: reviewsId, measures: [{ alias: "m0", fn: "count" }], groupBy: { source: "system", column: "created_at", bucket: "month" } })).groups.length === 1, "date buckets");
  await fails(aggregate({ objectId: reviewsId, measures: [{ alias: "m0", fn: "sum", fieldId: f.rReviewer }] }), "22023", "Invalid filter", "links can't be summed");
  await fails(aggregate({ objectId: reviewsId, measures: [] }), "22023", "Invalid filter", "a measure is required");

  // Guarded portal commands
  const anaMember = randomUUID(), benMember = randomUUID();
  const reviewerGuard = {
    objectId: reviewsId, computed: [],
    edit: [{ condition: and(reviewerIs(ana.id), statusIs("draft")), after: reviewerIs(ana.id), fields: [f.rScore, f.rRemarks], status: true }],
    comment: [{ condition: reviewerIs(ana.id) }],
  };
  const update = (record, values, extra = {}) => envelope("record.update", { recordId: record.id, expectedRevision: Number(record.revision ?? 1), values, ...extra });
  const rev = async (id) => Number((await one("select revision from events.workspace_records where id = $1", [id])).revision);
  const first = update({ id: r1.id, revision: await rev(r1.id) }, { [f.rScore]: 4, [f.rDouble]: 8 });
  const saved = await portal(anaMember, ana.id, reviewerGuard, first);
  eq(saved.record.values[f.rScore], 4, "reviewer edits their own draft review");
  eq(await portal(anaMember, ana.id, reviewerGuard, first), saved, "replay returns the stored response");
  await fails(portal(anaMember, ana.id, reviewerGuard, { ...first, requestHash: randomUUID() }), "23505", "Command ID reused", "reused command id");
  eq((await one("select actor_kind, actor_id from events.workspace_changes where record_id = $1 order by created_at desc limit 1", [r1.id])),
    { actor_kind: "portal", actor_id: anaMember }, "change log names the portal person");
  eq((await one("select actor_kind from events.workspace_command_receipts where actor_id = $1", [anaMember])).actor_kind, "portal");
  await fails(portal(anaMember, ana.id, reviewerGuard, update({ id: r2.id, revision: await rev(r2.id) }, { [f.rScore]: 1 })), "42501", "Not allowed", "someone else's review");
  await fails(portal(anaMember, ana.id, reviewerGuard, update({ id: r3.id, revision: await rev(r3.id) }, { [f.rScore]: 1 })), "42501", "Not allowed", "submitted review is read-only");
  await fails(portal(anaMember, ana.id, reviewerGuard, update({ id: r1.id, revision: await rev(r1.id) }, { [f.rTitle]: "x" })), "42501", "Not allowed", "field outside the guard");
  await fails(portal(anaMember, ana.id, reviewerGuard, update({ id: r1.id, revision: await rev(r1.id) }, {}, { links: [link(f.rReviewer, cat.id)] })), "42501", "Not allowed", "link field outside the guard");
  const hijack = { ...reviewerGuard, edit: [{ ...reviewerGuard.edit[0], fields: [f.rScore, f.rReviewer] }] };
  await fails(portal(anaMember, ana.id, hijack, update({ id: r1.id, revision: await rev(r1.id) }, {}, { links: [link(f.rReviewer, cat.id)] })), "42501", "Not allowed", "can't hand a record to someone else");
  eq((await all("select target_id from events.workspace_links where source_record_id = $1 and field_id = $2", [r1.id, f.rReviewer])).map((row) => row.target_id), [ana.id], "rejected change rolled back");
  const submitted = await portal(anaMember, ana.id, reviewerGuard, update({ id: r1.id, revision: await rev(r1.id) }, {}, { status: "submitted" }));
  eq(submitted.record.status, "submitted", "reviewer submits; the review stays theirs");
  await fails(portal(anaMember, ana.id, reviewerGuard, update({ id: r1.id, revision: await rev(r1.id) }, { [f.rScore]: 2 })), "42501", "Not allowed", "and is read-only afterwards");
  await fails(portal(anaMember, ana.id, { ...reviewerGuard, edit: [{ ...reviewerGuard.edit[0], status: false, condition: reviewerIs(ana.id) }] },
    update({ id: r3.id, revision: await rev(r3.id) }, {}, { status: "draft" })), "42501", "Not allowed", "status needs permission");
  const note = await portal(anaMember, ana.id, reviewerGuard, envelope("comment.add", { recordId: r1.id, body: "Done" }));
  eq((await one("select actor_kind, created_by from events.workspace_comments where id = $1", [note.comment.id])), { actor_kind: "portal", created_by: anaMember });
  await fails(portal(anaMember, ana.id, reviewerGuard, envelope("comment.add", { recordId: r2.id, body: "Hi" })), "42501", "Not allowed", "comment outside scope");
  await fails(portal(anaMember, ana.id, reviewerGuard, envelope("object.create", { object: { key: "x" } })), "42501", "Not allowed", "structure is never allowed");
  await fails(portal(null, ana.id, reviewerGuard, envelope("comment.add", { recordId: r1.id, body: "Hi" })), "42501", "Not allowed", "a member is required");

  const authorGuard = {
    objectId: papersId, computed: [],
    create: [{ after: { source: "link", fieldId: f.aAuthors, cast: "link", operator: "has_any", value: [ben.id] }, fields: [f.aTitle, f.aAuthors] }],
    delete: [{ condition: { source: "system", column: "created_by", cast: "text", operator: "eq", value: benMember } }],
  };
  const newPaper = (title, authors, extra = {}) => envelope("record.create", { objectId: papersId, title, status: "draft", values: { [f.aTitle]: title, ...extra }, links: [link(f.aAuthors, ...authors)] });
  const mineNew = (await portal(benMember, ben.id, authorGuard, newPaper("P3", [ben.id]))).record;
  eq([mineNew.createdBy, mineNew.status], [benMember, "draft"], "author creates a paper they author");
  const before = (await one("select count(*)::int as n from events.workspace_records where object_id = $1", [papersId])).n;
  await fails(portal(benMember, ben.id, authorGuard, newPaper("P4", [cat.id])), "42501", "Not allowed", "can't create a paper for someone else");
  await fails(portal(benMember, ben.id, authorGuard, newPaper("P5", [ben.id], { [f.aSecret]: "x" })), "42501", "Not allowed", "can't fill a hidden field");
  eq((await one("select count(*)::int as n from events.workspace_records where object_id = $1", [papersId])).n, before, "refused creates leave nothing behind");
  eq((await query({ objectId: papersId, limit: 50, filter: and({ source: "system", column: "created_by", cast: "text", operator: "eq", value: benMember }) })).total, 1, "created-by filter");
  await fails(portal(benMember, ben.id, authorGuard, envelope("records.delete", { recordIds: [p1.id] })), "42501", "Not allowed", "can't delete a staff record");
  eq((await portal(benMember, ben.id, authorGuard, envelope("records.delete", { recordIds: [mineNew.id] }))).count, 1, "deletes own paper");

  // Builder configuration
  await fails(config("portal.update", { patch: { enabled: true } }, viewer), "42501", null, "configure permission");
  await fails(config("portal.update", { patch: { enabled: true } }), "22023", "Portal needs people", "people list required");
  await fails(config("portal.update", { patch: { enabled: true, peopleObjectId: peopleId, emailFieldId: f.pName } }), "22023", "Portal email must be unique", "email field must be unique");
  await fails(config("portal.update", { patch: { enabled: true, peopleObjectId: peopleId, emailFieldId: f.pType } }), "22023", "Unknown field", "email field must hold text");
  await fails(config("portal.update", { patch: { enabled: true, peopleObjectId: papersId, emailFieldId: f.pEmail } }), "22023", "Unknown field", "email field must be on the people list");
  const enabled = await config("portal.update", { patch: { enabled: true, peopleObjectId: peopleId, emailFieldId: f.pEmail, nameFieldId: f.pName, settings: { welcome: "Hi" } } });
  eq([enabled.portal.enabled, enabled.portal.settings.welcome], [true, "Hi"]);
  eq((await all("select key from events.workspace_roles where event_id = $1 and builtin order by position", [event])).map((row) => row.key), ["public", "signed_in"], "built-in roles appear with the portal");
  const reviewerRole = (await config("role.save", { role: { key: "reviewer", name: "Reviewer", membership: { source: "value", fieldId: f.pType, cast: "text[]", operator: "has_any", value: ["opt_rev"] }, access: { [reviewsId]: { view: { mode: "where" } } } } })).role;
  eq([reviewerRole.key, reviewerRole.builtin], ["reviewer", false]);
  await fails(config("role.save", { role: { key: "reviewer", name: "Again" } }), "22023", "Role key taken", "role keys are unique");
  await fails(config("role.save", { role: { id: reviewerRole.id, name: "Stale" }, expectedRevision: 99 }), "40001", "Role changed", "role revisions");
  const renamed = await config("role.save", { role: { id: reviewerRole.id, name: "Peer reviewer" }, expectedRevision: reviewerRole.revision });
  await staff("change.undo", { changeId: renamed.changeId });
  eq((await one("select name from events.workspace_roles where id = $1", [reviewerRole.id])).name, "Reviewer", "undo a role edit");
  const builtin = await one("select id from events.workspace_roles where event_id = $1 and key = 'public'", [event]);
  await fails(config("role.delete", { roleId: builtin.id }), "22023", "Built-in role", "built-in roles stay");
  const gone = await config("role.delete", { roleId: reviewerRole.id });
  await staff("change.undo", { changeId: gone.changeId });
  eq((await one("select deleted_at from events.workspace_roles where id = $1", [reviewerRole.id])).deleted_at, null, "undo a role delete");

  const home = (await config("page.save", { page: { slug: "home", title: "Home", audience: { roles: [reviewerRole.id] }, body: { rows: [], blocks: [] } } })).page;
  await fails(config("page.save", { page: { slug: "home", title: "Again" } }), "22023", "Page address taken", "page addresses are unique");
  await config("page.save", { page: { kind: "record", objectId: reviewsId, slug: "review", title: "Review" } });
  await fails(config("page.save", { page: { kind: "record", objectId: reviewsId, slug: "review-2", title: "Review" } }), "22023", "Record page exists", "one record page per list");
  const extra = (await config("page.save", { page: { slug: "extra", title: "Extra" } })).page;
  await staff("change.undo", { changeId: (await config("page.save", { page: { slug: "undone", title: "Undone" } })).changeId });
  ok((await one("select deleted_at from events.workspace_pages where slug = 'undone'")).deleted_at, "undo a page create");
  const v1 = (await config("portal.publish", { note: "First" })).version;
  eq(v1.number, 1, "first version");
  const snapshot = (await one("select snapshot from events.workspace_portal_versions where id = $1", [v1.id])).snapshot;
  eq([snapshot.roles.length, snapshot.pages.map((page) => page.slug).sort()], [3, ["extra", "home", "review"]], "snapshot holds live roles and pages");
  eq((await one("select published_version_id from events.workspace_portals where event_id = $1", [event])).published_version_id, v1.id);
  await config("page.save", { page: { id: home.id, title: "Welcome" } });
  await config("page.delete", { pageId: extra.id });
  await config("page.save", { page: { slug: "later", title: "Later" } });
  eq((await config("portal.publish", {})).version.number, 2, "versions count up");
  await config("portal.restore_version", { versionId: v1.id });
  eq((await all("select slug, title from events.workspace_pages where event_id = $1 and deleted_at is null and kind = 'page' order by slug", [event])),
    [{ slug: "extra", title: "Extra" }, { slug: "home", title: "Home" }], "restoring a version resets the draft");
  const off = await config("portal.update", { patch: { enabled: false } });
  await staff("change.undo", { changeId: off.changeId });
  eq((await one("select enabled from events.workspace_portals where event_id = $1", [event])).enabled, true, "undo a settings change");

  // Purge, privileges
  await db.query("update events.workspace_pages set deleted_at = now() - interval '40 days' where slug = 'undone'");
  await db.query(`insert into events.workspace_portal_tokens (project_id, event_id, email, purpose, token_hash, expires_at)
    values ($1, $2, 'old@x.test', 'code', 'h1', now() - interval '40 days')`, [project, event]);
  await one("select events.workspace_purge(now() - interval '30 days') as value");
  eq((await all("select 1 from events.workspace_pages where slug = 'undone'")).length, 0, "purge removes old trashed pages");
  eq((await all("select 1 from events.workspace_portal_tokens where token_hash = 'h1'")).length, 0, "purge removes old tokens");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    for (const [sql, params] of [["select events.workspace_aggregate($1,$2,'{}')", [project, event]],
      ["select events.workspace_portal_config($1,$2,$1,'{}')", [project, event]],
      ["select events.workspace_portal_command($1,$2,$1,$1,'{}','{}')", [project, event]], ["select * from events.workspace_roles", []]]) {
      await fails(db.query(sql, params), "42501", null, `${role}: ${sql}`);
    }
    await db.exec("reset role");
  }
  return assertions;
}
