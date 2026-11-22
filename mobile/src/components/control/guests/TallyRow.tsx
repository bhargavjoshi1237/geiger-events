import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { TickMeter } from "@/components/ui/TickMeter";
import { colors, spacing, type } from "@/theme/tokens";

type Props = { label: string; count: number; of: number; divider?: boolean };

// One answer in a report breakdown: its label, its share of the total on a short tick scale, and the mono count.
export function TallyRow({ label, count, of, divider = true }: Props) {
  return (
    <View style={[styles.row, divider && styles.divided]} accessible accessibilityLabel={`${label}: ${count} of ${of}`}>
      <Text style={styles.label} numberOfLines={2}>
        {label}
      </Text>
      <View style={styles.meter}>
        <TickMeter value={count} max={of} ticks={18} height={10} tone="neutral" label={`${count} of ${of}`} />
      </View>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  label: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    color: colors.foreground,
  },
  meter: {
    width: 84,
  },
  count: {
    ...type.mono,
    minWidth: 32,
    textAlign: "right",
    color: colors.foreground,
  },
});
