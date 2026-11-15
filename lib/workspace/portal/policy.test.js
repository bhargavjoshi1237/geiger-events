import test from "node:test";
import assert from "node:assert/strict";
import { compilePolicy, derivedHidden, guardFor, matchedRoles, readPlan, rowAccess } from "./policy.js";
import { compileRule, resolveTokens } from "./rules.js";
import { validateRoleInput } from "./roles.js";
import { linkTargets, publicFields, shapeRecord } from "./strip.js";

const PEOPLE = "11111111-1111-4111-8111-111111111111";
const PAPERS = "22222222-2222-4222-8222-222222222222";
const REVIEWS = "33333333-3333-4333-8333-333333333333";
const fid = (n) => `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, "0")}`;
const f = (n, objectId, key, name, type, config = {}) => ({ id: fid(n), objectId, key, name, type, config, required: false, isUnique: false, position: n, revision: 1, deletedAt: null });
const ANA = "aaaaaaaa-0000-4000-8000-000000000001";
const MEMBER = "bbbbbbbb-0000-4000-8000-000000000001";

const definition = {
  workspace: { revision: 1 },
  objects: [
    { id: PEOPLE, key: "people", name: "Person", plural: "People", numberPrefix: "PER", titleFieldId: fid(1), statuses: [], deletedAt: null },
    { id: PAPERS, key: "papers", name: "Paper", plural: "Papers", numberPrefix: "PAP", titleFieldId: fid(10), statuses: [{ key: "draft" }, { key: "submitted" }], deletedAt: null },
    { id: REVIEWS, key: "reviews", name: "Review", plural: "Reviews", numberPrefix: "REV", titleFieldId: fid(20), statuses: [{ key: "draft" }, { key: "submitted" }], deletedAt: null },
  ],
  fields: [
    f(1, PEOPLE, "name", "Name", "short_text"),
    f(2, PEOPLE, "email", "Email", "email"),
    f(3, PEOPLE, "type", "Type", "multi_select", { options: [{ id: "opt_rev", label: "Reviewer" }, { id: "opt_auth", label: "Author" }] }),
    f(10, PAPERS, "title", "Title", "short_text"),
    f(11, PAPERS, "authors", "Authors", "link_record", { targetObjectId: PEOPLE, multiple: true }),
    f(12, PAPERS, "abstract", "Abstract", "long_text"),
    f(13, PAPERS, "author_count", "Author count", "rollup", { linkFieldId: fid(11), fn: "count" }),
    f(14, PAPERS, "author_names", "Author names", "lookup", { linkFieldId: fid(11), targetFieldId: fid(1) }),
    f(15, PAPERS, "label", "Label", "formula", { expression: "{title} & {abstract}", result: "text" }),
    f(20, REVIEWS, "title", "Title", "short_text"),
    f(21, REVIEWS, "paper", "Paper", "link_record", { targetObjectId: PAPERS, multiple: false }),
    f(22, REVIEWS, "reviewer", "Reviewer", "link_record", { targetObjectId: PEOPLE, multiple: false }),
    f(23, REVIEWS, "score", "Score", "number", { decimals: 0 }),
    f(24, REVIEWS, "paper_authors", "Paper authors", "lookup", { linkFieldId: fid(21), targetFieldId: fid(11) }),
  ],
  views: [],
};
const tokens = { personId: ANA, memberId: MEMBER, email: "ana@x.test", today: "2026-11-14" };
const authorsIncludeMe = { op: "and", items: [{ field: fid(11), operator: "has_any", value: ["@me"] }] };
const reviewerIsMe = { op: "and", items: [{ field: fid(22), operator: "has_any", value: ["@me"] }] };
const reviewer = {
  id: "role-rev", key: "reviewer", name: "Reviewer", membership: { op: "and", items: [{ field: fid(3), operator: "has_any", value: ["opt_rev"] }] },
  access: {
    [REVIEWS]: { view: { mode: "where", filter: reviewerIsMe }, edit: { mode: "where", filter: { op: "and", items: [{ field: "status", operator: "eq", value: "draft" }] } },
      status: true, comment: true, fields: { [fid(23)]: "edit" } },
    [PAPERS]: { view: { mode: "where", filter: { op: "and", items: [{ related: fid(21), direction: "back", match: reviewerIsMe }] } },
      fields: { [fid(11)]: "hidden" } },
  },
};
const author = {
  id: "role-auth", key: "author", name: "Author", membership: { op: "and", items: [{ field: fid(3), operator: "has_any", value: ["opt_auth"] }] },
  access: { [PAPERS]: { view: { mode: "where", filter: authorsIncludeMe }, create: { mode: "all" }, edit: { mode: "where", filter: authorsIncludeMe },
    delete: { mode: "where", filter: { op: "and", items: [{ field: "created_by", operator: "eq", value: "@me" }] } },
    fields: { [fid(10)]: "edit", [fid(11)]: "edit", [fid(12)]: "edit" } } },
};
const builtins = [
  { id: "role-public", key: "public", name: "Public visitor", builtin: true, membership: null, access: {} },
  { id: "role-signed", key: "signed_in", name: "Anyone signed in", builtin: true, membership: null, access: {} },
];

