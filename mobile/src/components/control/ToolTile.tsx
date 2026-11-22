import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { CountBadge } from "@/components/ui/CountBadge";
import { Icon, type IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { tapFeedback } from "@/lib/haptics";
import { colors, radius, spacing, type } from "@/theme/tokens";

type Tone = "neutral" | "success" | "warning" | "info" | "danger";

type Props = {
  icon: IconName;
  title: string;
  detail?: string;
  // A short live figure shown top-right, e.g. "3" pending approvals.
  badge?: string;
  badgeTone?: Tone;
  tone?: Tone;
  onPress: () => void;
};

// A square-ish launcher in a two-column grid of an area's main tools.
export function ToolTile({ icon, title, detail, badge, badgeTone = "warning", tone = "neutral", onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, detail, badge].filter(Boolean).join(", ")}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <View style={styles.top}>
        <IconTile icon={icon} size={36} tone={tone === "danger" ? "danger" : tone} />
        {badge ? (
          <CountBadge value={badge} tone={badgeTone} />
        ) : (
          <Icon name="arrow-up-right" size={16} color={colors.textTertiary} />
        )}
      </View>
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

// Lays tiles out two to a row; an odd last tile keeps half width so the grid stays even.
export function ToolGrid({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={styles.grid}>
      {rows.map((row, i) => (
        <View key={i} style={styles.gridRow}>
          {row.map((item, j) => (
            <View key={j} style={styles.cell}>
              {item}
            </View>
          ))}
          {row.length === 1 ? <View style={styles.cell} /> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 118,
    justifyContent: "space-between",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md + 2,
  },
  pressed: {
    opacity: 0.7,
    backgroundColor: colors.surfaceActive,
  },
  top: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  text: {
    gap: 3,
  },
  title: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  detail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  grid: {
    gap: spacing.sm + 2,
  },
  gridRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  cell: {
    flex: 1,
    minWidth: 0,
  },
});
