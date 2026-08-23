import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { Button } from "@/components/ui/Button";
import { colors, radius, spacing, type } from "@/theme/tokens";

type EmptyStateProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

// A quiet, centred moment: halo ring around the icon, then title and message.
export function EmptyState({ icon, title, message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.halo}>
        <View style={styles.iconTile}>
          <Feather name={icon} size={22} color={colors.mutedForeground} />
        </View>
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
    paddingVertical: spacing.xxl * 2,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  halo: {
    width: 76,
    height: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSubtle,
    marginBottom: spacing.sm,
  },
  iconTile: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    ...type.heading,
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
    marginTop: spacing.sm,
  },
});
