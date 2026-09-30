// Organiser-built form fields — { id, label, type, required, options?, showWhen? } — shared by registration forms and sponsor enquiries.

export const FIELD_TYPE_OPTIONS = [
  { value: "text", label: "Short text" },
  { value: "email", label: "Email" },
  { value: "textarea", label: "Paragraph" },
  { value: "select", label: "Dropdown" },
  { value: "checkbox", label: "Checkbox" },
  { value: "number", label: "Number" },
];

export function newField() {
  return {
    id: `f_${Math.random().toString(36).slice(2, 8)}`,
    label: "Untitled question",
    type: "text",
    required: false,
  };
}

// Checkbox answers are booleans; show-when rules compare as text, so "true"/"false" match them.
const asText = (v) => (typeof v === "boolean" ? String(v) : String(v ?? "").trim());

/** A field with a show-when rule is visible only while the referenced answer equals the rule's value. */
export function isFieldVisible(field, values) {
  if (!field.showWhen?.fieldId) return true;
  return (
    asText(values[field.showWhen.fieldId]).toLowerCase() ===
    asText(field.showWhen.equals).toLowerCase()
  );
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The first problem with the answers, as a sentence for a toast, or null when they're good to send. */
export function validateFields(fields, values) {
  for (const field of fields) {
    if (!isFieldVisible(field, values)) continue;
    const value = values[field.id];
    const empty = field.type === "checkbox" ? value !== true : !asText(value);
    if (field.required && empty) return `${field.label || "A required field"} is required.`;
    if (field.type === "email" && !empty && !EMAIL.test(asText(value)))
      return `${field.label || "Email"} doesn't look like an email address.`;
  }
  return null;
}

/** Visible answers with their labels, so later edits to the form never orphan what was submitted. */
export function answersSnapshot(fields, values) {
  return fields
    .filter((f) => isFieldVisible(f, values))
    .map((f) => ({ id: f.id, label: f.label, value: values[f.id] ?? (f.type === "checkbox" ? false : "") }));
}

// Anonymous JSON must be safe to render even when it bypasses our form.
export function normalizeAnswers(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((answer) =>
    answer && typeof answer === "object" &&
    typeof answer.id === "string" && typeof answer.label === "string" &&
    (typeof answer.value === "string" || typeof answer.value === "boolean" ||
      (typeof answer.value === "number" && Number.isFinite(answer.value))),
  ).map(({ id, label, value }) => ({ id, label, value }));
}
