import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type SectionTitleProps = {
  children: React.ReactNode;
  action?: React.ReactNode;
};

// Heading row with an optional right-hand action.
export function SectionTitle({ children, action }: SectionTitleProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{children}</Text>
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
  },
  title: {
    ...type.heading,
    color: colors.foreground,
  },
});
