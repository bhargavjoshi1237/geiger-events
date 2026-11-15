import { randomBytes, randomUUID } from "node:crypto";
import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { liveFields } from "../schema/definition.js";
import { sanitiseHtml } from "../schema/types/rich_text.js";
import { templateToKeys, templateToNames } from "../process/template.js";

const bad = (message) => { throw new WorkspaceError("invalid_document", 422, message); };
const text = (value, max) => (typeof value === "string" ? value.slice(0, max) : "");
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);
const clamp = (value, min, max, fallback) => (Number.isFinite(Number(value)) ? Math.min(max, Math.max(min, Number(value))) : fallback);
const COLOR = /^#[0-9a-f]{6}$/i;
const HTTPS = /^https:\/\/[^\s/]+\S*$/i;

export const PAGE_SIZES = Object.freeze({ A4: [595.28, 841.89], Letter: [612, 792] });
export const MAX_BLOCKS = 100;

// What a PDF page can hold; `columns` holds the simpler kinds side by side.
export const BLOCK_KINDS = Object.freeze({
  heading: { label: "Heading", icon: "heading" },
  text: { label: "Text", icon: "text" },
  field: { label: "Field value", icon: "text-cursor-input" },
  image: { label: "Image", icon: "image" },
  qr: { label: "QR code", icon: "qr-code" },
  signature: { label: "Signature", icon: "signature" },
  spacer: { label: "Space", icon: "move-vertical" },
  divider: { label: "Divider", icon: "minus" },
  table: { label: "Table of linked records", icon: "table" },
  columns: { label: "Two columns", icon: "columns-2" },
});
const INNER = new Set(["heading", "text", "field", "image", "qr", "signature", "spacer", "divider"]);
const ALIGN = ["left", "center", "right"];

export const blockId = () => `b_${randomUUID().replace(/-/g, "").slice(0, 10)}`;

// Template texts each block kind holds, so one walk can convert, collect or render them.
const TEXT_KEYS = { heading: ["text"], text: ["text"], qr: ["text", "caption"], signature: ["name", "role"], table: ["title"] };

function mapBlockTexts(block, fn) {
  const out = { ...block };
  for (const key of TEXT_KEYS[block.kind] ?? []) if (typeof out[key] === "string") out[key] = fn(out[key]);
  if (block.kind === "columns") {
    out.left = (block.left ?? []).map((inner) => mapBlockTexts(inner, fn));
    out.right = (block.right ?? []).map((inner) => mapBlockTexts(inner, fn));
  }
  return out;
}

// Applies fn to every template text in a document's config (blocks, certificate holder, email subject and body).
export function mapTexts(kind, config, fn) {
  if (kind === "email") return { ...config, subject: fn(config.subject ?? ""), body: fn(config.body ?? "") };
  return {
    ...config,
    blocks: (config.blocks ?? []).map((block) => mapBlockTexts(block, fn)),
    ...(config.certificate ? { certificate: { ...config.certificate, holder: fn(config.certificate.holder ?? "") } } : {}),
  };
}

export function documentTexts(kind, config) {
  const texts = [];
  mapTexts(kind, config, (value) => { texts.push(value); return value; });
  return texts;
}

function fieldOn(definition, objectId, fieldId, what) {
  const field = objectId ? liveFields(definition, objectId).find((item) => item.id === fieldId) : null;
  if (!field) bad(what);
  return field;
}

function validateBlock(definition, objectId, input, { inner = false, certificate = false } = {}) {
  if (!isObject(input) || !Object.hasOwn(BLOCK_KINDS, input.kind)) bad("Choose what each block shows.");
  if (inner && !INNER.has(input.kind)) bad(`${BLOCK_KINDS[input.kind].label} can't go inside two columns.`);
  const id = /^b_[a-z0-9]{4,24}$/.test(input.id ?? "") ? input.id : blockId();
  const align = oneOf(input.align, ALIGN, "left");
  const keys = (value, max) => templateToKeys(text(value, max), definition, objectId, { document: true });
  switch (input.kind) {
    case "heading":
      return { id, kind: "heading", text: keys(input.text, 500), level: oneOf(Number(input.level), [1, 2, 3], 1), align };
    case "text":
      return { id, kind: "text", text: keys(input.text, 10_000), size: clamp(input.size, 7, 28, 11), bold: input.bold === true, align, muted: input.muted === true };
    case "field": {
      const field = fieldOn(definition, objectId, input.fieldId, "Choose the field to show.");
      if (field.type === "attachments") bad("Files can't be shown on a page.");
      return { id, kind: "field", fieldId: field.id, label: input.label !== false, align };
    }
    case "image": {
      const url = text(input.url, 2000).trim();
      if (url && !HTTPS.test(url)) bad("Images need an https:// address.");
      return { id, kind: "image", url, width: clamp(input.width, 5, 250, 40), align };
    }
    case "qr": {
      const source = oneOf(input.source, ["verify", "text"], "text");
      if (source === "verify" && !certificate) bad("A certificate check QR code needs the document to be a certificate.");
      const value = keys(input.text, 1000);
      if (source === "text" && !value.trim()) bad("Choose what the QR code holds.");
      return { id, kind: "qr", source, text: source === "text" ? value : "", size: clamp(input.size, 12, 90, 30), caption: keys(input.caption, 200), align };
    }
    case "signature": {
      const url = text(input.url, 2000).trim();
      if (url && !HTTPS.test(url)) bad("Signature images need an https:// address.");
      return { id, kind: "signature", url, name: keys(input.name, 200), role: keys(input.role, 200), align };
    }
    case "spacer":
      return { id, kind: "spacer", height: clamp(input.height, 1, 150, 8) };
    case "divider":
      return { id, kind: "divider" };
    case "table": {
      const link = fieldOn(definition, objectId, input.linkFieldId, "Choose the link field whose records the table lists.");
      if (link.type !== "link_record") bad("Tables list records through a link field.");
      const targets = new Map(liveFields(definition, link.config.targetObjectId).map((field) => [field.id, field]));
      const columns = (Array.isArray(input.columns) ? [...new Set(input.columns)] : []).filter((fieldId) => targets.has(fieldId) && targets.get(fieldId).type !== "attachments").slice(0, 6);
      if (!columns.length) bad("Choose the columns the table shows.");
      return { id, kind: "table", linkFieldId: link.id, columns, title: keys(input.title, 200) };
    }
    case "columns": {
      const side = (list) => (Array.isArray(list) ? list.slice(0, 12) : []).map((item) => validateBlock(definition, objectId, item, { inner: true, certificate }));
      return { id, kind: "columns", left: side(input.left), right: side(input.right) };
    }
    default:
      return bad("Choose what each block shows.");
  }
}

