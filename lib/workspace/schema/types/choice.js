import { defineType, invalid, pick, validateOptions } from "./_shared.js";

const labelOf = (config, id) => config.options?.find((option) => option.id === id)?.label;
const idForLabel = (config, label) =>
  config.options?.find((option) => option.label.toLowerCase() === String(label).trim().toLowerCase())?.id;

export const singleSelect = defineType({
  type: "single_select", label: "Single select", group: "Choice", cast: "text",
  operators: ["eq", "neq", "any_of", "none_of", "is_empty", "is_not_empty"],
  validateConfig(config) {
    return { options: validateOptions(pick(config, ["options"]).options ?? []) };
  },
  normalise(value, config) {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value !== "string" || !labelOf(config, value)) invalid("Choose one of the options.");
    return value;
  },
  toText: (value, config = {}) => (value ? labelOf(config, value) ?? "" : ""),
  fromText(text, config = {}) {
    if (text === "") return null;
    return idForLabel(config, text) ?? idForLabel(config, String(text).split(",")[0]);
  },
});

export const multiSelect = defineType({
  type: "multi_select", label: "Multi-select", group: "Choice", cast: "text[]",
  operators: ["has_any", "has_all", "has_none", "is_empty", "is_not_empty"],
  validateConfig(config) {
    return { options: validateOptions(pick(config, ["options"]).options ?? []) };
  },
  normalise(value, config) {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) invalid("Choose from the options.");
    if (!value.length) return null;
    if (new Set(value).size !== value.length) invalid("An option is chosen twice.");
    for (const id of value) if (typeof id !== "string" || !labelOf(config, id)) invalid("Choose from the options.");
    return [...value];
  },
  toText: (value, config = {}) => (Array.isArray(value) ? value.map((id) => labelOf(config, id)).filter(Boolean).join(", ") : ""),
  fromText(text, config = {}) {
    if (text === "") return null;
    const ids = String(text).split(",").map((part) => part.trim()).filter(Boolean).map((part) => idForLabel(config, part));
    if (ids.some((id) => !id)) return undefined;
    return [...new Set(ids)];
  },
});

export const checkbox = defineType({
  type: "checkbox", label: "Checkbox", group: "Choice", cast: "boolean",
  operators: ["is_true", "is_false"],
  validateConfig: () => ({}),
  normalise(value) {
    if (value === null || value === undefined) return null;
    if (typeof value !== "boolean") invalid("Choose yes or no.");
    return value;
  },
  toText: (value) => (value === true ? "Yes" : value === false ? "No" : ""),
  fromText(text) {
    const folded = String(text).trim().toLowerCase();
    if (folded === "") return null;
    if (["yes", "y", "true", "1", "x", "✓"].includes(folded)) return true;
    if (["no", "n", "false", "0"].includes(folded)) return false;
    return undefined;
  },
});
