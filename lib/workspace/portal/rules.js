import { isObject, LIMITS, UUID } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { compileQuery } from "../records/query.js";
import { NIL_UUID, TOKENS } from "./contracts.js";

const bad = (message) => { throw new WorkspaceError("invalid_rule", 422, message); };
export const ALL = Object.freeze({ op: "and", items: [] });
export const NONE = Object.freeze({ op: "or", items: [] });

// Fills the viewer tokens in a rule: @me is their people-list record (or their account for "created by"), etc.
export function resolveTokens(filter, tokens) {
  const swap = (value, createdBy) => {
    if (value === TOKENS.me) return createdBy ? tokens.memberId ?? NIL_UUID : tokens.personId ?? NIL_UUID;
    if (value === TOKENS.myEmail) return tokens.email ?? "";
    if (value === TOKENS.today) return tokens.today;
    if (value === TOKENS.record) return tokens.recordId ?? NIL_UUID;
    return value;
  };
  const walk = (node) => {
    if (!isObject(node)) return node;
    if (Array.isArray(node.items)) return { ...node, items: node.items.map(walk) };
    if ("related" in node) return { ...node, ...(node.match ? { match: walk(node.match) } : {}) };
    if (!("value" in node)) return node;
    const createdBy = node.field === "created_by";
    return { ...node, value: Array.isArray(node.value) ? node.value.map((item) => swap(item, createdBy)) : swap(node.value, createdBy) };
  };
  return walk(filter);
}

// Turns an organiser rule (filter-builder shape plus "related" and "created_by") into a database condition node.
// Tokens must already be resolved. `nested` counts how many links deep we are (the database allows two).
export function compileRule(definition, objectId, filter, { nested = 0 } = {}) {
  if (filter === null || filter === undefined) return ALL;
  const node = (item, depth) => {
    if (!isObject(item)) bad("Invalid rule.");
    if ("related" in item) return related(item);
    if ("op" in item) {
      if (!["and", "or"].includes(item.op) || !Array.isArray(item.items)) bad("Invalid rule.");
      if (depth > LIMITS.filterDepth) bad("Rules can be nested three levels deep.");
      if (item.items.length > LIMITS.filterItems) bad("Use fewer conditions in this rule.");
      return { op: item.op, items: item.items.map((inner) => node(inner, depth + 1)) };
    }
    if (item.field === "created_by") {
      if (item.operator !== "eq" || typeof item.value !== "string" || !UUID.test(item.value)) bad("“Created by” can only be compared with “me”.");
      return { source: "system", column: "created_by", cast: "text", operator: "eq", value: item.value.toLowerCase() };
    }
    const compiled = compileQuery(definition, objectId, { filter: { op: "and", items: [item] }, limit: 1 }).filter.items[0];
    if (nested && compiled.source === "computed") bad("Rules about a linked list can't use lookups or rollups.");
    return compiled;
  };
  const related = (item) => {
    if (nested >= 2) bad("Rules can look through at most two links.");
    const direction = item.direction === "back" ? "back" : item.direction === "forward" ? "forward" : bad("Choose which way the link goes.");
    const field = definition.fields.find((entry) => entry.id === item.related && !entry.deletedAt && entry.type === "link_record");
    if (!field) bad("A rule uses a link that no longer exists.");
    if (direction === "forward" && field.objectId !== objectId) bad("A rule uses a link from another list.");
    if (direction === "back" && field.config.targetObjectId !== objectId) bad("A rule uses a link that doesn't point at this list.");
    const target = direction === "forward" ? field.config.targetObjectId : field.objectId;
    if (!definition.objects.some((object) => object.id === target && !object.deletedAt)) bad("A rule uses a list that no longer exists.");
    const match = item.match ? compileRule(definition, target, item.match, { nested: nested + 1 }) : null;
    return { source: "related", direction, fieldId: field.id, ...(match ? { match } : {}) };
  };
  return node(filter, 1);
}

export const and = (...items) => {
  const kept = items.filter((item) => item && !(item.op === "and" && !item.items.length));
  return kept.length === 1 ? kept[0] : { op: "and", items: kept };
};
export const or = (items) => ({ op: "or", items });

// Whether a rule refers to "this record" (only meaningful on a record page).
export function usesRecordToken(filter) {
  return JSON.stringify(filter ?? null).includes(`"${TOKENS.record}"`);
}

// Tokens used only to check that a saved rule is well-formed.
export const DRY_TOKENS = Object.freeze({ personId: NIL_UUID, memberId: NIL_UUID, email: "someone@example.com", today: "2026-01-01" });
