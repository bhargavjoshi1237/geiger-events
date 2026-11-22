import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme/tokens";

type Tone = "neutral" | "success" | "warning" | "info" | "danger";

const TINT: Record<Tone, string> = {
  neutral: colors.foreground,
  success: colors.success,
  warning: colors.warning,
  info: colors.info,
  danger: colors.danger,
};

// A small mono count in a tinted capsule: pending approvals, unread threads, items waiting.
export function CountBadge({ value, tone = "neutral" }: { value: string | number; tone?: Tone }) {
  const tint = TINT[tone];
  return (
    <View style={[styles.badge, tone === "neutral" ? styles.neutral : { borderColor: `${tint}59`, backgroundColor: `${tint}1A` }]}>
      <Text style={[styles.text, { color: tint }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 24,
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  neutral: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.surfaceActive,
  },
  text: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 15,
  },
});
