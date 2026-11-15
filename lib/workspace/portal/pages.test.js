import test from "node:test";
import assert from "node:assert/strict";
import { defaultBlockConfig, validateBlock } from "./blocks.js";
import { navigationFor, orderedBlocks, pageOpenTo, toBlocks, toCanvas, validatePageInput } from "./pages.js";
import { chartPlan, listPlan, recordPlan, statPlans } from "./plans.js";
import { compilePolicy, staffObjectPolicy } from "./policy.js";
import { diffSnapshots, draftSnapshot, publishWarnings } from "./publish.js";

const PEOPLE = "11111111-1111-4111-8111-111111111111";
const PAPERS = "22222222-2222-4222-8222-222222222222";
const fid = (n) => `cccccccc-cccc-4ccc-8ccc-${String(n).padStart(12, "0")}`;
const f = (n, objectId, key, name, type, config = {}, extra = {}) => ({ id: fid(n), objectId, key, name, type, config, required: false, isUnique: false, position: n, revision: 1, deletedAt: null, ...extra });
const definition = {
  objects: [
    { id: PEOPLE, key: "people", name: "Person", plural: "People", numberPrefix: "PER", titleFieldId: fid(1), statuses: [], position: 0, deletedAt: null },
    { id: PAPERS, key: "papers", name: "Paper", plural: "Papers", numberPrefix: "PAP", titleFieldId: fid(10), position: 1, deletedAt: null,
      statuses: [{ key: "draft", label: "Draft" }, { key: "submitted", label: "Submitted" }] },
  ],
  fields: [
    f(1, PEOPLE, "name", "Name", "short_text"),
    f(2, PEOPLE, "email", "Email", "email"),
    f(10, PAPERS, "title", "Title", "short_text", {}, { required: true }),
    f(11, PAPERS, "authors", "Authors", "link_record", { targetObjectId: PEOPLE, multiple: true }),
    f(12, PAPERS, "track", "Track", "single_select", { options: [{ id: "opt_ml", label: "ML" }, { id: "opt_cv", label: "Vision" }] }),
    f(13, PAPERS, "pdf", "PDF", "attachments", {}),
    f(14, PAPERS, "secret", "Secret", "long_text"),
    f(15, PAPERS, "due", "Due", "date"),
    f(16, PAPERS, "score", "Score", "number", { decimals: 1 }),
  ],
};
const roles = [
  { id: "role-public", key: "public", name: "Public visitor", builtin: true, access: {} },
  { id: "role-signed", key: "signed_in", name: "Anyone signed in", builtin: true, access: {} },
  { id: "role-auth", key: "author", name: "Author", membership: { op: "and", items: [] },
    access: { [PAPERS]: { view: { mode: "where", filter: { op: "and", items: [{ field: fid(11), operator: "has_any", value: ["@me"] }] } }, create: { mode: "all" }, edit: { mode: "none" }, delete: { mode: "none" },
      fields: { [fid(14)]: "hidden", [fid(10)]: "edit", [fid(11)]: "edit" } } } },
];
const ctx = { definition, kind: "page", objectId: null, audience: { roles: [], public: false } };
const tokens = { personId: "aaaaaaaa-0000-4000-8000-000000000001", memberId: "bbbbbbbb-0000-4000-8000-000000000001", email: "a@x.test", today: "2026-11-14" };

