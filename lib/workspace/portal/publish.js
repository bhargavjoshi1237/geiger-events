import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { BLOCK_KINDS } from "./blocks.js";
import { BUILTIN_ROLES } from "./contracts.js";

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const strip = (item) => {
  const { revision: _r, deletedAt: _d, position: _p, ...rest } = item ?? {};
  return rest;
};

// The draft in the same shape the database freezes on publish.
export function draftSnapshot({ portal, roles, pages }) {
  const live = (list) => list.filter((item) => !item.deletedAt).sort((a, b) => a.position - b.position);
  const { publishedVersionId: _v, revision: _r, ...settings } = portal ?? {};
  return { portal: settings, roles: live(roles).map(strip), pages: live(pages).map(strip) };
}

// What changed between the published version and the draft, in words an organiser recognises.
export function diffSnapshots(before, after, definition) {
  const changes = [];
  const objectName = (id) => definition.objects.find((object) => object.id === id)?.plural ?? "a removed list";
  const prev = before ?? { portal: {}, roles: [], pages: [] };
  const portalLabels = { enabled: "Portal on/off", peopleObjectId: "People list", emailFieldId: "Email field", nameFieldId: "Name field", signupEnabled: "Self sign-up", settings: "Welcome and contact details" };
  for (const [key, label] of Object.entries(portalLabels)) {
    if (!same(prev.portal?.[key], after.portal?.[key])) changes.push({ kind: "portal", label });
  }
  const byId = (list) => new Map((list ?? []).map((item) => [item.id, strip(item)]));
  const oldPages = byId(prev.pages);
  const newPages = byId(after.pages);
  for (const [id, page] of newPages) {
    const old = oldPages.get(id);
    if (!old) { changes.push({ kind: "page", label: `Page “${page.title}” added` }); continue; }
    if (old.title !== page.title) changes.push({ kind: "page", label: `Page “${old.title}” renamed to “${page.title}”` });
    if (old.slug !== page.slug) changes.push({ kind: "page", label: `Page “${page.title}” moved to /${page.slug}` });
    if (!same(old.audience, page.audience)) changes.push({ kind: "page", label: `Page “${page.title}”: who sees it changed` });
    if (old.layout !== page.layout) changes.push({ kind: "page", label: `Page “${page.title}” switched to ${page.layout === "canvas" ? "canvas" : "blocks"} layout` });
    const oldBlocks = new Map((old.body?.blocks ?? []).map((block) => [block.id, block]));
    const newBlocks = new Map((page.body?.blocks ?? []).map((block) => [block.id, block]));
    const added = [...newBlocks.keys()].filter((key) => !oldBlocks.has(key)).length;
    const removed = [...oldBlocks.keys()].filter((key) => !newBlocks.has(key)).length;
    const edited = [...newBlocks.entries()].filter(([key, block]) => oldBlocks.has(key) && !same(oldBlocks.get(key).config, block.config)).length;
    const moved = [...newBlocks.entries()].filter(([key, block]) => oldBlocks.has(key) && (!same(oldBlocks.get(key).at, block.at) || !same(oldBlocks.get(key).grid, block.grid))).length;
    const parts = [added && `${added} block${added === 1 ? "" : "s"} added`, removed && `${removed} removed`, edited && `${edited} changed`, moved && !added && !removed && "blocks rearranged"].filter(Boolean);
    if (parts.length) changes.push({ kind: "page", label: `Page “${page.title}”: ${parts.join(", ")}` });
  }
  for (const [id, page] of oldPages) if (!newPages.has(id)) changes.push({ kind: "page", label: `Page “${page.title}” removed` });

  const oldRoles = byId(prev.roles);
  const newRoles = byId(after.roles);
  for (const [id, role] of newRoles) {
    const old = oldRoles.get(id);
    if (!old) { changes.push({ kind: "role", label: `Role “${role.name}” added` }); continue; }
    if (old.name !== role.name) changes.push({ kind: "role", label: `Role “${old.name}” renamed to “${role.name}”` });
    if (!same(old.membership, role.membership)) changes.push({ kind: "role", label: `Role “${role.name}”: who has it changed` });
    const lists = new Set([...Object.keys(old.access ?? {}), ...Object.keys(role.access ?? {})]);
    for (const objectId of lists) {
      const a = old.access?.[objectId] ?? {};
      const b = role.access?.[objectId] ?? {};
      if (same(a, b)) continue;
      const actions = ["view", "create", "edit", "delete"].filter((key) => !same(a[key], b[key]));
      const fieldsChanged = !same(a.fields, b.fields);
      const what = [actions.length && `can ${actions.join("/")} changed`, fieldsChanged && "field visibility changed", (a.comment !== b.comment || a.status !== b.status) && "comments/status changed"].filter(Boolean);
      changes.push({ kind: "role", label: `Role “${role.name}” on ${objectName(objectId)}: ${what.join(", ") || "access changed"}` });
    }
  }
  for (const [id, role] of oldRoles) if (!newRoles.has(id)) changes.push({ kind: "role", label: `Role “${role.name}” removed` });
  return changes;
}

