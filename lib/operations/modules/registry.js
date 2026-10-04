import { validateDefinition } from "../config/definition.js";

const available = new Set(["records", "forms"]);
const field = (id, label, type, extra = {}) => ({ id, label, type, ...extra });
const recordModule = (key, label, titleFieldId, fields) => validateDefinition({
  key, version: 1, label, titleFieldId, sourceKind: "native",
  capabilities: ["records", "forms"], fields,
  states: [
    { key: "new", label: "New" },
    { key: "in-progress", label: "In progress" },
    { key: "complete", label: "Complete" },
  ],
  transitions: [
    { from: "new", to: "in-progress" },
    { from: "in-progress", to: "complete" },
    { from: "complete", to: "in-progress" },
  ],
  views: ["table", "board"],
}, available);

const nativeDefinitions = Object.freeze({
  "ops-people": recordModule("ops-people", "People", "name", [
    field("name", "Name", "text", { required: true }),
    field("email", "Email", "email"),
  ]),
  "ops-resources": recordModule("ops-resources", "Resources", "name", [
    field("name", "Name", "text", { required: true }),
    field("kind", "Kind", "select", { required: true, options: ["room", "equipment"] }),
    field("capacity", "Capacity", "number", { required: true, min: 1 }),
  ]),
  "ops-activities": recordModule("ops-activities", "Activities", "title", [
    field("title", "Title", "text", { required: true }),
    field("kind", "Kind", "text", { required: true }),
    field("timezone", "Time zone", "text", { required: true }),
  ]),
  "accepted-items": recordModule("accepted-items", "Accepted items", "title", [
    field("title", "Title", "text", { required: true }),
    field("category", "Category", "select", { options: ["Talk", "Poster"] }),
  ]),
  "speaker-preparation": recordModule("speaker-preparation", "Speaker preparation", "name", [
    field("name", "Name", "text", { required: true }),
    field("email", "Email", "email"), field("confirmed", "Confirmed", "boolean"),
  ]),
  "course-preparation": recordModule("course-preparation", "Course preparation", "title", [
    field("title", "Title", "text", { required: true }),
    field("trainer", "Trainer", "text"),
    field("attendee-target", "Attendee target", "number", { min: 0 }),
  ]),
  "equipment-checks": recordModule("equipment-checks", "Equipment checks", "item", [
    field("item", "Item", "text", { required: true }),
    field("quantity", "Quantity", "number", { min: 0 }),
    field("checked", "Checked", "boolean"),
  ]),
  entries: recordModule("entries", "Entries", "title", [
    field("title", "Title", "text", { required: true }),
    field("category", "Category", "select", { options: ["Individual", "Team"] }),
  ]),
  "judge-onboarding": recordModule("judge-onboarding", "Judge onboarding", "name", [
    field("name", "Name", "text", { required: true }),
    field("email", "Email", "email"), field("confirmed", "Confirmed", "boolean"),
  ]),
});

export function getModuleDefinition(key, version = 1) {
  if (version !== 1) return null;
  return Object.hasOwn(nativeDefinitions, key) ? nativeDefinitions[key] : null;
}

export function isNativeModuleKey(key) {
  return Object.hasOwn(nativeDefinitions, key);
}

export function listImplementedCapabilities() {
  return new Set(available);
}

export function isWorkflowModuleKey(key) {
  return ["ops-people", "ops-resources", "ops-activities"].includes(key);
}

export function getWorkflowModules() {
  return ["ops-people", "ops-resources", "ops-activities"]
    .map((key) => structuredClone(nativeDefinitions[key]));
}
