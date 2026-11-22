import { Image } from "expo-image";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { ListEditor } from "@/components/control/fields/ListEditor";
import { RefPicker } from "@/components/control/fields/RefPicker";
import { ChoicePicker } from "@/components/control/forms/ChoicePicker";
import { Readback, readDate, type Reading } from "@/components/control/forms/DateReadback";
import { FormField } from "@/components/control/forms/FormField";
import { ToggleRow } from "@/components/control/forms/ToggleRow";
import { CountBadge } from "@/components/ui/CountBadge";
import { Icon, type IconName } from "@/components/ui/icons";
import { Input } from "@/components/ui/Input";
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

const TEXT_ICON: Partial<Record<ControlField["type"], IconName>> = {
  email: "mail",
  url: "link",
  date: "calendar",
  time: "clock",
};

// The allowed range as a mono aside, e.g. "1–10".
function rangeOf(field: ControlField): string | undefined {
  if (field.min != null && field.max != null) return `${field.min}–${field.max}`;
  if (field.min != null) return `min ${field.min}`;
  if (field.max != null) return `max ${field.max}`;
  return undefined;
}

export function FieldEditor({ field, statuses, value, onChange, projectId }: Props) {
  const label = field.label || field.key;
  const required = Boolean(field.required);

  if (READ_ONLY_TYPES.has(field.type)) {
    return <ReadOnlyRow label={label} value={displayValue(field, value) || "Not set"} hint={field.hint ?? "Change this on the dashboard."} />;
  }

  switch (field.type) {
    case "switch":
      return <ToggleRow label={label} hint={field.hint} value={Boolean(value)} onValueChange={onChange} />;
    case "status": {
      const options = (statuses ?? []).map((s) => ({ value: s.value, label: s.label, tone: s.tone }));
      return (
        <FormField label={label} hint={field.hint} required={required}>
          <ChoicePicker layout="chips" options={options} value={String(value ?? "")} onChange={onChange} label={label} />
        </FormField>
      );
    }
    case "select":
    case "tabs":
      return (
        <FormField label={label} hint={field.hint} required={required}>
          <ChoicePicker options={field.options ?? []} value={String(value ?? "")} onChange={onChange} label={label} />
        </FormField>
      );
    case "list": {
      const items = Array.isArray(value) ? value.map(String) : [];
      return (
        <FormField label={label} hint={field.hint} required={required} aside={items.length ? <CountBadge value={items.length} /> : undefined}>
          <ListEditor value={items} onChange={onChange} placeholder={field.placeholder} />
        </FormField>
      );
    }
    case "ref":
      return (
        <FormField label={label} hint={field.hint} required={required}>
          <RefPicker refModule={field.refModule ?? ""} projectId={projectId} value={typeof value === "string" ? value : ""} onChange={onChange} label={label} />
        </FormField>
      );
    case "number":
      return <NumberField field={field} label={label} value={value} onChange={onChange} />;
    case "datetime":
      return <DateTimeField field={field} label={label} value={value} onChange={onChange} />;
    case "image":
      return (
        <FormField label={label} hint={field.hint ?? "Paste an image address; uploads happen on the dashboard."} required={required}>
          {typeof value === "string" && value ? <Image source={{ uri: value }} style={styles.preview} contentFit="cover" transition={150} /> : null}
          <Input
            leftIcon="image"
            value={String(value ?? "")}
            onChangeText={onChange}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            autoCorrect={false}
          />
        </FormField>
      );
    default: {
      const multiline = field.type === "textarea";
      const figure = field.type === "date" || field.type === "time";
      const keyboard = field.type === "email" ? "email-address" : field.type === "url" ? "url" : figure ? "numbers-and-punctuation" : "default";
      const placeholder = field.placeholder ?? (field.type === "date" ? "YYYY-MM-DD" : field.type === "time" ? "HH:MM" : undefined);
      const reading = field.type === "date" ? readDate(String(value ?? "")) : null;
      return (
        <FormField label={label} hint={field.hint} required={required} status={reading ? <Readback reading={reading} /> : null}>
          <Input
            leftIcon={multiline ? undefined : TEXT_ICON[field.type]}
            value={String(value ?? "")}
            onChangeText={onChange}
            placeholder={placeholder}
            keyboardType={keyboard}
            autoCapitalize={field.type === "email" || field.type === "url" ? "none" : "sentences"}
            multiline={multiline}
            textAlignVertical={multiline ? "top" : undefined}
            style={multiline ? styles.multiline : figure ? styles.figure : undefined}
          />
        </FormField>
      );
    }
  }
}

// A value the app can show but not change (audience and access pickers): a row with the value and a lock.
function ReadOnlyRow({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <View style={styles.readOnly} accessible accessibilityLabel={`${label}: ${value}. ${hint}`}>
      <View style={styles.readOnlyTop}>
        <Text style={styles.readOnlyLabel} numberOfLines={2}>
          {label}
        </Text>
        <View style={styles.readOnlyValue}>
          <Text style={styles.readOnlyText} numberOfLines={1}>
            {value}
          </Text>
          <Icon name="lock" size={13} color={colors.textTertiary} />
        </View>
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </View>
  );
}

// Typing "1." or "-" must not be thrown away, so the text is kept and only a complete number reaches the draft.
function NumberField({ field, label, value, onChange }: { field: ControlField; label: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(value == null ? "" : String(value));
  return (
    <FormField label={label} hint={field.hint} aside={rangeOf(field)} required={Boolean(field.required)}>
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
        style={styles.figure}
      />
    </FormField>
  );
}

function DateTimeField({ field, label, value, onChange }: { field: ControlField; label: string; value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = useState(localStamp(value));
  const typed = text.trim();
  const m = STAMP.exec(typed);
  const reading: Reading | null = !typed ? null : m ? readDate(`${m[1]}-${m[2]}-${m[3]}`, `${m[4]}:${m[5]}`) : { ok: false, text: "Write it as YYYY-MM-DD HH:MM" };
  return (
    <FormField label={label} hint={field.hint ?? "Your local time, as YYYY-MM-DD HH:MM."} required={Boolean(field.required)} status={reading ? <Readback reading={reading} /> : null}>
      <Input
        leftIcon="calendar-clock"
        value={text}
        onChangeText={(next) => {
          setText(next);
          if (!next.trim()) return onChange("");
          const parts = STAMP.exec(next.trim());
          if (parts) onChange(new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), Number(parts[4]), Number(parts[5])).toISOString());
        }}
        placeholder="2026-12-01 18:30"
        keyboardType="numbers-and-punctuation"
        style={styles.figure}
      />
    </FormField>
  );
}

const styles = StyleSheet.create({
  readOnly: {
    gap: spacing.xs + 2,
  },
  readOnlyTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  readOnlyLabel: {
    ...type.label,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  readOnlyValue: {
    maxWidth: "55%",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  readOnlyText: {
    ...type.body,
    fontSize: 14,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
  },
  figure: {
    ...type.mono,
    fontSize: 15,
    lineHeight: 20,
  },
  multiline: {
    minHeight: 110,
    paddingTop: spacing.md,
  },
  preview: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
  },
});