const blockLabel = (block) => block.config?.title || BLOCK_KINDS[block.kind]?.label || "Block";

// Things worth a second look before publishing. `level: "error"` means the portal would visibly fail.
export function publishWarnings(snapshot, definition) {
  const out = [];
  const { portal, roles, pages } = snapshot;
  const live = (id) => definition.objects.some((object) => object.id === id && !object.deletedAt);
  if (!portal?.enabled) out.push({ level: "info", text: "The portal is off. Publishing saves a version, but nobody outside the team can open it until you turn it on." });
  const contentPages = pages.filter((page) => page.kind === "page");
  if (portal?.enabled && !contentPages.some((page) => page.audience?.public || (page.audience?.roles ?? []).length)) {
    out.push({ level: "warning", text: "No page is open to anyone yet. Choose who sees each page." });
  }
  for (const role of roles.filter((item) => !item.builtin && !item.membership)) {
    out.push({ level: "warning", text: `Nobody has the role “${role.name}” yet. Add a rule for who has it.` });
  }
  for (const page of pages) {
    for (const block of page.body?.blocks ?? []) {
      const config = block.config ?? {};
      const objectIds = [config.source?.objectId, config.objectId, ...(config.tiles ?? []).map((tile) => tile.objectId)].filter(Boolean);
      if (objectIds.some((id) => !live(id))) {
        out.push({ level: "error", text: `“${blockLabel(block)}” on “${page.title}” uses a list that was deleted. Remove or change it.` });
        continue;
      }
      if (page.audience?.public && portal?.peopleObjectId && objectIds.includes(portal.peopleObjectId) && block.kind !== "form") {
        out.push({ level: "warning", text: `“${blockLabel(block)}” on the public page “${page.title}” shows the people list. Check that's intended.` });
      }
      if (block.kind === "form" && config.mode === "create") {
        const fields = liveFields(definition, config.objectId);
        const covered = new Set([...(config.sections ?? []).flatMap((section) => section.fields.map((item) => item.fieldId)), ...(config.defaults ?? []).map((item) => item.fieldId)]);
        for (const field of fields.filter((item) => item.required && getType(item.type).editable && !covered.has(item.id))) {
          out.push({ level: "error", text: `The form “${blockLabel(block)}” leaves out ${field.name}, which is required, so every submission would fail.` });
        }
        const canCreate = roles.some((role) => role.access?.[config.objectId]?.create?.mode === "all"
          && (page.audience?.public || (page.audience?.roles ?? []).includes(role.id) || role.key === BUILTIN_ROLES.signedIn));
        if (!canCreate) out.push({ level: "warning", text: `Nobody who sees “${page.title}” may add ${definition.objects.find((object) => object.id === config.objectId)?.plural ?? "records"}, so the form “${blockLabel(block)}” can't be sent.` });
      }
    }
  }
  return out;
}
