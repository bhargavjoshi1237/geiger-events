import { isObject } from "../contracts.js";
import { WorkspaceError } from "../errors.js";
import { liveFields } from "../schema/definition.js";
import { DAY_MS, MINUTE_MS, parseClock, parseDateString, toWall, wallDateString, fromWall } from "../../venue_booking/time.js";

const bad = (message) => { throw new WorkspaceError("invalid_automation", 422, message); };
const sameJson = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const oneOf = (value, options, fallback) => (options.includes(value) ? value : fallback);

// What can start an automation. `record` triggers have a list whose records the steps act on.
export const TRIGGER_KINDS = Object.freeze({
  "record.created": { label: "A record is added", icon: "circle-plus", record: true },
  "record.updated": { label: "A record changes", icon: "pencil", record: true },
  "status.changed": { label: "The status changes", icon: "git-commit-horizontal", record: true },
  date: { label: "A date is coming up or has passed", icon: "calendar-clock", record: true },
  schedule: { label: "On a schedule", icon: "repeat", record: false },
  manual: { label: "Someone presses Run", icon: "play", record: true },
  hook: { label: "A webhook is received", icon: "webhook", record: false },
  checkin: { label: "A ticket holder checks in", icon: "scan-line", record: false },
});
export const CHANGE_TRIGGERS = new Set(["record.created", "record.updated", "status.changed"]);
export const TIMED_TRIGGERS = new Set(["schedule", "date"]);
const EVERY = ["day", "weekday", "week", "month"];

function objectOf(definition, objectId, required = true) {
  if (!required && (objectId === null || objectId === undefined || objectId === "")) return null;
  const object = definition.objects.find((item) => item.id === objectId && !item.deletedAt);
  if (!object) bad("Choose a list.");
  return object;
}

function clock(value) {
  const minutes = parseClock(value);
  if (minutes === null || minutes >= 24 * 60) bad("Choose a time of day like 09:00.");
  return value.padStart(5, "0");
}

// Cleans a trigger; every kind keeps only the options it understands.
export function validateTrigger(definition, input) {
  if (!isObject(input) || !Object.hasOwn(TRIGGER_KINDS, input.kind)) bad("Choose what starts this automation.");
  const kind = input.kind;
  switch (kind) {
    case "record.created": {
      const object = objectOf(definition, input.objectId);
      return { kind, objectId: object.id, source: oneOf(input.source, ["any", "portal", "team"], "any") };
    }
    case "record.updated": {
      const object = objectOf(definition, input.objectId);
      const ids = new Set(liveFields(definition, object.id).map((field) => field.id));
      const fields = Array.isArray(input.fields) ? [...new Set(input.fields)].filter((id) => ids.has(id) || id === "status").slice(0, 50) : [];
      return { kind, objectId: object.id, fields };
    }
    case "status.changed": {
      const object = objectOf(definition, input.objectId);
      const keys = new Set((object.statuses ?? []).map((status) => status.key));
      if (!keys.size) bad("This list has no statuses.");
      const pick = (list) => (Array.isArray(list) ? [...new Set(list)].filter((key) => keys.has(key)) : []);
      return { kind, objectId: object.id, from: pick(input.from), to: pick(input.to) };
    }
    case "date": {
      const object = objectOf(definition, input.objectId);
      const field = liveFields(definition, object.id).find((item) => item.id === input.fieldId && ["date", "datetime"].includes(item.type));
      if (!field) bad("Choose a date field.");
      const offsetDays = Number.isInteger(input.offsetDays) ? Math.max(-365, Math.min(365, input.offsetDays)) : 0;
      return { kind, objectId: object.id, fieldId: field.id, offsetDays, time: clock(input.time ?? "09:00") };
    }
    case "schedule": {
      const object = objectOf(definition, input.objectId, false);
      const every = oneOf(input.every, EVERY, "day");
      return {
        kind, objectId: object?.id ?? null, every, time: clock(input.time ?? "09:00"),
        ...(every === "week" ? { weekday: Number.isInteger(input.weekday) ? Math.max(0, Math.min(6, input.weekday)) : 1 } : {}),
        ...(every === "month" ? { day: Number.isInteger(input.day) ? Math.max(1, Math.min(28, input.day)) : 1 } : {}),
      };
    }
    case "manual":
      return { kind, objectId: objectOf(definition, input.objectId).id };
    case "hook": {
      const object = objectOf(definition, input.objectId, false);
      return { kind, objectId: object?.id ?? null };
    }
    case "checkin": {
      // With a list, each check-in runs on that list's record for the ticket holder (linked ticket, else same email).
      const object = objectOf(definition, input.objectId, false);
      return { kind, objectId: object?.id ?? null };
    }
    default:
      return bad("Choose what starts this automation.");
  }
}

// The list a trigger's records come from (null when the trigger has no record).
export const subjectOf = (trigger) => (trigger?.objectId ?? null);

