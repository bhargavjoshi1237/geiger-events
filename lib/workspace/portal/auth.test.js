import test from "node:test";
import assert from "node:assert/strict";
import { cleanEmail, createPortalAuth, sha256 } from "./auth.js";
import { clientBlock, defaultRecordPage } from "./read.js";

function fakeStore() {
  const tokens = [];
  const members = [];
  const sessions = [];
  return {
    tokens, members, sessions,
    async countCodes(_context, { email, since }) {
      return tokens.filter((row) => row.purpose === "code" && (!email || row.email === email) && row.created_at >= since).length;
    },
    async addToken(row) {
      const full = { id: row.id ?? `t${tokens.length}`, attempts: 0, used_at: null, revoked_at: null, created_at: new Date().toISOString(), ...row };
      tokens.push(full);
      return full;
    },
    async latestCode(_context, email) {
      return [...tokens].reverse().find((row) => row.purpose === "code" && row.email === email && !row.used_at && Date.parse(row.expires_at) > Date.now()) ?? null;
    },
    async updateToken(id, patch) { Object.assign(tokens.find((row) => row.id === id), patch); },
    async claimToken(id) {
      const row = tokens.find((item) => item.id === id);
      if (row.used_at || row.revoked_at) return false;
      row.used_at = new Date().toISOString();
      return true;
    },
    async tokenByHash(hash) { return tokens.find((row) => row.token_hash === hash) ?? null; },
    async invites() { return tokens.filter((row) => row.purpose === "invite"); },
    async memberByEmail(email) { return members.find((row) => row.email === email) ?? null; },
    async createMember(email) { const row = { id: `m${members.length}`, email, name: "" }; members.push(row); return row; },
    async createSession(memberId, tokenHash) { sessions.push({ memberId, tokenHash }); },
    async deleteSession(tokenHash) { sessions.splice(sessions.findIndex((row) => row.tokenHash === tokenHash), 1); },
  };
}

const context = { projectId: "p", eventId: "e" };
const event = { id: "e", name: "ICAML 2026" };

test("emails are cleaned and checked", () => {
  assert.equal(cleanEmail("  Ana@Example.ORG "), "ana@example.org");
  assert.throws(() => cleanEmail("not-an-email"), /valid email/);
});

test("sign-in codes: emailed, single use, limited attempts and rate limited", async () => {
  const store = fakeStore();
  const sent = [];
  const auth = createPortalAuth({ store, send: async (mail) => { sent.push(mail); return { ok: true }; } });
  await auth.requestCode({ context, event }, "ana@x.test");
  assert.equal(sent.length, 1);
  assert.equal(sent[0].notification, undefined, "codes ignore notification switches");
  const code = /(\d{6}) is your sign-in code/.exec(sent[0].subject)[1];
  assert.ok(!store.tokens[0].token_hash.includes(code), "only a hash is stored");
  await assert.rejects(auth.verifyCode({ context }, "ana@x.test", code === "000000" ? "111111" : "000000"), /isn't right/);
  const ok = await auth.verifyCode({ context }, "ANA@x.test", code);
  assert.equal(ok.member.email, "ana@x.test");
  assert.equal(store.sessions.length, 1);
  assert.equal(store.sessions[0].tokenHash, sha256(ok.session.token));
  await assert.rejects(auth.verifyCode({ context }, "ana@x.test", code), /isn't right/, "a code works once");

  await auth.requestCode({ context, event }, "ben@x.test");
  const benCode = /(\d{6})/.exec(sent.at(-1).subject)[1];
  const wrong = benCode === "123456" ? "654321" : "123456";
  for (let i = 0; i < 5; i++) await assert.rejects(auth.verifyCode({ context }, "ben@x.test", wrong));
  await assert.rejects(auth.verifyCode({ context }, "ben@x.test", benCode), /isn't right/, "locked after five wrong tries");

  for (let i = 0; i < 6; i++) await auth.requestCode({ context, event }, "cat@x.test");
  assert.equal(sent.filter((mail) => mail.to === "cat@x.test").length, 5, "five codes an hour per email");
});

test("invite links: one per person, single use, older ones replaced", async () => {
  const store = fakeStore();
  const sent = [];
  const auth = createPortalAuth({ store, send: async (mail) => { sent.push(mail); return { ok: true }; } });
  let last = null;
  const linkFor = (token) => { last = token; return `https://x.test/invite?token=${token}`; };
  const first = await auth.invite({ context, event, staffId: "s", linkFor }, [{ email: "Ana@x.test", name: "Ana" }, { email: "", name: "No email" }]);
  assert.deepEqual([first.sent, first.failed.length], [1, 1]);
  assert.equal(sent[0].notification, "workspace_portal_invite");
  const firstToken = last;
  await auth.invite({ context, event, staffId: "s", linkFor }, [{ email: "ana@x.test", name: "Ana" }]);
  assert.equal(await auth.acceptInvite(firstToken), null, "a newer invite replaces the old link");
  const accepted = await auth.acceptInvite(last);
  assert.equal(accepted.member.email, "ana@x.test");
  assert.equal(accepted.eventId, "e");
  assert.equal(await auth.acceptInvite(last), null, "links work once");
  assert.equal(await auth.acceptInvite("short"), null);
});

test("blocks sent to the browser leave rules and automatic values on the server", () => {
  const block = clientBlock({ id: "b_1234", kind: "form", at: { row: "r_1234", col: 0, order: 0 }, config: {
    title: "Submit", source: { objectId: "o", filter: { op: "and", items: [] } }, defaults: [{ fieldId: "f", value: "@me" }],
    tiles: [{ label: "x", filter: { op: "and" }, part: {} }], signup: { enabled: true, objectId: "p", personFields: [], personDefaults: [{ fieldId: "t" }] } } });
  assert.deepEqual(block.config.source, { objectId: "o" });
  assert.equal(block.config.defaults, undefined);
  assert.deepEqual(block.config.tiles, [{ label: "x" }]);
  assert.equal(block.config.signup.personDefaults, undefined);
  const page = defaultRecordPage({ id: "o1", key: "papers", name: "Paper", icon: "file" });
  assert.equal(page.body.blocks[0].config.target, "page");
});
