import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, spacing, type } from "@/theme/tokens";

type Props = {
  // A 52–64pt IconTile, DateStub or cover thumb.
  leading: React.ReactNode;
  title: string;
  // Dims the title while it's standing in for a name that hasn't been typed yet.
  placeholder?: boolean;
  meta?: React.ReactNode;
  description?: string;
};

// The block a form or settings page opens with: glyph, name, a meta row of status and mono facts, then what it's for.
export function FormHeader({ leading, title, placeholder = false, meta, description }: Props) {
  return (
    <View style={styles.block}>
      <View style={styles.top}>
        {leading}
        <View style={styles.text}>
          <Text style={[styles.title, placeholder && styles.placeholder]} numberOfLines={3}>
            {title}
          </Text>
          {meta ? <View style={styles.meta}>{meta}</View> : null}
        </View>
      </View>
      {description ? <Text style={styles.description}>{description}</Text> : null}
    </View>
  );
}

// A mono fact in a FormHeader meta row: counts, dates, codes.
export function MetaText({ children }: { children: React.ReactNode }) {
  return (
    <Text style={styles.metaText} numberOfLines={1}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  top: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: spacing.sm,
  },
  title: {
    ...type.title,
    color: colors.foreground,
  },
  placeholder: {
    color: colors.textTertiary,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaText: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  description: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSecondary,
  },
});
