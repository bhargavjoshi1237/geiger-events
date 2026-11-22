import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import { PickerSheet, type PickerOption } from "@/components/control/inventory/PickerSheet";
import { Icon } from "@/components/ui/icons";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Props = {
  label: string;
  placeholder: string;
  options: PickerOption[];
  value: string;
  onChange: (value: string) => void;
  emptyText?: string;
};

// A select-style trigger that opens a searchable PickerSheet; the pick's detail (stock, date) rides along in mono.
export function PickerField({ label, placeholder, options, value, onChange, emptyText }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selected?.label ?? placeholder}${selected?.detail ? `, ${selected.detail}` : ""}`}
        onPress={() => {
          tapFeedback();
          setOpen(true);
        }}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}
      >
        <Text style={[styles.text, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        {selected?.detail ? (
          <Text style={styles.detail} numberOfLines={1}>
            {selected.detail}
          </Text>
        ) : null}
        <Icon name="chevrons-up-down" size={16} color={colors.textTertiary} />
      </Pressable>
      <PickerSheet visible={open} title={label} options={options} value={value} onPick={onChange} onClose={() => setOpen(false)} emptyText={emptyText} />
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
  pressed: {
    opacity: 0.6,
  },
  text: {
    ...type.body,
    flex: 1,
    color: colors.foreground,
  },
  placeholder: {
    color: colors.textTertiary,
  },
  detail: {
    ...type.monoSmall,
    fontSize: 11,
    flexShrink: 0,
    maxWidth: "45%",
    color: colors.textSecondary,
  },
});
