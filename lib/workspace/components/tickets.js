import { UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { workspaceStore } from "../server/store.js";
import { scanQuery } from "../../checkin/scan.js";
import { looksLikePass, verifyPass } from "./pass.js";
import { componentStore } from "./store.js";

// Ties workspace people to the event's tickets and orders: scanned codes, check-ins and "Match tickets by email".
const TICKET_CODE = /^[0-9a-f]{8}$/i;

const ticketFields = (definition, objectId, kind) => liveFields(definition, objectId).filter((field) => field.type === "link_event" && field.config.target === kind);
const emailFields = (definition, objectId) => liveFields(definition, objectId).filter((field) => field.type === "email");

// The record on `objectId` for a ticket holder: linked to that ticket/order, else with the same email.
export async function recordForHolder(context, definition, objectId, holder, { workspace = workspaceStore, store = componentStore } = {}) {
  if (!holder) return null;
  const linked = await store.linkSources(context, { kind: holder.kind, ids: [holder.id], fieldIds: ticketFields(definition, objectId, holder.kind).map((field) => field.id) });
  if (linked.length) {
    const rows = await workspace.records(context, [...new Set(linked.map((row) => row.source_record_id))]);
    const live = rows.find((row) => row.objectId === objectId && !row.deletedAt);
    if (live) return live.id;
  }
  if (!holder.email) return null;
  for (const field of emailFields(definition, objectId)) {
    const plan = compileQuery(definition, objectId, { filter: { op: "and", items: [{ field: field.id, operator: "eq", value: holder.email }] }, limit: 1 });
    const row = (await workspace.query(context, plan)).rows[0];
    if (row) return row.id;
  }
  return null;
}

// A scanned code → a record id on the people list: a workspace pass, a ticket/order QR (full id) or an 8-character ticket code.
export async function recordForCode(context, definition, objectId, code, deps = {}) {
  const { workspace = workspaceStore, store = componentStore } = deps;
  const text = String(code ?? "").trim().slice(0, 300);
  if (!text) throw new WorkspaceError("invalid_input", 422, "Scan a pass or a ticket.");
  if (looksLikePass(text)) {
    const id = verifyPass(text, context.eventId);
    const row = id ? await workspace.record(context, id) : null;
    if (!row || row.deletedAt) throw new WorkspaceError("not_found", 404, "This pass isn't valid for this event.");
    if (row.objectId !== objectId) throw new WorkspaceError("not_found", 404, "This pass belongs to someone this scanner doesn't take.");
    return row.id;
  }
  const { id, query } = scanQuery(text);
  const holder = id ? await store.ticketHolder(context, { id }) : TICKET_CODE.test(query) ? await store.ticketHolder(context, { code: query }) : null;
  if (!holder) throw new WorkspaceError("not_found", 404, "That isn't a pass or a ticket for this event.");
  const recordId = await recordForHolder(context, definition, objectId, holder, { workspace, store });
  if (!recordId) throw new WorkspaceError("not_found", 404, `${holder.name || "This ticket holder"} isn't on the list yet.`);
  return recordId;
}

// Links each person on a list to their ticket by email (oldest registration first); returns the counts.
export async function matchTicketsByEmail(context, { objectId, fieldId, emailFieldId, overwrite = false }, { workspace = workspaceStore, store = componentStore, send }) {
  const definition = await workspace.definition(context);
  const field = liveFields(definition, objectId).find((item) => item.id === fieldId && item.type === "link_event" && item.config.target === "ticket");
  if (!field) throw new WorkspaceError("invalid_input", 422, "Choose a field that links to tickets.");
  const email = liveFields(definition, objectId).find((item) => item.id === emailFieldId && item.type === "email");
  if (!email) throw new WorkspaceError("invalid_input", 422, "Choose the email field to match on.");
  const byEmail = new Map();
  for (const row of await store.registrations(context)) {
    const key = row.email.trim().toLowerCase();
    if (!byEmail.has(key)) byEmail.set(key, []);
    byEmail.get(key).push(row.id);
  }
  let matched = 0;
  let unmatched = 0;
  let kept = 0;
  for await (const page of workspace.recordPages(context, objectId)) {
    const links = await workspace.links(context, page.map((record) => record.id));
    const has = new Set(links.filter((link) => link.field_id === field.id).map((link) => link.source_record_id));
    for (const record of page) {
      const address = typeof record.values?.[email.id] === "string" ? record.values[email.id].trim().toLowerCase() : "";
      const ids = byEmail.get(address) ?? [];
      if (!ids.length) { unmatched += 1; continue; }
      if (has.has(record.id) && !overwrite) { kept += 1; continue; }
      const targets = (field.config.multiple ? ids : ids.slice(0, 1)).filter((id) => UUID.test(id)).map((id) => ({ kind: "ticket", id }));
      await send(context, "record.update", { recordId: record.id, expectedRevision: record.revision, values: {}, links: [{ fieldId: field.id, targets }], title: record.title ?? "" });
      matched += 1;
    }
  }
  return { matched, unmatched, kept };
}
