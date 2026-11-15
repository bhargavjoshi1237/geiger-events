import { EVENT_TARGETS, LIMITS, UUID } from "../../contracts.js";
import { badConfig, defineType, intSetting, invalid, linkTargets, pick } from "./_shared.js";

export const EVENT_TARGET_LABELS = Object.freeze({
  contact: "Contact", order: "Order", ticket: "Ticket holder", team_member: "Team member", venue_space: "Venue space",
});

// Link values never live in a record's values; they are stored as rows in workspace_links.
export const linkRecord = defineType({
  type: "link_record", label: "Link to record", group: "Links", cast: "link", stored: false,
  operators: ["has_any", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["targetObjectId", "multiple"]);
    if (!UUID.test(out.targetObjectId ?? "")) badConfig("Choose which list this field links to.");
    if (out.multiple !== undefined && typeof out.multiple !== "boolean") badConfig("Choose one or many links.");
    return { targetObjectId: out.targetObjectId.toLowerCase(), multiple: out.multiple ?? true };
  },
  normalise: (value, config) => linkTargets(value, "record", config.multiple ?? true),
  toText: () => "",
  fromText: () => undefined,
});

export const linkEvent = defineType({
  type: "link_event", label: "Link to event data", group: "Links", cast: "link", stored: false,
  operators: ["has_any", "is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["target", "multiple"]);
    if (!EVENT_TARGETS.includes(out.target)) badConfig("Choose what this field links to.");
    if (out.multiple !== undefined && typeof out.multiple !== "boolean") badConfig("Choose one or many links.");
    return { target: out.target, multiple: out.multiple ?? false };
  },
  normalise: (value, config) => linkTargets(value, config.target, config.multiple ?? false),
  toText: () => "",
  fromText: () => undefined,
});

const MIME = /^[a-z]+\/[a-z0-9.+*-]+$/i;

export function acceptsType(accept, type) {
  if (!accept?.length) return true;
  return accept.some((pattern) => pattern === type || (pattern.endsWith("/*") && type.startsWith(pattern.slice(0, -1))));
}

export const attachments = defineType({
  type: "attachments", label: "Attachments", group: "Files", cast: "file",
  operators: ["is_empty", "is_not_empty"],
  validateConfig(config) {
    const out = pick(config, ["maxFiles", "accept", "maxBytes"]);
    const result = {
      maxFiles: intSetting(out.maxFiles, { min: 1, max: LIMITS.files, fallback: 10, label: "Number of files" }),
      maxBytes: intSetting(out.maxBytes, { min: 1024, max: LIMITS.fileBytes, fallback: LIMITS.fileBytes, label: "File size" }),
    };
    if (out.accept !== undefined) {
      if (!Array.isArray(out.accept) || out.accept.length > 30 || out.accept.some((item) => typeof item !== "string" || !MIME.test(item))) {
        badConfig("Allowed file types must be like application/pdf or image/*.");
      }
      result.accept = [...new Set(out.accept.map((item) => item.toLowerCase()))];
    }
    return result;
  },
  normalise(value, config) {
    if (value === null || value === undefined) return null;
    if (!Array.isArray(value)) invalid("Attach files.");
    if (!value.length) return null;
    if (value.length > (config.maxFiles ?? 10)) invalid(`Attach up to ${config.maxFiles ?? 10} files.`);
    const seen = new Set();
    return value.map((file) => {
      if (!UUID.test(file?.id ?? "") || seen.has(file.id) || typeof file.name !== "string" || !file.name.trim() ||
        !Number.isInteger(file.size) || file.size < 0 || typeof file.type !== "string") invalid("A file isn't valid.");
      if (file.size > (config.maxBytes ?? LIMITS.fileBytes)) invalid(`${file.name} is too large.`);
      if (!acceptsType(config.accept, file.type.toLowerCase())) invalid(`${file.name} isn't an allowed file type.`);
      seen.add(file.id);
      return { id: file.id.toLowerCase(), name: file.name.trim().slice(0, 255), size: file.size, type: file.type.toLowerCase() };
    });
  },
  toText: (value) => (Array.isArray(value) ? value.map((file) => file.name).join(", ") : ""),
  fromText: () => undefined,
});
