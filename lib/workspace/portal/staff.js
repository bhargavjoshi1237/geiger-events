import { createHash, randomUUID } from "node:crypto";
import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { workspaceStore } from "../server/store.js";
import { workspaceService } from "../server/service.js";
import { resolveTheme } from "../../events/theme.js";
import { portalAuth } from "./auth.js";
import { BUILTIN_ROLES } from "./contracts.js";
import { validatePageInput } from "./pages.js";
import { listPlan } from "./plans.js";
import { canView } from "./policy.js";
import { clientPage, defaultRecordPage } from "./read.js";
import { diffSnapshots, draftSnapshot, publishWarnings } from "./publish.js";
import { validateRoleInput } from "./roles.js";
import { compileRule, DRY_TOKENS, resolveTokens } from "./rules.js";
import { portalService as defaultService } from "./service.js";
import { portalStore } from "./store.js";
import { viewers as defaultViewers } from "./viewer.js";

const bad = (message) => { throw new WorkspaceError("invalid_input", 422, message); };
const hash = (body) => createHash("sha256").update(JSON.stringify(body)).digest("hex");
const EMAIL = /^[^\s@<>"]{1,200}@[^\s@<>"]{1,100}\.[^\s@<>"]{2,40}$/;
const ids = (value, max) => {
  if (!Array.isArray(value) || !value.length || value.length > max || value.some((id) => !UUID.test(id ?? ""))) bad("Choose items to reorder.");
  return [...new Set(value.map((id) => id.toLowerCase()))];
};

export function brandColor(eventRow) {
  try {
    const design = eventRow?.metadata?.pageDesign;
    return resolveTheme(design).colors?.brand ?? null;
  } catch {
    return null;
  }
}

// The builder in the dashboard: portal settings, roles, pages, publishing, previews, team pages and invites.
export function createPortalStaff({ store = portalStore, workspace = workspaceStore, viewers = defaultViewers, auth = portalAuth, service = defaultService, records = workspaceService } = {}) {
  const config = (context, action, payload, commandId) => store.config(context, {
    action, commandId: UUID.test(commandId ?? "") ? commandId : randomUUID(), requestHash: hash({ action, ...payload }), ...payload,
  });

  async function draftState(context) {
    const [portal, roles, pages, definition] = await Promise.all([store.portal(context), store.roles(context), store.pages(context), workspace.definition(context)]);
    return { portal, roles, pages, definition };
  }

  function validatePortalPatch(patch, { definition, portal }) {
    if (!isObject(patch)) bad("Nothing to change.");
    const out = {};
    if ("enabled" in patch) out.enabled = patch.enabled === true;
    if ("signupEnabled" in patch) out.signupEnabled = patch.signupEnabled === true;
    const peopleId = "peopleObjectId" in patch ? patch.peopleObjectId : portal?.peopleObjectId ?? null;
    if ("peopleObjectId" in patch) {
      if (peopleId !== null && !definition.objects.some((object) => object.id === peopleId && !object.deletedAt)) bad("Choose a list.");
      out.peopleObjectId = peopleId;
      if (!("emailFieldId" in patch)) {
        const email = liveFields(definition, peopleId).find((field) => field.type === "email");
        out.emailFieldId = email?.id ?? null;
      }
      if (!("nameFieldId" in patch)) out.nameFieldId = definition.objects.find((object) => object.id === peopleId)?.titleFieldId ?? null;
    }
    for (const key of ["emailFieldId", "nameFieldId"]) {
      if (!(key in patch)) continue;
      if (patch[key] !== null && !liveFields(definition, peopleId).some((field) => field.id === patch[key])) bad("Choose a field from the people list.");
      out[key] = patch[key];
    }
    if ("settings" in patch) {
      if (!isObject(patch.settings)) bad("Invalid settings.");
      const welcome = typeof patch.settings.welcome === "string" ? patch.settings.welcome.trim().slice(0, 2000) : "";
      const contact = typeof patch.settings.contact === "string" ? patch.settings.contact.trim().toLowerCase() : "";
      if (contact && !EMAIL.test(contact)) bad("Enter a valid contact email.");
      out.settings = { ...(portal?.settings ?? {}), welcome, contact };
    }
    return out;
  }

  const handlers = {
    async "portal.update"(context, body, state) {
      return config(context, "portal.update", { patch: validatePortalPatch(body.patch, state), ...(Number.isInteger(body.expectedRevision) ? { expectedRevision: body.expectedRevision } : {}) }, body.commandId);
    },
    async "role.save"(context, body, state) {
      const roleId = UUID.test(body.role?.id ?? "") && state.roles.some((role) => role.id === body.role.id) ? body.role.id : null;
      const role = validateRoleInput(body.role ?? {}, { definition: state.definition, portal: state.portal, roles: state.roles, roleId });
      return config(context, "role.save", { role: { ...(roleId ? { id: roleId } : {}), ...role }, ...(Number.isInteger(body.expectedRevision) ? { expectedRevision: body.expectedRevision } : {}) }, body.commandId);
    },
    async "role.delete"(context, body) {
      if (!UUID.test(body.roleId ?? "")) bad("Choose a role.");
      return config(context, "role.delete", { roleId: body.roleId }, body.commandId);
    },
    async "role.restore"(context, body) {
      if (!UUID.test(body.roleId ?? "")) bad("Choose a role.");
      return config(context, "role.restore", { roleId: body.roleId }, body.commandId);
    },
    async "role.reorder"(context, body) {
      return config(context, "role.reorder", { order: ids(body.order, 40) }, body.commandId);
    },
    async "page.save"(context, body, state) {
      const pageId = UUID.test(body.page?.id ?? "") && state.pages.some((page) => page.id === body.page.id) ? body.page.id : null;
      const page = validatePageInput(body.page ?? {}, { definition: state.definition, roles: state.roles, pages: state.pages, pageId });
      return config(context, "page.save", { page: { ...(pageId ? { id: pageId } : {}), ...page }, ...(Number.isInteger(body.expectedRevision) ? { expectedRevision: body.expectedRevision } : {}) }, body.commandId);
    },
    async "page.delete"(context, body) {
      if (!UUID.test(body.pageId ?? "")) bad("Choose a page.");
      return config(context, "page.delete", { pageId: body.pageId }, body.commandId);
    },
    async "page.restore"(context, body) {
      if (!UUID.test(body.pageId ?? "")) bad("Choose a page.");
      return config(context, "page.restore", { pageId: body.pageId }, body.commandId);
    },
    async "page.reorder"(context, body) {
      return config(context, "page.reorder", { order: ids(body.order, 80) }, body.commandId);
    },
    async "portal.publish"(context, body, state) {
      const errors = publishWarnings(draftSnapshot(state), state.definition).filter((item) => item.level === "error");
      if (errors.length && body.confirm !== true) throw new WorkspaceError("confirm_required", 409, errors[0].text, { errors: errors.map((item) => item.text) });
      const note = typeof body.note === "string" ? body.note.trim().slice(0, 200) : "";
      return config(context, "portal.publish", { note }, body.commandId);
    },
    async "portal.restore_version"(context, body) {
      if (!UUID.test(body.versionId ?? "")) bad("Choose a version.");
      return config(context, "portal.restore_version", { versionId: body.versionId }, body.commandId);
    },
  };

  async function asViewer(context, as) {
    if (as?.mode === "preview") {
      const roleIds = Array.isArray(as.roleIds) ? as.roleIds.filter((id) => UUID.test(id ?? "")) : [];
      return viewers.preview(context, { roleIds, personId: UUID.test(as.personId ?? "") ? as.personId : null });
    }
    return viewers.team(context, { draft: as?.draft === true });
  }

  // Everyone in the people list with their email, name, invite state and last sign-in.
  async function people(context, state) {
    const { portal, definition } = state;
    if (!portal?.peopleObjectId || !definition.objects.some((object) => object.id === portal.peopleObjectId && !object.deletedAt)) return [];
    const rows = [];
    for await (const page of workspace.recordPages(context, portal.peopleObjectId)) {
      rows.push(...page);
      if (rows.length >= 2000) break;
    }
    const [invites, signIns] = await Promise.all([store.invites(context), store.signIns(context)]);
    const lastInvite = new Map();
    for (const row of invites) if (!lastInvite.has(row.email)) lastInvite.set(row.email, row);
    const lastSignIn = new Map();
    for (const row of signIns) if (!lastSignIn.has(row.email)) lastSignIn.set(row.email, row.used_at);
    return rows.map((row) => {
      const email = typeof row.values?.[portal.emailFieldId] === "string" ? row.values[portal.emailFieldId].toLowerCase() : null;
      const invite = email ? lastInvite.get(email) : null;
      return {
        id: row.id, number: row.number, name: (portal.nameFieldId && row.values?.[portal.nameFieldId]) || row.title, email,
        invite: invite ? { id: invite.id, sentAt: invite.created_at, state: invite.revoked_at ? "revoked" : invite.used_at ? "accepted" : Date.parse(invite.expires_at) < Date.now() ? "expired" : "sent" } : null,
        lastSignIn: email ? lastSignIn.get(email) ?? null : null,
      };
    });
  }

  // Ids of people a role's rule matches (for invites to a role and the "N people match" line).
  async function roleMembers(context, state, membership) {
    const { portal, definition } = state;
    if (!portal?.peopleObjectId) return { ids: [], total: 0 };
    const condition = compileRule(definition, portal.peopleObjectId, resolveTokens(membership, DRY_TOKENS));
    const out = [];
    let total = 0;
    for (let offset = 0; offset < 2000; offset += 200) {
      const plan = { ...compileQuery(definition, portal.peopleObjectId, { limit: 200, offset }), policy: condition };
      const page = await workspace.query(context, plan);
      total = Number(page.total);
      out.push(...page.rows.map((row) => row.id));
      if (out.length >= total || !page.rows.length) break;
    }
    return { ids: out, total };
  }

  return {
    async state(context) {
      const state = await draftState(context);
      const [versions, published] = await Promise.all([store.versions(context), state.portal?.publishedVersionId ? store.version(context, state.portal.publishedVersionId) : null]);
      const names = new Map((await workspace.people(context, [...new Set(versions.map((row) => row.published_by))])).map((row) => [row.user_id, row.name || row.email]));
      const draft = draftSnapshot({ portal: state.portal ?? {}, roles: state.roles, pages: state.pages });
      return {
        portal: state.portal ?? { enabled: false, peopleObjectId: null, emailFieldId: null, nameFieldId: null, signupEnabled: false, settings: {}, publishedVersionId: null, revision: 0 },
        roles: state.roles,
        pages: state.pages,
        versions: versions.map((row) => ({ id: row.id, number: row.number, note: row.note, publishedAt: row.published_at, publishedBy: names.get(row.published_by) ?? "Someone" })),
        published: published ? { id: published.id, number: published.number, publishedAt: published.published_at } : null,
        changes: diffSnapshots(published?.snapshot ?? null, draft, state.definition),
        warnings: publishWarnings(draft, state.definition),
      };
    },

    async command(context, body) {
      if (!isObject(body) || !Object.hasOwn(handlers, body.action)) bad("Unknown action.");
      return handlers[body.action](context, body, await draftState(context));
    },

    // A page as a role/person would see it (draft) or as the team sees it (published team page).
    async page(context, { pageId, as }) {
      const viewer = await asViewer(context, as);
      const page = viewer.snapshot.pages.find((item) => item.id === pageId);
      if (!page) throw new WorkspaceError("not_found", 404, "That page no longer exists.");
      return { page: clientPage(page), lists: service.listsFor(viewer, [page]), open: service.isOpen(viewer, page), session: service.session(viewer) };
    },

    async record(context, { objectKey, number, as }) {
      const viewer = await asViewer(context, as);
      return service.recordPage(viewer, objectKey, number);
    },

    async defaultRecordPage(context, objectId) {
      const definition = await workspace.definition(context);
      const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
      if (!object) throw new WorkspaceError("not_found", 404, "That list no longer exists.");
      return clientPage(defaultRecordPage(object));
    },

    async blockData(context, { pageId, blockId, params, recordId, as }) {
      return service.blockData(await asViewer(context, as), { pageId, blockId, params, recordId });
    },

    // Attendance from a scanner on a team page, written as the signed-in staff member.
    async scan(context, body) {
      const viewer = await viewers.team(context, { draft: body.draft === true });
      const page = service.pageById(viewer, body.pageId);
      const block = (page.body?.blocks ?? []).find((item) => item.id === body.blockId && item.kind === "scanner");
      if (!block) throw new WorkspaceError("not_found", 404, "That scanner no longer exists.");
      const recordId = page.kind === "record" && UUID.test(body.recordId ?? "") ? body.recordId.toLowerCase() : null;
      const checked = await service.scanner.check(viewer, block.config, { code: body.code ?? null, personId: body.personId ?? null, contextId: body.contextId ?? null, recordId });
      if (checked.already) return { ...checked, marked: false };
      const values = service.scanner.values(viewer, block.config, { personId: checked.person.id, contextId: checked.contextId });
      const { result } = await records.runCommand(context, { action: "record.create", objectId: block.config.objectId, values });
      return { ...checked, marked: true, at: result?.record?.createdAt ?? new Date().toISOString() };
    },

    // "Can see N of M" for one list, as a role or person would.
    async reach(context, { objectId, as }) {
      const viewer = await asViewer(context, { ...as, mode: "preview" });
      const objectPolicy = viewer.objectPolicy(objectId);
      const all = await workspace.query(context, compileQuery(viewer.definition, objectId, { limit: 1 }));
      if (!objectPolicy || !canView(objectPolicy)) return { visible: 0, total: Number(all.total) };
      const block = { kind: "table", config: { source: { objectId, filter: null, sort: [] }, search: false, filters: [], pageSize: 1 } };
      const { plan } = listPlan(block, { definition: viewer.definition, objectPolicy, tokens: viewer.tokens });
      return { visible: Number((await workspace.query(context, plan)).total), total: Number(all.total) };
    },

    async roleMatches(context, { membership }) {
      const state = await draftState(context);
      if (!membership) return { total: 0 };
      try {
        return { total: (await roleMembers(context, state, membership)).total };
      } catch (error) {
        if (error instanceof WorkspaceError) return { total: 0, error: error.message };
        throw error;
      }
    },

    async people(context) {
      return { people: await people(context, await draftState(context)) };
    },

    async invite(context, { recordIds, roleId, staffId, baseUrl }) {
      const state = await draftState(context);
      if (!state.portal?.enabled) bad("Turn the portal on before inviting people.");
      let wanted = Array.isArray(recordIds) ? recordIds.filter((id) => UUID.test(id ?? "")) : [];
      if (roleId) {
        const role = state.roles.find((item) => item.id === roleId && !item.deletedAt);
        if (!role) bad("Choose a role.");
        if (role.key === BUILTIN_ROLES.public) bad("Choose a role people sign in with.");
        wanted = role.membership ? (await roleMembers(context, state, role.membership)).ids : role.key === BUILTIN_ROLES.signedIn ? null : [];
      }
      const everyone = await people(context, state);
      const chosen = wanted === null ? everyone : everyone.filter((person) => wanted.includes(person.id));
      if (!chosen.length) bad("Nobody to invite. Check that they have an email address.");
      if (chosen.length > 500) bad("Invite up to 500 people at a time.");
      const event = await viewers.eventOf(context.eventId);
      return auth.invite({
        context, event, brand: brandColor(event.row), welcome: state.portal.settings?.welcome ?? "", staffId,
        linkFor: (token) => `${baseUrl}/e/${context.eventId}/workspace/invite?token=${encodeURIComponent(token)}`,
      }, chosen.map((person) => ({ email: person.email, name: person.name })));
    },

    async revokeInvite(context, { inviteId }) {
      if (!UUID.test(inviteId ?? "")) bad("Choose an invite.");
      return auth.revokeInvite(context, inviteId);
    },

    // People to pick from for "Preview as".
    async previewPeople(context, { q }) {
      const state = await draftState(context);
      if (!state.portal?.peopleObjectId) return { items: [] };
      const plan = compileQuery(state.definition, state.portal.peopleObjectId, { search: typeof q === "string" && q.trim() ? q.trim().slice(0, 100) : undefined, limit: 20 });
      const page = await workspace.query(context, plan);
      return { items: page.rows.map((row) => ({ id: row.id, label: row.title, email: state.portal.emailFieldId ? row.values?.[state.portal.emailFieldId] ?? null : null })) };
    },
  };
}

export const portalStaff = createPortalStaff();