test("tokens resolve per viewer, created_by uses the account", () => {
  const resolved = resolveTokens({ op: "and", items: [{ field: fid(22), operator: "has_any", value: ["@me"] }, { field: "created_by", operator: "eq", value: "@me" },
    { related: fid(21), direction: "forward", match: { op: "and", items: [{ field: fid(12), operator: "contains", value: "@my_email" }] } }] }, tokens);
  assert.deepEqual(resolved.items[0].value, [ANA]);
  assert.equal(resolved.items[1].value, MEMBER);
  assert.equal(resolved.items[2].match.items[0].value, "ana@x.test");
  assert.equal(resolveTokens({ op: "and", items: [{ field: fid(22), operator: "has_any", value: ["@me"] }] }, {}).items[0].value[0], "00000000-0000-4000-8000-000000000000");
});

test("rules compile to database nodes, including related records", () => {
  const node = compileRule(definition, PAPERS, resolveTokens({ op: "and", items: [{ related: fid(21), direction: "back", match: reviewerIsMe }] }, tokens));
  assert.deepEqual(node, { op: "and", items: [{ source: "related", direction: "back", fieldId: fid(21),
    match: { op: "and", items: [{ source: "link", fieldId: fid(22), cast: "link", operator: "has_any", value: [ANA] }] } }] });
  assert.throws(() => compileRule(definition, PAPERS, { op: "and", items: [{ related: fid(22), direction: "back" }] }), /doesn't point at this list/);
  assert.throws(() => compileRule(definition, REVIEWS, { op: "and", items: [{ related: fid(21), direction: "forward", match: { op: "and", items: [{ field: fid(13), operator: "gt", value: 1 }] } }] }), /lookups or rollups/);
  assert.throws(() => compileRule(definition, PAPERS, { op: "and", items: [{ field: "created_by", operator: "neq", value: MEMBER }] }), /Created by/);
  const three = { related: fid(21), direction: "forward", match: { op: "and", items: [{ related: fid(11), direction: "forward", match: { op: "and", items: [{ related: fid(22), direction: "back" }] } }] } };
  assert.throws(() => compileRule(definition, REVIEWS, { op: "and", items: [three] }), /two links/);
});

test("matched roles: public always, signed-in needs a person, custom roles need their flag", () => {
  const roles = [...builtins, reviewer, author];
  assert.deepEqual(matchedRoles(roles, { person: null }).map((role) => role.key), ["public"]);
  assert.deepEqual(matchedRoles(roles, { person: { id: ANA }, flags: { "role-rev": true } }).map((role) => role.key), ["public", "signed_in", "reviewer"]);
});

test("visibility is decided per record: author names stay hidden on papers someone reviews", () => {
  const policy = compilePolicy({ definition, roles: [reviewer, author], tokens });
  const papers = policy.objects[PAPERS];
  const { parts, policy: where } = readPlan(papers);
  assert.equal(where.op, "or");
  assert.equal(where.items.length, 2);
  const viewAlias = (roleId) => parts.find((part) => part.kind === "view" && part.roleId === roleId).alias;
  const editAlias = (roleId) => parts.find((part) => part.kind === "edit" && part.roleId === roleId).alias;
  const reviewed = rowAccess(papers, parts, { [viewAlias("role-rev")]: true });
  assert.equal(reviewed.levels[fid(11)], "hidden", "authors hidden on a paper Ana reviews");
  assert.equal(reviewed.levels[fid(14)], "hidden", "lookup of authors is hidden too");
  assert.equal(reviewed.levels[fid(13)], "hidden", "author count is hidden too");
  assert.deepEqual(reviewed.editable, []);
  const own = rowAccess(papers, parts, { [viewAlias("role-auth")]: true, [editAlias("role-auth")]: true });
  assert.equal(own.levels[fid(11)], "edit", "authors editable on her own paper");
  assert.deepEqual(own.editable.sort(), [fid(10), fid(11), fid(12)].sort());
  assert.deepEqual(papers.queryable.includes(fid(11)), false, "can't filter or sort by a field hidden on some rows");
  assert.ok(papers.queryable.includes(fid(10)));
  assert.ok(papers.visible.includes(fid(11)));
});

test("derived hidden fields follow formulas, lookups and rollups", () => {
  const { hidden, reasons } = derivedHidden(definition, PAPERS, { [fid(12)]: "hidden" }, () => true);
  assert.ok(hidden.has(fid(15)));
  assert.equal(reasons[fid(15)], "Abstract");
  const noPeople = derivedHidden(definition, PAPERS, {}, (objectId) => objectId !== PEOPLE);
  assert.ok(noPeople.hidden.has(fid(13)) && noPeople.hidden.has(fid(14)));
  const reviews = compilePolicy({ definition, roles: [reviewer], tokens }).objects[REVIEWS];
  assert.equal(reviews.levels["role-rev"][fid(24)], "hidden", "a lookup of a field hidden on the linked list is hidden");
});

test("write guards carry each role's rules and editable fields", () => {
  const policy = compilePolicy({ definition, roles: [reviewer, author], tokens });
  const guard = guardFor(definition, policy.objects[REVIEWS]);
  assert.equal(guard.edit.length, 1);
  assert.deepEqual(guard.edit[0].fields, [fid(23)]);
  assert.equal(guard.edit[0].status, true);
  assert.equal(guard.comment.length, 1);
  assert.deepEqual(guard.create, []);
  const papers = guardFor(definition, policy.objects[PAPERS], { defaults: [fid(12)] });
  assert.equal(papers.create.length, 1);
  assert.ok(papers.create[0].fields.includes(fid(12)));
  assert.ok(papers.computed.some((item) => item.fieldId === fid(13)));
  assert.equal(papers.delete[0].condition.items[1].items[0].value, MEMBER);
});

test("records are shaped for the viewer: hidden fields gone, unreachable links restricted", () => {
  const policy = compilePolicy({ definition, roles: [reviewer], tokens });
  const reviews = policy.objects[REVIEWS];
  const { parts } = readPlan(reviews);
  const access = rowAccess(reviews, parts, Object.fromEntries(parts.map((part) => [part.alias, true])));
  const row = {
    id: "r1", number: 1, title: "R1", status: "draft", revision: 2, createdBy: "staff-id", values: { [fid(20)]: "R1", [fid(23)]: 4 },
    computed: { [fid(24)]: "Ben" },
    links: { [fid(21)]: [{ kind: "record", id: "p1", label: "P1", list: "papers", number: 1 }], [fid(22)]: [{ kind: "record", id: ANA, label: "Ana", list: "people", number: 2 }] },
  };
  const shaped = shapeRecord(row, { definition, objectId: REVIEWS, access, visibleTargets: new Set(["p1"]) });
  assert.equal(shaped.createdBy, undefined);
  assert.equal(shaped.computed[fid(24)], undefined, "hidden lookup removed");
  assert.deepEqual(shaped.links[fid(21)], [{ kind: "record", id: "p1", label: "P1", sub: undefined, list: "papers", number: 1 }]);
  assert.deepEqual(shaped.links[fid(22)], [{ kind: "record", restricted: true, label: "Restricted" }], "can't open the people list");
  assert.deepEqual(shaped.access.editable, [fid(23)]);
  assert.deepEqual([...linkTargets(definition, REVIEWS, [row], [fid(21), fid(22)]).keys()].sort(), [PAPERS, PEOPLE].sort());
  assert.deepEqual(publicFields(definition, REVIEWS, [fid(23)]).map((field) => field.key), ["score"]);
});

test("role validation", () => {
  const portal = { peopleObjectId: PEOPLE };
  const roles = [...builtins];
  const out = validateRoleInput({ name: "Session chair", membership: { op: "and", items: [{ field: fid(3), operator: "has_any", value: ["opt_rev"] }] },
    access: { [PAPERS]: { view: { mode: "all" }, fields: { [fid(13)]: "edit" } } } }, { definition, portal, roles });
  assert.equal(out.key, "session_chair");
  assert.equal(out.access[PAPERS].fields[fid(13)], "read", "calculated fields can't be editable");
  assert.equal(out.access[PAPERS].edit.mode, "none");
  assert.throws(() => validateRoleInput({ name: "X", access: { [PAPERS]: { view: { mode: "all" }, fields: { [fid(10)]: "hidden" } } } }, { definition, portal, roles }), /can't be hidden/);
  assert.throws(() => validateRoleInput({ name: "X", access: { [PAPERS]: { view: { mode: "where" } } } }, { definition, portal, roles }), /add at least one condition/);
  assert.throws(() => validateRoleInput({ name: "public visitor" }, { definition, portal, roles }), /already a role/);
  assert.throws(() => validateRoleInput({ name: "X", membership: { op: "and", items: [] } }, { definition, portal: {}, roles }), /people list first/);
  const builtin = validateRoleInput({ membership: { op: "and", items: [] } }, { definition, portal, roles, roleId: "role-public" });
  assert.equal(builtin.membership, null);
  assert.equal(builtin.key, "public");
});
