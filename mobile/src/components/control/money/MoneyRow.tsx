import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TONE_COLOR } from "@/components/control/money/meta";
import type { IconName } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { tapFeedback } from "@/lib/haptics";
import type { StatusMeta } from "@/lib/status";
import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  icon: IconName;
  title: string;
  meta: string;
  amount?: string;
  amountTone?: "default" | "negative";
  status?: StatusMeta | null;
  onPress?: () => void;
  divider: boolean;
};

// A money line: who, what, how much and where it stands — the shape of the attendee app's order rows.
export function MoneyRow({ icon, title, meta, amount, amountTone = "default", status, onPress, divider }: Props) {
  const body = (
    <>
      <IconTile icon={icon} size={40} />
      <View style={styles.stack}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      <View style={styles.trailing}>
        {amount ? <Text style={[styles.amount, amountTone === "negative" && styles.negative]}>{amount}</Text> : null}
        {status ? (
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: TONE_COLOR[status.tone] }]} />
            <Text style={[styles.statusText, { color: TONE_COLOR[status.tone] }]} numberOfLines={1}>
              {status.label}
            </Text>
          </View>
        ) : null}
      </View>
    </>
  );

  if (!onPress) return <View style={[styles.row, divider && styles.divided]}>{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, amount, status?.label].filter(Boolean).join(", ")}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
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
  pressed: {
    opacity: 0.7,
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
  meta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  trailing: {
    alignItems: "flex-end",
    gap: 5,
    maxWidth: 140,
  },
  amount: {
    ...type.bodyStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  negative: {
    color: colors.danger,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...type.micro,
    fontSize: 11,
  },
});
