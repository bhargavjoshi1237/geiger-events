import { Image } from "expo-image";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { qtyText } from "@/components/control/inventory/meta";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { StockStatus } from "@/types/control_inventory";

type Props = {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  onHand: number;
  status: StockStatus;
  onPress: () => void;
  divider?: boolean;
};

// In stock stays neutral; only a shelf that needs a decision takes colour.
const TINT: Record<StockStatus, string> = {
  "In stock": colors.foreground,
  "Low stock": colors.warning,
  "Out of stock": colors.danger,
};

// A shelf in the stock room: photo or box glyph, the item, and its on-hand count read like a shelf label.
export function StockRow({ title, subtitle, imageUrl, onHand, status, onPress, divider = true }: Props) {
  const flagged = status !== "In stock";
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${qtyText(onHand)} on hand, ${status.toLowerCase()}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} contentFit="cover" transition={150} style={styles.thumb} />
      ) : (
        <IconTile icon="box" size={44} tone={status === "Out of stock" ? "danger" : status === "Low stock" ? "warning" : "neutral"} />
      )}
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
      <View style={styles.count}>
        <Text style={[styles.figure, { color: TINT[status] }]} numberOfLines={1}>
          {qtyText(onHand)}
        </Text>
        <Text style={[styles.unit, flagged && { color: TINT[status] }]} numberOfLines={1}>
          {flagged ? status : "On hand"}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 12,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceActive,
  },
  stack: {
    flex: 1,
    minWidth: 0,
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
  count: {
    alignItems: "flex-end",
    gap: 1,
    maxWidth: 96,
  },
  figure: {
    ...type.figureSmall,
    fontSize: 17,
    lineHeight: 21,
    fontVariant: ["tabular-nums"],
  },
  unit: {
    ...type.micro,
    fontSize: 9,
    lineHeight: 12,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
});
