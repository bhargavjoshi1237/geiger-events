import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { DateStub } from "@/components/control/DateStub";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { fmtTimeAgo } from "@/lib/format";
import { selectionFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { LiveAttendance } from "@/types/control_checkin_ops";

type DoorEvent = LiveAttendance["events"][number];

const POLL_MS = 15_000;
const stagger = (i: number) => Math.min(i, 8) * 50;
const count = (n: number) => n.toLocaleString("en-US");
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
  const openCheckIn = (id: string) => {
    selectionFeedback();
    router.push({ pathname: "/control/event/[id]/checkin", params: { id } });
  };

  let body: React.ReactNode;
  if (live.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load attendance" message={live.error} actionLabel="Try again" onAction={() => void live.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else if (!data.events.length) {
    body = <EmptyState icon="calendar" title="Nothing on today" message="Live door numbers appear here on the day of an event." />;
  } else {
    const { admitted, expected } = data.totals;
    const groups = [
      { title: "Doors open today", rows: today, live: true },
      { title: "Coming up", rows: next, live: false },
    ].filter((g) => g.rows.length);
    let step = 0;

    body = (
      <View style={styles.stack}>
        {today.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <Readout
              lead={{ label: "Inside today", value: count(admitted), hint: expected ? `of ${count(expected)} expected` : "no guests expected" }}
              items={[
                { label: "Checked in", value: `${pctOf(admitted, expected)}%` },
                { label: "Not in yet", value: count(Math.max(0, expected - admitted)) },
                { label: "Events", value: String(today.length) },
              ]}
            >
              {expected > 0 ? <TickMeter value={admitted} max={expected} ticks={44} height={16} label={`${admitted} of ${expected} checked in today`} /> : null}
            </Readout>
          </Animated.View>
        ) : null}

        {groups.map((g) => (
          <Animated.View key={g.title} entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title={g.title} footer={g.live ? "Updates every 15 seconds. Tap an event to open its check-in." : undefined}>
              {g.rows.map((e, i) => (
                <DoorRow key={e.id} event={e} live={g.live} onPress={() => openCheckIn(e.id)} divider={i < g.rows.length - 1} />
              ))}
            </ListGroup>
          </Animated.View>
        ))}

        {data.recent.length ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <ListGroup title="Latest admissions">
              {data.recent.map((r, i) => (
                <ListRow
                  key={r.id}
                  leading={<Avatar name={r.name} size={36} />}
                  title={r.name}
                  subtitle={[r.eventName, r.area, r.by].filter(Boolean).join(" · ")}
                  trailing={<Text style={styles.time}>{fmtTimeAgo(r.at)}</Text>}
                  divider={i < data.recent.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
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

// One event at the door: its date, who's inside against who's expected on the tick scale, and the way into check-in.
function DoorRow({ event, live, onPress, divider }: { event: DoorEvent; live: boolean; onPress: () => void; divider: boolean }) {
  const pct = pctOf(event.admitted, event.expected);
  const line = [event.time?.slice(0, 5), event.venue].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${event.name}: ${event.admitted} of ${event.expected} checked in. Open check-in`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <DateStub date={event.date} today={live} />
      <View style={styles.rowStack}>
        <View style={styles.rowHead}>
          <Text style={styles.rowName} numberOfLines={1}>
            {event.name}
          </Text>
          <Text style={[styles.pct, live && event.admitted > 0 && styles.pctLive]}>{`${pct}%`}</Text>
        </View>
        {line ? (
          <Text style={styles.rowLine} numberOfLines={1}>
            {line}
          </Text>
        ) : null}
        {event.expected > 0 ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter
                value={event.admitted}
                max={event.expected}
                ticks={30}
                height={9}
                tone={live ? "success" : "neutral"}
                label={`${event.admitted} of ${event.expected} checked in`}
              />
            </View>
            <Text style={styles.count}>
              {count(event.admitted)}
              <Text style={styles.countOf}>{`/${count(event.expected)}`}</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.rowLine}>No guests expected yet</Text>
        )}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rowHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowName: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  pct: {
    ...type.mono,
    color: colors.textSecondary,
  },
  pctLive: {
    color: colors.success,
  },
  rowLine: {
    ...type.caption,
    color: colors.textSecondary,
  },
  meterRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
    marginTop: 3,
  },
  meter: {
    flex: 1,
  },
  count: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.foreground,
  },
  countOf: {
    color: colors.textTertiary,
  },
  time: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
