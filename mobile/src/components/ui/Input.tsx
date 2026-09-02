import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import type { BlurEvent, FocusEvent, TextInputProps } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icons";
import { colors, radius, spacing, timing, type } from "@/theme/tokens";

type InputProps = TextInputProps & {
  leftIcon?: IconName;
};

export function Input({ leftIcon, ...props }: InputProps) {
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
        // Padding has to sit on a View: it is a no-op on a fixed-size svg glyph.
        <View style={styles.icon}>
          <Icon name={leftIcon} size={16} color={colors.textTertiary} />
        </View>
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
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
  },
  icon: {
    paddingLeft: spacing.lg,
  },
  input: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    ...type.body,
    color: colors.foreground,
  },
  inputWithIcon: {
    paddingLeft: spacing.sm,
  },
});
