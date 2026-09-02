import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { tapFeedback } from "@/lib/haptics";
import { colors, spacing, type } from "@/theme/tokens";

type ListRowProps = {
  leading?: React.ReactNode;
  title: string;
  subtitle?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  divider?: boolean;
};

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  chevron = false,
  divider = true,
}: ListRowProps) {
  const pressable = typeof onPress === "function";
  const showChevron = pressable || chevron;

  const body = (
    <>
      {leading}
      <View style={styles.stack}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
      {showChevron ? (
        <Icon name="chevron-right" size={18} color={colors.textTertiary} />
      ) : null}
    </>
  );

  if (pressable) {
    return (
      <View style={[styles.container, !divider && styles.noDivider]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          onPress={() => {
            tapFeedback();
            onPress();
          }}
          style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        >
          {body}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, !divider && styles.noDivider]}>
      <View style={styles.row}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  noDivider: {
    borderBottomWidth: 0,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 15,
  },
  pressed: {
    opacity: 0.6,
  },
  stack: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  subtitle: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
