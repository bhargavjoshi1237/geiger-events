import { isObject } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { liveFields } from "../schema/definition.js";
import { getType } from "../schema/types/index.js";

const bad = (message) => { throw new WorkspaceError("invalid_process", 422, message); };
export const NO_PROCESS = Object.freeze({ enforce: false, moves: [], requires: {} });
const isEmpty = (value) => value === null || value === undefined || value === "" || (Array.isArray(value) && !value.length);

// Fields that can be "required to enter" a stage: stored, editable, kept in the record's values.
export const requirable = (field) => getType(field.type)?.editable && getType(field.type)?.cast !== "link";

// Stage rules for one list: { enforce, moves: [{ from, to }], requires: { <status>: [fieldId] } }; from = null means "a new record".
export function validateProcess(definition, objectId, input) {
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) bad("That list no longer exists.");
  if (!isObject(input)) bad("Describe the stage rules.");
  const keys = new Set((object.statuses ?? []).map((status) => status.key));
  if (!keys.size) bad("Add statuses to this list first.");
  const seen = new Set();
  const moves = [];
  for (const move of Array.isArray(input.moves) ? input.moves.slice(0, 1000) : []) {
    if (!isObject(move)) continue;
    const from = move.from === null || move.from === undefined ? null : move.from;
    if ((from !== null && !keys.has(from)) || !keys.has(move.to) || from === move.to) continue;
    const id = `${from ?? ""}>${move.to}`;
    if (seen.has(id)) continue;
    seen.add(id);
    moves.push({ from, to: move.to });
  }
  const fields = new Map(liveFields(definition, objectId).filter(requirable).map((field) => [field.id, field]));
  const requires = {};
  for (const [status, ids] of Object.entries(isObject(input.requires) ? input.requires : {})) {
    if (!keys.has(status) || !Array.isArray(ids)) continue;
    const list = [...new Set(ids)].filter((id) => fields.has(id)).slice(0, 50);
    if (list.length) requires[status] = list;
  }
  return { enforce: input.enforce === true, moves, requires };
}

// Drops moves and requirements that point at statuses or fields that no longer exist.
export function cleanProcess(definition, objectId, config) {
  try {
    return validateProcess(definition, objectId, config ?? NO_PROCESS);
  } catch {
    return NO_PROCESS;
  }
}

// Statuses a record may move to from `from` (null = a new record), or null when moves aren't restricted.
export function allowedMoves(process, object, from) {
  if (!process?.enforce) return null;
  const starts = process.moves.filter((move) => move.from === null).map((move) => move.to);
  if (from === null || from === undefined) return starts.length ? starts : (object?.statuses?.[0] ? [object.statuses[0].key] : []);
  return process.moves.filter((move) => move.from === from).map((move) => move.to);
}

const statusLabel = (object, key) => object?.statuses?.find((status) => status.key === key)?.label ?? key ?? "No status";

// Checks a status change (or a new record's first status) against the rules; null when it's allowed.
export function checkMove(process, object, { from = null, to = null, values = {}, fields = [], creating = false }) {
  if (!process?.enforce) return null;
  if (!creating && from === to) return null;
  if (creating && (to === null || to === undefined)) return null;
  const allowed = allowedMoves(process, object, creating ? null : from);
  if (to === null || to === undefined || !allowed.includes(to)) {
    const next = allowed.map((key) => statusLabel(object, key));
    return {
      code: "move_not_allowed", allowed,
      message: creating
        ? `New ${object.plural.toLowerCase()} can't start as ${statusLabel(object, to)}.${next.length ? ` Start as ${next.join(" or ")}.` : ""}`
        : `${statusLabel(object, from)} can't move to ${statusLabel(object, to)}.${next.length ? ` Next: ${next.join(", ")}.` : " It's a final stage."}`,
    };
  }
  const missing = (process.requires?.[to] ?? []).filter((id) => isEmpty(values?.[id]));
  if (missing.length) {
    const byId = new Map(fields.map((field) => [field.id, field]));
    const names = missing.map((id) => byId.get(id)?.name ?? "a field");
    return {
      code: "stage_requirements",
      message: `Fill in ${names.join(", ")} before moving to ${statusLabel(object, to)}.`,
      fields: Object.fromEntries(missing.map((id) => [id, `Required for ${statusLabel(object, to)}.`])),
    };
  }
  return null;
}

// The error a refused move raises; staff who can configure may resend with force.
export function moveError(problem) {
  if (problem.code === "stage_requirements") return new WorkspaceError("invalid_input", 422, problem.message, problem.fields);
  return new WorkspaceError("move_not_allowed", 409, problem.message, { allowed: problem.allowed });
}
