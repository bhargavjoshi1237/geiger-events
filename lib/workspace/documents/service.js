import { randomUUID } from "node:crypto";
import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { safeFetch } from "../net/safe_fetch.js";
import { brandColor } from "../portal/staff.js";
import { portalStore } from "../portal/store.js";
import { automationEmail, backgroundBaseUrl, recordPortalUrl } from "../process/emails.js";
import { linkedIds, loadRecord, loadRecords } from "../process/records.js";
import { DOCUMENT_PLACEHOLDERS, displayValue, linkedKeys, renderTemplate, templateResolver } from "../process/template.js";
import { liveFields } from "../schema/definition.js";
import { workspaceService } from "../server/service.js";
import { workspaceStore } from "../server/store.js";
import { BLOCK_KINDS, certificateCode, documentFileName, documentForEditing, documentTexts, normaliseCode, validateDocument } from "./model.js";
import { renderPdf } from "./render.js";
import { documentStore } from "./store.js";

const bad = (message) => { throw new WorkspaceError("invalid_input", 422, message); };
const notFound = (message) => new WorkspaceError("not_found", 404, message);
const IMAGE_BYTES = 5 * 1024 * 1024;
const LINK_SECONDS = 14 * 86_400;
const SAMPLE_CODE = "XXXX-XXXX-XXXX";

export const verifyUrl = (eventId, code) => `${backgroundBaseUrl()}/e/${eventId}/verify/${code}`;

async function loadImage(url) {
  const response = await safeFetch(url, { maxBytes: IMAGE_BYTES, timeoutMs: 8000 });
  if (!response.ok) throw new Error(`the server answered HTTP ${response.status}`);
  return response.bytes;
}

// Placeholders for a preview without a record: each field shows its own name in brackets.
function sampleResolver(definition, object, event, base) {
  const byKey = new Map((object ? liveFields(definition, object.id) : []).map((field) => [field.key, field]));
  return (path) => {
    switch (path) {
      case "record.number": return object ? `${object.numberPrefix}-12` : "";
      case "record.title": return "Sample record";
      case "record.status": return object?.statuses?.[0]?.label ?? "";
      case "certificate.code": return SAMPLE_CODE;
      case "certificate.url": return verifyUrl(event.id, SAMPLE_CODE);
      default: break;
    }
    const [first, second] = path.split(".");
    const field = byKey.get(first);
    if (!field) return base(path);
    if (second === undefined) return `[${field.name}]`;
    const target = liveFields(definition, field.config.targetObjectId ?? "").find((item) => item.key === second);
    return target ? `[${field.name} · ${target.name}]` : "";
  };
}

