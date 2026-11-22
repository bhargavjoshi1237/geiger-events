import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { moneyIn } from "@/lib/control_meta";
import { fmtDate, fmtShortDay } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { OpsSummary } from "@/types/control_ops";

const CHART_HEIGHT = 110;
const asLocal = (date: string) => `${date}T12:00:00`;

// Every event in the project together; amounts in different currencies add up as plain numbers, shown in USD like Today.
export default function AnalyticsOverviewScreen() {
  const router = useRouter();
  const { project } = useControl();
  const query = useControlQuery<OpsSummary>(project ? `/api/control/ops/projects/${project.id}/analytics` : null);
  const data = query.data;

  return (
    <Screen scroll header={<ScreenHeader title="Analytics" subtitle={project?.name} />}>
      {query.error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load analytics" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />
      ) : !data ? (
        <SkeletonList rows={5} variant="card" />
      ) : (
        <View style={styles.stack}>
          <View style={styles.row}>
            <StatTile label="Revenue" value={moneyIn(data.totals.revenue)} hint="After refunds" />
            <StatTile label="Tickets" value={data.totals.sold.toLocaleString("en-US")} />
            <StatTile label="Orders" value={data.totals.orders.toLocaleString("en-US")} />
          </View>
          <View style={styles.row}>
            <StatTile label="Events" value={String(data.totals.events)} />
            <StatTile label="Checked in" value={data.totals.checkedIn.toLocaleString("en-US")} />
            <StatTile label="Show rate" value={`${data.totals.showRate}%`} hint="Of tickets sold" />
          </View>

          <DayChart days={data.byDay} recentRevenue={data.recent.revenue} recentSold={data.recent.sold} />

          <View>
            <SectionTitle variant="kicker">Top events</SectionTitle>
            {!data.topEvents.length ? (
              <EmptyState icon="chart-line" title="No sales yet" message="Events appear here once they sell tickets." />
            ) : (
              <View style={styles.group}>
                {data.topEvents.map((e, i) => (
                  <ListRow
                    key={e.id}
                    leading={<IconTile icon="calendar" size={34} />}
                    title={e.name}
                    subtitle={[
                      e.date ? fmtDate(asLocal(e.date)) : "No date",
                      e.capacity ? `${e.sold}/${e.capacity} sold` : `${e.sold} sold`,
                      `${e.checkedIn} in`,
                    ].join(" · ")}
                    trailing={<Text style={styles.amount}>{moneyIn(e.revenue)}</Text>}
                    onPress={() => router.push({ pathname: "/control/event/[id]", params: { id: e.id } })}
                    divider={i < data.topEvents.length - 1}
                  />
                ))}
              </View>
            )}
          </View>
          <Text style={styles.caption}>Traffic, email and engagement reports stay on the dashboard.</Text>
        </View>
      )}
    </Screen>
  );
}

function DayChart({ days, recentRevenue, recentSold }: { days: OpsSummary["byDay"]; recentRevenue: number; recentSold: number }) {
  const byRevenue = days.some((d) => d.revenue > 0);
  const values = days.map((d) => (byRevenue ? d.revenue : d.sold));
  const max = Math.max(...values, 1);
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;

  return (
    <View>
      <SectionTitle variant="kicker">Last 30 days</SectionTitle>
      <View style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={styles.chartTotal}>{byRevenue ? moneyIn(recentRevenue) : `${recentSold} sold`}</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  amount: {
    ...type.labelStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  caption: {
    ...type.caption,
    color: colors.textSecondary,
  },
  chartCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  chartHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  chartTotal: {
    ...type.heading,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  chartRange: {
    ...type.caption,
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
    ...type.micro,
    fontSize: 10,
    lineHeight: 12,
    color: colors.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  barLabelToday: {
    color: colors.foreground,
  },
});
