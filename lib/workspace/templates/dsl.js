// Building blocks for built-in templates. Templates use keys, not ids: lists and fields by key, and references that
// the installer resolves as it creates things: #list:<list>, #field:<list>.<field>, #role:<role>, #doc:<name>,
// #review:<name> and #me (the person installing).
export const ref = Object.freeze({
  list: (list) => `#list:${list}`,
  field: (list, field) => `#field:${list}.${field}`,
  role: (key) => `#role:${key}`,
  doc: (name) => `#doc:${name}`,
  review: (name) => `#review:${name}`,
  me: "#me",
});

export const optionId = (label) => `opt_${String(label).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 24)}`;
const options = (labels) => labels.map((entry) => {
  const [label, color = "gray"] = Array.isArray(entry) ? entry : [entry];
  return { id: optionId(label), label, color };
});

const field = (type, key, name, config = {}, extra = {}) => ({ key, name, type, config, required: false, isUnique: false, ...extra });

// Field shorthands; `extra` takes { required, isUnique }.
export const f = Object.freeze({
  text: (key, name, extra) => field("short_text", key, name, {}, extra),
  long: (key, name, extra) => field("long_text", key, name, {}, extra),
  rich: (key, name, extra) => field("rich_text", key, name, {}, extra),
  email: (key, name, extra) => field("email", key, name, {}, extra),
  url: (key, name, extra) => field("url", key, name, {}, extra),
  phone: (key, name, extra) => field("phone", key, name, {}, extra),
  number: (key, name, { decimals = 0, ...extra } = {}) => field("number", key, name, { decimals }, extra),
  currency: (key, name, { currency = "EUR", ...extra } = {}) => field("currency", key, name, { currency, decimals: 2 }, extra),
  date: (key, name, extra) => field("date", key, name, {}, extra),
  datetime: (key, name, extra) => field("datetime", key, name, {}, extra),
  duration: (key, name, extra) => field("duration", key, name, {}, extra),
  checkbox: (key, name, extra) => field("checkbox", key, name, {}, extra),
  rating: (key, name, { max = 5, ...extra } = {}) => field("rating", key, name, { max }, extra),
  select: (key, name, labels, extra) => field("single_select", key, name, { options: options(labels) }, extra),
  multi: (key, name, labels, extra) => field("multi_select", key, name, { options: options(labels) }, extra),
  link: (key, name, list, { multiple = false, ...extra } = {}) => field("link_record", key, name, { targetObjectKey: list, multiple }, extra),
  ticket: (key, name, { multiple = false, ...extra } = {}) => field("link_event", key, name, { target: "ticket", multiple }, extra),
  space: (key, name, extra) => field("link_event", key, name, { target: "venue_space", multiple: false }, extra),
  files: (key, name, { maxFiles = 5, accept, ...extra } = {}) => field("attachments", key, name, { maxFiles, ...(accept ? { accept } : {}) }, extra),
  lookup: (key, name, link, target) => field("lookup", key, name, { linkFieldKey: link, targetFieldKey: target }),
  rollup: (key, name, link, fn = "count", target = null) => field("rollup", key, name, { linkFieldKey: link, fn, ...(target ? { targetFieldKey: target } : {}) }),
  formula: (key, name, expression, result = "text") => field("formula", key, name, { expression, result }),
});

// A list: statuses as [key, label, color] triples, the title field by key.
export function list(key, name, plural, { icon = "database", prefix, statuses = [], title = null, fields }) {
  return {
    key, name, plural, icon, numberPrefix: prefix, titleFieldKey: title,
    statuses: statuses.map(([status, label, color = "gray"]) => ({ key: status, label, color })), fields, views: [],
  };
}

// Filters and rules: where(is(ref.field("paper", "track"), "eq", "opt_ml")).
export const where = (...items) => ({ op: "and", items });
export const anyOf = (...items) => ({ op: "or", items });
export const is = (fieldRef, operator, value) => ({ field: fieldRef, operator, ...(value === undefined ? {} : { value }) });

// Stage rules: moves as "from>to" strings ("" for a new record), requirements by status.
export function stages(listKey, moves, requires = {}) {
  return {
    list: ref.list(listKey),
    config: {
      enforce: true,
      moves: moves.map((move) => { const [from, to] = move.split(">"); return { from: from || null, to }; }),
      requires: Object.fromEntries(Object.entries(requires).map(([status, keys]) => [status, keys.map((key) => ref.field(listKey, key))])),
    },
  };
}

// Pages in the stacked layout: one row per block, full width.
let blockCounter = 0;
export function blocksPage({ slug, title, icon = "file", kind = "page", list: listKey = null, audience = {}, blocks }) {
  const rows = blocks.map((_, index) => ({ id: `r_${`${slug.replace(/[^a-z0-9]/g, "")}page`.slice(0, 12)}${index}`, widths: [12] }));
  return {
    slug, title, icon, kind, ...(listKey ? { objectId: ref.list(listKey) } : {}), layout: "blocks", audience,
    body: { rows, blocks: blocks.map((block, index) => ({ id: `b_tpl${(blockCounter++).toString(36)}${index}`, kind: block.kind, at: { row: rows[index].id, col: 0, order: 0 }, config: block.config })) },
  };
}
export const block = (kind, config) => ({ kind, config });

// Recipients and values for automation steps.
export const toField = (listKey, key) => ({ kind: "field", fieldId: ref.field(listKey, key) });
export const toLinked = (listKey, link, targetList, key) => ({ kind: "linked", linkFieldId: ref.field(listKey, link), fieldId: ref.field(targetList, key) });
export const toTeam = () => ({ kind: "team", userIds: [ref.me] });
export const value = (listKey, key, v) => ({ fieldId: ref.field(listKey, key), value: v });
