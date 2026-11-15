import { UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { attachLinks } from "../links/resolve.js";
import { labelLookups } from "../records/lookups.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { workspaceStore } from "../server/store.js";
import { cleanProcess } from "../process/stages.js";
import { BUILTIN_ROLES } from "./contracts.js";
import { navigationFor, pageOpenTo } from "./pages.js";
import { chartPlan, listPlan, statPlans, visibleIdsPlan } from "./plans.js";
import { canView, readPlan, rowAccess } from "./policy.js";
import { and } from "./rules.js";
import { portalStore } from "./store.js";
import { linkTargets, publicFields, shapeRecord } from "./strip.js";
import { scanner as defaultScanner, scannerLists } from "../components/scan.js";
import { signPass } from "../components/pass.js";

const notFound = (message = "This page doesn't exist or isn't open to you.") => new WorkspaceError("not_found", 404, message);
const LIST_BLOCKS = new Set(["table", "cards", "board", "calendar", "schedule", "timeline", "placement"]);

// Settings a block needs in the browser; rules, automatic values and filters stay on the server.
export function clientBlock(block) {
  const { source, defaults: _defaults, tiles, filter: _filter, signup, placesFilter: _places, ...rest } = block.config ?? {};
  return {
    id: block.id, kind: block.kind, at: block.at, grid: block.grid,
    config: {
      ...rest,
      ...(source ? { source: { objectId: source.objectId } } : {}),
      ...(tiles ? { tiles: tiles.map(({ filter: _f, part: _p, ...tile }) => tile) } : {}),
      ...(signup ? { signup: { enabled: signup.enabled === true, objectId: signup.objectId, personFields: signup.personFields ?? [] } } : {}),
    },
  };
}

export function clientPage(page) {
  return {
    id: page.id, slug: page.slug, title: page.title, icon: page.icon, kind: page.kind, objectId: page.objectId ?? null, layout: page.layout,
    body: { rows: page.body?.rows ?? [], blocks: (page.body?.blocks ?? []).map(clientBlock), ...(page.body?.header ? { header: page.body.header } : {}) },
  };
}

// The record page used when a list has none: every visible field, files and comments.
export function defaultRecordPage(object) {
  return {
    id: `default-${object.id}`, slug: `record-${object.key}`, title: object.name, icon: object.icon, kind: "record", objectId: object.id, layout: "blocks",
    audience: {}, position: 0,
    body: { rows: [{ id: "r_default", widths: [12] }], blocks: [{ id: "b_default", kind: "record", at: { row: "r_default", col: 0, order: 0 },
      config: { title: "", target: "page", objectId: object.id, sections: [], files: true, comments: true, activity: true, edit: true } }] },
  };
}

export function createPortalReads({ store = portalStore, workspace = workspaceStore, scanner = defaultScanner } = {}) {
  const liveObject = (viewer, id) => viewer.definition.objects.find((object) => object.id === id && !object.deletedAt) ?? null;

  function isOpen(viewer, page) {
    if (viewer.mode === "team") return page.kind === "record" || page.audience?.team === true;
    return pageOpenTo(page, { roleIds: viewer.roleIds, publicRoleId: viewer.publicRoleId });
  }

  function pageById(viewer, pageId) {
    const page = viewer.snapshot.pages.find((item) => item.id === pageId);
    if (!page || !isOpen(viewer, page)) throw notFound();
    return page;
  }

  function accessFor(objectPolicy, parts, flags) {
    if (objectPolicy.staff) return { levels: objectPolicy.levels.staff, editable: [], status: false, delete: false, comment: false };
    return rowAccess(objectPolicy, parts, flags);
  }

  async function visibleTargetIds(viewer, targets) {
    const out = new Set();
    for (const [objectId, ids] of targets) {
      const objectPolicy = viewer.objectPolicy(objectId);
      if (!objectPolicy || !canView(objectPolicy)) continue;
      if (objectPolicy.staff) { ids.forEach((id) => out.add(id)); continue; }
      const list = [...ids];
      for (let i = 0; i < list.length; i += 200) {
        const page = await workspace.query(viewer.context, visibleIdsPlan(viewer.definition, objectPolicy, objectId, list.slice(i, i + 200)));
        page.rows.forEach((row) => out.add(row.id));
      }
    }
    return out;
  }

  // Database rows → what this viewer may see of them (labels, links, per-row field visibility).
  async function shapeRows(viewer, objectId, objectPolicy, parts, rows) {
    if (!rows.length) return [];
    const base = labelLookups(viewer.definition, objectId, rows.map((row) => ({ ...row, number: Number(row.number), revision: Number(row.revision) })));
    const withLinks = await attachLinks(workspace, viewer.context, viewer.definition, base, { venueId: viewer.event.venueId });
    const accesses = withLinks.map((row) => accessFor(objectPolicy, parts, row.policy));
    const visibleFields = [...new Set(accesses.flatMap((access) => Object.entries(access.levels).filter(([, level]) => level !== "hidden").map(([id]) => id)))];
    const visibleTargets = await visibleTargetIds(viewer, linkTargets(viewer.definition, objectId, withLinks, visibleFields));
    return withLinks.map((row, index) => shapeRecord(row, { definition: viewer.definition, objectId, access: accesses[index], visibleTargets }));
  }

  // One record by id or number, only if the viewer may see it.
  async function findRecord(viewer, objectId, { id = null, number = null }) {
    const objectPolicy = viewer.objectPolicy(objectId);
    if (!objectPolicy || !canView(objectPolicy)) return null;
    const read = objectPolicy.staff ? { policy: null, policyParts: [], parts: [] } : readPlan(objectPolicy);
    const match = id ? { source: "system", column: "id", cast: "text", operator: "eq", value: id }
      : { source: "system", column: "number", cast: "numeric", operator: "eq", value: number };
    const plan = { ...compileQuery(viewer.definition, objectId, { limit: 1 }), policy: read.policy ? and(read.policy, match) : match, policyParts: read.policyParts };
    const row = (await workspace.query(viewer.context, plan)).rows[0];
    if (!row) return null;
    return (await shapeRows(viewer, objectId, objectPolicy, read.parts, [row]))[0];
  }

  // Allowed status moves for status pickers (null when the list has no enforced stage rules).
  function processFor(viewer, objectId) {
    const config = viewer.processes?.get?.(objectId);
    if (!config?.enforce) return null;
    const clean = cleanProcess(viewer.definition, objectId, config);
    return clean.enforce ? { enforce: true, moves: clean.moves } : null;
  }

  // Field definitions and list metadata the browser needs for the blocks on a page.
  function listsFor(viewer, pages, extraObjectIds = []) {
    const wanted = new Map();
    const add = (objectId, fieldIds = []) => {
      if (!objectId || !liveObject(viewer, objectId)) return;
      if (!wanted.has(objectId)) wanted.set(objectId, new Set());
      fieldIds.forEach((id) => wanted.get(objectId).add(id));
    };
    for (const page of pages) {
      if (page.objectId) add(page.objectId);
      for (const block of page.body?.blocks ?? []) {
        const config = block.config ?? {};
        add(config.source?.objectId);
        add(config.objectId, config.mode ? (config.sections ?? []).flatMap((section) => section.fields.map((item) => item.fieldId)) : []);
        (config.tiles ?? []).forEach((tile) => add(tile.objectId));
        if (block.kind === "placement" && config.linkField) add(liveFields(viewer.definition, config.source?.objectId ?? "").find((field) => field.id === config.linkField)?.config?.targetObjectId);
        if (block.kind === "scanner") { const lists = scannerLists(viewer.definition, config); add(lists.peopleId); add(lists.contextId); }
        if (config.signup?.enabled) add(config.signup.objectId, (config.signup.personFields ?? []).map((item) => item.fieldId));
      }
    }
    extraObjectIds.forEach((id) => add(id));
    const lists = {};
    for (const [objectId, formFields] of wanted) {
      const object = liveObject(viewer, objectId);
      const objectPolicy = viewer.objectPolicy(objectId);
      const visible = new Set([...(objectPolicy?.visible ?? []), ...formFields]);
      lists[objectId] = {
        id: object.id, key: object.key, name: object.name, plural: object.plural, icon: object.icon, numberPrefix: object.numberPrefix,
        titleFieldId: object.titleFieldId, statuses: object.statuses ?? [],
        fields: publicFields(viewer.definition, objectId, [...visible]),
        queryable: objectPolicy?.queryable ?? [],
        can: { view: canView(objectPolicy), create: Boolean(objectPolicy?.create?.length) },
        process: processFor(viewer, objectId),
      };
    }
    return lists;
  }

  async function personNames(viewer, rows) {
    const staffIds = [...new Set(rows.filter((row) => row.actor_kind !== "portal").map((row) => row.created_by))];
    const memberIds = [...new Set(rows.filter((row) => row.actor_kind === "portal").map((row) => row.created_by))];
    const [team, members] = await Promise.all([workspace.people(viewer.context, staffIds), store.membersByIds(memberIds)]);
    return {
      team: new Map(team.map((row) => [row.user_id, row.name || "Organiser"])),
      members: new Map(members.map((row) => [row.id, row.name || row.email?.split("@")[0] || "Participant"])),
    };
  }

  async function comments(viewer, recordId) {
    const rows = await store.portalComments(viewer.context, recordId);
    const names = await personNames(viewer, rows);
    return rows.map((row) => ({
      id: row.id, body: row.body, at: row.created_at, team: row.actor_kind !== "portal",
      mine: row.actor_kind === "portal" && row.created_by === viewer.member?.id,
      author: row.actor_kind === "portal" ? names.members.get(row.created_by) ?? "Participant" : names.team.get(row.created_by) ?? "Organiser",
    }));
  }

  async function listData(viewer, block, tokens, params) {
    const objectPolicy = viewer.objectPolicy(block.config.source.objectId);
    if (!objectPolicy || !canView(objectPolicy)) return { rows: [], total: 0, restricted: true };
    const { plan, parts } = listPlan(block, { definition: viewer.definition, objectPolicy, tokens, params });
    const page = await workspace.query(viewer.context, plan);
    const out = { rows: await shapeRows(viewer, block.config.source.objectId, objectPolicy, parts, page.rows), total: Number(page.total) };
    if (block.kind === "schedule" && !params.first) out.lanes = await laneOptions(viewer, block);
    if (block.kind === "placement") {
      const link = liveFields(viewer.definition, block.config.source.objectId).find((field) => field.id === block.config.linkField);
      const places = link ? await visibleRecords(viewer, link.config.targetObjectId, { filter: block.config.placesFilter, limit: 200, tokens }) : null;
      out.places = places?.rows ?? [];
      out.placesRestricted = !places;
    }
    return out;
  }

  // Records of a list the viewer can see, for schedule lanes, places and scanner contexts.
  async function visibleRecords(viewer, objectId, { filter = null, limit = 200, tokens = viewer.tokens } = {}) {
    const objectPolicy = viewer.objectPolicy(objectId);
    if (!objectPolicy || !canView(objectPolicy)) return null;
    const block = { kind: "table", config: { source: { objectId, filter, sort: [{ field: "title", dir: "asc" }] }, search: false, filters: [], pageSize: limit } };
    return listData(viewer, block, tokens, {});
  }

  // The columns of a schedule: a choice field's options, a linked list's records or the venue's spaces.
  async function laneOptions(viewer, block) {
    const field = liveFields(viewer.definition, block.config.source.objectId).find((item) => item.id === block.config.laneField);
    if (!field) return [];
    if (field.type === "single_select") return (field.config.options ?? []).map((option) => ({ id: option.id, label: option.label, color: option.color }));
    if (field.type === "link_record") {
      const data = await visibleRecords(viewer, field.config.targetObjectId, { limit: 50 });
      return (data?.rows ?? []).map((row) => ({ id: row.id, label: row.title || `#${row.number}` }));
    }
    if (field.type === "link_event" && viewer.event.venueId) {
      return (await workspace.eventData(viewer.context, "venue_space", { venueId: viewer.event.venueId })).map((row) => ({ id: row.id, label: row.label }));
    }
    return [];
  }

  // The scanner: a code or a pick checked (nothing written), a name search, or what it needs to start.
  async function scannerData(viewer, block, params, recordId) {
    const config = block.config;
    const lists = scannerLists(viewer.definition, config);
    if (!lists.peopleId) return { restricted: true };
    const attendance = viewer.objectPolicy(config.objectId);
    const canMark = viewer.mode === "team" || (viewer.mode === "portal" && Boolean(attendance?.create?.length));
    if (typeof params.code === "string" || typeof params.personId === "string") {
      if (!canMark && viewer.mode !== "preview") throw new WorkspaceError("forbidden", 403, "You can't take attendance here.");
      return scanner.check(viewer, config, { code: params.code ?? null, personId: params.personId ?? null, contextId: params.contextId ?? null, recordId });
    }
    if (typeof params.search === "string") return { people: canMark || viewer.mode === "preview" ? await scanner.search(viewer, config, params.search) : [] };
    const contexts = config.context === "choose" && lists.contextId ? await visibleRecords(viewer, lists.contextId, { limit: 200 }) : null;
    return { canMark, preview: viewer.mode === "preview", contexts: (contexts?.rows ?? []).map((row) => ({ id: row.id, label: row.title || `#${row.number}` })) };
  }

  // The signed-in person's pass: a signed code for their people-list record.
  function passData(viewer) {
    if (viewer.mode !== "portal" || !viewer.person) return { code: null, mode: viewer.mode };
    return { code: signPass(viewer.event.id, viewer.person.id), name: viewer.person.name ?? viewer.person.title ?? "", number: viewer.person.number };
  }

  async function statsData(viewer, block, tokens) {
    const tiles = await Promise.all(block.config.tiles.map(async (tile) => {
      const objectPolicy = viewer.objectPolicy(tile.objectId);
      const plans = objectPolicy && canView(objectPolicy) ? statPlans(tile, { definition: viewer.definition, objectPolicy, tokens }) : null;
      if (!plans) return { label: tile.label, fn: tile.fn, value: null };
      const results = await Promise.all(plans.map((plan) => store.aggregate(viewer.context, plan)));
      const first = Number(results[0].values?.m0 ?? 0);
      const value = tile.fn === "percent" ? (first ? Math.round((Number(results[1].values?.m0 ?? 0) / first) * 1000) / 10 : 0) : results[0].values?.m0 ?? null;
      return { label: tile.label, fn: tile.fn, fieldId: tile.fieldId, objectId: tile.objectId, value: value === null ? null : Number(value) };
    }));
    return { tiles };
  }

  async function chartData(viewer, block, tokens) {
    const config = block.config;
    const objectPolicy = viewer.objectPolicy(config.objectId);
    const plan = objectPolicy && canView(objectPolicy) ? chartPlan(config, { definition: viewer.definition, objectPolicy, tokens }) : null;
    if (!plan) return { groups: [], restricted: true };
    const result = await store.aggregate(viewer.context, plan);
    const object = liveObject(viewer, config.objectId);
    const field = liveFields(viewer.definition, config.objectId).find((item) => item.id === config.groupBy.field);
    const label = (key) => {
      if (key === null || key === undefined) return { label: "None", color: "gray" };
      if (config.groupBy.field === "status") {
        const status = object.statuses?.find((item) => item.key === key);
        return { label: status?.label ?? key, color: status?.color ?? "gray" };
      }
      if (field?.type === "single_select" || field?.type === "multi_select") {
        const option = field.config.options?.find((item) => item.id === key);
        return { label: option?.label ?? "Removed option", color: option?.color ?? "gray" };
      }
      if (field?.type === "checkbox") return { label: key === "true" || key === true ? "Yes" : "No", color: key === "true" || key === true ? "green" : "gray" };
      return { label: String(key), color: "blue" };
    };
    return { groups: (result.groups ?? []).map((group) => ({ key: group.key, ...label(group.key), value: Number(group.values?.m0 ?? 0) })) };
  }

  function formState(config) {
    const now = Date.now();
    if (config.opensAt && Date.parse(config.opensAt) > now) return "not_open";
    if (config.closesAt && Date.parse(config.closesAt) <= now) return "closed";
    return "open";
  }

  async function formData(viewer, block, recordId) {
    const config = block.config;
    const state = formState(config);
    if (config.mode === "edit") {
      const target = config.target === "page" ? { id: recordId } : viewer.person ? { id: viewer.person.id } : null;
      const record = target?.id && UUID.test(target.id) ? await findRecord(viewer, config.objectId, target) : null;
      return { state, record, editable: record ? record.access.editable : [] };
    }
    const objectPolicy = viewer.objectPolicy(config.objectId);
    const draft = config.drafts && viewer.member?.id && viewer.mode === "portal"
      ? await store.draft(viewer.context, { memberId: viewer.member.id, pageId: block.pageId, blockId: block.id }) : null;
    return {
      state, signedIn: Boolean(viewer.member), person: Boolean(viewer.person),
      canCreate: Boolean(objectPolicy?.create?.length) || viewer.mode === "team",
      signup: Boolean(config.signup?.enabled && viewer.settings?.signupEnabled),
      draft: draft?.data ?? null, draftSavedAt: draft?.updated_at ?? null,
    };
  }

  async function recordBlockData(viewer, block, recordId) {
    const config = block.config;
    const target = config.target === "page" ? recordId : viewer.person?.id ?? null;
    if (!target || !UUID.test(target)) return { record: null };
    const record = await findRecord(viewer, config.objectId, { id: target });
    if (!record) return { record: null, restricted: true };
    return {
      record,
      comments: config.comments && record.access.comment ? await comments(viewer, record.id) : [],
    };
  }

  return {
    findRecord, shapeRows, comments, listsFor, pageById, isOpen, scanner,
    blockDataFor: (viewer, block, params = {}) => listData(viewer, block, viewer.tokens, params),

    session(viewer) {
      const nav = navigationFor(viewer.snapshot.pages, { roleIds: viewer.roleIds, publicRoleId: viewer.publicRoleId });
      return {
        event: {
          id: viewer.event.id, name: viewer.event.name, timeZone: viewer.event.timeZone,
          date: viewer.event.row?.event_date ?? null, time: viewer.event.row?.event_time ?? null, place: viewer.event.row?.city || viewer.event.row?.venue || null,
        },
        portal: { welcome: viewer.settings.settings?.welcome ?? "", contact: viewer.settings.settings?.contact ?? "", signupEnabled: Boolean(viewer.settings.signupEnabled) },
        member: viewer.member ? { email: viewer.member.email, name: viewer.member.name ?? "" } : null,
        person: viewer.person ? { id: viewer.person.id, name: viewer.person.name ?? viewer.person.title } : null,
        roles: viewer.roles.filter((role) => role.key !== BUILTIN_ROLES.public && role.key !== BUILTIN_ROLES.signedIn)
          .map((role) => ({ id: role.id, name: role.name, icon: role.icon, color: role.color })),
        nav,
        home: nav[0]?.slug ?? null,
      };
    },

    // A page by address: its blocks (browser-safe) and the lists they show.
    page(viewer, slug) {
      const page = viewer.snapshot.pages.find((item) => item.kind === "page" && item.slug === slug);
      if (!page || !isOpen(viewer, page)) throw notFound();
      return { page: clientPage(page), lists: listsFor(viewer, [page]) };
    },

    // A record page: the record (if the viewer may see it), the list's record page, comments and their own activity.
    async recordPage(viewer, objectKey, number) {
      const object = viewer.definition.objects.find((item) => item.key === objectKey && !item.deletedAt);
      if (!object || !Number.isInteger(number) || number < 1) throw notFound("This record doesn't exist or isn't open to you.");
      const record = await findRecord(viewer, object.id, { number });
      if (!record) throw notFound("This record doesn't exist or isn't open to you.");
      const page = viewer.snapshot.pages.find((item) => item.kind === "record" && item.objectId === object.id) ?? defaultRecordPage(object);
      const activity = viewer.member?.id && viewer.mode === "portal"
        ? (await store.ownChanges(viewer.context, { recordId: record.id, memberId: viewer.member.id })).map((row) => ({ id: row.id, action: row.action, at: row.created_at }))
        : [];
      return {
        page: clientPage(page), lists: listsFor(viewer, [page], [object.id]), record,
        comments: record.access.comment ? await comments(viewer, record.id) : [], activity,
      };
    },

    async blockData(viewer, { pageId, blockId, params = {}, recordId = null }) {
      const page = pageById(viewer, pageId);
      const block = (page.body?.blocks ?? []).find((item) => item.id === blockId);
      if (!block) throw notFound("That block no longer exists.");
      let tokens = viewer.tokens;
      if (page.kind === "record") {
        if (!UUID.test(recordId ?? "") || !(await findRecord(viewer, page.objectId, { id: recordId.toLowerCase() }))) throw notFound();
        tokens = { ...tokens, recordId: recordId.toLowerCase() };
      }
      if (LIST_BLOCKS.has(block.kind)) return listData(viewer, block, tokens, params);
      if (block.kind === "custom") return block.config.source ? listData(viewer, { ...block, kind: "table", config: { ...block.config, search: true, filters: [] } }, tokens, params) : { rows: [], total: 0 };
      if (block.kind === "stats") return statsData(viewer, block, tokens);
      if (block.kind === "chart") return chartData(viewer, block, tokens);
      if (block.kind === "record") return recordBlockData(viewer, block, recordId);
      if (block.kind === "form") return formData(viewer, { ...block, pageId: page.id }, recordId);
      if (block.kind === "scanner") return scannerData(viewer, block, params, tokens.recordId ?? null);
      if (block.kind === "pass") return passData(viewer);
      return {};
    },
  };
}
