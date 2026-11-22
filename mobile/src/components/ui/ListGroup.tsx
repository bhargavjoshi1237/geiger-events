import React from "react";
import { StyleSheet, Text, View } from "react-native";
import type { StyleProp, ViewStyle } from "react-native";

import { SectionTitle } from "@/components/ui/SectionTitle";
import { colors, radius, spacing, type } from "@/theme/tokens";

type ListGroupProps = {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
  footer?: string;
  // "flush" drops the inner padding for content that draws its own (grids, full-bleed rows).
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
};

// The inset grouped list: an optional kicker title, a recessed rounded container of rows, and a quiet footer note.
export function ListGroup({ children, title, action, footer, flush = false, style }: ListGroupProps) {
  return (
    <View style={style}>
      {title ? (
        <SectionTitle variant="kicker" action={action}>
          {title}
        </SectionTitle>
      ) : null}
      <View style={[styles.group, flush && styles.flush]}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  flush: {
    paddingHorizontal: 0,
  },
  footer: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
