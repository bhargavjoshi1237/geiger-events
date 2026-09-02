import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { tapFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  right?: React.ReactNode;
  onBack?: () => void;
  bordered?: boolean;
};

// The nav bar for pushed screens: 44pt back target, compact title, optional trailing actions.
export function ScreenHeader({
  title,
  subtitle,
  leading,
  right,
  onBack,
  bordered = false,
}: ScreenHeaderProps) {
  return (
    <View style={[styles.header, bordered && styles.bordered]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        onPress={() => {
          tapFeedback();
          if (onBack) onBack();
          else router.back();
        }}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Icon name="chevron-left" size={22} color={colors.foreground} />
      </Pressable>
      {leading}
      <View style={styles.stack}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right ? <View style={styles.actions}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  bordered: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  back: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -spacing.md,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...type.heading,
    color: colors.foreground,
  },
  subtitle: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
