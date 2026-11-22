import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { moneyIn } from "@/lib/control_meta";
import { fmtDate, fmtShortDay } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { OpsSummary, OpsTopEvent } from "@/types/control_ops";

const CHART_HEIGHT = 110;
const asLocal = (date: string) => `${date}T12:00:00`;
const stagger = (i: number) => Math.min(i, 8) * 50;
const num = (n: number) => n.toLocaleString("en-US");

// Every event in the project together; amounts in different currencies add up as plain numbers, shown in USD like Today.
export default function AnalyticsOverviewScreen() {
  const router = useRouter();
  const { project } = useControl();
  const query = useControlQuery<OpsSummary>(project ? `/api/control/ops/projects/${project.id}/analytics` : null);
  const data = query.data;

  let body: React.ReactNode;
  if (query.error && !data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load analytics" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  } else if (!data) {
    body = <SkeletonList rows={5} variant="card" />;
  } else {
    const { totals } = data;
    let step = 0;
    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            lead={{ label: "Revenue", value: moneyIn(totals.revenue), hint: "after refunds" }}
            items={[
              { label: "Tickets", value: num(totals.sold) },
              { label: "Orders", value: num(totals.orders) },
              { label: "Events", value: num(totals.events) },
            ]}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <SectionTitle variant="kicker">Attendance</SectionTitle>
          <Readout lead={{ label: "Show rate", value: `${totals.showRate}%`, hint: `${num(totals.checkedIn)} of ${num(totals.sold)} came` }}>
            {totals.sold > 0 ? <TickMeter value={totals.checkedIn} max={totals.sold} ticks={44} height={16} label={`${totals.checkedIn} of ${totals.sold} ticket holders checked in`} /> : null}
          </Readout>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <DayChart days={data.byDay} recentRevenue={data.recent.revenue} recentSold={data.recent.sold} />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          {!data.topEvents.length ? (
            <View>
              <SectionTitle variant="kicker">Top events</SectionTitle>
              <EmptyState icon="chart-line" title="No sales yet" message="Events appear here once they sell tickets." />
            </View>
          ) : (
            <ListGroup title="Top events by revenue" footer="Traffic, email and engagement reports stay on the dashboard.">
              {data.topEvents.map((e, i) => (
                <RankRow
                  key={e.id}
                  rank={i + 1}
                  event={e}
                  onPress={() => router.push({ pathname: "/control/event/[id]", params: { id: e.id } })}
                  divider={i < data.topEvents.length - 1}
                />
              ))}
            </ListGroup>
          )}
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Analytics" subtitle={project?.name} />}>
      {body}
    </Screen>
  );
}

// A ledger line: mono rank, the event with sold on the tick scale, and its revenue right-aligned.
function RankRow({ rank, event: e, onPress, divider }: { rank: number; event: OpsTopEvent; onPress: () => void; divider: boolean }) {
  const meta = [e.date ? fmtDate(asLocal(e.date)) : "No date", `${num(e.checkedIn)} in`].join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${e.name}, ${moneyIn(e.revenue)}, ${e.sold} sold`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.rankRow, divider && styles.divided, pressed && styles.pressed]}
    >
      <Text style={[styles.rank, rank === 1 && styles.rankFirst]}>{String(rank).padStart(2, "0")}</Text>
      <View style={styles.rankStack}>
        <View style={styles.rankTitleRow}>
          <Text style={styles.rankName} numberOfLines={1}>
            {e.name}
          </Text>
          <Text style={styles.amount} numberOfLines={1}>
            {moneyIn(e.revenue)}
          </Text>
        </View>
        <Text style={styles.rankMeta} numberOfLines={1}>
          {meta}
        </Text>
        {e.capacity > 0 ? (
          <View style={styles.meterRow}>
            <View style={styles.meter}>
              <TickMeter value={e.sold} max={e.capacity} ticks={30} height={9} label={`${e.sold} of ${e.capacity} sold`} />
            </View>
            <Text style={styles.count}>
              {e.sold}
              <Text style={styles.countOf}>{`/${e.capacity}`}</Text>
            </Text>
          </View>
        ) : (
          <Text style={styles.count}>
            {e.sold}
            <Text style={styles.countOf}> sold</Text>
          </Text>
        )}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function DayChart({ days, recentRevenue, recentSold }: { days: OpsSummary["byDay"]; recentRevenue: number; recentSold: number }) {
  const byRevenue = days.some((d) => d.revenue > 0);
  const values = days.map((d) => (byRevenue ? d.revenue : d.sold));
  const max = Math.max(...values, 1);
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;

  return (
    <ListGroup title="Last 30 days">
      <View style={styles.chart}>
        <View style={styles.chartHead}>
          <View style={styles.chartFigure}>
            <Text style={styles.chartLabel}>{byRevenue ? "Revenue" : "Tickets sold"}</Text>
            <Text style={styles.chartTotal}>{byRevenue ? moneyIn(recentRevenue) : num(recentSold)}</Text>
          </View>
          <Text style={styles.chartRange}>{first && last ? `${fmtShortDay(asLocal(first))} – ${fmtShortDay(asLocal(last))}` : ""}</Text>
        </View>
        <View style={styles.bars} accessible accessibilityLabel={`${byRevenue ? "Revenue" : "Tickets sold"} per day over the last ${days.length} days`}>
          {days.map((d, i) => {
            const value = values[i];
            const height = value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 2;
            const today = i === days.length - 1;
            // Every fifth day is labelled so thirty bars stay readable.
            const labelled = today || (days.length - 1 - i) % 5 === 0;
            return (
              <View key={d.date} style={styles.barColumn}>
                <View style={[styles.bar, today ? styles.barToday : value > 0 ? styles.barFilled : styles.barEmpty, { height }]} />
                <Text style={[styles.barLabel, today && styles.barLabelToday]}>{labelled ? Number(d.date.slice(8, 10)) : " "}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  rank: {
    ...type.mono,
    width: 24,
    color: colors.textTertiary,
  },
  rankFirst: {
    color: colors.foreground,
  },
  rankStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  rankTitleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  rankName: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  amount: {
    ...type.mono,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  rankMeta: {
    ...type.monoSmall,
    fontSize: 11,
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
  chart: {
    paddingVertical: spacing.lg,
    gap: spacing.lg,
  },
  chartHead: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  chartFigure: {
    gap: 3,
  },
  chartLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  chartTotal: {
    ...type.figureSmall,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  chartRange: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  barColumn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    minHeight: CHART_HEIGHT + 20,
  },
  bar: {
    width: "100%",
    borderRadius: 2,
  },
  barFilled: {
    backgroundColor: colors.borderStrong,
  },
  barEmpty: {
    backgroundColor: colors.surfaceActive,
  },
  barToday: {
    backgroundColor: colors.primary,
  },
  barLabel: {
    ...type.monoSmall,
    fontSize: 9,
    lineHeight: 12,
    color: colors.textTertiary,
  },
  barLabelToday: {
    color: colors.foreground,
  },
});