test("blocks validate against the workspace and drop deleted fields", () => {
  const table = validateBlock({ kind: "table", config: { source: { objectId: PAPERS, sort: [{ field: fid(12), dir: "desc" }] }, columns: [fid(10), "status", "gone"], filters: [fid(12), fid(14)] } }, ctx);
  assert.deepEqual(table.columns, [fid(10), "status"]);
  assert.deepEqual(table.filters, [fid(12)], "long text can't be an exposed filter");
  assert.deepEqual(table.source.sort, [{ field: fid(12), dir: "desc" }]);
  assert.throws(() => validateBlock({ kind: "table", config: { source: { objectId: "nope" } } }, ctx), /Choose a list/);
  assert.throws(() => validateBlock({ kind: "cards", config: { source: { objectId: PAPERS, filter: { op: "and", items: [{ field: fid(11), operator: "has_any", value: ["@record"] }] } } } }, ctx), /record page/);
  assert.throws(() => validateBlock({ kind: "calendar", config: { source: { objectId: PAPERS } } }, ctx), /date field/);
  assert.throws(() => validateBlock({ kind: "record", config: { target: "page" } }, ctx), /record page/);
  const text = validateBlock({ kind: "text", config: { html: "<h2>Hi</h2><script>x()</script><img src=x onerror=y>" } }, ctx);
  assert.equal(text.html, "<h2>Hi</h2>");
  assert.throws(() => validateBlock({ kind: "image", config: { url: "javascript:alert(1)" } }, ctx), /https/);
  assert.throws(() => validateBlock({ kind: "buttons", config: { items: [{ kind: "url", target: "javascript:x" }] } }, ctx), /https/);
  const form = validateBlock({ kind: "form", config: { objectId: PAPERS, status: "submitted", sections: [{ fields: [{ fieldId: fid(10), required: true }, { fieldId: fid(14) }] }],
    defaults: [{ fieldId: fid(11), value: ["@me"] }], closesAt: "2026-09-01T23:59:00Z", signup: { enabled: true, objectId: PEOPLE } } }, ctx);
  assert.equal(form.status, "submitted");
  assert.deepEqual(form.defaults, [{ fieldId: fid(11), value: ["@me"] }]);
  assert.equal(form.signup.enabled, false, "sign-up only on public pages");
  const publicForm = validateBlock({ kind: "form", config: { objectId: PAPERS, signup: { enabled: true, objectId: PEOPLE, personFields: [{ fieldId: fid(1) }], personDefaults: [{ fieldId: fid(2), value: "@my_email" }] } } },
    { ...ctx, audience: { public: true } });
  assert.equal(publicForm.signup.enabled, true);
  assert.throws(() => validateBlock({ kind: "form", config: { objectId: PAPERS, defaults: [{ fieldId: fid(16), value: "abc" }] } }, ctx), /Score/);
  assert.throws(() => validateBlock({ kind: "stats", config: { tiles: [{ objectId: PAPERS, fn: "sum", fieldId: fid(10) }] } }, ctx), /number field/);
  for (const kind of ["table", "cards", "board", "stats", "chart", "text", "image", "buttons", "divider", "form"]) {
    assert.doesNotThrow(() => validateBlock({ kind, config: defaultBlockConfig(kind, { definition }) }, ctx), kind);
  }
});

test("welcome, notice, details and key-date blocks clean their content", () => {
  for (const kind of ["hero", "notice", "facts", "dates"]) {
    assert.doesNotThrow(() => validateBlock({ kind, config: defaultBlockConfig(kind, { definition }) }, ctx), kind);
  }
  const hero = validateBlock({ kind: "hero", config: {
    heading: "Welcome", badge: "sparkles", buttons: [{ label: "Go", kind: "page", target: "submit" }],
    facts: [{ icon: "Map Pin!", label: "Where", value: "Lisbon" }, { icon: "calendar", label: "", value: "" }, "nope"],
  } }, ctx);
  assert.equal(hero.badge, "countdown");
  assert.deepEqual(hero.facts, [{ icon: "info", label: "Where", value: "Lisbon" }]);
  assert.equal(hero.buttons[0].style, "primary");
  assert.throws(() => validateBlock({ kind: "hero", config: { image: "http://example.org/a.jpg" } }, ctx), /https/);
  assert.throws(() => validateBlock({ kind: "hero", config: { buttons: [{ kind: "url", target: "javascript:x" }] } }, ctx), /https/);
  const notice = validateBlock({ kind: "notice", config: { icon: "bell", html: "<p>Hi<script>x()</script></p>" } }, ctx);
  assert.equal(notice.icon, "bell");
  assert.doesNotMatch(notice.html, /script/);
  const dates = validateBlock({ kind: "dates", config: { title: "Key dates", items: [{ date: "2026-11-30", label: "Posters close" }, { date: "30/11", label: "Bad" }, { date: "2026-12-08" }] } }, ctx);
  assert.deepEqual(dates.items, [{ date: "2026-11-30", label: "Posters close", note: "" }]);
  const text = validateBlock({ kind: "text", config: { html: "<p>Help</p>", card: true } }, ctx);
  assert.equal(text.card, true);
});