function validatePage(input) {
  const page = isObject(input) ? input : {};
  const background = text(page.background, 2000).trim();
  if (background && !HTTPS.test(background)) bad("The background image needs an https:// address.");
  return {
    size: oneOf(page.size, Object.keys(PAGE_SIZES), "A4"),
    orientation: oneOf(page.orientation, ["portrait", "landscape"], "portrait"),
    margin: clamp(page.margin, 5, 60, 20),
    font: oneOf(page.font, ["sans", "serif"], "sans"),
    color: COLOR.test(page.color ?? "") ? page.color.toLowerCase() : "#111827",
    accent: COLOR.test(page.accent ?? "") ? page.accent.toLowerCase() : "#111827",
    background,
  };
}

function validateCertificate(definition, objectId, input) {
  if (!isObject(input) || input.enabled !== true) return { enabled: false, holder: "", fields: [] };
  if (!objectId) bad("Certificates are issued to records — choose the list first.");
  const holder = templateToKeys(text(input.holder, 200), definition, objectId);
  if (!holder.trim()) bad("Choose whose name the certificate shows, like {{Name}}.");
  const live = new Map(liveFields(definition, objectId).map((field) => [field.id, field]));
  const fields = (Array.isArray(input.fields) ? [...new Set(input.fields)] : []).filter((id) => live.has(id) && live.get(id).type !== "attachments").slice(0, 12);
  return { enabled: true, holder, fields };
}

// A template from the editor (field names in placeholders) → what's stored (field keys).
export function validateDocument(definition, input) {
  if (!isObject(input)) bad("Describe the document.");
  const kind = oneOf(input.kind, ["email", "pdf"], null);
  if (!kind) bad("Choose an email template or a PDF document.");
  const name = text(input.name, 120).trim();
  if (!name) bad("Name the document.");
  let objectId = null;
  if (input.objectId) {
    if (!definition.objects.some((object) => object.id === input.objectId && !object.deletedAt)) bad("That list no longer exists.");
    objectId = input.objectId;
  }
  const config = isObject(input.config) ? input.config : {};
  if (kind === "email") {
    const subject = templateToKeys(text(config.subject, 300).trim(), definition, objectId);
    const body = templateToKeys(sanitiseHtml(text(config.body, 50_000)), definition, objectId);
    if (!subject || !body.trim()) bad("Write a subject and a message.");
    return { kind, name, objectId, config: { subject, body } };
  }
  const certificate = validateCertificate(definition, objectId, config.certificate);
  const blocks = (Array.isArray(config.blocks) ? config.blocks : []).map((block) => validateBlock(definition, objectId, block, { certificate: certificate.enabled }));
  const count = blocks.reduce((sum, block) => sum + 1 + (block.left?.length ?? 0) + (block.right?.length ?? 0), 0);
  if (count > MAX_BLOCKS) bad(`A document can have up to ${MAX_BLOCKS} blocks.`);
  return { kind, name, objectId, config: { page: validatePage(config.page), certificate, blocks } };
}

// Stored keys → the names organisers type.
export function documentForEditing(definition, document) {
  return { ...document, config: mapTexts(document.kind, document.config ?? {}, (value) => templateToNames(value, definition, document.objectId)) };
}

// Certificate codes: 12 symbols from a 32-letter alphabet without look-alikes (60 bits), grouped ABCD-EFGH-JKLM.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/;

export function certificateCode(bytes = randomBytes(12)) {
  const chars = Array.from(bytes.slice(0, 12), (byte) => ALPHABET[byte & 31]).join("");
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

// A typed or pasted code → the canonical form, or null (lower case, spaces and missing dashes are forgiven).
export function normaliseCode(input) {
  const raw = String(input ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (raw.length !== 12) return null;
  const code = `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
  return CODE_PATTERN.test(code) ? code : null;
}

// The file name a generated document gets on a record; regenerating with "replace" swaps the file with this name.
export function documentFileName(document, label) {
  const safe = (value) => String(value ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ").replace(/\s+/g, " ").trim();
  return `${safe(document.name).slice(0, 80) || "Document"}${label ? ` - ${safe(label).slice(0, 80)}` : ""}.pdf`;
}

export const isUuid = (value) => UUID.test(value ?? "");
