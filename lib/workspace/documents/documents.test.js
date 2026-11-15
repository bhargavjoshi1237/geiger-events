import { test } from "node:test";
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import { certificateCode, CODE_PATTERN, documentFileName, documentForEditing, documentTexts, normaliseCode, validateDocument } from "./model.js";
import { layoutDocument, pageGeometry, wrapText } from "./layout.js";
import { imageKind, qrModules, renderPdf } from "./render.js";

const P = "00000000-0000-4000-8000-0000000000b1";
const R = "00000000-0000-4000-8000-0000000000b2";
const definition = {
  objects: [
    { id: P, key: "paper", name: "Paper", plural: "Papers", numberPrefix: "PAP", statuses: [{ key: "accepted", label: "Accepted" }] },
    { id: R, key: "person", name: "Person", plural: "People", numberPrefix: "PER", statuses: [] },
  ],
  fields: [
    { id: "f-title", objectId: P, key: "title", name: "Title", type: "short_text", config: {} },
    { id: "f-files", objectId: P, key: "files", name: "Files", type: "attachments", config: {} },
    { id: "f-authors", objectId: P, key: "authors", name: "Authors", type: "link_record", config: { targetObjectId: R, multiple: true } },
    { id: "f-name", objectId: R, key: "name", name: "Name", type: "short_text", config: {} },
    { id: "f-email", objectId: R, key: "email", name: "Email", type: "email", config: {} },
  ],
};

// Monospace stand-in for font metrics: every character is half the font size wide.
const measure = (text, { size = 11 } = {}) => String(text).length * size * 0.5;

