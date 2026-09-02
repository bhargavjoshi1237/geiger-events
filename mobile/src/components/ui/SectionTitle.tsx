import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type SectionTitleProps = {
  children: React.ReactNode;
  // "kicker" is the small uppercase group label (month headers, form sections).
  variant?: "heading" | "kicker";
  action?: React.ReactNode;
};

export function SectionTitle({ children, variant = "heading", action }: SectionTitleProps) {
  return (
    <View style={styles.row}>
      <Text style={variant === "kicker" ? styles.kicker : styles.heading}>{children}</Text>
      {action}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  heading: {
    ...type.subhead,
    color: colors.foreground,
    flexShrink: 1,
  },
  kicker: {
    ...type.micro,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
    flexShrink: 1,
  },
});
