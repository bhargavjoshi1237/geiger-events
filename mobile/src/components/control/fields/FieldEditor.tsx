import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ListEditor } from "@/components/control/fields/ListEditor";
import { RefPicker } from "@/components/control/fields/RefPicker";
import { Field } from "@/components/ui/Field";
import { FilterChips } from "@/components/ui/FilterChips";
import { Input } from "@/components/ui/Input";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import { displayValue, READ_ONLY_TYPES } from "@/lib/control_records";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlField, ControlStatusOption } from "@/types/portal";

type Props = {
  field: ControlField;
  statuses?: ControlStatusOption[];
  value: unknown;
  onChange: (value: unknown) => void;
  projectId: string;
};

const pad = (n: number) => String(n).padStart(2, "0");

// "YYYY-MM-DD HH:MM" in the phone's time zone, which is how the dashboard's picker shows it too.
function localStamp(iso: unknown): string {
  if (typeof iso !== "string" || !iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const STAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/;

export function FieldEditor({ field, statuses, value, onChange, projectId }: Props) {
  const label = field.label || field.key;

  if (READ_ONLY_TYPES.has(field.type)) {
    return (
      <Field label={label} hint={field.hint ?? "Change this on the dashboard."}>
        <View style={styles.readOnly}>
          <Text style={styles.readOnlyText}>{displayValue(field, value) || "Not set"}</Text>
        </View>
      </Field>
    );
  }

  switch (field.type) {
    case "switch":
      return (
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.switchLabel}>{label}</Text>
            {field.hint ? <Text style={styles.hint}>{field.hint}</Text> : null}
          </View>
          <Switch value={Boolean(value)} onValueChange={onChange} label={label} />
        </View>
      );
    case "status": {
      const options = (statuses ?? []).map((s) => ({ value: s.value, label: s.label }));
      return (
        <Field label={label} hint={field.hint}>
          <FilterChips options={options} value={String(value ?? "")} onChange={onChange} />
        </Field>
      );
    }
    case "select":
    case "tabs": {
      const options = field.options ?? [];
      return (
        <Field label={label} hint={field.hint}>
          {options.length <= 3 ? (
            <Segmented options={options} value={String(value ?? "")} onChange={onChange} />
          ) : (
            <FilterChips options={options} value={String(value ?? "")} onChange={onChange} />
          )}
        </Field>
      );
    }
    case "list":
      return (
        <Field label={label} hint={field.hint}>
          <ListEditor value={Array.isArray(value) ? value.map(String) : []} onChange={onChange} placeholder={field.placeholder} />
        </Field>
      );
    case "ref":
      return (
        <Field label={label} hint={field.hint}>
          <RefPicker refModule={field.refModule ?? ""} projectId={projectId} value={typeof value === "string" ? value : ""} onChange={onChange} label={label} />
        </Field>
      );
    case "number":
      return <NumberField field={field} label={label} value={value} onChange={onChange} />;
    case "datetime":
      return <DateTimeField field={field} label={label} value={value} onChange={onChange} />;
    case "image":
      return (
        <Field label={label} hint={field.hint ?? "Paste an image address; uploads happen on the dashboard."}>
          {typeof value === "string" && value ? <Image source={{ uri: value }} style={styles.preview} contentFit="cover" /> : null}
          <Input value={String(value ?? "")} onChangeText={onChange} placeholder="https://…" autoCapitalize="none" keyboardType="url" autoCorrect={false} />
        </Field>
      );
    default: {
      const multiline = field.type === "textarea";
      const keyboard = field.type === "email" ? "email-address" : field.type === "url" ? "url" : field.type === "date" || field.type === "time" ? "numbers-and-punctuation" : "default";
      const placeholder = field.placeholder ?? (field.type === "date" ? "YYYY-MM-DD" : field.type === "time" ? "HH:MM" : undefined);
      return (
        <Field label={label} hint={field.hint}>
          <Input
            value={String(value ?? "")}
            onChangeText={onChange}
            placeholder={placeholder}
            keyboardType={keyboard}
            autoCapitalize={field.type === "email" || field.type === "url" ? "none" : "sentences"}
            multiline={multiline}
            textAlignVertical={multiline ? "top" : undefined}
            style={multiline ? styles.multiline : undefined}
          />
        </Field>
      );
    }
  }
}

// Typing "1." or "-" must not be thrown away, so the text is kept and only a complete number reaches the draft.
function NumberField({ field, label, value, onChange }: { field: ControlField; label: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  return (
    <Field label={label} hint={field.hint}>
      <Input
        value={text}
        onChangeText={(next) => {
          setText(next);
          const trimmed = next.trim().replace(",", ".");
          if (!trimmed) onChange(null);
          else if (Number.isFinite(Number(trimmed))) onChange(Number(trimmed));
        }}
        placeholder={field.placeholder}
        keyboardType="decimal-pad"
      />
    </Field>
  );
}

function DateTimeField({ field, label, value, onChange }: { field: ControlField; label: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(localStamp(value));
  return (
    <Field label={label} hint={field.hint ?? "Your local time, as YYYY-MM-DD HH:MM."}>
      <Input
        value={text}
        onChangeText={(next) => {
          setText(next);
          if (!next.trim()) return onChange("");
          const m = STAMP.exec(next.trim());
          if (m) onChange(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).toISOString());
        }}
        placeholder="2026-12-01 18:30"
        keyboardType="numbers-and-punctuation"
      />
    </Field>
  );
}

const styles = StyleSheet.create({
  readOnly: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  readOnlyText: {
    ...type.body,
    color: colors.textSecondary,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  switchText: {
    flex: 1,
    gap: 2,
  },
  switchLabel: {
    ...type.label,
    color: colors.foreground,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
  },
  multiline: {
    minHeight: 110,
    paddingTop: spacing.md,
  },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
  },
});
