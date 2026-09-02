import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type ScreenTitleProps = {
  title: string;
  eyebrow?: string;
  right?: React.ReactNode;
};

// The large tab-root title. Pushed screens use ScreenHeader instead.
export function ScreenTitle({ title, eyebrow, right }: ScreenTitleProps) {
  return (
    <View style={styles.row}>
      <View style={styles.stack}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {right ? <View style={styles.actions}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg + spacing.xs,
  },
  stack: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  title: {
    ...type.display,
    color: colors.foreground,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
});
