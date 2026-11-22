import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { colors, radius, spacing, type } from "@/theme/tokens";

// A quiet dashed note above a screen's content, e.g. why its switches are locked for this role.
export function Notice({ text, icon = "lock" }: { text: string; icon?: IconName }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={text}>
      <Icon name={icon} size={15} color={colors.textTertiary} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  text: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
    color: colors.textSecondary,
  },
});
