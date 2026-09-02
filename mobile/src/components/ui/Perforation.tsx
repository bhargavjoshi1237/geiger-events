import React from "react";
import { StyleSheet, View } from "react-native";

import { colors } from "@/theme/tokens";

const DASH_COUNT = 48;

type PerforationProps = {
  dashColor?: string;
  notchColor?: string;
  notchSize?: number;
};

// A tear-off line: dashes plus two page-coloured circles that the parent card's overflow clips in half.
export function Perforation({
  dashColor = colors.border,
  notchColor = colors.background,
  notchSize = 16,
}: PerforationProps) {
  const half = notchSize / 2;
  const notch = {
    width: notchSize,
    height: notchSize,
    borderRadius: half,
    backgroundColor: notchColor,
    top: -half,
  };

  return (
    <View style={styles.rule} pointerEvents="none">
      <View style={styles.dashes}>
        {Array.from({ length: DASH_COUNT }).map((_, i) => (
          <View key={i} style={[styles.dash, { backgroundColor: dashColor }]} />
        ))}
      </View>
      <View style={[styles.notch, notch, { left: -half }]} />
      <View style={[styles.notch, notch, { right: -half }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  rule: {
    height: 1,
  },
  dashes: {
    flexDirection: "row",
    overflow: "hidden",
  },
  dash: {
    width: 6,
    height: 1,
    marginRight: 6,
  },
  notch: {
    position: "absolute",
  },
});
