import { COLORS, isObject, LIMITS, OPTION_ID, UUID } from "../../contracts.js";
import { WorkspaceError } from "../../errors.js";

export const invalid = (message) => { throw new WorkspaceError("invalid_value", 422, message); };
export const badConfig = (message) => { throw new WorkspaceError("invalid_field", 422, message); };
export const isBlank = (value) => value === undefined || value === null || (typeof value === "string" && value.trim() === "");

// Copies only known keys from a config object, so stray settings never reach storage.
export function pick(config, keys) {
  if (config !== undefined && !isObject(config)) badConfig("Field settings must be an object.");
  const out = {};
  for (const key of keys) if (config?.[key] !== undefined) out[key] = config[key];
  return out;
}

export function intSetting(value, { min, max, fallback, label }) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) badConfig(`${label} must be a whole number from ${min} to ${max}.`);
  return value;
}

export function numberBounds(config) {
  for (const bound of ["min", "max"]) {
    if (config[bound] !== undefined && (typeof config[bound] !== "number" || !Number.isFinite(config[bound]))) {
      badConfig("Minimum and maximum must be numbers.");
    }
  }
  if (config.min !== undefined && config.max !== undefined && config.min > config.max) {
    badConfig("The minimum is larger than the maximum.");
  }
}

export function roundTo(value, decimals) {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function checkNumber(value, config, decimals) {
  if (typeof value !== "number" || !Number.isFinite(value)) invalid("Enter a number.");
  const rounded = roundTo(value, decimals);
  if (config.min !== undefined && rounded < config.min) invalid(`Enter ${config.min} or more.`);
  if (config.max !== undefined && rounded > config.max) invalid(`Enter ${config.max} or less.`);
  return rounded;
}

export function parseNumberText(text) {
  const cleaned = String(text).replace(/[,\s]/g, "").replace(/^[^\d.-]+/, "").replace(/%$/, "");
  if (!/^-?\d*\.?\d+(e-?\d+)?$/i.test(cleaned)) return undefined;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : undefined;
}

export function validateOptions(options) {
  if (!Array.isArray(options) || options.length > LIMITS.options) badConfig(`Add up to ${LIMITS.options} options.`);
  const ids = new Set();
  const labels = new Set();
  return options.map((option) => {
    if (!isObject(option) || !OPTION_ID.test(option.id ?? "") || typeof option.label !== "string") badConfig("Each option needs a label.");
    const label = option.label.trim();
    if (!label || label.length > 100) badConfig("Option labels must be 1–100 characters.");
    const folded = label.toLowerCase();
    if (ids.has(option.id) || labels.has(folded)) badConfig(`The option "${label}" appears twice.`);
    ids.add(option.id);
    labels.add(folded);
    return { id: option.id, label, color: COLORS.includes(option.color) ? option.color : "gray" };
  });
}

export function linkTargets(value, kind, multiple) {
  const list = value === null || value === undefined ? [] : Array.isArray(value) ? value : [value];
  const seen = new Set();
  const out = list.map((item) => {
    const id = typeof item === "string" ? item : item?.id;
    if (!UUID.test(id ?? "")) invalid("A linked item isn't valid.");
    if (seen.has(id)) invalid("The same item is linked twice.");
    seen.add(id);
    return { kind, id: id.toLowerCase() };
  });
  if (!multiple && out.length > 1) invalid("This field takes one linked item.");
  return out;
}

const COMMON = { stored: true, titleable: false, editable: true, toText: (value) => (value === null || value === undefined ? "" : String(value)) };

// Builds a field type with shared defaults; every type module calls this once.
export function defineType(spec) {
  return Object.freeze({ ...COMMON, ...spec });
}
