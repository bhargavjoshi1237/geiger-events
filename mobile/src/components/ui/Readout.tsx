import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme/tokens";

type Tone = "success" | "warning" | "danger" | "info" | "neutral";

export type ReadoutFigure = {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
};

type ReadoutProps = {
  lead?: ReadoutFigure;
  items?: ReadoutFigure[];
  // Sits under the lead figure, e.g. a TickMeter for sold against capacity.
  children?: React.ReactNode;
};

const TONE_TEXT: Record<Tone, string> = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.foreground,
};

// The instrument panel: one lead figure, then a row of secondary figures split by hairlines.
export function Readout({ lead, items = [], children }: ReadoutProps) {
  return (
    <View style={styles.panel}>
      {lead ? (
        <View style={styles.lead} accessible accessibilityLabel={`${lead.label}: ${lead.value}${lead.hint ? `, ${lead.hint}` : ""}`}>
          <Text style={styles.label}>{lead.label}</Text>
          <View style={styles.leadRow}>
            <Text style={[styles.figure, { color: TONE_TEXT[lead.tone ?? "neutral"] }]} numberOfLines={1} adjustsFontSizeToFit>
              {lead.value}
            </Text>
            {lead.hint ? (
              <Text style={styles.leadHint} numberOfLines={1}>
                {lead.hint}
              </Text>
            ) : null}
          </View>
          {children ? <View style={styles.extra}>{children}</View> : null}
        </View>
      ) : children ? (
        <View style={styles.lead}>{children}</View>
      ) : null}
      {items.length ? (
        <View style={[styles.row, Boolean(lead || children) && styles.rowRuled]}>
          {items.map((item, i) => (
            <View
              key={item.label}
              style={[styles.cell, i > 0 && styles.cellRuled]}
              accessible
              accessibilityLabel={`${item.label}: ${item.value}${item.hint ? `, ${item.hint}` : ""}`}
            >
              <Text style={styles.label} numberOfLines={1}>
                {item.label}
              </Text>
              <Text style={[styles.small, { color: TONE_TEXT[item.tone ?? "neutral"] }]} numberOfLines={1} adjustsFontSizeToFit>
                {item.value}
              </Text>
              {item.hint ? (
                <Text style={styles.hint} numberOfLines={1}>
                  {item.hint}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    overflow: "hidden",
  },
  lead: {
    padding: spacing.lg,
    gap: spacing.xs + 2,
  },
  leadRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  figure: {
    ...type.figure,
    flexShrink: 1,
    fontVariant: ["tabular-nums"],
  },
  leadHint: {
    ...type.monoSmall,
    color: colors.textSecondary,
    flexShrink: 0,
  },
  extra: {
    marginTop: spacing.sm,
  },
  row: {
    flexDirection: "row",
  },
  rowRuled: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.borderStrong,
  },
  cell: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.lg,
    gap: 3,
  },
  cellRuled: {
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.borderStrong,
  },
  label: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  small: {
    ...type.figureSmall,
    fontVariant: ["tabular-nums"],
  },
  hint: {
    ...type.caption,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
  },
});
