import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme/tokens";

type Props = { label: string; value: string; hint?: string };

// One figure in a row of figures; rows wrap them in a flex row so each tile takes an equal share.
export function StatTile({ label, value, hint }: Props) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      {hint ? (
        <Text style={styles.hint} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    gap: 2,
  },
  value: {
    ...type.heading,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  label: {
    ...type.caption,
    color: colors.textSecondary,
  },
  hint: {
    ...type.micro,
    color: colors.textTertiary,
  },
});
