import { isObject, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";
import { sanitiseHtml } from "../schema/types/rich_text.js";
import { PORTAL_LIMITS, TOKENS } from "./contracts.js";
import { compileRule, DRY_TOKENS, resolveTokens, usesRecordToken } from "./rules.js";
import { CUSTOM_LIMITS } from "../code/bridge.js";

const bad = (message) => { throw new WorkspaceError("invalid_block", 422, message); };

// The block library. `data` blocks read records; the rest are content.
export const BLOCK_KINDS = Object.freeze({
  table: { label: "Table", icon: "table-2", data: true, hint: "Rows and columns with search and filters" },
  cards: { label: "Cards", icon: "layout-grid", data: true, hint: "A gallery of records with a cover image" },
  board: { label: "Board", icon: "square-kanban", data: true, hint: "Columns by status or a choice field" },
  calendar: { label: "Calendar", icon: "calendar-days", data: true, hint: "Records on a month or week view" },
  record: { label: "Record details", icon: "file-text", data: true, hint: "One record's fields, files and comments" },
  form: { label: "Form", icon: "clipboard-pen-line", data: true, hint: "Collect or edit a record" },
  stats: { label: "Stats", icon: "gauge", data: true, hint: "Counts, totals and averages" },
  chart: { label: "Chart", icon: "chart-column", data: true, hint: "Bar, line or donut chart" },
  schedule: { label: "Schedule", icon: "calendar-range", data: true, hint: "Sessions on a day grid by room or track" },
  timeline: { label: "Timeline", icon: "gantt-chart", data: true, hint: "Bars from start to end on a day, week or month axis" },
  placement: { label: "Placement", icon: "layout-dashboard", data: true, hint: "Place talks, exhibitors or volunteers into rooms, booths or shifts" },
  scanner: { label: "Scanner", icon: "scan-line", data: true, hint: "Take attendance by scanning passes or tickets" },
  pass: { label: "Pass", icon: "qr-code", data: true, hint: "The signed-in person's own QR pass" },
  custom: { label: "Custom", icon: "code-xml", data: true, hint: "Your own HTML, CSS and JavaScript, sandboxed" },
  hero: { label: "Welcome", icon: "panel-top", data: false, hint: "A cover, heading, buttons and the key facts" },
  notice: { label: "Notice", icon: "megaphone", data: false, hint: "A short announcement bar" },
  facts: { label: "Details", icon: "list", data: false, hint: "When, where and other details with icons" },
  dates: { label: "Key dates", icon: "calendar-check", data: false, hint: "Deadlines and milestones, the next one highlighted" },
  text: { label: "Text", icon: "type", data: false, hint: "Headings, paragraphs and links" },
  image: { label: "Image", icon: "image", data: false, hint: "A picture or banner" },
  buttons: { label: "Buttons", icon: "mouse-pointer-click", data: false, hint: "Links to pages, forms or websites" },
  divider: { label: "Divider", icon: "minus", data: false, hint: "Space or a line between blocks" },
});
export const BLOCK_HEIGHTS = Object.freeze({
  table: 14, cards: 14, board: 16, calendar: 18, record: 16, form: 20, stats: 5, chart: 12, text: 5, image: 10, buttons: 3, divider: 2,
  schedule: 22, timeline: 14, placement: 18, scanner: 16, pass: 12, custom: 12, hero: 14, notice: 3, facts: 8, dates: 8,
});
export const SCHEDULE_VIEWS = Object.freeze(["grid", "agenda", "glance"]);
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const EXPOSABLE = new Set(["single_select", "multi_select", "checkbox", "date", "datetime", "short_text", "email", "number"]);
export const SEARCHABLE = new Set(["short_text", "long_text", "email", "url", "phone", "rich_text"]);
const shortText = (value, max) => (typeof value === "string" ? value.trim().slice(0, max) : "");
const bool = (value, fallback = false) => (typeof value === "boolean" ? value : fallback);
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);
const int = (value, min, max, fallback) => (Number.isInteger(value) ? Math.min(max, Math.max(min, value)) : fallback);

function objectOf(definition, objectId, what = "Choose a list for this block.") {
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) bad(what);
  return object;
}

// Keeps only live fields of the list (a deleted field simply drops out of the block).
function fieldIds(definition, objectId, ids, { max = 200, allowStatus = false, test = () => true } = {}) {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids)) bad("Choose fields.");
  const byId = new Map(liveFields(definition, objectId).map((field) => [field.id, field]));
  return [...new Set(ids)].filter((id) => (allowStatus && id === "status") || (byId.has(id) && test(byId.get(id)))).slice(0, max);
}