export function createDocumentService({ store = documentStore, workspace = workspaceStore, records = workspaceService, portal = portalStore, fetchImage = loadImage } = {}) {
  async function definitionOf(context) {
    const definition = await workspace.definition(context);
    if (!definition.workspace) throw notFound("Set up the workspace for this event first.");
    return definition;
  }

  async function eventOf(context) {
    const row = await portal.eventRow(context.eventId);
    return { id: context.eventId, name: row?.name ?? "the event", timeZone: row?.timezone || "UTC", venueId: row?.venue_id ?? null, brand: brandColor(row) };
  }

  const objectOf = (definition, id) => definition.objects.find((object) => object.id === id && !object.deletedAt) ?? null;

  // The resolver and table rows for one record (or sample values when there's none).
  async function contextFor(context, { definition, event, document, record, certificate = null, payload = null }) {
    const object = objectOf(definition, record?.objectId ?? document.objectId);
    const base = templateResolver(definition, { event, timeZone: event.timeZone });
    if (!record) return { object, resolve: sampleResolver(definition, object, event, base), tables: new Map(), sample: true };
    const linked = {};
    for (const key of linkedKeys(documentTexts(document.kind, document.config))) {
      const field = liveFields(definition, object.id).find((item) => item.key === key && item.type === "link_record");
      if (field) linked[key] = await loadRecords(context, definition, field.config.targetObjectId, linkedIds(record, field.id).slice(0, 50), { workspace, venueId: event.venueId });
    }
    const tables = new Map();
    const wanted = (document.config.blocks ?? []).flatMap((block) => (block.kind === "columns" ? [] : [block])).filter((block) => block.kind === "table");
    for (const block of wanted) {
      const field = liveFields(definition, object.id).find((item) => item.id === block.linkFieldId);
      if (field && !tables.has(field.id)) tables.set(field.id, await loadRecords(context, definition, field.config.targetObjectId, linkedIds(record, field.id).slice(0, 200), { workspace, venueId: event.venueId }));
    }
    const resolve = templateResolver(definition, {
      object, record, linked, event, timeZone: event.timeZone, payload, certificate,
      link: object ? recordPortalUrl(event.id, object.key, record.number) : "",
    });
    return { object, resolve, tables, sample: false };
  }

  // Stored blocks → blocks with their text filled in, ready for the renderer.
  function fillBlocks(blocks, options) {
    const { definition, object, record, resolve, tables, sample, event, certificate } = options;
    const fill = (value) => renderTemplate(value, resolve);
    const fieldsOf = (objectId) => (objectId ? liveFields(definition, objectId) : []);
    return blocks.map((block) => {
      switch (block.kind) {
        case "heading":
        case "text":
          return { ...block, text: fill(block.text) };
        case "field": {
          const field = fieldsOf(object?.id).find((item) => item.id === block.fieldId);
          if (!field) return null;
          return { ...block, name: field.name, value: sample ? `[${field.name}]` : displayValue(field, record, { timeZone: event.timeZone }) };
        }
        case "qr":
          return { ...block, value: block.source === "verify" ? certificate?.url ?? (sample ? verifyUrl(event.id, SAMPLE_CODE) : "") : fill(block.text), caption: fill(block.caption) };
        case "signature":
          return { ...block, name: fill(block.name), role: fill(block.role) };
        case "table": {
          const link = fieldsOf(object?.id).find((item) => item.id === block.linkFieldId);
          const targets = new Map(fieldsOf(link?.config?.targetObjectId).map((field) => [field.id, field]));
          const columns = block.columns.map((id) => targets.get(id)).filter(Boolean);
          const rows = sample
            ? [1, 2].map(() => columns.map((field) => `[${field.name}]`))
            : (tables.get(block.linkFieldId) ?? []).map((target) => columns.map((field) => displayValue(field, target, { timeZone: event.timeZone })));
          return { ...block, title: fill(block.title), header: columns.map((field) => field.name), rows };
        }
        case "columns":
          return { ...block, left: fillBlocks(block.left ?? [], options), right: fillBlocks(block.right ?? [], options) };
        default:
          return block;
      }
    }).filter(Boolean);
  }

  async function renderFor(context, { definition, event, document, record = null, certificate = null }) {
    if (document.kind !== "pdf") bad("Only PDF documents can be rendered.");
    const ctx = await contextFor(context, { definition, event, document, record, certificate });
    const blocks = fillBlocks(document.config.blocks ?? [], { ...ctx, definition, record, event, certificate });
    const out = await renderPdf({ page: document.config.page ?? {}, blocks, title: document.name, loadImage: fetchImage });
    return { ...out, resolve: ctx.resolve, object: ctx.object };
  }

  async function pdfDocument(context, id) {
    const document = UUID.test(id ?? "") ? await store.document(context, id) : null;
    if (!document) throw notFound("That document no longer exists.");
    if (document.kind !== "pdf") bad("Choose a PDF document.");
    return document;
  }

  // Renders a document for one record, stores the PDF in a file field and, for certificates, issues one.
  // write(values) saves the field (as staff or as an automation); ids make retries reuse the same file and certificate.
  async function produce(context, { definition, event, document, record, fieldId, replace = true, ids = {}, issuer, write }) {
    if (document.objectId && document.objectId !== record.objectId) bad("This document is written for a different list.");
    const field = liveFields(definition, record.objectId).find((item) => item.id === fieldId && item.type === "attachments");
    if (!field) bad("Choose a file field on this list to put the document in.");
    // Work out the field's files first, so a full field stops before anything is rendered or uploaded.
    const name = documentFileName(document, record.title || `${objectOf(definition, record.objectId)?.numberPrefix ?? "REC"}-${record.number}`);
    const current = Array.isArray(record.values?.[field.id]) ? record.values[field.id] : [];
    const maxFiles = field.config?.maxFiles ?? 10;
    // With Replace on, a one-file field simply holds the new document; otherwise only a copy with the same name is swapped.
    const kept = replace && maxFiles === 1 ? [] : current.filter((item) => !(replace && item.name === name));
    if (kept.length >= maxFiles) {
      bad(`${field.name} holds up to ${maxFiles} file${maxFiles === 1 ? "" : "s"} and is full. Remove one${replace ? "" : ", or turn on Replace"}, or choose another field.`);
    }
    const settings = document.config.certificate ?? {};
    let certificate = null;
    if (settings.enabled) {
      const id = ids.certificateId ?? randomUUID();
      const existing = ids.certificateId ? await store.certificateById(id) : null;
      const code = existing?.code ?? certificateCode();
      certificate = { id, code, url: verifyUrl(event.id, code) };
    }
    const { bytes, warnings, resolve } = await renderFor(context, { definition, event, document, record, certificate });
    const fileId = ids.fileId ?? randomUUID();
    const path = `${context.projectId}/${context.eventId}/${field.id}/${fileId}/${name.replace(/[^\w.-]+/g, "_")}`;
    await store.upload(path, bytes);
    await store.addFile({ id: fileId, project_id: context.projectId, event_id: context.eventId, field_id: field.id, path, name, type: "application/pdf", size: bytes.length, created_by: issuer.id });
    const file = { id: fileId, name, size: bytes.length, type: "application/pdf" };
    await write({ [field.id]: [...kept.filter((item) => item.id !== fileId), file] });

    let issued = null;
    if (certificate) {
      const fields = new Map(liveFields(definition, record.objectId).map((item) => [item.id, item]));
      const data = (settings.fields ?? []).map((id) => fields.get(id)).filter(Boolean)
        .map((item) => ({ label: item.name, value: displayValue(item, record, { timeZone: event.timeZone }).slice(0, 500) }));
      const result = await store.issue({
        id: certificate.id, project_id: context.projectId, event_id: context.eventId, document_id: document.id, record_id: record.id,
        code: certificate.code, title: document.name.slice(0, 200), holder: renderTemplate(settings.holder, resolve).trim().slice(0, 200), data,
        file_id: fileId, issued_by_kind: issuer.kind, issued_by: issuer.id,
      });
      issued = result.certificate;
      if (replace) {
        const earlier = (await store.certificates(context, { recordId: record.id, documentId: document.id, status: "valid" })).filter((item) => item.id !== issued.id);
        await store.revoke(context, earlier.map((item) => item.id), `Reissued as ${issued.code}`);
      }
    }
    return { file, certificate: issued ? { id: issued.id, code: issued.code, url: verifyUrl(event.id, issued.code) } : null, warnings };
  }

  const recordLabel = (definition, row) => {
    if (!row) return null;
    const object = objectOf(definition, row.object_id);
    return { id: row.id, objectId: row.object_id, label: row.title || `${object?.numberPrefix ?? "REC"}-${row.number}` };
  };

  return {
    produce,
    renderFor,
    eventOf,

    async list(context) {
      const definition = await definitionOf(context);
      const documents = await store.documents(context);
      return {
        documents: documents.map((document) => documentForEditing(definition, document)),
        catalog: { blocks: BLOCK_KINDS, placeholders: DOCUMENT_PLACEHOLDERS },
      };
    },

    async save(context, { id, document, expectedRevision }) {
      const definition = await definitionOf(context);
      const clean = validateDocument(definition, document);
      let row;
      if (UUID.test(id ?? "")) {
        const current = await store.document(context, id);
        if (!current) throw notFound("That document no longer exists.");
        if (current.kind !== clean.kind) bad("A document can't change between email and PDF.");
        row = await store.updateDocument(context, id, { name: clean.name, object_id: clean.objectId, config: clean.config, revision: current.revision + 1, updated_by: context.principal.id },
          Number.isInteger(expectedRevision) ? expectedRevision : current.revision);
      } else {
        row = await store.insertDocument({
          project_id: context.projectId, event_id: context.eventId, kind: clean.kind, name: clean.name, object_id: clean.objectId, config: clean.config,
          created_by: context.principal.id, updated_by: context.principal.id,
        });
      }
      return { document: documentForEditing(definition, row) };
    },

    async remove(context, { id }) {
      const current = UUID.test(id ?? "") ? await store.document(context, id) : null;
      if (!current) throw notFound("That document no longer exists.");
      await store.updateDocument(context, id, { deleted_at: new Date().toISOString() });
      return { deleted: true };
    },

    // The real PDF for a record (or sample values), from a saved document or the editor's unsaved copy.
    async preview(context, { documentId, document, recordId }) {
      const definition = await definitionOf(context);
      const event = await eventOf(context);
      const source = isObject(document) ? { id: null, ...validateDocument(definition, document) } : await pdfDocument(context, documentId);
      let record = null;
      if (UUID.test(recordId ?? "")) {
        const raw = await workspace.record(context, recordId);
        if (!raw || raw.deletedAt) throw notFound("That record no longer exists.");
        if (source.objectId && raw.objectId !== source.objectId) bad("Choose a record from the document's list.");
        record = await loadRecord(context, definition, raw.objectId, raw.id, { workspace, venueId: event.venueId });
      }
      const certificate = source.config.certificate?.enabled ? { code: SAMPLE_CODE, url: verifyUrl(event.id, SAMPLE_CODE) } : null;
      const { bytes, warnings, pages } = await renderFor(context, { definition, event, document: source, record, certificate });
      return { bytes, warnings, pages, name: documentFileName(source, record?.title) };
    },

    // Generates a document for chosen records as the signed-in staff member.
    async generate(context, { documentId, recordIds, fieldId, replace = true }) {
      const definition = await definitionOf(context);
      const event = await eventOf(context);
      const document = await pdfDocument(context, documentId);
      const ids = Array.isArray(recordIds) ? [...new Set(recordIds.filter((id) => UUID.test(id ?? "")))].slice(0, 50) : [];
      if (!ids.length) bad("Choose records to generate it for.");
      const results = [];
      for (const recordId of ids) {
        try {
          const raw = await workspace.record(context, recordId);
          if (!raw || raw.deletedAt) throw notFound("That record no longer exists.");
          const record = await loadRecord(context, definition, raw.objectId, raw.id, { workspace, venueId: event.venueId });
          const result = await produce(context, {
            definition, event, document, record, fieldId, replace: replace !== false, issuer: { kind: "staff", id: context.principal.id },
            write: (values) => records.runCommand(context, { action: "record.update", recordId: record.id, expectedRevision: record.revision, values }),
          });
          results.push({ recordId, ...result });
        } catch (error) {
          if (!(error instanceof WorkspaceError)) console.error("[workspace.documents] generate", recordId, error);
          // Field-level problems (like a full file field) say more than the summary line.
          const details = error instanceof WorkspaceError && error.fields && typeof error.fields === "object" ? Object.values(error.fields).filter((item) => typeof item === "string") : [];
          results.push({ recordId, error: error instanceof WorkspaceError ? [error.message, ...details].join(" ") : "Couldn't make the document for this record." });
        }
      }
      return { results };
    },

    async certificates(context, { recordId = null, status = null } = {}) {
      const definition = await definitionOf(context);
      const rows = await store.certificates(context, { recordId: UUID.test(recordId ?? "") ? recordId : null, status: ["valid", "revoked"].includes(status) ? status : null });
      const labels = new Map((await workspace.recordLabels(context, [...new Set(rows.map((row) => row.recordId).filter(Boolean))])).map((row) => [row.id, row]));
      return {
        certificates: rows.map((row) => ({ ...row, url: verifyUrl(context.eventId, row.code), record: recordLabel(definition, labels.get(row.recordId)) })),
      };
    },

    async revoke(context, { id, reason }) {
      const current = UUID.test(id ?? "") ? await store.certificate(context, id) : null;
      if (!current) throw notFound("That certificate no longer exists.");
      if (current.revokedAt) bad("That certificate is already revoked.");
      const why = typeof reason === "string" ? reason.trim().slice(0, 500) : "";
      if (!why) bad("Say why it's revoked — the check page shows the reason.");
      await store.revoke(context, [current.id], why);
      return { revoked: true };
    },

    async emailPreview(context, { document, recordId }) {
      const definition = await definitionOf(context);
      const event = await eventOf(context);
      const clean = validateDocument(definition, { ...document, kind: "email" });
      let record = null;
      if (UUID.test(recordId ?? "")) {
        const raw = await workspace.record(context, recordId);
        if (raw && !raw.deletedAt) record = await loadRecord(context, definition, raw.objectId, raw.id, { workspace, venueId: event.venueId });
      }
      const { resolve } = await contextFor(context, { definition, event, document: clean, record });
      return automationEmail({ event: event.name, brand: event.brand, subject: renderTemplate(clean.config.subject, resolve) || "Update", bodyHtml: renderTemplate(clean.config.body, resolve, { html: true }) });
    },

    // A private link to a freshly rendered PDF for one record (for emails); never issues a certificate.
    async emailLink(context, { definition, event, documentId, record, key }) {
      const document = await pdfDocument(context, documentId);
      const { bytes } = await renderFor(context, { definition, event, document: { ...document, config: { ...document.config, certificate: { enabled: false } } }, record });
      const name = documentFileName(document, record?.title);
      const path = `${context.projectId}/${context.eventId}/emailed/${key}/${name.replace(/[^\w.-]+/g, "_")}`;
      await store.upload(path, bytes);
      return { url: await store.signedUrl(path, LINK_SECONDS, name), name };
    },

    // The public check: only the fields the verification page shows.
    async verify(eventId, code) {
      const canonical = normaliseCode(code);
      if (!UUID.test(eventId ?? "") || !canonical) return null;
      return store.publicCertificate(eventId, canonical);
    },
  };
}

export const documentService = createDocumentService();
