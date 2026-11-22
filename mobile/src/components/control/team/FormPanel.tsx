import React from "react";
import { StyleSheet, View } from "react-native";

import { ListGroup } from "@/components/ui/ListGroup";
import { spacing } from "@/theme/tokens";

// A titled form section: ListGroup's inset container with room for stacked fields.
export function FormPanel({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <ListGroup title={title} footer={footer}>
      <View style={styles.body}>{children}</View>
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
});
