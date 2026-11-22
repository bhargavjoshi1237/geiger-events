import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing, type } from "@/theme/tokens";

// A card of label/value lines for a record's details in a sheet.
export function Facts({ children }: { children: React.ReactNode }) {
  return <View style={styles.facts}>{children}</View>;
}

export function Fact({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.fact}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, mono && styles.mono]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  facts: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.md,
  },
  fact: {
    gap: 2,
  },
  label: {
    ...type.micro,
    color: colors.textSecondary,
  },
  value: {
    ...type.body,
    color: colors.foreground,
  },
  mono: {
    ...type.mono,
  },
});