// A record change from the log: { action, objectId, actorKind, before, after }.
export function changeMatches(trigger, change) {
  if (!trigger || !change || change.objectId !== trigger.objectId) return false;
  const before = change.before ?? {};
  const after = change.after ?? {};
  switch (trigger.kind) {
    case "record.created":
      if (change.action !== "record.create") return false;
      if (trigger.source === "portal") return change.actorKind === "portal";
      if (trigger.source === "team") return change.actorKind === "staff";
      return true;
    case "record.updated": {
      if (change.action !== "record.update") return false;
      const valueChanged = (id) => !sameJson(before.values?.[id], after.values?.[id]);
      const linked = new Set((Array.isArray(after.links) ? after.links : []).map((link) => link?.fieldId));
      const statusChanged = "status" in after && before.status !== after.status;
      if (!trigger.fields.length) {
        return statusChanged || linked.size > 0 || Object.keys(after.values ?? {}).some(valueChanged);
      }
      return trigger.fields.some((id) => (id === "status" ? statusChanged : valueChanged(id) || linked.has(id)));
    }
    case "status.changed": {
      let from;
      let to;
      if (change.action === "record.create") {
        if (!after.status || trigger.from.length) return false;
        from = null;
        to = after.status;
      } else if (change.action === "record.update") {
        if (!("status" in after) || before.status === after.status) return false;
        from = before.status ?? null;
        to = after.status ?? null;
      } else return false;
      return (!trigger.from.length || trigger.from.includes(from)) && (!trigger.to.length || trigger.to.includes(to));
    }
    default:
      return false;
  }
}

function dayMatches(trigger, wall) {
  const dow = new Date(wall).getUTCDay();
  if (trigger.every === "weekday") return dow >= 1 && dow <= 5;
  if (trigger.every === "week") return dow === (trigger.weekday ?? 1);
  if (trigger.every === "month") return new Date(wall).getUTCDate() === (trigger.day ?? 1);
  return true;
}

// The first time a schedule or date trigger is due strictly after `after`, on the event's clock.
export function nextRunAt(trigger, after, timeZone = "UTC") {
  if (!TIMED_TRIGGERS.has(trigger?.kind)) return null;
  const minutes = parseClock(trigger.time ?? "09:00") ?? 9 * 60;
  const startDay = parseDateString(wallDateString(toWall(after, timeZone)));
  const pattern = trigger.kind === "date" ? { every: "day" } : trigger;
  for (let i = 0; i <= 62; i += 1) {
    const day = startDay + i * DAY_MS;
    if (!dayMatches(pattern, day)) continue;
    const instant = fromWall(day + minutes * MINUTE_MS, timeZone);
    if (instant.getTime() > new Date(after).getTime()) return instant;
  }
  return null;
}

// The record date a date trigger looks for on a given run day: offset -2 means "two days before the date".
export function targetDate(trigger, runAt, timeZone = "UTC") {
  const today = parseDateString(wallDateString(toWall(runAt, timeZone)));
  return wallDateString(today - (trigger.offsetDays ?? 0) * DAY_MS);
}

// One line describing a trigger, for lists and run logs.
export function triggerSummary(trigger, definition) {
  const object = definition?.objects.find((item) => item.id === trigger?.objectId);
  const list = object?.name?.toLowerCase() ?? "record";
  const status = (key) => object?.statuses?.find((item) => item.key === key)?.label ?? key;
  const field = (id) => (id === "status" ? "Status" : definition?.fields.find((item) => item.id === id)?.name ?? "a field");
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  switch (trigger?.kind) {
    case "record.created": return `When a ${list} is added${trigger.source === "portal" ? " in the portal" : trigger.source === "team" ? " by the team" : ""}`;
    case "record.updated": return trigger.fields.length ? `When ${trigger.fields.map(field).join(" or ")} changes on a ${list}` : `When a ${list} changes`;
    case "status.changed": {
      const to = trigger.to.length ? ` to ${trigger.to.map(status).join(" or ")}` : "";
      const from = trigger.from.length ? ` from ${trigger.from.map(status).join(" or ")}` : "";
      return `When a ${list} moves${from}${to}`;
    }
    case "date": {
      const n = Math.abs(trigger.offsetDays);
      const when = n === 0 ? "on" : `${n} day${n === 1 ? "" : "s"} ${trigger.offsetDays < 0 ? "before" : "after"}`;
      return `${when[0].toUpperCase()}${when.slice(1)} ${field(trigger.fieldId)} on each ${list}, at ${trigger.time}`;
    }
    case "schedule": {
      const every = trigger.every === "week" ? `Every ${days[trigger.weekday ?? 1]}` : trigger.every === "month" ? `On day ${trigger.day ?? 1} of each month`
        : trigger.every === "weekday" ? "Every weekday" : "Every day";
      return `${every} at ${trigger.time}${object ? `, for each ${list}` : ""}`;
    }
    case "manual": return `When someone presses Run on a ${list}`;
    case "hook": return "When the webhook address receives a request";
    case "checkin": return "When a ticket holder checks in";
    default: return "When something happens";
  }
}
