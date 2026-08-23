import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme/tokens";

type PillTone = "success" | "danger" | "info" | "warning" | "neutral";

type PillProps = {
  label: string;
  tone: PillTone;
};

const TONES: Record<PillTone, string> = {
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  warning: colors.warning,
  neutral: colors.mutedForeground,
};

// Status chip: a coloured dot + tinted label on a 15% tint at 30% border.
export function Pill({ label, tone }: PillProps) {
  const tint = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: `${tint}1A`, borderColor: `${tint}40` }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    alignSelf: "flex-start",
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  label: {
    ...type.caption,
    fontSize: 10,
    lineHeight: 14,
  },
});
