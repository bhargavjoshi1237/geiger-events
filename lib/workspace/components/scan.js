import { UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { workspaceStore } from "../server/store.js";
import { recordForCode } from "./tickets.js";

// The scanner block's server side, shared by the portal and team pages: who a scan or a pick means, the context it's
// taken for, whether they're already marked, and the values a new attendance record gets.
const notFound = (message) => new WorkspaceError("not_found", 404, message);

const linkTarget = (definition, objectId, fieldId) => liveFields(definition, objectId).find((field) => field.id === fieldId)?.config?.targetObjectId ?? null;
const hasLink = (fieldId, id) => ({ field: fieldId, operator: "has_any", value: [id] });

export function scannerLists(definition, config) {
  return { peopleId: linkTarget(definition, config.objectId, config.personField), contextId: config.contextField ? linkTarget(definition, config.objectId, config.contextField) : null };
}

export function createScanner({ workspace = workspaceStore } = {}) {
  async function label(viewer, id) {
    const [row] = await workspace.recordLabels(viewer.context, [id]);
    const object = viewer.definition.objects.find((item) => item.id === row?.object_id);
    return row ? { id: row.id, label: row.title || `${object?.numberPrefix ?? "REC"}-${row.number}` } : null;
  }

  async function inList(viewer, objectId, id) {
    if (!UUID.test(id ?? "")) return false;
    const row = await workspace.record(viewer.context, id.toLowerCase());
    return Boolean(row && !row.deletedAt && row.objectId === objectId);
  }

  // The attendance record already taken for this person (and context), if any.
  async function existing(viewer, config, personId, contextId) {
    const items = [hasLink(config.personField, personId), ...(config.contextField && contextId ? [hasLink(config.contextField, contextId)] : [])];
    const plan = compileQuery(viewer.definition, config.objectId, { filter: { op: "and", items }, sort: [{ field: "created_at", dir: "asc" }], limit: 1 });
    const row = (await workspace.query(viewer.context, plan)).rows[0];
    return row ? { id: row.id, at: row.createdAt ?? row.created_at ?? null } : null;
  }

  // Which context a mark is for: the record page's record, the one chosen, or none.
  async function contextFor(viewer, config, { contextId, recordId }) {
    const { contextId: listId } = scannerLists(viewer.definition, config);
    if (config.context === "none" || !listId) return null;
    const id = config.context === "page" ? recordId : contextId;
    if (!(await inList(viewer, listId, id))) throw new WorkspaceError("invalid_input", 422, config.context === "page" ? "Open the record you're taking attendance for." : "Choose what you're taking attendance for.");
    return id.toLowerCase();
  }

  return {
    // People on the list whose name matches (labels only), for checking someone in without a code.
    async search(viewer, config, q) {
      const { peopleId } = scannerLists(viewer.definition, config);
      const text = typeof q === "string" ? q.trim().slice(0, 100) : "";
      if (!peopleId || text.length < 2) return [];
      const plan = compileQuery(viewer.definition, peopleId, { search: text, sort: [{ field: "title", dir: "asc" }], limit: 10 });
      const object = viewer.definition.objects.find((item) => item.id === peopleId);
      return (await workspace.query(viewer.context, plan)).rows.map((row) => ({ id: row.id, label: row.title || `${object?.numberPrefix ?? "REC"}-${row.number}` }));
    },

    // A scan or a pick → { person, contextId, already }; nothing is written.
    async check(viewer, config, { code = null, personId = null, contextId = null, recordId = null }) {
      const { peopleId } = scannerLists(viewer.definition, config);
      if (!peopleId) throw notFound("This scanner's people list no longer exists.");
      let id;
      if (code) id = await recordForCode(viewer.context, viewer.definition, peopleId, code, { workspace });
      else if (await inList(viewer, peopleId, personId)) id = personId.toLowerCase();
      else throw notFound("That person isn't on the list.");
      const context = await contextFor(viewer, config, { contextId, recordId });
      return { person: await label(viewer, id), contextId: context, already: await existing(viewer, config, id, context) };
    },

    // Values for a new attendance record: who, for what, and when.
    values(viewer, config, { personId, contextId }) {
      return {
        [config.personField]: [{ kind: "record", id: personId }],
        ...(config.contextField && contextId ? { [config.contextField]: [{ kind: "record", id: contextId }] } : {}),
        ...(config.timeField && liveFields(viewer.definition, config.objectId).some((field) => field.id === config.timeField) ? { [config.timeField]: new Date().toISOString() } : {}),
      };
    },
  };
}

export const scanner = createScanner();
