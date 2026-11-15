import { UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { workspaceStore } from "../server/store.js";
import { BUILTIN_ROLES, NIL_UUID } from "./contracts.js";
import { compilePolicy, matchedRoles, staffObjectPolicy } from "./policy.js";
import { draftSnapshot } from "./publish.js";
import { compileRule, resolveTokens } from "./rules.js";
import { portalStore } from "./store.js";
import { processStore } from "../process/store.js";

export function todayIn(timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

const closed = () => new WorkspaceError("portal_closed", 404, "This portal isn't open.");
// Stage rules per list; an empty map until the process tables exist.
const loadProcesses = (context) => processStore.processes(context).catch(() => new Map());

export function createViewers({ store = portalStore, workspace = workspaceStore } = {}) {
  async function eventOf(eventId) {
    if (!UUID.test(eventId ?? "")) throw new WorkspaceError("not_found", 404, "This portal doesn't exist.");
    const row = await store.eventRow(eventId.toLowerCase());
    if (!row) throw new WorkspaceError("not_found", 404, "This portal doesn't exist.");
    return { id: row.id, projectId: row.project_id, name: row.name ?? "", timeZone: row.timezone || "UTC", venueId: row.venue_id ?? null, row };
  }

  // The viewer's people-list record (matched by email) and, in the same query, which custom roles' rules it meets.
  async function personFor(context, definition, settings, roles, { email = null, recordId = null, tokens }) {
    const peopleId = settings?.peopleObjectId;
    if (!peopleId || !definition.objects.some((object) => object.id === peopleId && !object.deletedAt)) return { person: null, flags: {} };
    if (email && !liveFields(definition, peopleId).some((field) => field.id === settings.emailFieldId)) return { person: null, flags: {} };
    const custom = roles.filter((role) => !role.builtin && role.membership);
    const parts = [];
    for (const role of custom) {
      try {
        parts.push({ alias: `p${parts.length}`, roleId: role.id, condition: compileRule(definition, peopleId, resolveTokens(role.membership, tokens)) });
      } catch {
        // A rule that refers to a deleted field matches nobody until the organiser fixes it.
      }
      if (parts.length >= 30) break;
    }
    const filter = email
      ? { op: "and", items: [{ field: settings.emailFieldId, operator: "eq", value: email }] }
      : null;
    const plan = compileQuery(definition, peopleId, { filter: filter ?? undefined, limit: 1 });
    if (recordId) plan.policy = { source: "system", column: "id", cast: "text", operator: "eq", value: recordId };
    plan.policyParts = parts.map(({ alias, condition }) => ({ alias, condition }));
    const row = (await workspace.query(context, plan)).rows[0];
    if (!row) return { person: null, flags: {} };
    const flags = Object.fromEntries(parts.map((part) => [part.roleId, row.policy?.[part.alias] === true]));
    const nameField = settings.nameFieldId;
    return {
      person: { id: row.id, objectId: peopleId, number: Number(row.number), title: row.title, name: (nameField && row.values?.[nameField]) || row.title, email: settings.emailFieldId ? row.values?.[settings.emailFieldId] ?? null : null },
      flags,
    };
  }

  function finish({ mode, context, event, settings, snapshot, definition, member, person, flags, processes }) {
    const tokens = { personId: person?.id ?? null, memberId: member?.id ?? null, email: member?.email ?? person?.email ?? null, today: todayIn(event.timeZone) };
    const roles = matchedRoles(snapshot.roles, { person, flags });
    const policy = compilePolicy({ definition, roles, tokens });
    return {
      mode, context, event, settings, snapshot, definition, member, person, roles, tokens, policy, processes: processes ?? new Map(),
      roleIds: roles.map((role) => role.id),
      publicRoleId: snapshot.roles.find((role) => role.key === BUILTIN_ROLES.public)?.id ?? null,
      objectPolicy: (objectId) => policy.objects[objectId] ?? null,
    };
  }

  return {
    eventOf,

    // An outside person (or anonymous visitor) on the published portal.
    async portal(eventId, member) {
      const event = await eventOf(eventId);
      const context = { projectId: event.projectId, eventId: event.id, principal: { kind: "portal", id: member?.id ?? NIL_UUID } };
      const live = await store.portal(context);
      if (!live?.enabled || !live.publishedVersionId) throw closed();
      const version = await store.version(context, live.publishedVersionId);
      if (!version) throw closed();
      const snapshot = version.snapshot;
      const settings = snapshot.portal ?? {};
      const [definition, processes] = await Promise.all([workspace.definition(context), loadProcesses(context)]);
      const email = member?.email ? String(member.email).toLowerCase() : null;
      const base = { personId: null, memberId: member?.id ?? null, email, today: todayIn(event.timeZone) };
      const { person, flags } = email ? await personFor(context, definition, settings, snapshot.roles, { email, tokens: base }) : { person: null, flags: {} };
      return finish({ mode: "portal", context, event, settings, snapshot, definition, member: member ? { ...member, email } : null, person, flags, processes });
    },

    // Staff previewing the draft as a role or as one person from the people list. Read-only.
    async preview(staffContext, { roleIds = [], personId = null } = {}) {
      const event = await eventOf(staffContext.eventId);
      const context = { ...staffContext };
      const [live, roles, pages, definition, processes] = await Promise.all([store.portal(context), store.roles(context), store.pages(context),
        workspace.definition(context), loadProcesses(context)]);
      const snapshot = draftSnapshot({ portal: live ?? {}, roles, pages });
      const settings = snapshot.portal ?? {};
      if (personId) {
        const tokens = { personId, memberId: NIL_UUID, email: null, today: todayIn(event.timeZone) };
        const { person, flags } = await personFor(context, definition, settings, snapshot.roles, { recordId: personId, tokens });
        if (!person) throw new WorkspaceError("not_found", 404, "That person isn't in the people list.");
        return finish({ mode: "preview", context, event, settings, snapshot, definition, member: { id: NIL_UUID, email: person.email }, person, flags, processes });
      }
      const chosen = new Set(roleIds);
      const flags = Object.fromEntries(snapshot.roles.map((role) => [role.id, chosen.has(role.id)]));
      const person = chosen.size && [...chosen].some((id) => snapshot.roles.find((role) => role.id === id)?.key !== BUILTIN_ROLES.public)
        ? { id: NIL_UUID, objectId: settings.peopleObjectId, number: 0, title: "Preview person", name: "Preview person", email: null } : null;
      const roleList = snapshot.roles.map((role) => (role.builtin ? role : { ...role, membership: role.membership ?? { op: "and", items: [] } }));
      return finish({ mode: "preview", context, event, settings, snapshot: { ...snapshot, roles: roleList }, definition, member: null, person, flags, processes });
    },

    // The team in the dashboard: published team pages with full access.
    async team(staffContext, { draft = false } = {}) {
      const event = await eventOf(staffContext.eventId);
      const context = { ...staffContext };
      const [live, definition, processes] = await Promise.all([store.portal(context), workspace.definition(context), loadProcesses(context)]);
      let snapshot;
      if (draft || !live?.publishedVersionId) {
        const [roles, pages] = await Promise.all([store.roles(context), store.pages(context)]);
        snapshot = draftSnapshot({ portal: live ?? {}, roles, pages });
      } else {
        snapshot = (await store.version(context, live.publishedVersionId))?.snapshot ?? { portal: {}, roles: [], pages: [] };
      }
      const cache = new Map();
      return {
        mode: "team", staff: true, context, event, settings: snapshot.portal ?? {}, snapshot, definition, processes, member: null, person: null, roles: [], roleIds: [],
        publicRoleId: null, tokens: { personId: null, memberId: null, email: null, today: todayIn(event.timeZone) },
        objectPolicy: (objectId) => {
          if (!definition.objects.some((object) => object.id === objectId && !object.deletedAt)) return null;
          if (!cache.has(objectId)) cache.set(objectId, staffObjectPolicy(definition, objectId));
          return cache.get(objectId);
        },
      };
    },
  };
}

export const viewers = createViewers();
