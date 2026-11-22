import React from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/tokens";

type TickTone = "success" | "warning" | "danger" | "info" | "neutral";

type TickMeterProps = {
  value: number;
  max: number;
  label: string;
  ticks?: number;
  height?: number;
  tone?: TickTone;
};

const FILL: Record<TickTone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.foreground,
};

// Control's counter scale: a ruler of ticks that fills like a door clicker; every tenth tick is a taller scale mark.
export function TickMeter({ value, max, label, ticks = 40, height = 14, tone = "success" }: TickMeterProps) {
  const ratio = max > 0 ? Math.max(0, value / max) : 0;
  const over = ratio > 1;
  const lit = over ? ticks : Math.round(Math.min(1, ratio) * ticks);
  // A single sale still shows, rather than rounding down to an empty scale.
  const shown = value > 0 && lit === 0 ? 1 : lit;
  const fill = over && tone !== "danger" ? colors.warning : FILL[tone];
  const minor = Math.max(4, Math.round(height * 0.6));

  return (
    <View
      style={[styles.row, { height }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(Math.min(1, ratio) * 100) }}
    >
      {Array.from({ length: ticks }, (_, i) => {
        const major = i % 10 === 0 || i === ticks - 1;
        return (
          <View
            key={i}
            style={[styles.tick, { height: major ? height : minor, backgroundColor: i < shown ? fill : colors.surfaceStrong }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  tick: {
    width: 2,
    borderRadius: 1,
  },
});
