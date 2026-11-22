import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { GuestSegment } from "@/types/control_guests";

// Read-only: segment rules are built on the dashboard; the phone shows who each one reaches right now.
export default function SegmentsScreen() {
  const { project } = useControl();
  const list = useControlQuery<{ segments: GuestSegment[] }>(project ? `/api/control/guests/projects/${project.id}/segments` : null);
  const segments = list.data?.segments ?? [];

  return (
    <Screen scroll header={<ScreenHeader title="Segments" />}>
      <Text style={styles.lede}>Live member counts for each segment. Build and change segments on the dashboard.</Text>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load segments" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={4} variant="card" />
      ) : !segments.length ? (
        <EmptyState icon="users-round" title="No segments yet" message="Segments group contacts by tag, status, consent or attendance. Create them on the dashboard." />
      ) : (
        <View style={styles.stack}>
          {segments.map((s) => (
            <Card key={s.id} tone="subtle">
              <View style={styles.head}>
                <Text style={styles.name} numberOfLines={2}>
                  {s.name}
                </Text>
                <Text style={styles.count}>{`${s.members.toLocaleString("en-US")} ${pluralize(s.members, "contact", "contacts")}`}</Text>
              </View>
              {s.description ? <Text style={styles.meta}>{s.description}</Text> : null}
              {s.rules.length ? (
                <View style={styles.rules}>
                  {s.rules.map((rule, i) => (
                    <Text key={`${s.id}-${i}`} style={styles.rule}>
                      {`${i ? "and " : ""}${rule}`}
                    </Text>
                  ))}
                </View>
              ) : (
                <Text style={styles.meta}>{s.handPicked ? "Hand-picked contacts only" : "Everyone in the Contact Book"}</Text>
              )}
              {s.handPicked && s.rules.length ? <Text style={styles.meta}>{`Plus ${s.handPicked} hand-picked`}</Text> : null}
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.body,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.md,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  name: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  count: {
    ...type.captionStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  meta: {
    ...type.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  rules: {
    gap: 2,
    marginTop: spacing.sm,
  },
  rule: {
    ...type.monoSmall,
    color: colors.mutedForeground,
  },
});
