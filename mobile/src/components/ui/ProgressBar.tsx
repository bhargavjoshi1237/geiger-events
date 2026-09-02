import React, { useEffect } from "react";
import { StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, radius } from "@/theme/tokens";

const HEIGHT = 2;
const SWEEP_MS = 900;

// Indeterminate: a request has no measurable progress, so the bar sweeps.
export function ProgressBar({ active }: { active: boolean }) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(-1);

  useEffect(() => {
    if (!active) {
      x.value = -1;
      return;
    }
    x.value = withRepeat(
      withTiming(1, { duration: SWEEP_MS, easing: Easing.inOut(Easing.quad) }),
      -1,
      false,
    );
  }, [active, x]);

  const sweepStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value * width }],
  }));

  if (!active) return null;

  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityLabel="Saving">
      <Animated.View style={[styles.sweep, sweepStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceActive,
    overflow: "hidden",
  },
  sweep: {
    width: "45%",
    height: HEIGHT,
    borderRadius: radius.pill,
    backgroundColor: colors.foreground,
  },
});
