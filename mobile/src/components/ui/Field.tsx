import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type FieldProps = {
  label: string;
  hint?: string;
  children: React.ReactNode;
};

// Label above the control, optional hint below. Port of the web Field.
export function Field({ label, hint, children }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  label: {
    ...type.label,
    color: colors.mutedForeground,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
