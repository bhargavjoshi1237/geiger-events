import { liveFields } from "../schema/definition.js";

// Lookups return the target's stored text; option ids and booleans are swapped for what people see.
export function labelLookups(definition, objectId, rows) {
  const lookups = liveFields(definition, objectId).filter((field) => field.type === "lookup");
  if (!lookups.length) return rows;
  const byId = new Map(definition.fields.map((field) => [field.id, field]));
  return rows.map((row) => {
    const computed = { ...(row.computed ?? {}) };
    for (const field of lookups) {
      const target = byId.get(field.config.targetFieldId);
      const raw = computed[field.id];
      if (raw === null || raw === undefined || !target) continue;
      if (target.type === "single_select" || target.type === "multi_select") {
        const labels = new Map((target.config.options ?? []).map((option) => [option.id, option.label]));
        computed[field.id] = String(raw).replace(/opt_[a-z0-9]{1,24}/g, (id) => labels.get(id) ?? "").replace(/[[\]"]/g, "").replace(/(, )+/g, ", ").replace(/^, |, $/g, "");
      } else if (target.type === "checkbox") {
        computed[field.id] = String(raw).replace(/\btrue\b/g, "Yes").replace(/\bfalse\b/g, "No");
      } else if (target.type === "rich_text") {
        computed[field.id] = String(raw).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      }
    }
    return { ...row, computed };
  });
}
