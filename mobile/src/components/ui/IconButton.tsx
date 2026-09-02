import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius } from "@/theme/tokens";

type IconButtonVariant = "outline" | "solid" | "plain" | "primary";
type IconButtonShape = "circle" | "square";

type IconButtonProps = {
  icon: IconName;
  label: string;
  onPress: () => void;
  variant?: IconButtonVariant;
  shape?: IconButtonShape;
  size?: number;
  iconSize?: number;
  badge?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function IconButton({
  icon,
  label,
  onPress,
  variant = "outline",
  shape = "circle",
  size = 44,
  iconSize = 19,
  badge = false,
  style,
}: IconButtonProps) {
  const tint = variant === "primary" ? colors.primaryForeground : colors.mutedForeground;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={size < 44 ? 8 : 0}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [
        styles.base,
        { width: size, height: size, borderRadius: shape === "circle" ? size / 2 : radius.md },
        variant === "outline" && styles.outline,
        variant === "solid" && styles.solid,
        variant === "primary" && styles.primary,
        pressed && styles.pressed,
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={tint} />
      {badge ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
  },
  outline: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
  solid: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  pressed: {
    opacity: 0.65,
  },
  badge: {
    position: "absolute",
    top: 9,
    right: 11,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.background,
  },
});
