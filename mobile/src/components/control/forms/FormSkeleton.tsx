import React from "react";
import { StyleSheet, View } from "react-native";

import { ListGroup } from "@/components/ui/ListGroup";
import { Skeleton } from "@/components/ui/Skeleton";
import { colors, radius, spacing } from "@/theme/tokens";

// Mirrors a form page while it loads: the header block, then panels of labelled inputs.
export function FormSkeleton({ panels = 2 }: { panels?: number }) {
  return (
    <View style={styles.stack}>
      <View style={styles.head}>
        <Skeleton width={52} height={52} radius={radius.md} />
        <View style={styles.headText}>
          <Skeleton width="62%" height={22} radius={5} />
          <Skeleton width="38%" height={12} radius={4} />
        </View>
      </View>
      {Array.from({ length: panels }, (_, i) => (
        <View key={i} style={styles.panel}>
          <Skeleton width={84} height={10} radius={3} />
          <ListGroup>
            {[0, 1, 2].map((j) => (
              <View key={j} style={[styles.row, j < 2 && styles.divided]}>
                <Skeleton width="28%" height={10} radius={3} />
                <Skeleton width="100%" height={46} radius={radius.lg - 2} />
              </View>
            ))}
          </ListGroup>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingTop: spacing.xs,
  },
  headText: {
    flex: 1,
    gap: spacing.sm,
  },
  panel: {
    gap: spacing.md,
  },
  row: {
    gap: spacing.sm + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
});
