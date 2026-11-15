import { isObject } from "../contracts.js";

// Symbolic references in templates and snapshots (#list:paper, #field:paper.title, #role:author, #doc:Name,
// #review:Name, #me), resolved to ids when installing, and made from ids when saving a snapshot.
const REF = /^#(list|field|role|doc|review|me)(?::(.+))?$/;
export const isRef = (value) => typeof value === "string" && REF.test(value);

// maps: { list: Map, field: Map ("list.field"), role: Map, doc: Map, review: Map, me }. Unresolved references are
// reported in `missing`; inside arrays they drop out, as object keys the entry drops out, elsewhere they become null.
export function resolveRefs(value, maps) {
  const missing = new Set();
  const one = (text) => {
    const match = REF.exec(text);
    if (!match) return text;
    const id = match[1] === "me" ? maps.me ?? null : maps[match[1]]?.get(match[2]) ?? null;
    if (!id) missing.add(text);
    return id;
  };
  const walk = (node) => {
    if (typeof node === "string") return one(node);
    if (Array.isArray(node)) return node.flatMap((item) => { const out = walk(item); return out === null && isRef(item) ? [] : [out]; });
    if (isObject(node)) {
      const out = {};
      for (const [key, item] of Object.entries(node)) {
        const name = isRef(key) ? one(key) : key;
        if (name !== null) out[name] = walk(item);
      }
      return out;
    }
    return node;
  };
  return { value: walk(value), missing: [...missing] };
}

// The reverse: known ids (as values or object keys) become references, so a snapshot can be replayed anywhere.
export function tokenizeIds(value, tokens) {
  const swap = (text) => tokens.get(text.toLowerCase()) ?? text;
  const walk = (node) => {
    if (typeof node === "string") return swap(node);
    if (Array.isArray(node)) return node.map(walk);
    if (isObject(node)) return Object.fromEntries(Object.entries(node).map(([key, item]) => [swap(key), walk(item)]));
    return node;
  };
  return walk(value);
}

// Reference maps from a workspace definition: list keys and "list.field" keys to ids.
export function definitionMaps(definition) {
  const lists = new Map();
  const fields = new Map();
  const keyOf = new Map();
  for (const object of definition.objects.filter((item) => !item.deletedAt)) { lists.set(object.key, object.id); keyOf.set(object.id, object.key); }
  for (const field of definition.fields.filter((item) => !item.deletedAt && keyOf.has(item.objectId))) fields.set(`${keyOf.get(field.objectId)}.${field.key}`, field.id);
  return { list: lists, field: fields };
}

// Tokens for every live list and field of a definition (id → reference).
export function definitionTokens(definition, { objectIds = null } = {}) {
  const tokens = new Map();
  const keyOf = new Map();
  for (const object of definition.objects.filter((item) => !item.deletedAt && (!objectIds || objectIds.has(item.id)))) {
    keyOf.set(object.id, object.key);
    tokens.set(object.id, `#list:${object.key}`);
  }
  for (const field of definition.fields.filter((item) => !item.deletedAt && keyOf.has(item.objectId))) tokens.set(field.id, `#field:${keyOf.get(field.objectId)}.${field.key}`);
  return tokens;
}
