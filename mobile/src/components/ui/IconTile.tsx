import React from "react";
import { StyleSheet, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/icons";
import { colors, radius } from "@/theme/tokens";

type IconTileTone = "neutral" | "success" | "danger" | "outline";

type IconTileProps = {
  icon: IconName;
  size?: number;
  tone?: IconTileTone;
};

const TINTS: Record<IconTileTone, string> = {
  neutral: colors.mutedForeground,
  success: colors.success,
  danger: colors.danger,
  outline: colors.textTertiary,
};

// The rounded-square glyph tile that leads most rows in the design.
export function IconTile({ icon, size = 40, tone = "neutral" }: IconTileProps) {
  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, borderRadius: size >= 40 ? radius.md : radius.sm + 2 },
        tone === "success" && styles.success,
        tone === "danger" && styles.danger,
        tone === "outline" && styles.outline,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.46)} color={TINTS[tone]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceActive,
  },
  success: {
    backgroundColor: `${colors.success}26`,
  },
  danger: {
    backgroundColor: `${colors.danger}1A`,
  },
  outline: {
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
