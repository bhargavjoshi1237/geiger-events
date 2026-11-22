import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { StatTile } from "@/components/control/StatTile";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Meter } from "@/components/ui/Meter";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { moneyIn } from "@/lib/control_meta";
import { fmtShortDay } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlAnalytics, ControlEventDetail } from "@/types/portal";

const CHART_HEIGHT = 120;

// Server days are UTC dates; anchoring at local noon keeps the label on the same calendar day everywhere.
const asLocal = (date: string) => `${date}T12:00:00`;

export default function AnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hub = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`);
  const stats = useControlQuery<ControlAnalytics>(`/api/control/events/${id}/analytics`);
  const currency = hub.data?.details.currency ?? "usd";
  const data = stats.data;

  return (
    <Screen scroll header={<ScreenHeader title="Analytics" subtitle={hub.data?.event.name} />}>
      {stats.error && !data ? (
        <EmptyState
          icon="circle-alert"
          title="Couldn't load the numbers"
          message={stats.error}
          actionLabel="Try again"
          onAction={() => {
            void hub.reload();
            void stats.reload();
          }}
        />
      ) : !data ? (
        <SkeletonList rows={4} variant="card" />
      ) : (
        <View style={styles.stack}>
          <View style={styles.tiles}>
            <View style={styles.tileRow}>
              <StatTile label="Revenue" value={moneyIn(data.totals.revenue, currency)} hint="After refunds" />
              <StatTile label="Tickets sold" value={String(data.totals.sold)} />
            </View>
            <View style={styles.tileRow}>
              <StatTile label="Orders" value={String(data.totals.orders)} />
              <StatTile label="Refunded" value={moneyIn(data.totals.refunded, currency)} />
            </View>
          </View>

          {data.totals.orders === 0 ? (
            <EmptyState icon="chart-column" title="No sales yet" message="Sales by day and by ticket show up here once orders come in." />
          ) : (
            <>
              <DayChart days={data.byDay} currency={currency} />
              <View>
                <SectionTitle variant="kicker">By ticket</SectionTitle>
                <View style={styles.group}>
                  {data.byTicket.map((t, i) => (
                    <View key={t.name} style={[styles.ticketRow, i < data.byTicket.length - 1 && styles.divided]}>
                      <View style={styles.ticketStack}>
                        <Text style={styles.ticketName} numberOfLines={1}>
                          {t.name}
                        </Text>
                        <Text style={styles.ticketMeta}>{`${t.sold} sold`}</Text>
                      </View>
                      <Text style={styles.ticketRevenue}>{moneyIn(t.revenue, currency)}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </>
          )}

          <Attendance admitted={data.attendance.admitted} expected={data.attendance.expected} />
        </View>
      )}
    </Screen>
  );
}

function DayChart({ days, currency }: { days: ControlAnalytics["byDay"]; currency: string }) {
  // Revenue when anything earned money; free events chart tickets instead.
  const byRevenue = days.some((d) => d.revenue > 0);
  const values = days.map((d) => (byRevenue ? d.revenue : d.sold));
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, v) => sum + v, 0);
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;

  return (
    <View>
      <SectionTitle variant="kicker">Last 14 days</SectionTitle>
      <View style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={styles.chartTotal}>{byRevenue ? moneyIn(total, currency) : `${total} sold`}</Text>
          <Text style={styles.chartRange}>{first && last ? `${fmtShortDay(asLocal(first))} – ${fmtShortDay(asLocal(last))}` : ""}</Text>
        </View>
        <View
          style={styles.bars}
          accessible
          accessibilityLabel={`${byRevenue ? "Revenue" : "Tickets sold"} per day over the last ${days.length} days`}
        >
          {days.map((d, i) => {
            const value = values[i];
            const height = value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 2;
            const today = i === days.length - 1;
            return (
              <View key={d.date} style={styles.barColumn}>
                <View style={[styles.bar, today ? styles.barToday : value > 0 ? styles.barFilled : styles.barEmpty, { height }]} />
                <Text style={[styles.barLabel, today && styles.barLabelToday]}>{Number(d.date.slice(8, 10))}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function Attendance({ admitted, expected }: { admitted: number; expected: number }) {
  const pct = expected ? Math.min(100, Math.round((admitted / expected) * 100)) : 0;
  return (
    <View>
      <SectionTitle variant="kicker">Attendance</SectionTitle>
      <View style={styles.chartCard}>
        <View style={styles.chartHead}>
          <Text style={styles.chartTotal}>{`${admitted} of ${expected}`}</Text>
          <Text style={styles.chartRange}>{expected ? `${pct}% checked in` : "No confirmed guests yet"}</Text>
        </View>
        <Meter value={admitted} max={expected} label={`${admitted} of ${expected} checked in`} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  tiles: {
    gap: spacing.sm,
  },
  tileRow: {
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
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  ticketRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  ticketStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  ticketName: {
    ...type.label,
    fontSize: 15,
    color: colors.foreground,
  },
  ticketMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  ticketRevenue: {
    ...type.bodyStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
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
    gap: 4,
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
    borderRadius: 3,
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
