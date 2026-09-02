import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme/tokens";

type PillTone = "success" | "danger" | "info" | "warning" | "neutral";
type PillVariant = "tint" | "outline";

type PillProps = {
  label: string;
  tone: PillTone;
  variant?: PillVariant;
  dot?: boolean;
};

const TONES: Record<PillTone, string> = {
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  warning: colors.warning,
  neutral: colors.mutedForeground,
};

// "tint" is the status badge on cards; "outline" is the quieter row-trailing badge in lists.
export function Pill({ label, tone, variant = "tint", dot = true }: PillProps) {
  const tint = TONES[tone];
  const outline = variant === "outline";
  return (
    <View
      style={[
        styles.pill,
        outline
          ? styles.outline
          : { backgroundColor: `${tint}1A`, borderColor: `${tint}40` },
      ]}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: tint }]} /> : null}
      <Text
        style={[styles.label, { color: outline ? colors.mutedForeground : tint }]}
        numberOfLines={1}
      >
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
    paddingVertical: 4,
    paddingHorizontal: spacing.sm + 2,
    alignSelf: "flex-start",
  },
  outline: {
    backgroundColor: colors.surfaceCard,
    borderColor: colors.border,
    borderRadius: radius.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    ...type.micro,
    fontSize: 11,
    lineHeight: 14,
  },
});
