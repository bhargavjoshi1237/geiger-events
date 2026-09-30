import { validateReferenceTargets } from "../config/fields.js";

export async function resolveReferences(context, definition, references, store) {
  const ids = Array.isArray(references) ? references.map((ref) => ref?.targetId) : [];
  const targets = ids.length ? await store.getReferenceTargets(context, ids) : [];
  return validateReferenceTargets(definition, references, targets, context);
}