function filterOf(definition, objectId, filter, ctx) {
  if (filter === null || filter === undefined) return null;
  if (usesRecordToken(filter) && ctx.kind !== "record") bad("“This record” only works on a record page.");
  try {
    compileRule(definition, objectId, resolveTokens(filter, DRY_TOKENS));
  } catch (error) {
    if (error instanceof WorkspaceError) bad(error.message);
    throw error;
  }
  return filter;
}

function sortOf(definition, objectId, sort) {
  if (sort === undefined || sort === null) return [];
  try {
    compileQuery(definition, objectId, { sort, limit: 1 });
  } catch (error) {
    if (error instanceof WorkspaceError) bad(error.message);
    throw error;
  }
  return sort.map((item) => ({ field: item.field, dir: item.dir === "desc" ? "desc" : "asc" }));
}

function source(definition, input, ctx) {
  if (!isObject(input)) bad("Choose a list for this block.");
  const object = objectOf(definition, input.objectId);
  return { objectId: object.id, filter: filterOf(definition, object.id, input.filter, ctx), sort: sortOf(definition, object.id, input.sort) };
}

function defaultValue(field, value) {
  const tokens = Object.values(TOKENS);
  if (typeof value === "string" && tokens.includes(value)) return value;
  if (Array.isArray(value) && value.every((item) => typeof item === "string" && (UUID.test(item) || tokens.includes(item)))) {
    if (field.type !== "link_record" && field.type !== "multi_select") bad(`Choose a value for ${field.name}.`);
    return value;
  }
  try {
    const type = getType(field.type);
    if (type.cast === "link") bad(`Choose records for ${field.name}.`);
    type.normalise(value, field.config);
  } catch (error) {
    if (error instanceof WorkspaceError) bad(`${field.name}: ${error.message}`);
    throw error;
  }
  return value;
}

function defaults(definition, objectId, list) {
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list) || list.length > 20) bad("Set up to 20 automatic values.");
  const byId = new Map(liveFields(definition, objectId).map((field) => [field.id, field]));
  return list.filter((item) => isObject(item) && byId.has(item.fieldId) && getType(byId.get(item.fieldId).type).editable)
    .map((item) => ({ fieldId: item.fieldId, value: defaultValue(byId.get(item.fieldId), item.value) }));
}

function formFields(definition, objectId, list) {
  const byId = new Map(liveFields(definition, objectId).map((field) => [field.id, field]));
  if (!Array.isArray(list)) return [];
  return list.filter((item) => isObject(item) && byId.has(item.fieldId) && getType(byId.get(item.fieldId).type).editable)
    .map((item) => ({ fieldId: item.fieldId, required: item.required === true, help: shortText(item.help, 300) }));
}

// Where a calendar, schedule or timeline opens: null (today), "first" (the earliest record) or a fixed day.
function startDateOf(value) {
  if (value === "first") return "first";
  return typeof value === "string" && DATE_ONLY.test(value) ? value : null;
}

function isoOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) bad("Choose a valid date and time.");
  return new Date(value).toISOString();
}

