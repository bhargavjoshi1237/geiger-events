import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { pluralize } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { GuestSegment } from "@/types/control_guests";

const stagger = (i: number) => Math.min(i, 8) * 50;
const n = (value: number) => value.toLocaleString("en-US");

// Read-only: segment rules are built on the dashboard; the phone shows who each one reaches right now.
export default function SegmentsScreen() {
  const { project } = useControl();
  const list = useControlQuery<{ segments: GuestSegment[] }>(project ? `/api/control/guests/projects/${project.id}/segments` : null);
  const segments = list.data?.segments ?? [];

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load segments" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />;
  } else if (!list.data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else if (!segments.length) {
    body = <EmptyState icon="users-round" title="No segments yet" message="Segments group contacts by tag, status, consent or attendance. Create them on the dashboard." />;
  } else {
    const largest = segments.reduce((top, s) => (s.members > top.members ? s : top), segments[0]);
    const ruled = segments.filter((s) => s.rules.length).length;
    const picked = segments.reduce((sum, s) => sum + s.handPicked, 0);
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout
            lead={{ label: "Largest reach", value: n(largest.members), hint: largest.name }}
            items={[
              { label: "Segments", value: String(segments.length) },
              { label: "Rule-based", value: String(ruled) },
              { label: "Hand-picked", value: n(picked), hint: pluralize(picked, "contact", "contacts") },
            ]}
          />
        </Animated.View>
        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <ListGroup title="Segments" footer="Counts are live and move as contacts change.">
            {segments.map((s, i) => (
              <SegmentRow key={s.id} segment={s} divider={i < segments.length - 1} />
            ))}
          </ListGroup>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Segments" />}>
      <Text style={styles.lede}>Live member counts for each segment. Build and change segments on the dashboard.</Text>
      {body}
    </Screen>
  );
}

// One segment: who it reaches in mono on the right, then its rules as chips joined by "and".
function SegmentRow({ segment: s, divider }: { segment: GuestSegment; divider: boolean }) {
  return (
    <View style={[styles.row, divider && styles.divided]} accessible accessibilityLabel={`${s.name}, ${n(s.members)} ${pluralize(s.members, "contact", "contacts")}`}>
      <View style={styles.head}>
        <IconTile icon="users-round" size={36} />
        <View style={styles.headText}>
          <Text style={styles.name} numberOfLines={2}>
            {s.name}
          </Text>
          {s.description ? (
            <Text style={styles.description} numberOfLines={2}>
              {s.description}
            </Text>
          ) : null}
        </View>
        <View style={styles.reach}>
          <Text style={styles.reachValue}>{n(s.members)}</Text>
          <Text style={styles.reachLabel}>{pluralize(s.members, "contact", "contacts")}</Text>
        </View>
      </View>
      <View style={styles.rules}>
        {s.rules.length ? (
          s.rules.map((rule, i) => (
            <React.Fragment key={`${s.id}-${i}`}>
              {i ? <Text style={styles.and}>and</Text> : null}
              <View style={styles.rule}>
                <Text style={styles.ruleText}>{rule}</Text>
              </View>
            </React.Fragment>
          ))
        ) : (
          <Text style={styles.description}>{s.handPicked ? "Hand-picked contacts only" : "Everyone in the Contact Book"}</Text>
        )}
        {s.handPicked && s.rules.length ? (
          <>
            <Text style={styles.and}>plus</Text>
            <View style={styles.rule}>
              <Text style={styles.ruleText}>{`${n(s.handPicked)} hand-picked`}</Text>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
  row: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
    paddingTop: 1,
  },
  name: {
    ...type.labelStrong,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  description: {
    ...type.caption,
    color: colors.textSecondary,
  },
  reach: {
    alignItems: "flex-end",
  },
  reachValue: {
    ...type.figureSmall,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  reachLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  rules: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.xs + 2,
    paddingLeft: 36 + spacing.md,
  },
  rule: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceActive,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  ruleText: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 15,
    color: colors.mutedForeground,
  },
  and: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
});
