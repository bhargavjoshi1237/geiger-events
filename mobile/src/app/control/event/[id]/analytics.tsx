import { useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { TickMeter } from "@/components/ui/TickMeter";
import { moneyIn } from "@/lib/control_meta";
import { fmtShortDay } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlAnalytics, ControlEventDetail } from "@/types/portal";

const CHART_HEIGHT = 120;

// Server days are UTC dates; anchoring at local noon keeps the label on the same calendar day everywhere.
const asLocal = (date: string) => `${date}T12:00:00`;
const count = (n: number) => n.toLocaleString("en-US");
const stagger = (i: number) => Math.min(i, 8) * 50;

export default function AnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const hub = useControlQuery<ControlEventDetail>(`/api/control/events/${id}`);
  const stats = useControlQuery<ControlAnalytics>(`/api/control/events/${id}/analytics`);
  const currency = hub.data?.details.currency ?? "usd";
  const data = stats.data;

  let body: React.ReactNode;
  if (stats.error && !data) {
    body = (
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
    );
  } else if (!data) {
    body = <SkeletonList rows={4} variant="card" />;
  } else {
    const { totals, attendance } = data;
    const past = hub.data?.event.when === "past";
    const attendancePct = attendance.expected > 0 ? Math.round((attendance.admitted / attendance.expected) * 100) : 0;
    let step = 0;

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <Readout
            lead={{ label: "Revenue", value: moneyIn(totals.revenue, currency), hint: "after refunds" }}
            items={[
              { label: "Tickets sold", value: count(totals.sold) },
              { label: "Orders", value: count(totals.orders) },
              { label: "Refunded", value: moneyIn(totals.refunded, currency) },
            ]}
          />
        </Animated.View>

        {totals.orders === 0 ? (
          <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
            <EmptyState
              icon="chart-column"
              title="No sales yet"
              message="Sales by day and by ticket show up here once orders come in."
              actionLabel="Check again"
              onAction={() => void stats.reload()}
            />
          </Animated.View>
        ) : (
          <>
            <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
              <DayChart days={data.byDay} currency={currency} />
            </Animated.View>
            {data.byTicket.length ? (
              <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
                <ByTicket rows={data.byTicket} currency={currency} />
              </Animated.View>
            ) : null}
          </>
        )}

        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <SectionTitle variant="kicker">Attendance</SectionTitle>
          <Readout
            lead={{
              label: "Checked in",
              value: count(attendance.admitted),
              hint: attendance.expected > 0 ? `of ${count(attendance.expected)} · ${attendancePct}%` : "no confirmed guests yet",
              tone: attendance.admitted > 0 ? "success" : "neutral",
            }}
            items={[
              { label: "Expected", value: count(attendance.expected) },
              { label: past ? "No-shows" : "To arrive", value: count(Math.max(0, attendance.expected - attendance.admitted)) },
            ]}
          >
            {attendance.expected > 0 ? (
              <TickMeter
                value={attendance.admitted}
                max={attendance.expected}
                ticks={44}
                height={16}
                label={`${attendance.admitted} of ${attendance.expected} checked in`}
              />
            ) : null}
          </Readout>
        </Animated.View>
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Analytics" subtitle={hub.data?.event.name} />}>
      {body}
    </Screen>
  );
}