test("pages keep their heading settings and drop empty ones", () => {
  const withHeader = validatePageInput({ title: "Submit", body: { rows: [], blocks: [], header: { title: " Late-breaking poster ", description: "Two pages.", extra: 1 } } },
    { definition, roles, pages: [] });
  assert.deepEqual(withHeader.body.header, { title: "Late-breaking poster", description: "Two pages.", hidden: false });
  const hidden = validatePageInput({ title: "Home", body: { rows: [], blocks: [], header: { hidden: true } } }, { definition, roles, pages: [] });
  assert.equal(hidden.body.header.hidden, true);
  const plain = validatePageInput({ title: "Plain", body: { rows: [], blocks: [], header: { title: "", description: "" } } }, { definition, roles, pages: [] });
  assert.equal(plain.body.header, undefined);
});

test("pages validate, place blocks and convert between layouts", () => {
  const page = validatePageInput({ title: "My papers", body: { rows: [], blocks: [{ id: "b_aaaa1", kind: "text", config: {} }, { id: "b_aaaa2", kind: "divider", config: {} }] } },
    { definition, roles, pages: [] });
  assert.equal(page.slug, "my-papers");
  assert.equal(page.body.rows.length, 1);
  assert.deepEqual(page.body.blocks.map((block) => block.at.order), [0, 1]);
  assert.throws(() => validatePageInput({ title: "Sign in", slug: "sign-in" }, { definition, roles, pages: [] }), /reserved/);
  assert.throws(() => validatePageInput({ title: "X", slug: "my-papers" }, { definition, roles, pages: [{ id: "p1", kind: "page", slug: "my-papers" }] }), /already uses/);
  const record = validatePageInput({ title: "Paper", kind: "record", objectId: PAPERS }, { definition, roles, pages: [] });
  assert.equal(record.slug, "record-papers");

  const body = {
    rows: [{ id: "r_row1", widths: [4, 8] }, { id: "r_row2", widths: [12] }],
    blocks: [
      { id: "b_side", kind: "text", at: { row: "r_row1", col: 0, order: 0 } },
      { id: "b_main", kind: "table", at: { row: "r_row1", col: 1, order: 0 } },
      { id: "b_main2", kind: "text", at: { row: "r_row1", col: 1, order: 1 } },
      { id: "b_foot", kind: "divider", at: { row: "r_row2", col: 0, order: 0 } },
    ],
  };
  const canvas = toCanvas(body);
  const grid = Object.fromEntries(canvas.blocks.map((block) => [block.id, block.grid]));
  assert.deepEqual([grid.b_side.x, grid.b_side.w, grid.b_main.x, grid.b_main.w], [0, 4, 4, 8]);
  assert.equal(grid.b_main2.y, grid.b_main.h, "stacked in the same column");
  assert.ok(grid.b_foot.y >= grid.b_main.h + grid.b_main2.h);
  const back = toBlocks(canvas);
  assert.equal(back.rows.length, 2);
  assert.deepEqual(back.rows[0].widths, [4, 8]);
  assert.deepEqual(orderedBlocks({ layout: "blocks", body: back }).map((block) => block.id), ["b_side", "b_main", "b_main2", "b_foot"]);
  assert.deepEqual(orderedBlocks({ layout: "canvas", body: canvas }).map((block) => block.id), ["b_side", "b_main", "b_main2", "b_foot"]);
});

test("navigation follows roles, public and team audiences", () => {
  const pages = [
    { id: "1", kind: "page", slug: "home", title: "Home", position: 0, audience: { roles: ["role-signed"] } },
    { id: "2", kind: "page", slug: "cfp", title: "Call for papers", position: 1, audience: { public: true } },
    { id: "3", kind: "page", slug: "desk", title: "Desk", position: 2, audience: { team: true } },
    { id: "4", kind: "record", slug: "record-papers", title: "Paper", position: 3, audience: {} },
    { id: "5", kind: "page", slug: "hidden", title: "Hidden", position: 4, audience: { roles: ["role-auth"], nav: false } },
  ];
  assert.deepEqual(navigationFor(pages, { roleIds: ["role-public"], publicRoleId: "role-public" }).map((page) => page.slug), ["cfp"]);
  assert.deepEqual(navigationFor(pages, { roleIds: ["role-public", "role-signed", "role-auth"], publicRoleId: "role-public" }).map((page) => page.slug), ["home", "cfp"]);
  assert.ok(pageOpenTo(pages[4], { roleIds: ["role-auth"] }), "hidden from the menu but still open");
  assert.deepEqual(navigationFor(pages, { team: true }).map((page) => page.slug), ["desk"]);
});

