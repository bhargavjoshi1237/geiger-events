import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { PulseDot } from "@/components/ui/PulseDot";
import { useCountdown } from "@/lib/countdown";
import { colors, radius, spacing, timing, type } from "@/theme/tokens";

const DIGIT_H = 26;
const DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export function Countdown({ dateStr }: { dateStr: string | null }) {
  const parts = useCountdown(dateStr);
  if (!parts) return null;
  if (parts.done) {
    return (
      <View style={styles.donePill}>
        <PulseDot size={6} />
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
  const clamped = Math.min(99, Math.max(0, value));
  return (
    <View style={styles.cell}>
      <View style={styles.valueFrame}>
        <RollingDigit digit={Math.floor(clamped / 10)} />
        <RollingDigit digit={clamped % 10} />
      </View>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

// An odometer: a 0-9 strip slides behind a one-digit window.
function RollingDigit({ digit }: { digit: number }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(-digit * DIGIT_H);

  useEffect(() => {
    const target = -digit * DIGIT_H;
    y.value = reduced
      ? target
      : withTiming(target, { duration: timing.base, easing: Easing.out(Easing.cubic) });
  }, [digit, reduced, y]);

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));

  return (
    <View style={styles.digitWindow}>
      <Animated.View style={stripStyle}>
        {DIGITS.map((d) => (
          <Text key={d} style={styles.value}>
            {d}
          </Text>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    backgroundColor: colors.surfaceActive,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  valueFrame: {
    height: DIGIT_H,
    flexDirection: "row",
    justifyContent: "center",
  },
  digitWindow: {
    height: DIGIT_H,
    overflow: "hidden",
  },
  value: {
    ...type.title,
    height: DIGIT_H,
    lineHeight: DIGIT_H,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
  },
  label: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textSecondary,
    marginTop: 5,
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
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
  },
  doneText: {
    ...type.labelStrong,
    color: colors.success,
  },
});
