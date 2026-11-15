import { UUID } from "../../contracts.js";
import { WorkspaceError } from "../../errors.js";
import { badConfig, defineType, pick } from "./_shared.js";

const readOnly = () => { throw new WorkspaceError("read_only", 422, "This field is calculated and can't be edited."); };
export const FORMULA_RESULTS = Object.freeze({ text: "text", number: "numeric", boolean: "boolean", date: "date" });
export const ROLLUP_FUNCTIONS = Object.freeze(["count", "sum", "avg", "min", "max"]);

// Formula expressions are checked against the object's fields in definition.js; here only the shape is checked.
export const formula = defineType({
  type: "formula", label: "Formula", group: "Computed", cast: "text", editable: false,
  operators: ["eq", "neq", "contains", "gt", "gte", "lt", "lte", "is_true", "is_false", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["expression", "result"]);
    if (typeof out.expression !== "string" || !out.expression.trim()) badConfig("Write a formula.");
    const result = out.result ?? "text";
    if (!Object.hasOwn(FORMULA_RESULTS, result)) badConfig("Choose what the formula returns.");
    return { expression: out.expression.trim(), result };
  },
  normalise: readOnly,
  fromText: () => undefined,
});

export const lookup = defineType({
  type: "lookup", label: "Lookup", group: "Computed", cast: "text", stored: false, editable: false,
  operators: ["contains", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["linkFieldId", "targetFieldId"]);
    if (!UUID.test(out.linkFieldId ?? "") || !UUID.test(out.targetFieldId ?? "")) badConfig("Choose a link field and the field to show.");
    return { linkFieldId: out.linkFieldId.toLowerCase(), targetFieldId: out.targetFieldId.toLowerCase() };
  },
  normalise: readOnly,
  fromText: () => undefined,
});

export const rollup = defineType({
  type: "rollup", label: "Rollup", group: "Computed", cast: "numeric", stored: false, editable: false,
  operators: ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["linkFieldId", "targetFieldId", "fn"]);
    if (!UUID.test(out.linkFieldId ?? "")) badConfig("Choose a link field.");
    const fn = out.fn ?? "count";
    if (!ROLLUP_FUNCTIONS.includes(fn)) badConfig("Choose how to summarise.");
    if (fn !== "count" && !UUID.test(out.targetFieldId ?? "")) badConfig("Choose the number field to summarise.");
    return { linkFieldId: out.linkFieldId.toLowerCase(), fn, ...(fn === "count" ? {} : { targetFieldId: out.targetFieldId.toLowerCase() }) };
  },
  normalise: readOnly,
  fromText: () => undefined,
});