test("documents: validation stores field keys and refuses what can't render", () => {
  const doc = validateDocument(definition, {
    kind: "pdf", name: "  Acceptance letter ", objectId: P,
    config: {
      page: { size: "Letter", orientation: "landscape", margin: 500, color: "#ABCDEF", background: "" },
      certificate: { enabled: true, holder: "{{Authors.Name}}", fields: ["f-title", "f-files", "nope"] },
      blocks: [
        { kind: "heading", text: "Dear {{Authors.Name}}", level: 9 },
        { kind: "qr", source: "verify" },
        { kind: "table", linkFieldId: "f-authors", columns: ["f-name", "f-email", "nope"], title: "Authors of {{Title}}" },
        { kind: "columns", left: [{ kind: "text", text: "{{certificate.code}}" }], right: [{ kind: "signature", name: "Chair" }] },
      ],
    },
  });
  assert.equal(doc.name, "Acceptance letter");
  assert.deepEqual(doc.config.page, { size: "Letter", orientation: "landscape", margin: 60, font: "sans", color: "#abcdef", accent: "#111827", background: "" });
  assert.deepEqual(doc.config.certificate, { enabled: true, holder: "{{authors.name}}", fields: ["f-title"] });
  assert.equal(doc.config.blocks[0].text, "Dear {{authors.name}}");
  assert.equal(doc.config.blocks[0].level, 1);
  assert.deepEqual(doc.config.blocks[2].columns, ["f-name", "f-email"]);
  assert.equal(doc.config.blocks[3].left[0].text, "{{certificate.code}}");
  assert.ok(doc.config.blocks.every((block) => /^b_[a-z0-9]{10}$/.test(block.id)));
  assert.deepEqual(documentTexts("pdf", doc.config).filter(Boolean), ["Dear {{authors.name}}", "Authors of {{title}}", "{{certificate.code}}", "Chair", "{{authors.name}}"]);
  assert.equal(documentForEditing(definition, { ...doc, kind: "pdf" }).config.blocks[0].text, "Dear {{Authors.Name}}");

  const refuse = (config, pattern, extra = {}) => assert.throws(() => validateDocument(definition, { kind: "pdf", name: "X", objectId: P, config, ...extra }), pattern);
  refuse({ blocks: [{ kind: "qr", source: "verify" }] }, /needs the document to be a certificate/);
  refuse({ blocks: [{ kind: "image", url: "http://example.com/a.png" }] }, /https/);
  refuse({ blocks: [{ kind: "field", fieldId: "f-files" }] }, /Files can't be shown/);
  refuse({ blocks: [{ kind: "text", text: "{{Missing}}" }] }, /isn't a field/);
  refuse({ blocks: [{ kind: "columns", left: [{ kind: "table", linkFieldId: "f-authors", columns: ["f-name"] }] }] }, /can't go inside two columns/);
  refuse({ blocks: [{ kind: "table", linkFieldId: "f-title", columns: ["f-name"] }] }, /link field/);
  refuse({ certificate: { enabled: true, holder: "{{Title}}" } }, /choose the list/, { objectId: null });
  refuse({ blocks: Array.from({ length: 101 }, () => ({ kind: "divider" })) }, /up to 100 blocks/);
  assert.throws(() => validateDocument(definition, { kind: "email", name: "Mail", objectId: P, config: { subject: "Hi", body: "" } }), /subject and a message/);
  assert.throws(() => validateDocument(definition, { kind: "email", name: "Mail", objectId: P, config: { subject: "{{certificate.code}}", body: "x" } }), /only works in documents/);
  const email = validateDocument(definition, { kind: "email", name: "Mail", objectId: P, config: { subject: "About {{Title}}", body: "<p onclick=\"x()\">Hi {{Authors.Email}}</p><script>bad()</script>" } });
  assert.deepEqual(email.config, { subject: "About {{title}}", body: "<p>Hi {{authors.email}}</p>" });
});

test("documents: certificate codes are 60 random bits in a readable alphabet", () => {
  const code = certificateCode(Buffer.from(Array.from({ length: 12 }, (_, i) => i * 37)));
  assert.match(code, CODE_PATTERN);
  assert.equal(certificateCode(Buffer.alloc(12, 0)), "AAAA-AAAA-AAAA");
  assert.equal(certificateCode(Buffer.alloc(12, 31)), "9999-9999-9999");
  const seen = new Set(Array.from({ length: 2000 }, () => certificateCode()));
  assert.equal(seen.size, 2000);
  assert.equal(normaliseCode(" abcd efgh-jkmn "), "ABCD-EFGH-JKMN");
  assert.equal(normaliseCode("ABCD-EFGH-JKLO"), null, "O isn't in the alphabet");
  assert.equal(normaliseCode("ABCD-EFGH"), null);
  assert.equal(documentFileName({ name: "Letter: draft/2" }, "Paper / 7"), "Letter draft 2 - Paper 7.pdf");
});

test("documents: text wraps on words, keeps blank lines and cuts long words", () => {
  assert.deepEqual(wrapText("one two three four", 45, measure, { size: 10 }), ["one two", "three", "four"]);
  assert.deepEqual(wrapText("a\n\nb", 100, measure, { size: 10 }), ["a", "", "b"]);
  assert.deepEqual(wrapText("abcdefghijkl", 30, measure, { size: 10 }), ["abcdef", "ghijkl"]);
  assert.deepEqual(wrapText("", 30, measure, { size: 10 }), [""]);
});

test("documents: layout paginates text and tables, repeating the table header", () => {
  const geometry = pageGeometry({ size: "A4", margin: 20 });
  assert.ok(Math.abs(geometry.width - 595.28) < 0.01 && Math.abs(geometry.margin - 56.69) < 0.01);
  assert.equal(pageGeometry({ size: "A4", orientation: "landscape" }).width, 841.89);
  const lines = Array.from({ length: 120 }, (_, i) => `Line ${i}`).join("\n");
  const rows = Array.from({ length: 80 }, (_, i) => [`Row ${i}`, "x"]);
  const { pages } = layoutDocument([
    { kind: "heading", text: "Report", level: 1, align: "center" },
    { kind: "text", text: lines, size: 11 },
    { kind: "table", title: "People", header: ["Name", "Email"], rows },
  ], { page: { size: "A4", margin: 20 }, measure });
  assert.ok(pages.length >= 4, `expected several pages, got ${pages.length}`);
  const bottom = pageGeometry({ margin: 20 }).bottom;
  for (const ops of pages) for (const op of ops.filter((item) => item.op === "text")) assert.ok(op.y <= bottom + 1, `text below the margin: ${op.y}`);
  const heading = pages[0].find((op) => op.text === "Report");
  assert.ok(Math.abs(heading.x - (595.28 - measure("Report", { size: 22 })) / 2) < 0.01, "centred heading");
  const headers = pages.flat().filter((op) => op.text === "Name").length;
  assert.ok(headers >= 2, "the table header repeats on the next page");
  const texts = pages.flat().filter((op) => op.op === "text").map((op) => op.text);
  assert.equal(texts.filter((text) => text.startsWith("Row ")).length, 80, "every row is drawn once");
  assert.equal(texts.filter((text) => text.startsWith("Line ")).length, 120);
});

test("documents: a heading never ends a page on its own", () => {
  const filler = { kind: "spacer", height: 247 };
  const { pages } = layoutDocument([filler, { kind: "heading", text: "Section", level: 2 }, { kind: "text", text: "Body", size: 11 }], { page: { margin: 20 }, measure });
  assert.equal(pages.length, 2);
  assert.ok(pages[1].some((op) => op.text === "Section") && pages[1].some((op) => op.text === "Body"));
});

test("documents: every block type renders to a real PDF", async () => {
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  assert.equal(imageKind(png), "png");
  assert.equal(imageKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), "jpg");
  assert.equal(imageKind(Buffer.from("GIF89a")), null);
  const qr = qrModules("https://example.com/e/1/verify/ABCD-EFGH-JKLM");
  assert.equal(qr.bits.length, qr.count * qr.count);
  const loadImage = async (url) => {
    if (url.includes("broken")) throw new Error("the server answered HTTP 404");
    return png;
  };
  const { bytes, warnings, pages } = await renderPdf({
    title: "Smoke test",
    page: { size: "A4", font: "serif", margin: 18, background: "https://example.com/bg.png", accent: "#1d4ed8" },
    loadImage,
    blocks: [
      { kind: "heading", text: "Ελληνικά · Кириллица · Tiếng Việt", level: 1, align: "center" },
      { kind: "text", text: "Body text with\ttabs and a\nnew line.", size: 11, align: "left" },
      { kind: "field", name: "Title", value: "Learning to rank", label: true, align: "left" },
      { kind: "image", url: "https://example.com/logo.png", width: 30, align: "right" },
      { kind: "image", url: "https://example.com/broken.png", width: 30, align: "left" },
      { kind: "qr", value: "https://example.com/verify", size: 30, caption: "Scan to check", align: "center" },
      { kind: "signature", url: "https://example.com/sig.png", name: "Dr Ana Ruiz", role: "Programme chair", align: "left" },
      { kind: "spacer", height: 6 },
      { kind: "divider" },
      { kind: "table", title: "Authors", header: ["Name", "Email"], rows: [["Ana", "ana@x.test"], ["Ben", "ben@x.test"]] },
      { kind: "columns", left: [{ kind: "text", text: "Left", size: 11 }], right: [{ kind: "qr", value: "right", size: 20, caption: "", align: "right" }] },
    ],
  });
  assert.equal(pages, 1);
  assert.deepEqual(warnings, ["An image couldn't be loaded: the server answered HTTP 404."]);
  const parsed = await PDFDocument.load(bytes);
  assert.equal(parsed.getPageCount(), 1);
  assert.equal(parsed.getTitle(), "Smoke test");
  assert.ok(bytes.length < 400_000, `fonts are subset (${bytes.length} bytes)`);
});

test("documents: generating into a file field replaces or refuses, before anything is uploaded", async () => {
  const { createDocumentService } = await import("./service.js");
  const uploads = [];
  const store = { upload: async (path) => { uploads.push(path); }, addFile: async (row) => row, issue: async () => ({}), certificates: async () => [], revoke: async () => {} };
  const service = createDocumentService({ store, workspace: {}, records: {}, portal: {}, fetchImage: async () => { throw new Error("no images"); } });
  const one = { id: "f-one", objectId: P, key: "one", name: "Certificate PDF", type: "attachments", config: { maxFiles: 1 } };
  const two = { id: "f-two", objectId: P, key: "two", name: "Letters", type: "attachments", config: { maxFiles: 2 } };
  const defs = { ...definition, fields: [...definition.fields, one, two] };
  const document = { id: "d1", kind: "pdf", name: "Letter", objectId: P, config: { page: {}, certificate: { enabled: false }, blocks: [{ kind: "text", text: "Hello {{title}}" }] } };
  const old = { id: "00000000-0000-4000-8000-000000000101", name: "Seeded.pdf", size: 10, type: "application/pdf" };
  const same = { id: "00000000-0000-4000-8000-000000000102", name: "Letter - Paper one.pdf", size: 10, type: "application/pdf" };
  const record = (values) => ({ id: "r1", objectId: P, number: 1, title: "Paper one", revision: 1, values: { "f-title": "Paper one", ...values }, links: {} });
  const base = { definition: defs, event: { id: "e1", name: "Event", timeZone: "UTC" }, document, issuer: { kind: "staff", id: "u1" } };
  const run = async (fieldId, values, replace) => {
    let written = null;
    await service.produce({ projectId: "p", eventId: "e" }, { ...base, record: record(values), fieldId, replace, write: async (out) => { written = out; } });
    return written[fieldId];
  };

  const replaced = await run("f-one", { "f-one": [old] }, true);
  assert.deepEqual([replaced.length, replaced[0].name], [1, "Letter - Paper one.pdf"], "a one-file field holds just the new document");
  await assert.rejects(run("f-one", { "f-one": [old] }, false), /holds up to 1 file and is full/);
  const swapped = await run("f-two", { "f-two": [old, same] }, true);
  assert.deepEqual(swapped.map((file) => file.name), ["Seeded.pdf", "Letter - Paper one.pdf"], "the earlier copy with the same name is swapped");
  const before = uploads.length;
  await assert.rejects(run("f-two", { "f-two": [old, { ...same, name: "Other.pdf" }] }, true), /holds up to 2 files and is full/);
  assert.equal(uploads.length, before, "nothing is uploaded when the field is full");
});
