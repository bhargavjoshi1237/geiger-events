import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, spring } from "@/theme/tokens";

type CardProps = {
  children: React.ReactNode;
  onPress?: () => void;
  // "subtle" is the recessed container the design uses for grouped list rows.
  tone?: "card" | "subtle";
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, onPress, tone = "card", style }: CardProps) {
  const toneStyle = tone === "subtle" ? styles.subtle : null;
  const scaleRef = useSharedValue(1);
  const pressIn = () => {
    scaleRef.value = withSpring(0.98, spring);
  };
  const pressOut = () => {
    scaleRef.value = withSpring(1, spring);
  };
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleRef.value }],
  }));

  if (typeof onPress === "function") {
    return (
      <Pressable
        accessibilityRole="button"
        onPressIn={pressIn}
        onPressOut={pressOut}
        onPress={() => {
          tapFeedback();
          onPress();
        }}
      >
        <Animated.View style={[styles.card, toneStyle, animStyle, style]}>{children}</Animated.View>
      </Pressable>
    );
  }

  return <View style={[styles.card, toneStyle, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  subtle: {
    backgroundColor: colors.surfaceSubtle,
  },
});
