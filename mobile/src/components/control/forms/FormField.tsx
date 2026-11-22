import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  label: string;
  hint?: string;
  // Right of the label: a string reads as a mono figure (a range, a count), or pass a node such as a CountBadge.
  aside?: React.ReactNode;
  required?: boolean;
  // Live feedback under the control, above the hint (a date read back, a capacity meter).
  status?: React.ReactNode;
  children: React.ReactNode;
};

// A stacked field: micro label with an optional figure on the right, the control, live status, then the hint.
export function FormField({ label, hint, aside, required = false, status, children }: Props) {
  return (
    <View style={styles.field}>
      <View style={styles.head}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {required ? <Text style={styles.required}>Required</Text> : null}
        <View style={styles.spacer} />
        {typeof aside === "string" ? <Text style={styles.aside}>{aside}</Text> : aside}
      </View>
      {children}
      {status}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: spacing.sm,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 18,
  },
  label: {
    ...type.micro,
    flexShrink: 1,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textSecondary,
  },
  required: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    color: colors.textTertiary,
  },
  spacer: {
    flex: 1,
  },
  aside: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 15,
    color: colors.textTertiary,
  },
  hint: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
