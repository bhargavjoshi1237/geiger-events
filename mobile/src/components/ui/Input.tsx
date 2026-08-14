import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, TextInput } from "react-native";
import type { BlurEvent, FocusEvent, TextInputProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { colors, radius, spacing, timing } from "@/theme/tokens";

type InputProps = TextInputProps & {
  leftIcon?: React.ComponentProps<typeof Feather>["name"];
};

// Forwards every TextInputProps; the focus ring animates the frame's borderColor.
export function Input({ leftIcon, ...props }: InputProps) {
  // Focus handlers defined before useAnimatedStyle so the React Compiler keeps
  // the shared value's mutable range open.
  const borderColorRef = useSharedValue<string>(colors.border);
  const handleFocus = (e: FocusEvent) => {
    borderColorRef.value = withTiming(colors.borderStrong, { duration: timing.fast });
    props.onFocus?.(e);
  };
  const handleBlur = (e: BlurEvent) => {
    borderColorRef.value = withTiming(colors.border, { duration: timing.fast });
    props.onBlur?.(e);
  };
  const animStyle = useAnimatedStyle(() => ({ borderColor: borderColorRef.value }));

  return (
    <Animated.View style={[styles.frame, animStyle]}>
      {leftIcon ? (
        <Feather name={leftIcon} size={16} color={colors.textTertiary} style={styles.icon} />
      ) : null}
      <TextInput
        {...props}
        placeholderTextColor={colors.textTertiary}
        style={[styles.input, leftIcon && styles.inputWithIcon, props.style]}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  frame: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  icon: {
    paddingLeft: spacing.lg,
  },
  input: {
    flex: 1,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    color: colors.foreground,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
});
