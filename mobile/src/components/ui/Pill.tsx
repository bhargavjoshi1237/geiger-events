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

// Status chip: a coloured dot + label on a 15% tint at 30% border.
export function Pill({ label, tone }: PillProps) {
  const tint = TONES[tone];
  return (
    <View style={[styles.pill, { backgroundColor: `${tint}26`, borderColor: `${tint}4D` }]}>
      <View style={[styles.dot, { backgroundColor: tint }]} />
      <Text style={styles.label}>{label}</Text>
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
    paddingHorizontal: spacing.sm + 2,
    alignSelf: "flex-start",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...type.caption,
    color: colors.foreground,
  },
});
