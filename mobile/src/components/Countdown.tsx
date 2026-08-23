import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import { useCountdown } from "@/lib/countdown";
import { colors, radius, spacing, timing, type } from "@/theme/tokens";

// Port of the web Countdown: four tiles, cross-fading digits, "Happening now".
export function Countdown({ dateStr }: { dateStr: string | null }) {
  const parts = useCountdown(dateStr);
  if (!parts) return null;
  if (parts.done) {
    return (
      <View style={styles.donePill}>
        <View style={styles.doneDot} />
        <Text style={styles.doneText}>Happening now</Text>
      </View>
    );
  }
  const cells = [
    { value: parts.days, label: "days" },
    { value: parts.hours, label: "hrs" },
    { value: parts.minutes, label: "min" },
    { value: parts.seconds, label: "sec" },
  ];
  return (
    <View style={styles.row}>
      {cells.map((c) => (
        <Cell key={c.label} value={c.value} label={c.label} />
      ))}
    </View>
  );
}

function Cell({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.cell}>
      <View style={styles.valueFrame}>
        {/* Keyed remount cross-fades a changed digit in place. */}
        <Animated.Text
          key={value}
          entering={FadeIn.duration(timing.fast)}
          exiting={FadeOut.duration(timing.fast)}
          style={[styles.value, styles.valueAbs]}
        >
          {String(value).padStart(2, "0")}
        </Animated.Text>
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cell: {
    alignItems: "center",
    gap: spacing.xs,
  },
  valueFrame: {
    height: 44,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.md,
  },
  valueAbs: {
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
  },
  value: {
    ...type.title,
    fontSize: 19,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  label: {
    ...type.caption,
    fontSize: 10,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  donePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    alignSelf: "flex-start",
    backgroundColor: `${colors.success}1A`,
    borderWidth: 1,
    borderColor: `${colors.success}40`,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  doneDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.success,
  },
  doneText: {
    ...type.label,
    fontWeight: "600",
    color: colors.success,
  },
});
