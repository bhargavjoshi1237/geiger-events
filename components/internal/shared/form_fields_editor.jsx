"use client";

import React from "react";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  GripVertical,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";

import { EmptyState, Field, SectionCard } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Switch } from "@geiger/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { FIELD_TYPE_OPTIONS, newField } from "@/lib/forms/fields";

// The question builder shared by registration forms and sponsor enquiries; `lockedFields` are always asked and can't be edited.
export function FormFieldsEditor({
  fields,
  setFields,
  lockedFields = [],
  title = "Questions",
  description = "Drag-free reorder with the arrows. Add a 'show when' rule to make a question conditional.",
  emptyDescription = "Add the fields you want to collect at registration.",
}) {
  const addField = () => setFields((f) => [...f, newField()]);

  const updateField = (id, patch) =>
    setFields((f) => f.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const removeField = (id) => setFields((f) => f.filter((x) => x.id !== id));

  const moveField = (index, dir) =>
    setFields((f) => {
      const next = [...f];
      const j = index + dir;
      if (j < 0 || j >= next.length) return f;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });

  // Any other question, locked ones included, can gate this one.
  const fieldOptions = (currentId) =>
    [...lockedFields, ...fields].filter((f) => f.id !== currentId);

  const addButton = (
    <Button
      size="sm"
      className="bg-primary text-primary-foreground hover:bg-primary/90"
      onClick={addField}
    >
      <Plus className="h-4 w-4" /> Add question
    </Button>
  );

  return (
    <SectionCard title={title} description={description} action={addButton}>
      {lockedFields.length ? (
        <div className="mb-3 space-y-2">
          {lockedFields.map((field) => (
            <div
              key={field.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-subtle px-3 py-2.5"
            >
              <Lock className="h-3.5 w-3.5 shrink-0 text-text-tertiary" aria-hidden />
              <span className="flex-1 truncate text-sm text-foreground">{field.label}</span>
              <span className="text-xs text-text-tertiary">Always asked</span>
            </div>
          ))}
        </div>
      ) : null}

      {fields.length ? (
        <div className="space-y-3">
          {fields.map((field, i) => (
            <div key={field.id} className="rounded-lg border border-border bg-surface-card p-3">
              <div className="flex items-start gap-2">
                <div className="mt-7 flex flex-col items-center gap-0.5 text-text-tertiary">
                  <button
                    type="button"
                    aria-label="Move question up"
                    className="rounded p-0.5 transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    disabled={i === 0}
                    onClick={() => moveField(i, -1)}
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <GripVertical className="h-4 w-4 opacity-60" aria-hidden />
                  <button
                    type="button"
                    aria-label="Move question down"
                    className="rounded p-0.5 transition-colors hover:bg-surface-hover hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
                    disabled={i === fields.length - 1}
                    onClick={() => moveField(i, 1)}
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <div className="grid flex-1 gap-3">
                  <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
                    <Field label="Question label">
                      <Input
                        value={field.label}
                        onChange={(e) => updateField(field.id, { label: e.target.value })}
                      />
                    </Field>
                    <Field label="Type">
                      <Select
                        value={field.type}
                        onValueChange={(v) => updateField(field.id, { type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FIELD_TYPE_OPTIONS.map((o) => (
                            <SelectItem key={o.value} value={o.value}>
                              {o.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </div>

                  {field.type === "select" ? (
                    <Field label="Options" hint="Comma-separated choices for the dropdown.">
                      <Input
                        value={(field.options || []).join(", ")}
                        onChange={(e) =>
                          updateField(field.id, {
                            options: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="e.g. Small, Medium, Large"
                      />
                    </Field>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Switch
                        checked={!!field.required}
                        onCheckedChange={(v) => updateField(field.id, { required: v })}
                      />
                      Required
                    </label>

                    <div className="flex flex-1 items-center gap-2">
                      <span className="text-sm text-text-secondary">Show when</span>
                      <Select
                        value={field.showWhen?.fieldId || "always"}
                        onValueChange={(v) =>
                          updateField(field.id, {
                            showWhen:
                              v === "always"
                                ? undefined
                                : { fieldId: v, equals: field.showWhen?.equals || "" },
                          })
                        }
                      >
                        <SelectTrigger className="h-8 w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="always">Always shown</SelectItem>
                          {fieldOptions(field.id).map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {field.showWhen ? (
                        <Input
                          value={field.showWhen.equals}
                          onChange={(e) =>
                            updateField(field.id, {
                              showWhen: { ...field.showWhen, equals: e.target.value },
                            })
                          }
                          placeholder="equals…"
                          className="h-8 w-32"
                        />
                      ) : null}
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Remove question"
                      className="text-red-300 hover:bg-red-500/10 hover:text-red-300"
                      onClick={() => removeField(field.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : lockedFields.length ? (
        <p className="text-xs text-text-tertiary">
          No extra questions yet. Add one to ask anything else before you reply.
        </p>
      ) : (
        <EmptyState
          icon={FileText}
          title="No questions yet"
          description={emptyDescription}
          action={
            <Button
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={addField}
            >
              <Plus className="h-4 w-4" /> Add question
            </Button>
          }
        />
      )}
    </SectionCard>
  );
}

export default FormFieldsEditor;
