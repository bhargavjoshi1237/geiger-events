import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { Button } from "@/components/ui/Button";
import { colors, radius, spacing, type } from "@/theme/tokens";

type EmptyStateProps = {
  icon: IconName;
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconTile}>
        <Icon name={icon} size={22} color={colors.mutedForeground} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <Button title={actionLabel} onPress={onAction} variant="secondary" size="sm" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: spacing.xxl - 4,
    paddingHorizontal: spacing.xl,
    gap: 6,
  },
  iconTile: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceActive,
    marginBottom: spacing.sm,
  },
  title: {
    ...type.bodyStrong,
    color: colors.foreground,
    textAlign: "center",
  },
  message: {
    ...type.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
    textAlign: "center",
    maxWidth: 280,
  },
  action: {
    marginTop: spacing.md,
  },
});
