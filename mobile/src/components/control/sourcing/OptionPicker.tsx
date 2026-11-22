import React, { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { Sheet } from "@/components/ui/Sheet";
import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";

export type PickerOption = { value: string; label: string; hint?: string };

type Props = {
  label: string;
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  noneLabel?: string;
};

// A field-shaped trigger that opens a sheet of choices; long lists (venues, events, spaces) scroll.
export function OptionPicker({ label, options, value, onChange, placeholder = "Choose…", noneLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const all = noneLabel ? [{ value: "", label: noneLabel }, ...options] : options;

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? noneLabel ?? placeholder}`}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={[styles.triggerText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? (value === "" && noneLabel ? noneLabel : placeholder)}
        </Text>
        <Icon name="chevrons-up-down" size={16} color={colors.textTertiary} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {all.map((o, i) => (
            <Pressable
              key={o.value || "none"}
              accessibilityRole="button"
              accessibilityState={{ selected: o.value === value }}
              accessibilityLabel={o.label}
              onPress={() => {
                selectionFeedback();
                onChange(o.value);
                setOpen(false);
              }}
              style={({ pressed }) => [styles.row, i < all.length - 1 && styles.divided, pressed && styles.pressed]}
            >
              <View style={styles.rowText}>
                <Text style={styles.rowLabel} numberOfLines={1}>
                  {o.label}
                </Text>
                {"hint" in o && o.hint ? (
                  <Text style={styles.rowHint} numberOfLines={2}>
                    {o.hint}
                  </Text>
                ) : null}
              </View>
              {o.value === value ? <Icon name="check" size={18} color={colors.foreground} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  triggerText: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  placeholder: {
    color: colors.textTertiary,
  },
  pressed: {
    opacity: 0.6,
  },
  list: {
    maxHeight: 420,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    ...type.body,
    color: colors.foreground,
  },
  rowHint: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
