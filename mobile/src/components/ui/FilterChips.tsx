import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";

export type FilterChip = { value: string; label: string; count?: number | null };

type FilterChipsProps = {
  options: FilterChip[];
  value: string;
  onChange: (value: string) => void;
};

export function FilterChips({ options, value, onChange }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            accessibilityLabel={o.count ? `${o.label}, ${o.count}` : o.label}
            hitSlop={6}
            onPress={() => {
              selectionFeedback();
              if (!active) onChange(o.value);
            }}
            style={({ pressed }) => [
              styles.chip,
              active ? styles.chipActive : styles.chipIdle,
              pressed && styles.pressed,
            ]}
          >
            <Text style={[styles.label, active ? styles.labelActive : styles.labelIdle]}>
              {o.label}
              {o.count ? ` ${o.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.lg,
  },
  chip: {
    height: 32,
    justifyContent: "center",
    borderRadius: radius.pill,
    paddingHorizontal: 14,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipIdle: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: {
    opacity: 0.7,
  },
  label: {
    ...type.captionStrong,
  },
  labelActive: {
    color: colors.primaryForeground,
  },
  labelIdle: {
    color: colors.mutedForeground,
  },
});
