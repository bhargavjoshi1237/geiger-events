import React from "react";
import { StyleSheet, View } from "react-native";

import { ListGroup } from "@/components/ui/ListGroup";
import { colors, spacing } from "@/theme/tokens";

type Props = {
  title?: string;
  footer?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

// A ListGroup of form rows: each field sits in its own row with a hairline under it, like a settings app.
export function FormPanel({ title, footer, action, children }: Props) {
  const rows = React.Children.toArray(children);
  return (
    <ListGroup title={title || undefined} footer={footer} action={action}>
      {rows.map((row, i) => (
        <View key={(React.isValidElement(row) && row.key) || i} style={[styles.row, i < rows.length - 1 && styles.divided]}>
          {row}
        </View>
      ))}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: spacing.md + 2,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
});
