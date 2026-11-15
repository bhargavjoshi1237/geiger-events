import { badConfig, checkNumber, defineType, intSetting, invalid, numberBounds, parseNumberText, pick } from "./_shared.js";

const NUMBER_OPS = ["eq", "neq", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty"];

function numeric({ type, label, decimals, extraKeys = [], extraConfig = () => ({}) }) {
  return defineType({
    type, label, group: "Number", cast: "numeric", operators: NUMBER_OPS,
    validateConfig(config) {
      const out = pick(config, ["decimals", "min", "max", ...extraKeys]);
      numberBounds(out);
      const result = { ...extraConfig(out), decimals: decimals ?? intSetting(out.decimals, { min: 0, max: 8, fallback: 0, label: "Decimal places" }) };
      if (out.min !== undefined) result.min = out.min;
      if (out.max !== undefined) result.max = out.max;
      return result;
    },
    normalise(value, config) {
      if (value === null || value === undefined || value === "") return null;
      return checkNumber(value, config, config.decimals ?? decimals ?? 0);
    },
    fromText(text, config = {}) {
      if (text === "") return null;
      const value = parseNumberText(text);
      if (value === undefined) return undefined;
      try { return this.normalise(value, config); } catch { return undefined; }
    },
  });
}

export const number = numeric({ type: "number", label: "Number" });

export const currency = numeric({
  type: "currency", label: "Currency", decimals: 2, extraKeys: ["currency"],
  extraConfig(out) {
    const code = out.currency ?? "USD";
    if (typeof code !== "string" || !/^[A-Z]{3}$/.test(code)) badConfig("Choose a three-letter currency code, like USD.");
    return { currency: code };
  },
});

export const percent = numeric({ type: "percent", label: "Percent" });

export const rating = defineType({
  type: "rating", label: "Rating", group: "Number", cast: "numeric", operators: NUMBER_OPS,
  validateConfig(config) {
    const out = pick(config, ["max"]);
    return { max: intSetting(out.max, { min: 3, max: 10, fallback: 5, label: "Highest rating" }) };
  },
  normalise(value, config) {
    if (value === null || value === undefined || value === "" || value === 0) return null;
    const max = config.max ?? 5;
    if (!Number.isInteger(value) || value < 1 || value > max) invalid(`Choose a rating from 1 to ${max}.`);
    return value;
  },
  fromText(text, config = {}) {
    if (text === "") return null;
    const value = parseNumberText(text);
    if (!Number.isInteger(value) || value < 1 || value > (config.max ?? 5)) return undefined;
    return value;
  },
});
