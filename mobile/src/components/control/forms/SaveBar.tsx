import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { Icon, type IconName } from "@/components/ui/icons";
import { pluralize } from "@/lib/format";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  title: string;
  icon?: IconName;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  // How many edits are waiting (or just true); leave it out to show `note` instead.
  changes?: number | boolean;
  note?: string;
};

// The form's pinned action: what's waiting to be saved on the left, the one button that saves it on the right.
export function SaveBar({ title, icon, onPress, loading = false, disabled = false, changes, note }: Props) {
  const insets = useSafeAreaInsets();
  const pending = typeof changes === "number" ? changes > 0 : Boolean(changes);

  let status: React.ReactNode;
  if (changes === undefined) {
    status = note ? (
      <Text style={styles.note} numberOfLines={2}>
        {note}
      </Text>
    ) : null;
  } else if (pending) {
    status =
      typeof changes === "number" ? (
        <>
          <CountBadge value={changes} tone="warning" />
          <Text style={styles.pending} numberOfLines={1}>
            {pluralize(changes, "unsaved change", "unsaved changes")}
          </Text>
        </>
      ) : (
        <>
          <View style={styles.dot} />
          <Text style={styles.pending} numberOfLines={1}>
            Unsaved changes
          </Text>
        </>
      );
  } else {
    status = (
      <>
        <Icon name="check" size={14} color={colors.textTertiary} />
        <Text style={styles.clean} numberOfLines={1}>
          No unsaved changes
        </Text>
      </>
    );
  }

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, spacing.md) + spacing.xs }]}>
      <View style={styles.status}>{status}</View>
      <Button title={title} icon={icon} onPress={onPress} loading={loading} disabled={disabled} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  status: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  note: {
    ...type.caption,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.warning,
  },
  pending: {
    ...type.captionStrong,
    flexShrink: 1,
    color: colors.mutedForeground,
  },
  clean: {
    ...type.caption,
    flexShrink: 1,
    color: colors.textTertiary,
  },
});
