import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
} from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";

import { tapFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: () => void;
  scrollY?: SharedValue<number>;
};

// Page header for pushed routes: back chevron, collapsing title, hairline divider.
export function ScreenHeader({ title, subtitle, right, onBack, scrollY }: ScreenHeaderProps) {
  const reduced = useReducedMotion();
  // Title shrinks once the attached scroll view passes 24px; skipped under reduced motion.
  const titleStyle = useAnimatedStyle(() => {
    if (reduced || !scrollY) {
      return { fontSize: type.title.fontSize, lineHeight: type.title.lineHeight };
    }
    const p = interpolate(Math.max(0, Math.min(scrollY.value, 24)), [0, 24], [0, 1]);
    return {
      fontSize: interpolate(p, [0, 1], [type.title.fontSize, type.heading.fontSize]),
      lineHeight: interpolate(p, [0, 1], [type.title.lineHeight, type.heading.lineHeight]),
    };
  });

  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          tapFeedback();
          if (onBack) onBack();
          else router.back();
        }}
        style={styles.back}
      >
        <Feather name="chevron-left" size={24} color={colors.foreground} />
      </Pressable>
      <View style={styles.stack}>
        <Animated.Text style={[styles.title, titleStyle]} numberOfLines={1}>
          {title}
        </Animated.Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -spacing.md,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    color: colors.foreground,
  },
  subtitle: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
