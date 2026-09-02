import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { colors, spacing, type } from "@/theme/tokens";

type DetailRowProps = {
  label: string;
  value: string;
  icon?: IconName;
  mono?: boolean;
  divider?: boolean;
};

export function DetailRow({ label, value, icon, mono = false, divider = true }: DetailRowProps) {
  return (
    <View style={[styles.row, divider && styles.divided]}>
      <View style={styles.labelWrap}>
        {icon ? <Icon name={icon} size={15} color={colors.textSecondary} /> : null}
        <Text style={styles.label}>{label}</Text>
      </View>
      <Text style={[styles.value, mono && styles.mono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceHover,
  },
  labelWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  label: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    ...type.body,
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
    color: colors.foreground,
  },
  mono: {
    ...type.mono,
    color: colors.foreground,
  },
});
