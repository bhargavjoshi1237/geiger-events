import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Meter } from "@/components/ui/Meter";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtTimeAgo } from "@/lib/format";
import { selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { LiveAttendance } from "@/types/control_checkin_ops";

const POLL_MS = 15_000;

const pctOf = (admitted: number, expected: number) => (expected ? Math.round((admitted / expected) * 100) : 0);

export default function LiveAttendanceScreen() {
  const router = useRouter();
  const { project } = useControl();
  const focused = useAppFocused();
  const live = useControlQuery<LiveAttendance>(project ? `/api/control/checkin_ops/projects/${project.id}/attendance` : null);
  const { reload } = live;

  useEffect(() => {
    if (!focused) return undefined;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [focused, reload]);

  const data = live.data;
  const today = data?.events.filter((e) => e.when === "today") ?? [];
  const next = data?.events.filter((e) => e.when !== "today") ?? [];

  let body: React.ReactNode;
  if (live.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load attendance" message={live.error} actionLabel="Try again" onAction={() => void live.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else if (!data.events.length) {
    body = <EmptyState icon="calendar" title="Nothing on today" message="Live door numbers appear here on the day of an event." />;
  } else {
    body = (
      <View style={styles.stack}>
        {today.length ? (
          <View style={styles.tiles}>
            <StatTile label="Inside today" value={data.totals.admitted.toLocaleString("en-US")} />
            <StatTile label="Expected" value={data.totals.expected.toLocaleString("en-US")} />
            <StatTile label="Checked in" value={`${pctOf(data.totals.admitted, data.totals.expected)}%`} />
          </View>
        ) : null}
        {[
          { title: "Today", rows: today },
          { title: "Coming up", rows: next },
        ]
          .filter((g) => g.rows.length)
          .map((g) => (
            <View key={g.title} style={styles.section}>
              <SectionTitle variant="kicker">{g.title}</SectionTitle>
              {g.rows.map((e) => (
                <Pressable
                  key={e.id}
                  accessibilityRole="button"
                  accessibilityLabel={`${e.name}: ${e.admitted} of ${e.expected} checked in. Open check-in`}
                  onPress={() => {
                    selectionFeedback();
                    router.push({ pathname: "/control/event/[id]/checkin", params: { id: e.id } });
                  }}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}
                >
                  <View style={styles.cardHead}>
                    <Text style={styles.cardName} numberOfLines={1}>
                      {e.name}
                    </Text>
                    <Text style={styles.cardPct}>{`${pctOf(e.admitted, e.expected)}%`}</Text>
                  </View>
                  <Meter value={e.admitted} max={e.expected} label={`${e.admitted} of ${e.expected} checked in`} />
                  <Text style={styles.cardMeta}>
                    {[`${e.admitted.toLocaleString("en-US")} of ${e.expected.toLocaleString("en-US")} inside`, e.time?.slice(0, 5), e.venue].filter(Boolean).join(" · ")}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))}
        {data.recent.length ? (
          <View style={styles.section}>
            <SectionTitle variant="kicker">Latest admissions</SectionTitle>
            <View style={styles.group}>
              {data.recent.map((r, i) => (
                <ListRow
                  key={r.id}
                  title={r.name}
                  subtitle={[r.eventName, r.area, r.by].filter(Boolean).join(" · ")}
                  trailing={<Text style={styles.time}>{fmtTimeAgo(r.at)}</Text>}
                  divider={i < data.recent.length - 1}
                />
              ))}
            </View>
          </View>
        ) : null}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Real-time attendance" />}>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  tiles: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  section: {
    gap: spacing.sm,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  cardName: {
    ...type.labelStrong,
    flex: 1,
    color: colors.foreground,
  },
  cardPct: {
    ...type.labelStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  cardMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  time: {
    ...type.caption,
    color: colors.textSecondary,
  },
});
