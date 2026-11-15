import test from "node:test";
import assert from "node:assert/strict";
import { FIELD_TYPES, getType, convertValue } from "./index.js";

const id1 = "11111111-1111-4111-8111-111111111111";
const id2 = "22222222-2222-4222-8222-222222222222";
const bad = (fn) => assert.throws(fn, { code: "invalid_value" });
const options = [{ id: "opt_a", label: "Talk", color: "blue" }, { id: "opt_b", label: "Poster", color: "green" }];

test("registry exposes exactly the 22 organiser field types", () => {
  assert.equal(FIELD_TYPES.length, 22);
  for (const name of FIELD_TYPES) assert.equal(getType(name).type, name);
  assert.equal(getType("nope"), null);
});

test("text types trim, enforce limits and treat blank as empty", () => {
  const short = getType("short_text");
  assert.equal(short.normalise("  hi  ", short.validateConfig({})), "hi");
  assert.equal(short.normalise("   ", short.validateConfig({})), null);
  bad(() => short.normalise("abcdef", short.validateConfig({ maxLength: 5 })));
  const long = getType("long_text");
  const config = long.validateConfig({ maxWords: 3 });
  assert.equal(long.normalise("one two  three", config), "one two  three");
  bad(() => long.normalise("one two three four", config));
  bad(() => long.normalise("abcdef", long.validateConfig({ maxChars: 5 })));
});

test("rich text keeps safe markup and strips scripts, handlers and javascript links", () => {
  const rich = getType("rich_text");
  const out = rich.normalise(`<p onclick="x()">Hi <strong>there</strong><script>alert(1)</script></p><a href="javascript:alert(1)">x</a><a href="https://a.test">ok</a><img src=x onerror=alert(1)>`, rich.validateConfig({}));
  assert.ok(out.includes("<p>Hi <strong>there</strong></p>"));
  assert.ok(!out.includes("script") && !out.includes("onclick") && !out.includes("javascript") && !out.includes("<img"));
  assert.ok(out.includes(`<a href="https://a.test" rel="noopener noreferrer" target="_blank">ok</a>`));
});

test("email, url and phone validate their formats", () => {
  const email = getType("email");
  assert.equal(email.normalise(" Ann@Example.COM ", {}), "Ann@example.com");
  bad(() => email.normalise("a@b", {}));
  const url = getType("url");
  assert.equal(url.normalise("https://geiger.studio/x", {}), "https://geiger.studio/x");
  bad(() => url.normalise("ftp://x.test", {}));
  bad(() => url.normalise("javascript:alert(1)", {}));
  const phone = getType("phone");
  assert.equal(phone.normalise(" +44 (20) 7946-0000 ", {}), "+44 (20) 7946-0000");
  bad(() => phone.normalise("12", {}));
  bad(() => phone.normalise("call me", {}));
});

test("number family rounds, bounds and checks currency", () => {
  const number = getType("number");
  assert.equal(number.normalise(2.456, number.validateConfig({ decimals: 2 })), 2.46);
  bad(() => number.normalise(11, number.validateConfig({ max: 10 })));
  bad(() => number.normalise("5", number.validateConfig({})));
  const currency = getType("currency");
  assert.throws(() => currency.validateConfig({ currency: "usd1" }), { code: "invalid_field" });
  assert.equal(currency.normalise(10.005, currency.validateConfig({ currency: "GBP" })), 10.01);
  const percent = getType("percent");
  assert.equal(percent.normalise(45, percent.validateConfig({})), 45);
  const rating = getType("rating");
  const five = rating.validateConfig({});
  assert.equal(five.max, 5);
  assert.equal(rating.normalise(4, five), 4);
  bad(() => rating.normalise(6, five));
  bad(() => rating.normalise(2.5, five));
  assert.throws(() => rating.validateConfig({ max: 11 }), { code: "invalid_field" });
});

test("selects store option ids and validate options", () => {
  const single = getType("single_select");
  const config = single.validateConfig({ options });
  assert.equal(single.normalise("opt_b", config), "opt_b");
  bad(() => single.normalise("opt_z", config));
  assert.throws(() => single.validateConfig({ options: [...options, { id: "opt_c", label: "talk" }] }), { code: "invalid_field" });
  const multi = getType("multi_select");
  assert.deepEqual(multi.normalise(["opt_a", "opt_b"], config), ["opt_a", "opt_b"]);
  assert.equal(multi.normalise([], config), null);
  bad(() => multi.normalise(["opt_a", "opt_a"], config));
});

test("checkbox, date, datetime and duration", () => {
  assert.equal(getType("checkbox").normalise(true, {}), true);
  bad(() => getType("checkbox").normalise("yes", {}));
  assert.equal(getType("date").normalise("2026-02-28", {}), "2026-02-28");
  bad(() => getType("date").normalise("2026-02-30", {}));
  assert.equal(getType("datetime").normalise("2026-11-14T10:00:00+05:30", {}), "2026-11-14T04:30:00.000Z");
  bad(() => getType("datetime").normalise("2026-11-14 10:00", {}));
  assert.equal(getType("duration").normalise(5400, {}), 5400);
  bad(() => getType("duration").normalise(-1, {}));
});

test("links normalise to kind/id pairs and respect single links", () => {
  const record = getType("link_record");
  const many = record.validateConfig({ targetObjectId: id1, multiple: true });
  assert.deepEqual(record.normalise([id1, id2], many), [{ kind: "record", id: id1 }, { kind: "record", id: id2 }]);
  const one = record.validateConfig({ targetObjectId: id1, multiple: false });
  bad(() => record.normalise([id1, id2], one));
  bad(() => record.normalise(["nope"], many));
  const event = getType("link_event");
  const contacts = event.validateConfig({ target: "contact" });
  assert.deepEqual(event.normalise([id2], contacts), [{ kind: "contact", id: id2 }]);
  assert.throws(() => event.validateConfig({ target: "planet" }), { code: "invalid_field" });
});

test("attachments check count and type", () => {
  const files = getType("attachments");
  const config = files.validateConfig({ maxFiles: 1, accept: ["application/pdf"] });
  const pdf = { id: id1, name: "paper.pdf", size: 10, type: "application/pdf" };
  assert.deepEqual(files.normalise([pdf], config), [pdf]);
  bad(() => files.normalise([pdf, { ...pdf, id: id2 }], config));
  bad(() => files.normalise([{ ...pdf, type: "image/png" }], config));
});

test("computed types are read-only and say whether they are stored", () => {
  assert.equal(getType("formula").stored, true);
  assert.equal(getType("lookup").stored, false);
  assert.equal(getType("rollup").stored, false);
  assert.throws(() => getType("lookup").normalise("x", {}), { code: "read_only" });
});

test("conversions go through text and report failures", () => {
  const select = getType("single_select").validateConfig({ options });
  assert.deepEqual(convertValue("number", {}, "short_text", {}, 12), { ok: true, value: "12" });
  assert.deepEqual(convertValue("short_text", {}, "number", { decimals: 0 }, "12"), { ok: true, value: 12 });
  assert.equal(convertValue("short_text", {}, "number", {}, "x").ok, false);
  assert.deepEqual(convertValue("single_select", select, "short_text", {}, "opt_a"), { ok: true, value: "Talk" });
  assert.deepEqual(convertValue("short_text", {}, "single_select", select, "poster"), { ok: true, value: "opt_b" });
  assert.deepEqual(convertValue("multi_select", select, "single_select", select, ["opt_b", "opt_a"]), { ok: true, value: "opt_b" });
  assert.deepEqual(convertValue("short_text", {}, "short_text", {}, null), { ok: true, value: null });
});
