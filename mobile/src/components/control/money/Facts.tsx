import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ListGroup } from "@/components/ui/ListGroup";
import { colors, spacing, type } from "@/theme/tokens";

// A record's details as an inset group of label/value lines, hairlines between them.
export function Facts({ children, title }: { children: React.ReactNode; title?: string }) {
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <ListGroup title={title}>
      {rows.map((row, i) => (
        <View key={i} style={i < rows.length - 1 && styles.divided}>
          {row}
        </View>
      ))}
    </ListGroup>
  );
}

// Long or multi-line values stack under their label instead of squeezing into the right-hand column.
export function Fact({ label, value, mono = false, block }: { label: string; value: string; mono?: boolean; block?: boolean }) {
  const stacked = block ?? (value.length > 34 || value.includes("\n"));
  if (stacked) {
    return (
      <View style={styles.stacked}>
        <Text style={styles.kicker}>{label}</Text>
        <Text style={[styles.body, mono && styles.mono]}>{value}</Text>
      </View>
    );
  }
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceHover,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 13,
  },
  label: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  value: {
    ...type.body,
    fontSize: 14,
    flexShrink: 1,
    textAlign: "right",
    color: colors.foreground,
  },
  stacked: {
    gap: spacing.xs + 2,
    paddingVertical: 13,
  },
  kicker: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  body: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  mono: {
    ...type.mono,
    color: colors.foreground,
  },
});
