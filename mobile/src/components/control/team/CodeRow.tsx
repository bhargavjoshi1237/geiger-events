import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { IconButton } from "@/components/ui/IconButton";
import type { IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { colors, spacing, type } from "@/theme/tokens";

type Tone = "neutral" | "success" | "warning" | "info" | "danger" | "outline";

type Props = {
  icon: IconName;
  label: string;
  value: string;
  tone?: Tone;
  onCopy?: () => void;
  copyLabel?: string;
  trailing?: React.ReactNode;
  divider?: boolean;
};

// A labelled mono value (a URL, key or domain) with an optional copy button, for settings lists.
export function CodeRow({ icon, label, value, tone = "neutral", onCopy, copyLabel, trailing, divider = true }: Props) {
  return (
    <View style={[styles.row, divider && styles.divided]}>
      <IconTile icon={icon} size={36} tone={tone} />
      <View style={styles.stack}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        <Text style={styles.value} numberOfLines={2} selectable>
          {value}
        </Text>
      </View>
      {trailing}
      {onCopy ? <IconButton icon="copy" label={copyLabel ?? `Copy ${label}`} variant="plain" size={36} iconSize={16} onPress={onCopy} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  label: {
    ...type.caption,
    color: colors.textSecondary,
  },
  value: {
    ...type.mono,
    color: colors.foreground,
  },
});
