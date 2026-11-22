import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { signedQty } from "@/components/control/inventory/meta";
import { colors, spacing, type } from "@/theme/tokens";
import type { MovementKind } from "@/types/control_inventory";

type Props = {
  qty: number;
  kind: MovementKind;
  title: string;
  detail?: string;
  when?: string;
  divider?: boolean;
};

// Stock in is success; a write-off is danger; every other hand-out stays neutral so the ledger isn't a wall of red.
function tintOf(qty: number, kind: MovementKind): string {
  if (qty > 0) return colors.success;
  return kind === "waste" ? colors.danger : colors.foreground;
}

// One line of the append-only ledger: the signed quantity leads in mono, then what moved and when.
export function LedgerRow({ qty, kind, title, detail, when, divider = true }: Props) {
  const signed = signedQty(qty);
  return (
    <View
      style={[styles.row, divider && styles.divided]}
      accessible
      accessibilityLabel={[signed, title, detail, when].filter(Boolean).join(", ")}
    >
      <Text style={[styles.qty, { color: tintOf(qty, kind) }]} numberOfLines={1} adjustsFontSizeToFit>
        {signed}
      </Text>
      <View style={styles.stack}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      {when ? (
        <Text style={styles.when} numberOfLines={1}>
          {when}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 13,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  qty: {
    ...type.figureSmall,
    fontSize: 16,
    lineHeight: 20,
    width: 64,
    textAlign: "right",
    fontVariant: ["tabular-nums"],
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    ...type.label,
    color: colors.foreground,
  },
  detail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  when: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textTertiary,
    flexShrink: 0,
  },
});
