import React from "react";
import { StyleSheet, View } from "react-native";

import { colors, radius } from "@/theme/tokens";

type MeterProps = {
  value: number;
  max: number;
  label: string;
};

// Determinate fill (how many of how many); ProgressBar is the indeterminate "working" sweep.
export function Meter({ value, max, label }: MeterProps) {
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((value / max) * 100))) : 0;
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.fill, { width: `${pct}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceActive,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.success,
  },
});
