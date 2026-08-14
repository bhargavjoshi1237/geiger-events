import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type DetailRowProps = {
  label: string;
  value: string;
};

// A label/value pair, ListRow-style, for receipt and ticket details.
export function DetailRow({ label, value }: DetailRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.lg,
    paddingVertical: spacing.sm + 2,
  },
  label: {
    ...type.label,
    color: colors.textSecondary,
  },
  value: {
    ...type.label,
    flexShrink: 1,
    textAlign: "right",
    color: colors.foreground,
  },
});
