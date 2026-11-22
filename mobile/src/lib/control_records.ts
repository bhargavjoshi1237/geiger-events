import { ICONS, type IconName } from "@/components/ui/icons";
import { fmtDateTime } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import type { ControlField, ControlModule, ControlRecord } from "@/types/portal";

// Helpers for Control's generic records screens: every module is drawn from its catalog fields.

// The dashboard's audience and access pickers have no phone editor yet; they show as a summary.
export const READ_ONLY_TYPES = new Set(["audience", "access", "readonly"]);

export function iconOf(name: string | undefined, fallback: IconName = "layers"): IconName {
  return name && name in ICONS ? (name as IconName) : fallback;
}

export function fieldsOf(module: ControlModule): ControlField[] {
  return module.panels.flatMap((panel) => panel.fields);
}

// A ticketing record shows only the fields for its own kind; fields with no kinds listed apply to every kind.
export function appliesTo(field: ControlField, kind: string | null | undefined): boolean {
  return !field.forKinds?.length || (Boolean(kind) && field.forKinds.includes(kind as string));
}

export function readValue(record: ControlRecord | null, field: ControlField): unknown {
  if (!record) return undefined;
  if (field.scope === "config") return record.config[field.key];
  return (record as unknown as Record<string, unknown>)[field.key];
}

function audienceText(value: unknown): string {
  if (!value || typeof value !== "object") return "Everyone";
  const spec = value as { scope?: string; eventId?: string; emails?: unknown[]; include?: unknown[] };
  const people = Array.isArray(spec.emails) ? spec.emails.length : 0;
  if (people) return `${people} ${people === 1 ? "person" : "people"}`;
  if (spec.eventId || spec.scope === "event") return "One event's guests";
  if (Array.isArray(spec.include) && spec.include.length) return "A targeted group";
  return "Everyone";
}

// A value as one line of text, for lists and read-only fields.
export function displayValue(field: ControlField, value: unknown): string {
  if (value == null || value === "") return "";
  switch (field.type) {
    case "switch":
      return value ? "On" : "Off";
    case "list":
    case "readonly":
      if (Array.isArray(value)) return `${value.length} ${value.length === 1 ? "item" : "items"}`;
      if (typeof value === "object") return "Set on the dashboard";
      return String(value);
    case "select":
    case "tabs":
      return field.options?.find((o) => o.value === value)?.label ?? String(value);
    case "datetime":
      return fmtDateTime(String(value));
    case "audience":
      return audienceText(value);
    case "access":
      return typeof value === "object" ? "Restricted" : String(value);
    case "number":
      return typeof value === "number" ? value.toLocaleString("en-US") : String(value);
    default:
      return typeof value === "object" ? "Set on the dashboard" : String(value);
  }
}

export function statusOf(module: ControlModule, record: ControlRecord): StatusMeta | null {
  if (module.shape === "ticketing") return record.active === false ? { label: "Off", tone: "neutral" } : { label: "Active", tone: "success" };
  const status = module.statuses?.find((s) => s.value === record.status);
  return status ? { label: status.label, tone: status.tone } : record.status ? { label: record.status, tone: "neutral" } : null;
}

// The line under a record's name in a list, from the module's summary keys.
export function summaryLine(module: ControlModule, record: ControlRecord): string {
  const fields = fieldsOf(module);
  // Modules with several kinds (coupon, group, affiliate…) lead with the kind, as the dashboard's type column does.
  const kind = (module.kinds?.length ?? 0) > 1 ? module.kinds?.find((k) => k.value === record.kind)?.label : undefined;
  const parts = (module.summary ?? []).map((key) => {
    const field = fields.find((f) => f.key === key) ?? { key, label: key, type: "text" as const, scope: "config" as const };
    const text = displayValue(field, record.config[key]);
    return text && field.type === "number" ? `${text} ${field.label.toLowerCase()}` : text;
  });
  return [kind, ...parts].filter(Boolean).join(" · ");
}

export type Draft = Record<string, unknown>;

const draftKey = (field: ControlField) => `${field.scope}:${field.key}`;

export function draftFrom(module: ControlModule, record: ControlRecord | null): Draft {
  const draft: Draft = {};
  for (const field of fieldsOf(module)) draft[draftKey(field)] = readValue(record, field);
  return draft;
}

export function draftValue(draft: Draft, field: ControlField): unknown {
  return draft[draftKey(field)];
}

export function withValue(draft: Draft, field: ControlField, value: unknown): Draft {
  return { ...draft, [draftKey(field)]: value };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

// Only what changed, shaped the way the server's PATCH expects (root keys, plus a config object).
export function changesFrom(module: ControlModule, record: ControlRecord | null, draft: Draft, only?: Set<string>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  const config: Record<string, unknown> = {};
  for (const field of fieldsOf(module)) {
    if (READ_ONLY_TYPES.has(field.type)) continue;
    if (only && !only.has(field.key)) continue;
    const next = draftValue(draft, field);
    if (record && same(next, readValue(record, field))) continue;
    if (!record && (next === undefined || next === "")) continue;
    if (field.scope === "config") config[field.key] = next;
    else body[field.key] = next;
  }
  if (Object.keys(config).length) body.config = config;
  return body;
}
