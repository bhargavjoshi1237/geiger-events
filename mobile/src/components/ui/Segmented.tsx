import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spring, type } from "@/theme/tokens";

type SegmentOption = { value: string; label: string };

type SegmentedProps = {
  options: SegmentOption[];
  value: string;
  onChange: (value: string) => void;
};

export function Segmented({ options, value, onChange }: SegmentedProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const active = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const progress = useSharedValue(0);

  const segmentWidth = options.length ? trackWidth / options.length : 0;

  useEffect(() => {
    if (segmentWidth > 0) {
      progress.value = withSpring(active * segmentWidth, spring);
    }
  }, [active, segmentWidth, progress]);

  const pillStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: progress.value }],
  }));

  return (
    <View style={styles.track}>
      <View
        style={styles.inner}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      >
        <Animated.View style={[styles.pill, pillStyle]} />
        {options.map((o) => {
          const focused = o.value === value;
          return (
            <Pressable
              key={o.value}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={o.label}
              onPress={() => {
                selectionFeedback();
                if (!focused) onChange(o.value);
              }}
              style={styles.segment}
            >
              <Text style={[styles.label, focused && styles.labelFocused]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    backgroundColor: colors.surfaceSubtle,
    borderRadius: radius.md,
    padding: 3,
  },
  inner: {
    flexDirection: "row",
  },
  pill: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md - 3,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 36,
  },
  label: {
    ...type.label,
    fontSize: 13,
    color: colors.textSecondary,
  },
  labelFocused: {
    ...type.labelStrong,
    fontSize: 13,
    color: colors.foreground,
  },
});