test("block plans add the viewer's rules and only use fields every role can see", () => {
  const policy = compilePolicy({ definition, roles: [roles[2]], tokens }).objects[PAPERS];
  const block = { kind: "table", config: validateBlock({ kind: "table", config: { source: { objectId: PAPERS, sort: [{ field: fid(14), dir: "asc" }] }, search: true, filters: [fid(12), "status"] } }, ctx) };
  const { plan, parts } = listPlan(block, { definition, objectPolicy: policy, tokens, params: { search: "deep", filters: { [fid(12)]: ["opt_ml"], status: ["draft"] }, sort: { field: fid(14) }, offset: 20 } });
  assert.equal(plan.policy.op, "or");
  assert.deepEqual(plan.policy.items[0].items[0].value, [tokens.personId]);
  assert.deepEqual(plan.sort, [{ source: "system", column: "number", cast: "numeric", dir: "asc" }], "a hidden field can't be sorted on");
  assert.ok(!plan.searchFields.includes(fid(14)), "hidden text isn't searched");
  assert.deepEqual(plan.filter.items.map((item) => item.operator), ["any_of", "any_of"]);
  assert.equal(plan.offset, 20);
  assert.ok(parts.some((part) => part.kind === "view"));
  const staff = listPlan(block, { definition, objectPolicy: staffObjectPolicy(definition, PAPERS), tokens, params: { sort: { field: fid(14) } } });
  assert.equal(staff.plan.sort[0].fieldId, fid(14));
  assert.equal(staff.plan.searchFields, undefined);
  const one = recordPlan(definition, policy, PAPERS, 7);
  assert.equal(one.plan.filter.items[0].value, 7);
  assert.equal(statPlans({ objectId: PAPERS, fn: "avg", fieldId: fid(14) }, { definition, objectPolicy: policy, tokens }), null);
  const pct = statPlans({ objectId: PAPERS, fn: "percent", part: { op: "and", items: [{ field: "status", operator: "eq", value: "submitted" }] } }, { definition, objectPolicy: policy, tokens });
  assert.equal(pct.length, 2);
  assert.equal(chartPlan({ objectId: PAPERS, groupBy: { field: fid(12) }, measure: { fn: "count" } }, { definition, objectPolicy: policy, tokens }).groupBy.cast, "text");
});

test("publish diff and warnings", () => {
  const page = { id: "p1", kind: "page", slug: "home", title: "Home", position: 0, layout: "blocks", audience: { roles: ["role-auth"] },
    body: { rows: [], blocks: [{ id: "b_form1", kind: "form", config: { title: "Submit", mode: "create", objectId: PAPERS, sections: [{ fields: [{ fieldId: fid(11) }] }], defaults: [] } }] } };
  const before = draftSnapshot({ portal: { enabled: false }, roles: [], pages: [] });
  const after = draftSnapshot({ portal: { enabled: true, peopleObjectId: PEOPLE }, roles, pages: [page] });
  const labels = diffSnapshots(before, after, definition).map((change) => change.label);
  assert.ok(labels.includes("Portal on/off"));
  assert.ok(labels.includes("Page “Home” added"));
  assert.ok(labels.includes("Role “Author” added"));
  const renamed = draftSnapshot({ portal: { enabled: true, peopleObjectId: PEOPLE }, roles: [{ ...roles[2], access: { [PAPERS]: { ...roles[2].access[PAPERS], fields: {} } } }], pages: [{ ...page, title: "Start" }] });
  const more = diffSnapshots(after, renamed, definition).map((change) => change.label);
  assert.ok(more.includes("Page “Home” renamed to “Start”"));
  assert.ok(more.some((label) => label.startsWith("Role “Author” on Papers: field visibility changed")));
  const warnings = publishWarnings(after, definition).map((item) => item.text);
  assert.ok(warnings.some((text) => text.includes("leaves out Title")));
  assert.ok(!warnings.some((text) => text.includes("can't be sent")), "Author may add papers");
});
