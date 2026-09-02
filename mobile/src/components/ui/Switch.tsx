import React, { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spring, timing } from "@/theme/tokens";

const TRACK_W = 44;
const TRACK_H = 26;
const PAD = 3;
const KNOB = TRACK_H - PAD * 2;
const TRAVEL = TRACK_W - KNOB - PAD * 2;

type SwitchProps = {
  value: boolean;
  onValueChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
};

export function Switch({ value, onValueChange, label, disabled = false }: SwitchProps) {
  const on = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    on.value = value ? 1 : 0;
  }, [value, on]);

  const progress = useDerivedValue(() => withTiming(on.value, { duration: timing.fast }));

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.surfaceActive, colors.foreground],
    ),
  }));

  const knobStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(on.value * TRAVEL, spring) }],
    backgroundColor: interpolateColor(
      progress.value,
      [0, 1],
      [colors.textSecondary, colors.background],
    ),
  }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={10}
      onPress={() => {
        selectionFeedback();
        onValueChange(!value);
      }}
    >
      <Animated.View style={[styles.track, trackStyle, disabled && styles.disabled]}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

// A static stand-in for the knob while a toggle is mid-request.
export function SwitchPlaceholder() {
  return (
    <View style={[styles.track, styles.disabled]}>
      <View style={[styles.knob, styles.knobIdle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_W,
    height: TRACK_H,
    borderRadius: radius.pill,
    padding: PAD,
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: radius.pill,
  },
  knobIdle: {
    backgroundColor: colors.textSecondary,
  },
});
