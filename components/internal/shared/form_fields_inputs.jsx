"use client";

import React from "react";

import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import { Checkbox } from "@geiger/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui/select";
import { cn } from "@/lib/utils";
import { isFieldVisible } from "@/lib/forms/fields";

// Renders organiser-built fields (lib/forms/fields.js) for a visitor to fill in; hidden show-when fields are skipped.
export function FormFieldsInputs({ fields, values, onChange, idPrefix = "field" }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {fields
        .filter((field) => isFieldVisible(field, values))
        .map((field) => {
          const id = `${idPrefix}-${field.id}`;
          const value = values[field.id];
          const label = (
            <span className="text-xs text-text-secondary">
              {field.label}
              {field.required ? <span className="text-text-tertiary"> *</span> : null}
            </span>
          );

          if (field.type === "checkbox") {
            return (
              <label key={field.id} htmlFor={id} className="flex cursor-pointer items-center gap-2.5 sm:col-span-2">
                <Checkbox id={id} checked={value === true} onCheckedChange={(v) => onChange(field.id, v === true)} />
                {label}
              </label>
            );
          }

          const wide = field.type === "textarea";
          return (
            <div key={field.id} className={cn("space-y-1.5", wide && "sm:col-span-2")}>
              <label htmlFor={id}>{label}</label>
              {field.type === "textarea" ? (
                <Textarea id={id} rows={3} value={value ?? ""} onChange={(e) => onChange(field.id, e.target.value)} />
              ) : field.type === "select" ? (
                <Select value={value ?? ""} onValueChange={(v) => onChange(field.id, v)}>
                  <SelectTrigger id={id}>
                    <SelectValue placeholder="Choose…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(field.options || []).map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id={id}
                  type={field.type === "email" || field.type === "number" ? field.type : "text"}
                  value={value ?? ""}
                  onChange={(e) => onChange(field.id, e.target.value)}
                />
              )}
            </div>
          );
        })}
    </div>
  );
}

export default FormFieldsInputs;