function DayChart({ days, currency }: { days: ControlAnalytics["byDay"]; currency: string }) {
  // Revenue when anything earned money; free events chart tickets instead.
  const byRevenue = days.some((d) => d.revenue > 0);
  const values = days.map((d) => (byRevenue ? d.revenue : d.sold));
  const max = Math.max(...values, 1);
  const total = values.reduce((sum, v) => sum + v, 0);
  const peakIndex = values.indexOf(Math.max(...values, 0));
  const peak = total > 0 && peakIndex >= 0 ? days[peakIndex] : null;
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  const show = (v: number) => (byRevenue ? moneyIn(v, currency) : `${count(v)} sold`);

  return (
    <ListGroup title={`Last ${days.length || 14} days`}>
      <View style={styles.chart}>
        <View style={styles.chartHead}>
          <View style={styles.chartTotal}>
            <Text style={styles.figureLabel}>{byRevenue ? "Revenue" : "Tickets"}</Text>
            <Text style={styles.figure}>{byRevenue ? moneyIn(total, currency) : count(total)}</Text>
          </View>
          <Text style={styles.range}>{first && last ? `${fmtShortDay(asLocal(first))} – ${fmtShortDay(asLocal(last))}` : ""}</Text>
        </View>

        <View>
          <View style={styles.bars} accessible accessibilityLabel={`${byRevenue ? "Revenue" : "Tickets sold"} per day over the last ${days.length} days`}>
            {days.map((d, i) => {
              const value = values[i];
              const height = value > 0 ? Math.max(3, (value / max) * CHART_HEIGHT) : 2;
              const today = i === days.length - 1;
              return (
                <View key={d.date} style={styles.barColumn}>
                  <View style={[styles.bar, today ? styles.barToday : value > 0 ? styles.barFilled : styles.barEmpty, { height }]} />
                </View>
              );
            })}
          </View>
          <View style={styles.axis}>
            {days.map((d, i) => (
              <Text key={d.date} style={[styles.axisLabel, i === days.length - 1 && styles.axisToday]}>
                {Number(d.date.slice(8, 10))}
              </Text>
            ))}
          </View>
        </View>

        {peak ? (
          <View style={styles.peak}>
            <Text style={styles.figureLabel}>Best day</Text>
            <Text style={styles.peakValue} numberOfLines={1}>
              {`${fmtShortDay(asLocal(peak.date))} · ${show(values[peakIndex])}`}
            </Text>
          </View>
        ) : null}
      </View>
    </ListGroup>
  );
}

// Each ticket's share of the total as a bar: revenue when anything earned money, tickets for free events.
function ByTicket({ rows, currency }: { rows: ControlAnalytics["byTicket"]; currency: string }) {
  const byRevenue = rows.some((t) => t.revenue > 0);
  const total = rows.reduce((sum, t) => sum + (byRevenue ? t.revenue : t.sold), 0);

  return (
    <ListGroup title="By ticket" footer={byRevenue ? "Bars show each ticket's share of revenue." : "Bars show each ticket's share of tickets sold."}>
      {rows.map((t, i) => {
        const share = total > 0 ? Math.round(((byRevenue ? t.revenue : t.sold) / total) * 100) : 0;
        return (
          <View
            key={t.name}
            style={[styles.ticketRow, i < rows.length - 1 && styles.divided]}
            accessible
            accessibilityLabel={`${t.name}: ${t.sold} sold, ${moneyIn(t.revenue, currency)}, ${share}%`}
          >
            <View style={styles.ticketHead}>
              <Text style={styles.ticketName} numberOfLines={1}>
                {t.name}
              </Text>
              <Text style={styles.ticketRevenue}>{moneyIn(t.revenue, currency)}</Text>
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${share}%` }]} />
            </View>
            <View style={styles.ticketFoot}>
              <Text style={styles.ticketMeta}>{`${count(t.sold)} sold`}</Text>
              <Text style={styles.ticketMeta}>{`${share}%`}</Text>
            </View>
          </View>
        );
      })}
    </ListGroup>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
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
  chartTotal: {
    flexShrink: 1,
    gap: 3,
  },
  figureLabel: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  figure: {
    ...type.figureSmall,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  range: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  bars: {
    height: CHART_HEIGHT,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.borderStrong,
  },
  barColumn: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bar: {
    width: "100%",
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barFilled: {
    backgroundColor: colors.borderStrong,
  },
  barEmpty: {
    backgroundColor: colors.surfaceActive,
  },
  barToday: {
    backgroundColor: colors.foreground,
  },
  axis: {
    flexDirection: "row",
    gap: 4,
    marginTop: 6,
  },
  axisLabel: {
    ...type.monoSmall,
    flex: 1,
    fontSize: 10,
    lineHeight: 12,
    letterSpacing: 0,
    textAlign: "center",
    color: colors.textTertiary,
  },
  axisToday: {
    color: colors.foreground,
  },
  peak: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.surfaceActive,
    paddingTop: spacing.md,
  },
  peakValue: {
    ...type.monoSmall,
    flexShrink: 1,
    color: colors.foreground,
  },
  ticketRow: {
    gap: spacing.sm,
    paddingVertical: 14,
  },
  ticketHead: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.md,
  },
  ticketName: {
    ...type.label,
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  ticketRevenue: {
    ...type.mono,
    fontSize: 14,
    lineHeight: 20,
    color: colors.foreground,
  },
  track: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceActive,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: radius.pill,
    backgroundColor: colors.mutedForeground,
  },
  ticketFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  ticketMeta: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
