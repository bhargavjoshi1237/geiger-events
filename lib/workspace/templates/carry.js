import { documentService } from "../documents/service.js";
import { documentStore } from "../documents/store.js";
import { portalStaff } from "../portal/staff.js";
import { portalStore } from "../portal/store.js";
import { processService } from "../process/service.js";
import { processStore } from "../process/store.js";
import { installExtras, installMaps } from "./installer.js";
import { definitionTokens, tokenizeIds } from "./refs.js";

// Carry-over beyond lists and fields: stage rules, automations, review setups, documents and the portal draft travel
// with "Save as template" and "Copy from another event", as references that are resolved in the new workspace.
export const services = {
  process: processService, documents: documentService, portal: portalStaff, processStore, documentStore, portalStore,
};

const quietly = (promise, fallback) => promise.catch(() => fallback);

// Extras of one event, limited to the lists being copied (objectIds); every id becomes a reference.
export async function collectExtras(context, definition, objectIds = null) {
  const lists = objectIds ? new Set(objectIds) : new Set(definition.objects.filter((object) => !object.deletedAt).map((object) => object.id));
  const tokens = definitionTokens(definition, { objectIds: lists });
  const [processes, automations, setups, documents, portal, roles, pages] = await Promise.all([
    quietly(processStore.processes(context), new Map()), quietly(processStore.automations(context), []), quietly(processStore.reviewSetups(context), []),
    quietly(documentStore.documents(context), []), quietly(portalStore.portal(context), null), quietly(portalStore.roles(context), []), quietly(portalStore.pages(context), []),
  ]);
  for (const role of roles) tokens.set(role.id, `#role:${role.key}`);
  for (const document of documents) tokens.set(document.id, `#doc:${document.name}`);
  for (const setup of setups) tokens.set(setup.id, `#review:${setup.name}`);
  const portable = (value) => tokenizeIds(value, tokens);
  const inLists = (objectId) => !objectId || lists.has(objectId);
  return {
    processes: [...processes.entries()].filter(([objectId]) => lists.has(objectId))
      .map(([objectId, config]) => ({ list: tokens.get(objectId), config: portable({ enforce: config.enforce === true, moves: config.moves ?? [], requires: config.requires ?? {} }) })),
    reviewSetups: setups.filter((setup) => lists.has(setup.config?.submissionsObjectId)).map((setup) => ({ name: setup.name, config: portable(setup.config) })),
    documents: documents.filter((document) => inLists(document.objectId))
      .map((document) => ({ kind: document.kind, name: document.name, objectId: document.objectId ? tokens.get(document.objectId) : null, config: portable(document.config) })),
    automations: automations.filter((automation) => inLists(automation.trigger?.objectId))
      .map((automation) => ({ name: automation.name, description: automation.description ?? "", trigger: portable(automation.trigger), condition: portable(automation.condition ?? null), steps: portable(automation.steps) })),
    portal: portal && lists.has(portal.peopleObjectId) ? {
      patch: portable({ enabled: portal.enabled, peopleObjectId: portal.peopleObjectId, emailFieldId: portal.emailFieldId, nameFieldId: portal.nameFieldId,
        signupEnabled: portal.signupEnabled, settings: { welcome: portal.settings?.welcome ?? "", contact: portal.settings?.contact ?? "" } }),
      roles: roles.filter((role) => !role.deletedAt).map((role) => ({
        ref: role.key, name: role.name, icon: role.icon, color: role.color, ...(role.builtin ? { builtin: true } : { membership: portable(role.membership) }), access: portable(role.access),
      })),
      pages: pages.filter((page) => !page.deletedAt && inLists(page.objectId))
        .map((page) => portable({ slug: page.slug, title: page.title, icon: page.icon, kind: page.kind, ...(page.objectId ? { objectId: page.objectId } : {}), layout: page.layout, audience: page.audience, body: page.body })),
    } : null,
  };
}

export const hasExtras = (extras) => Boolean(extras && (extras.processes?.length || extras.reviewSetups?.length || extras.documents?.length
  || extras.automations?.length || extras.portal));

// One sentence for the copy plan about what comes along besides lists.
export function extrasSentence(extras) {
  if (!hasExtras(extras)) return null;
  const parts = [];
  const count = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
  if (extras.processes?.length) parts.push(`stage rules for ${count(extras.processes.length, "list")}`);
  if (extras.automations?.length) parts.push(`${count(extras.automations.length, "automation")} (they arrive turned off)`);
  if (extras.reviewSetups?.length) parts.push(count(extras.reviewSetups.length, "review setup"));
  if (extras.documents?.length) parts.push(count(extras.documents.length, "document"));
  if (extras.portal) parts.push(`the portal draft (${count(extras.portal.roles?.length ?? 0, "role")}, ${count(extras.portal.pages?.length ?? 0, "page")})`);
  return `Also coming along: ${parts.join(", ")}. Anything that refers to a list that isn't copied is left out.`;
}

// Installs extras after the copy service created the lists; `keys` = { objectIds, fieldIds } from it.
export async function installCarried(context, extras, keys) {
  if (!hasExtras(extras)) return { counts: {}, notes: [] };
  return installExtras(context, extras, installMaps(keys, context.principal.id), services);
}
