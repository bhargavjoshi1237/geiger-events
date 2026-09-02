import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icons";
import { selectionFeedback } from "@/lib/haptics";
import { colors, radius, spacing, spring, type } from "@/theme/tokens";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "destructiveGhost"
  | "paper";
type ButtonSize = "sm" | "md";

type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "leading" | "trailing";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
};

const VARIANT_TEXT: Record<ButtonVariant, string> = {
  primary: colors.primaryForeground,
  secondary: colors.foreground,
  ghost: colors.foreground,
  destructive: colors.primary,
  destructiveGhost: colors.danger,
  paper: colors.paper,
};

const VARIANT_BG: Record<ButtonVariant, string | undefined> = {
  primary: colors.primary,
  secondary: colors.surfaceCard,
  ghost: undefined,
  destructive: colors.destructive,
  destructiveGhost: undefined,
  paper: colors.paperForeground,
};

export function Button({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "leading",
  loading = false,
  disabled = false,
  fullWidth = false,
}: ButtonProps) {
  const pressed = loading || disabled;
  const scaleRef = useSharedValue(1);
  const opacityRef = useSharedValue(1);
  const pressIn = () => {
    scaleRef.value = withSpring(0.97, spring);
    opacityRef.value = withSpring(0.9, spring);
  };
  const pressOut = () => {
    scaleRef.value = withSpring(1, spring);
    opacityRef.value = withSpring(1, spring);
  };
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scaleRef.value }],
    opacity: opacityRef.value,
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: pressed, busy: loading }}
      disabled={pressed}
      onPressIn={pressIn}
      onPressOut={pressOut}
      onPress={() => {
        selectionFeedback();
        onPress?.();
      }}
      style={[styles.wrap, fullWidth && styles.fullWidth]}
    >
      <Animated.View
        style={[
          styles.button,
          size === "md" ? styles.md : styles.sm,
          VARIANT_BG[variant] ? { backgroundColor: VARIANT_BG[variant] } : null,
          variant === "secondary" && styles.secondary,
          variant === "destructiveGhost" && styles.destructiveGhost,
          disabled && styles.disabled,
          animStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator
            size="small"
            color={VARIANT_TEXT[variant]}
            accessibilityLabel="Loading"
          />
        ) : (
          <>
            {icon && iconPosition === "leading" ? (
              <Icon name={icon} size={size === "sm" ? 16 : 18} color={VARIANT_TEXT[variant]} />
            ) : null}
            <Text style={[styles.label, size === "sm" && styles.labelSm, { color: VARIANT_TEXT[variant] }]}>
              {title}
            </Text>
            {icon && iconPosition === "trailing" ? (
              <Icon name={icon} size={size === "sm" ? 16 : 18} color={VARIANT_TEXT[variant]} />
            ) : null}
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
  },
  fullWidth: {
    alignSelf: "stretch",
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.md,
    paddingHorizontal: spacing.xl,
  },
  md: {
    height: 48,
  },
  sm: {
    height: 36,
    paddingHorizontal: spacing.lg,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
  },
  destructiveGhost: {
    backgroundColor: `${colors.danger}14`,
    borderWidth: 1,
    borderColor: `${colors.danger}4D`,
  },
  disabled: {
    opacity: 0.5,
  },
  label: {
    ...type.bodyStrong,
    flexShrink: 0,
  },
  labelSm: {
    ...type.labelStrong,
    fontSize: 13,
  },
});
