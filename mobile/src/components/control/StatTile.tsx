import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme/tokens";

type Props = { label: string; value: string; hint?: string };

// One figure in a row of figures; rows wrap them in a flex row so each tile takes an equal share.
export function StatTile({ label, value, hint }: Props) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}${hint ? `, ${hint}` : ""}`}>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
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
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
    gap: 4,
  },
  label: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  value: {
    ...type.figureSmall,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
  },
});
