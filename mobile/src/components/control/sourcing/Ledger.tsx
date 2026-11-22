import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type LedgerRowProps = {
  label: string;
  detail?: string;
  amount: string;
  divider?: boolean;
  muted?: boolean;
};

// A priced line inside a ListGroup: a mono label (usually a date) and its working, the amount right-aligned in mono.
export function LedgerRow({ label, detail, amount, divider = true, muted = false }: LedgerRowProps) {
  return (
    <View style={[styles.row, divider && styles.divided]} accessible accessibilityLabel={`${label}${detail ? `, ${detail}` : ""}: ${amount}`}>
      <View style={styles.text}>
        <Text style={[styles.label, muted && styles.muted]} numberOfLines={1}>
          {label}
        </Text>
        {detail ? (
          <Text style={styles.detail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.amount, muted && styles.muted]} numberOfLines={1}>
        {amount}
      </Text>
    </View>
  );
}

// The ruled line that closes a ledger, with the total set as a figure; unruled when it's the only line.
export function LedgerTotal({ label = "Total", amount, hint, ruled = true }: { label?: string; amount: string; hint?: string; ruled?: boolean }) {
  return (
    <View style={[styles.total, ruled && styles.ruled]} accessible accessibilityLabel={`${label}: ${amount}${hint ? `, ${hint}` : ""}`}>
      <View style={styles.text}>
        <Text style={styles.totalLabel}>{label}</Text>
        {hint ? (
          <Text style={styles.detail} numberOfLines={2}>
            {hint}
          </Text>
        ) : null}
      </View>
      <Text style={styles.totalAmount} numberOfLines={1} adjustsFontSizeToFit>
        {amount}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.md + 1,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  label: {
    ...type.monoSmall,
    color: colors.foreground,
  },
  detail: {
    ...type.caption,
    color: colors.textSecondary,
  },
  amount: {
    ...type.mono,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  muted: {
    color: colors.textSecondary,
  },
  total: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md + 2,
  },
  ruled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  totalLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  totalAmount: {
    ...type.figureSmall,
    flexShrink: 1,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
});
