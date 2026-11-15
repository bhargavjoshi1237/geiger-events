import { LIMITS } from "../../contracts.js";
import { defineType, intSetting, invalid, isBlank, pick } from "./_shared.js";

export const countWords = (text) => (String(text).match(/\S+/g) ?? []).length;

// Parses with the type's own rules; anything it rejects doesn't convert.
function tryNormalise(text) {
  if (text === "") return null;
  try { return this.normalise(text, this.validateConfig({})); } catch { return undefined; }
}

export const shortText = defineType({
  type: "short_text", label: "Short text", group: "Text", cast: "text", titleable: true,
  operators: ["eq", "neq", "contains", "not_contains", "starts_with", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["maxLength"]);
    return { maxLength: intSetting(out.maxLength, { min: 1, max: LIMITS.shortText, fallback: LIMITS.shortText, label: "Maximum length" }) };
  },
  normalise(value, config) {
    if (isBlank(value)) return null;
    if (typeof value !== "string") invalid("Enter text.");
    const text = value.trim().replace(/\s*\n\s*/g, " ");
    const max = config.maxLength ?? LIMITS.shortText;
    if (text.length > max) invalid(`Keep this under ${max} characters.`);
    return text;
  },
  fromText: (text) => (text === "" ? null : text),
});

export const longText = defineType({
  type: "long_text", label: "Long text", group: "Text", cast: "text",
  operators: ["contains", "not_contains", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["maxChars", "maxWords"]);
    const result = { maxChars: intSetting(out.maxChars, { min: 1, max: LIMITS.longText, fallback: LIMITS.longText, label: "Character limit" }) };
    if (out.maxWords !== undefined) result.maxWords = intSetting(out.maxWords, { min: 1, max: 20_000, label: "Word limit" });
    return result;
  },
  normalise(value, config) {
    if (isBlank(value)) return null;
    if (typeof value !== "string") invalid("Enter text.");
    const text = value.trim();
    const max = config.maxChars ?? LIMITS.longText;
    if (text.length > max) invalid(`Keep this under ${max} characters.`);
    if (config.maxWords && countWords(text) > config.maxWords) invalid(`Keep this to ${config.maxWords} words or fewer.`);
    return text;
  },
  fromText: (text) => (text === "" ? null : text),
});

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const email = defineType({
  type: "email", label: "Email", group: "Text", cast: "text", titleable: true,
  operators: ["eq", "neq", "contains", "is_empty", "is_not_empty"],
  validateConfig: () => ({}),
  normalise(value) {
    if (isBlank(value)) return null;
    if (typeof value !== "string") invalid("Enter an email address.");
    const text = value.trim();
    if (text.length > 254 || !EMAIL.test(text)) invalid("Enter a valid email address.");
    const at = text.lastIndexOf("@");
    return text.slice(0, at) + text.slice(at).toLowerCase();
  },
  fromText: tryNormalise,
});

export const phone = defineType({
  type: "phone", label: "Phone", group: "Text", cast: "text",
  operators: ["eq", "contains", "is_empty", "is_not_empty"],
  validateConfig: () => ({}),
  normalise(value) {
    if (isBlank(value)) return null;
    if (typeof value !== "string") invalid("Enter a phone number.");
    const text = value.trim().replace(/\s+/g, " ");
    const digits = text.replace(/\D/g, "").length;
    if (!/^\+?[\d\s\-().]+$/.test(text) || digits < 5 || digits > 20) invalid("Enter a valid phone number.");
    return text;
  },
  fromText: tryNormalise,
});

export const url = defineType({
  type: "url", label: "URL", group: "Text", cast: "text",
  operators: ["eq", "contains", "is_empty", "is_not_empty"],
  validateConfig: () => ({}),
  normalise(value) {
    if (isBlank(value)) return null;
    if (typeof value !== "string") invalid("Enter a web address.");
    const text = value.trim();
    let parsed;
    try { parsed = new URL(text); } catch { invalid("Enter a full web address starting with https://."); }
    if (!["http:", "https:"].includes(parsed.protocol) || text.length > 2000) invalid("Enter a full web address starting with https://.");
    return text;
  },
  fromText: tryNormalise,
});