const ICON = /^[a-z0-9-]{1,60}$/;
const iconName = (value, fallback) => (typeof value === "string" && ICON.test(value) ? value : fallback);
const httpsUrl = (value) => {
  const url = typeof value === "string" ? value.trim() : "";
  if (url && !/^https:\/\/[^\s"'<>]+$/i.test(url)) bad("Use an https:// image address.");
  return url;
};
const pageSlug = (value) => (typeof value === "string" ? value.trim().slice(0, 63) : "");

// Buttons that open a portal page or a website (shared by the buttons and welcome blocks).
function buttonItems(list) {
  return (Array.isArray(list) ? list : []).slice(0, PORTAL_LIMITS.buttons).map((item) => {
    const kind = oneOf(item?.kind, ["page", "url"], "page");
    const target = typeof item?.target === "string" ? item.target.trim().slice(0, 500) : "";
    if (kind === "url" && target && !/^(https:\/\/|mailto:)[^\s"'<>]+$/i.test(target)) bad("Use an https:// or mailto: link.");
    return { label: shortText(item?.label, 40) || "Open", kind, target, style: oneOf(item?.style, ["primary", "outline"], "primary") };
  });
}

// Icon, label and value rows, e.g. "When · 8–10 December".
function factItems(list) {
  return (Array.isArray(list) ? list : []).slice(0, 8).filter(isObject)
    .map((item) => ({ icon: iconName(item.icon, "info"), label: shortText(item.label, 60), value: shortText(item.value, 200) }))
    .filter((item) => item.label || item.value);
}

const VALIDATORS = {
  table(config, definition, ctx) {
    const src = source(definition, config.source, ctx);
    return {
      title: shortText(config.title, 120), source: src,
      columns: fieldIds(definition, src.objectId, config.columns, { max: PORTAL_LIMITS.tableColumns, allowStatus: true }),
      search: bool(config.search, true),
      filters: fieldIds(definition, src.objectId, config.filters, { max: PORTAL_LIMITS.exposedFilters, allowStatus: true, test: (field) => EXPOSABLE.has(field.type) }),
      pageSize: int(config.pageSize, 5, PORTAL_LIMITS.pageSize, 20), open: bool(config.open, true), emptyText: shortText(config.emptyText, 200),
    };
  },
  cards(config, definition, ctx) {
    const src = source(definition, config.source, ctx);
    return {
      title: shortText(config.title, 120), source: src,
      cover: fieldIds(definition, src.objectId, [config.cover], { test: (field) => field.type === "attachments" })[0] ?? null,
      fields: fieldIds(definition, src.objectId, config.fields, { max: PORTAL_LIMITS.cardFields, allowStatus: true }),
      columns: int(config.columns, 1, 3, 3), search: bool(config.search, false),
      filters: fieldIds(definition, src.objectId, config.filters, { max: PORTAL_LIMITS.exposedFilters, allowStatus: true, test: (field) => EXPOSABLE.has(field.type) }),
      pageSize: int(config.pageSize, 3, PORTAL_LIMITS.pageSize, 12), open: bool(config.open, true), emptyText: shortText(config.emptyText, 200),
    };
  },
  board(config, definition, ctx) {
    const src = source(definition, config.source, ctx);
    const groupBy = config.groupBy === "status" ? "status"
      : fieldIds(definition, src.objectId, [config.groupBy], { test: (field) => field.type === "single_select" })[0] ?? "status";
    return { title: shortText(config.title, 120), source: src, groupBy, fields: fieldIds(definition, src.objectId, config.fields, { max: 4 }),
      open: bool(config.open, true), emptyText: shortText(config.emptyText, 200) };
  },
  calendar(config, definition, ctx) {
    const src = source(definition, config.source, ctx);
    const dates = (ids) => fieldIds(definition, src.objectId, ids, { test: (field) => field.type === "date" || field.type === "datetime" });
    const dateField = dates([config.dateField])[0];
    if (!dateField) bad("Choose a date field for the calendar.");
    return { title: shortText(config.title, 120), source: src, dateField, endField: dates([config.endField])[0] ?? null,
      view: oneOf(config.view, ["month", "week"], "month"), open: bool(config.open, true), startDate: startDateOf(config.startDate) };
  },
  schedule(config, definition, ctx) {
    const src = source(definition, config.source, ctx);
    const pick = (id, test) => fieldIds(definition, src.objectId, [id], { test })[0] ?? null;
    const startField = pick(config.startField, (field) => field.type === "datetime");
    if (!startField) bad("Choose a date-and-time field for when each item starts.");
    const lane = pick(config.laneField, (field) => field.type === "single_select" || field.type === "link_record" || (field.type === "link_event" && field.config.target === "venue_space"));
    const more = isObject(config.more) && pageSlug(config.more.page) ? { label: shortText(config.more.label, 40) || "See all", page: pageSlug(config.more.page) } : null;
    return {
      title: shortText(config.title, 120), source: src, startField,
      endField: pick(config.endField, (field) => field.type === "datetime"), durationField: pick(config.durationField, (field) => field.type === "duration"),
      laneField: lane, peopleField: pick(config.peopleField, (field) => field.type === "link_record"),
      startDate: startDateOf(config.startDate), days: int(config.days, 1, 14, 3), open: bool(config.open, true),
      fields: fieldIds(definition, src.objectId, config.fields, { max: 3 }),
      view: oneOf(config.view, SCHEDULE_VIEWS, "grid"), more,
    };
  },
  timeline(config, definition, ctx) {
    const src = source(definition, config.source, ctx);
    const dates = (id) => fieldIds(definition, src.objectId, [id], { test: (field) => field.type === "date" || field.type === "datetime" })[0] ?? null;
    const startField = dates(config.startField);
    if (!startField) bad("Choose the field each bar starts from.");
    const groupBy = config.groupBy === "status" ? "status"
      : fieldIds(definition, src.objectId, [config.groupBy], { test: (field) => field.type === "single_select" || field.type === "link_record" })[0] ?? null;
    return {
      title: shortText(config.title, 120), source: src, startField, endField: dates(config.endField), groupBy,
      scale: oneOf(config.scale, ["day", "week", "month"], "week"), startDate: startDateOf(config.startDate), open: bool(config.open, true),
    };
  },
  placement(config, definition, ctx) {
    const src = source(definition, config.source, ctx);
    const link = fieldIds(definition, src.objectId, [config.linkField], { test: (field) => field.type === "link_record" })[0];
    if (!link) bad("Choose the link field that says where each item is placed.");
    const placesId = liveFields(definition, src.objectId).find((field) => field.id === link).config.targetObjectId;
    const onPlaces = (id, test) => fieldIds(definition, placesId, [id], { test })[0] ?? null;
    const matchItem = fieldIds(definition, src.objectId, [config.match?.itemField], { test: (field) => field.type === "single_select" || field.type === "multi_select" })[0];
    const matchPlace = onPlaces(config.match?.placeField, (field) => field.type === "single_select" || field.type === "multi_select");
    return {
      title: shortText(config.title, 120), source: src, linkField: link, placesFilter: filterOf(definition, placesId, config.placesFilter, ctx),
      capacityField: onPlaces(config.capacityField, (field) => getType(field.type).cast === "numeric"),
      startField: onPlaces(config.startField, (field) => field.type === "datetime"), endField: onPlaces(config.endField, (field) => field.type === "datetime"),
      match: matchItem && matchPlace ? { itemField: matchItem, placeField: matchPlace } : null,
      fields: fieldIds(definition, src.objectId, config.fields, { max: 3 }), autoPlace: bool(config.autoPlace, true), open: bool(config.open, true),
    };
  },
  scanner(config, definition, ctx) {
    const object = objectOf(definition, config.objectId, "Choose the list attendance is recorded in.");
    const links = (id) => fieldIds(definition, object.id, [id], { test: (field) => field.type === "link_record" })[0] ?? null;
    const personField = links(config.personField);
    if (!personField) bad("Choose the link field that says who attended.");
    const contextField = links(config.contextField);
    let context = contextField ? oneOf(config.context, ["page", "choose"], "choose") : "none";
    const contextTarget = contextField ? liveFields(definition, object.id).find((field) => field.id === contextField).config.targetObjectId : null;
    if (context === "page" && (ctx.kind !== "record" || ctx.objectId !== contextTarget)) context = "choose";
    return {
      title: shortText(config.title, 120), objectId: object.id, personField, contextField, context,
      timeField: fieldIds(definition, object.id, [config.timeField], { test: (field) => field.type === "datetime" })[0] ?? null,
      camera: bool(config.camera, true), search: bool(config.search, true),
    };
  },
  pass(config) {
    return { title: shortText(config.title, 120), text: shortText(config.text, 500) };
  },
  custom(config, definition, ctx) {
    const code = (value, max, what) => {
      const text = typeof value === "string" ? value : "";
      if (text.length > max) bad(`The ${what} can be up to ${Math.round(max / 1000)} KB.`);
      return text;
    };
    return {
      title: shortText(config.title, 120),
      html: code(config.html, CUSTOM_LIMITS.html, "HTML"), css: code(config.css, CUSTOM_LIMITS.css, "CSS"), js: code(config.js, CUSTOM_LIMITS.js, "JavaScript"),
      height: int(config.height, CUSTOM_LIMITS.minHeight, CUSTOM_LIMITS.maxHeight, 320),
      source: config.source?.objectId ? source(definition, config.source, ctx) : null,
      pageSize: int(config.pageSize, 5, PORTAL_LIMITS.pageSize, 50), frame: bool(config.frame, true),
    };
  },
  record(config, definition, ctx) {
    const target = oneOf(config.target, ["page", "mine"], ctx.kind === "record" ? "page" : "mine");
    if (target === "page" && ctx.kind !== "record") bad("Show “this record” on a record page, or choose the viewer's own record.");
    const objectId = target === "page" ? ctx.objectId : objectOf(definition, config.objectId, "Choose the people list.").id;
    const sections = (Array.isArray(config.sections) ? config.sections : []).slice(0, PORTAL_LIMITS.formSections).map((section) => ({
      title: shortText(section?.title, 120), fields: fieldIds(definition, objectId, section?.fields),
    }));
    return { title: shortText(config.title, 120), target, objectId, sections, files: bool(config.files, true),
      comments: bool(config.comments, true), activity: bool(config.activity, false), edit: bool(config.edit, true) };
  },
  form(config, definition, ctx) {
    const mode = oneOf(config.mode, ["create", "edit"], "create");
    const target = mode === "edit" ? oneOf(config.target, ["page", "mine"], ctx.kind === "record" ? "page" : "mine") : null;
    if (target === "page" && ctx.kind !== "record") bad("Edit “this record” on a record page, or choose the viewer's own record.");
    const objectId = target === "page" ? ctx.objectId : objectOf(definition, config.objectId).id;
    const sections = (Array.isArray(config.sections) ? config.sections : []).slice(0, PORTAL_LIMITS.formSections).map((section) => ({
      title: shortText(section?.title, 120), description: shortText(section?.description, 1000),
      fields: formFields(definition, objectId, section?.fields),
    }));
    if (sections.reduce((n, section) => n + section.fields.length, 0) > PORTAL_LIMITS.formFields) bad(`A form can have up to ${PORTAL_LIMITS.formFields} fields.`);
    const object = definition.objects.find((item) => item.id === objectId);
    const status = mode === "create" && object.statuses?.some((item) => item.key === config.status) ? config.status : null;
    const signupInput = isObject(config.signup) ? config.signup : {};
    const signup = mode === "create" && ctx.audience?.public && signupInput.enabled === true ? {
      enabled: true, objectId: objectOf(definition, signupInput.objectId, "Choose the people list for sign-up.").id,
    } : { enabled: false };
    if (signup.enabled) {
      signup.personFields = formFields(definition, signup.objectId, signupInput.personFields).slice(0, 20);
      signup.personDefaults = defaults(definition, signup.objectId, signupInput.personDefaults);
    }
    const opensAt = isoOrNull(config.opensAt);
    const closesAt = isoOrNull(config.closesAt);
    if (opensAt && closesAt && opensAt >= closesAt) bad("The form must open before it closes.");
    return {
      title: shortText(config.title, 120), intro: shortText(config.intro, 2000), mode, target, objectId, sections,
      steps: bool(config.steps, false), defaults: defaults(definition, objectId, config.defaults), status, opensAt, closesAt,
      submitLabel: shortText(config.submitLabel, 40) || (mode === "create" ? "Submit" : "Save changes"),
      success: { message: shortText(config.success?.message, 1000), page: typeof config.success?.page === "string" ? config.success.page.slice(0, 63) : null },
      drafts: bool(config.drafts, true), signup,
    };
  },
  stats(config, definition, ctx) {
    const tiles = (Array.isArray(config.tiles) ? config.tiles : []).slice(0, PORTAL_LIMITS.stats).map((tile) => {
      const object = objectOf(definition, tile?.objectId);
      const fn = oneOf(tile.fn, ["count", "sum", "avg", "min", "max", "percent"], "count");
      const fieldId = ["sum", "avg", "min", "max"].includes(fn)
        ? fieldIds(definition, object.id, [tile.fieldId], { test: (field) => getType(field.type).cast === "numeric" || field.type === "rollup" || (field.type === "formula" && field.config.result === "number") })[0]
        : null;
      if (["sum", "avg", "min", "max"].includes(fn) && !fieldId) bad("Choose a number field for this stat.");
      return { label: shortText(tile.label, 60) || object.plural, objectId: object.id, filter: filterOf(definition, object.id, tile.filter, ctx), fn, fieldId,
        part: fn === "percent" ? filterOf(definition, object.id, tile.part, ctx) : null };
    });
    if (!tiles.length) bad("Add at least one stat.");
    return { title: shortText(config.title, 120), tiles };
  },
  chart(config, definition, ctx) {
    const object = objectOf(definition, config.objectId);
    const groupField = config.groupBy?.field === "status" ? "status"
      : fieldIds(definition, object.id, [config.groupBy?.field], { test: (field) => ["single_select", "multi_select", "checkbox", "date", "datetime"].includes(field.type) })[0] ?? "status";
    const field = liveFields(definition, object.id).find((item) => item.id === groupField);
    const bucket = field && (field.type === "date" || field.type === "datetime") ? oneOf(config.groupBy?.bucket, ["day", "week", "month"], "month") : null;
    const fn = oneOf(config.measure?.fn, ["count", "sum", "avg"], "count");
    const measureField = fn === "count" ? null : fieldIds(definition, object.id, [config.measure?.fieldId], { test: (item) => getType(item.type).cast === "numeric" || item.type === "rollup" })[0];
    if (fn !== "count" && !measureField) bad("Choose a number field to chart.");
    return { title: shortText(config.title, 120), objectId: object.id, filter: filterOf(definition, object.id, config.filter, ctx),
      kind: oneOf(config.kind, ["bar", "line", "donut"], "bar"), groupBy: { field: groupField, ...(bucket ? { bucket } : {}) }, measure: { fn, fieldId: measureField } };
  },
  text(config) {
    const html = sanitiseHtml(typeof config.html === "string" ? config.html : "");
    if (html.length > PORTAL_LIMITS.text) bad("This text is too long.");
    return { html, align: oneOf(config.align, ["left", "center"], "left"), card: bool(config.card, false) };
  },
  hero(config) {
    return {
      image: httpsUrl(config.image), badge: oneOf(config.badge, ["countdown", "none"], "countdown"),
      heading: shortText(config.heading, 160), text: shortText(config.text, 1000), buttons: buttonItems(config.buttons), facts: factItems(config.facts),
    };
  },
  notice(config) {
    const html = sanitiseHtml(typeof config.html === "string" ? config.html : "");
    if (html.length > 2000) bad("Keep the notice short.");
    return { icon: iconName(config.icon, "megaphone"), html };
  },
  facts(config) {
    return { title: shortText(config.title, 120), items: factItems(config.items) };
  },
  dates(config) {
    const items = (Array.isArray(config.items) ? config.items : []).slice(0, 12).filter(isObject)
      .map((item) => ({ date: typeof item.date === "string" && DATE_ONLY.test(item.date) ? item.date : "", label: shortText(item.label, 120), note: shortText(item.note, 120) }))
      .filter((item) => item.date && item.label);
    return { title: shortText(config.title, 120), items };
  },
  image(config) {
    const url = httpsUrl(config.url);
    const link = typeof config.link === "string" && /^https:\/\/[^\s"'<>]+$/i.test(config.link.trim()) ? config.link.trim() : null;
    return { url, alt: shortText(config.alt, 200), fit: oneOf(config.fit, ["cover", "contain"], "cover"), height: int(config.height, 80, 800, 240), link };
  },
  buttons(config) {
    return { items: buttonItems(config.items), align: oneOf(config.align, ["left", "center"], "left") };
  },
  divider(config) {
    return { size: oneOf(config.size, ["sm", "md", "lg"], "md"), line: bool(config.line, true) };
  },
};

// Validates one block's settings for the page it sits on; returns the cleaned config.
export function validateBlock(block, ctx) {
  const validate = VALIDATORS[block?.kind];
  if (!validate) bad("Choose a block type.");
  return validate(isObject(block.config) ? block.config : {}, ctx.definition, ctx);
}

// Starting settings for a newly added block, chosen from the workspace so it shows something straight away.
export function defaultBlockConfig(kind, { definition, objectId = null, pageKind = "page" }) {
  const objects = definition.objects.filter((object) => !object.deletedAt).sort((a, b) => a.position - b.position);
  const object = objects.find((item) => item.id === objectId) ?? objects[0];
  const fields = object ? liveFields(definition, object.id).sort((a, b) => a.position - b.position) : [];
  const source = object ? { objectId: object.id, filter: null, sort: [] } : null;
  const visible = fields.filter((field) => !["rich_text", "attachments"].includes(field.type)).slice(0, 4).map((field) => field.id);
  switch (kind) {
    case "table": return { title: object?.plural ?? "", source, columns: visible, search: true, filters: [], pageSize: 20, open: true };
    case "cards": return { title: object?.plural ?? "", source, cover: fields.find((field) => field.type === "attachments")?.id ?? null, fields: visible.slice(0, 3), columns: 3, pageSize: 12, open: true };
    case "board": return { title: object?.plural ?? "", source, groupBy: "status", fields: visible.slice(0, 2), open: true };
    case "calendar": return { title: object?.plural ?? "", source, dateField: fields.find((field) => field.type === "date" || field.type === "datetime")?.id ?? null, view: "month", open: true, startDate: null };
    case "schedule": {
      const times = fields.filter((field) => field.type === "datetime");
      const lane = fields.find((field) => field.type === "link_record" || field.type === "single_select" || (field.type === "link_event" && field.config.target === "venue_space"));
      return { title: object?.plural ?? "", source, startField: times[0]?.id ?? null, endField: times[1]?.id ?? null,
        durationField: fields.find((field) => field.type === "duration")?.id ?? null, laneField: lane?.id ?? null, peopleField: null, startDate: "first", days: 3, open: true, fields: [],
        view: "grid", more: null };
    }
    case "timeline": {
      const dates = fields.filter((field) => field.type === "date" || field.type === "datetime");
      return { title: object?.plural ?? "", source, startField: dates[0]?.id ?? null, endField: dates[1]?.id ?? null, groupBy: "status", scale: "week", startDate: "first", open: true };
    }
    case "placement": {
      const link = fields.find((field) => field.type === "link_record");
      const places = link ? liveFields(definition, link.config.targetObjectId) : [];
      return { title: object?.plural ?? "", source, linkField: link?.id ?? null, placesFilter: null,
        capacityField: places.find((field) => getType(field.type).cast === "numeric")?.id ?? null, startField: null, endField: null, match: null, fields: [], autoPlace: true, open: true };
    }
    case "scanner": {
      const links = fields.filter((field) => field.type === "link_record");
      return { title: "Check people in", objectId: object?.id, personField: links[0]?.id ?? null, contextField: links[1]?.id ?? null,
        context: links[1] && links[1].config.targetObjectId === objectId && pageKind === "record" ? "page" : "choose", timeField: fields.find((field) => field.type === "datetime")?.id ?? null, camera: true, search: true };
    }
    case "pass": return { title: "Your pass", text: "Show this at the door." };
    case "custom": return { title: "", source, pageSize: 50, height: 320, frame: true,
      html: "<div id=\"app\">Loading…</div>",
      css: "#app { padding: 16px; }",
      js: ["geiger.data().then(({ total }) => {", "  document.getElementById(\"app\").textContent = `${total} records`;", "});"].join("\n") };
    case "record": return { title: "", target: pageKind === "record" ? "page" : "mine", objectId: object?.id, sections: [{ title: "", fields: fields.map((field) => field.id) }], files: true, comments: true, edit: true };
    case "form": return { title: object ? `New ${object.name.toLowerCase()}` : "", mode: "create", objectId: object?.id,
      sections: [{ title: "", fields: fields.filter((field) => getType(field.type).editable).slice(0, 6).map((field) => ({ fieldId: field.id, required: field.required })) }],
      submitLabel: "Submit", success: { message: "Thanks — we've received it." }, drafts: true };
    case "stats": return { title: "", tiles: object ? [{ label: object.plural, objectId: object.id, fn: "count" }] : [] };
    case "chart": return { title: object ? `${object.plural} by status` : "", objectId: object?.id, kind: "bar", groupBy: { field: "status" }, measure: { fn: "count" } };
    case "text": return { html: "<h2>Heading</h2><p>Write something here.</p>", align: "left", card: false };
    case "hero": return {
      image: "", badge: "countdown", heading: "Welcome to {{event.name}}", text: "Everything you need for the event, in one place.",
      buttons: [{ label: "Open", kind: "page", target: "", style: "primary" }],
      facts: [{ icon: "calendar", label: "When", value: "" }, { icon: "map-pin", label: "Where", value: "" }],
    };
    case "notice": return { icon: "megaphone", html: "<p><strong>New:</strong> write your announcement here.</p>" };
    case "facts": return { title: "Details", items: [{ icon: "calendar", label: "When", value: "" }, { icon: "map-pin", label: "Where", value: "" }] };
    case "dates": return { title: "Key dates", items: [{ date: new Date().toISOString().slice(0, 10), label: "Something happens", note: "" }] };
    case "image": return { url: "", alt: "", fit: "cover", height: 240 };
    case "buttons": return { items: [{ label: "Open", kind: "page", target: "", style: "primary" }], align: "left" };
    case "divider": return { size: "md", line: true };
    default: return {};
  }
}
