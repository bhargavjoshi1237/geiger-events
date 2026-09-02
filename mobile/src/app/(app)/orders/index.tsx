import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtMonthYear, money } from "@/lib/format";
import { ORDER_STATUS, REFUND_STATUS, statusPill } from "@/lib/status";
import type { Tone } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Order } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

const TONE_COLORS: Record<Tone, string> = {
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  warning: colors.warning,
  neutral: colors.mutedForeground,
};

function orderBadge(o: Order) {
  if (o.refund) return statusPill(REFUND_STATUS, o.refund.status);
  return statusPill(ORDER_STATUS, o.status);
}

export default function OrdersScreen() {
  const router = useRouter();
  const { data } = usePortalData();
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const orders = useMemo(
    () =>
      [...(data?.orders || [])].sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime(),
      ),
    [data],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      return `${o.eventName} ${o.orderCode} ${o.ticket}`.toLowerCase().includes(q);
    });
  }, [orders, query, status]);

  const groups = useMemo(() => {
    const out: { month: string; items: Order[] }[] = [];
    for (const o of filtered) {
      const month = fmtMonthYear(o.createdAt) || "Earlier";
      const last = out[out.length - 1];
      if (last && last.month === month) last.items.push(o);
      else out.push({ month, items: [o] });
    }
    return out;
  }, [filtered]);

  const hasFilters = Boolean(query.trim()) || status !== "all";

  return (
    <Screen scroll>
      <ScreenHeader
        title="Orders"
        right={
          <IconButton
            icon={searching ? "x" : "search"}
            label={searching ? "Close search" : "Search orders"}
            variant="plain"
            onPress={() => {
              setSearching((s) => !s);
              setQuery("");
            }}
          />
        }
      />

      {data === null ? (
        <SkeletonList rows={5} />
      ) : !orders.length ? (
        <EmptyState
          icon="shopping-bag"
          title="No orders yet"
          message="Your ticket purchases and receipts will show up here."
        />
      ) : (
        <>
          {searching ? (
            <View style={styles.search}>
              <Input
                leftIcon="search"
                value={query}
                onChangeText={setQuery}
                placeholder="Search orders, events, codes…"
                autoCapitalize="none"
                autoFocus
              />
            </View>
          ) : null}

          <View style={styles.filters}>
            <FilterChips options={STATUS_FILTERS} value={status} onChange={setStatus} />
          </View>

          {!filtered.length ? (
            <EmptyState
              icon="funnel"
              title="No matching orders"
              message="Try a different search or clear the status filter."
              actionLabel={hasFilters ? "Clear filters" : undefined}
              onAction={
                hasFilters
                  ? () => {
                      setQuery("");
                      setStatus("all");
                    }
                  : undefined
              }
            />
          ) : (
            <Animated.View layout={LinearTransition} style={styles.stack}>
              {groups.map((group, gi) => (
                <View key={group.month}>
                  <SectionTitle variant="kicker">{group.month}</SectionTitle>
                  <View style={styles.group}>
                    {group.items.map((o, idx) => {
                      const badge = orderBadge(o);
                      return (
                        <Animated.View
                          key={o.id}
                          entering={FadeInDown.delay(stagger(gi + idx)).springify()}
                        >
                          <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={`${o.eventName}, ${badge.label}`}
                            onPress={() => router.push(`/orders/${o.id}`)}
                            style={({ pressed }) => [
                              styles.row,
                              idx < group.items.length - 1 && styles.rowDivided,
                              pressed && styles.pressed,
                            ]}
                          >
                            <IconTile
                              icon={o.total > 0 ? "file-text" : "award"}
                              size={44}
                            />
                            <View style={styles.rowStack}>
                              <Text style={styles.rowName} numberOfLines={1}>
                                {o.eventName}
                              </Text>
                              <Text style={styles.rowMeta} numberOfLines={1}>
                                {o.ticket || "Admission"}
                                {o.quantity > 1 ? ` × ${o.quantity}` : ""} · {o.orderCode}
                              </Text>
                            </View>
                            <View style={styles.rowTrailing}>
                              <Text style={styles.rowTotal}>{money(o.total)}</Text>
                              <View style={styles.statusRow}>
                                <View
                                  style={[
                                    styles.statusDot,
                                    { backgroundColor: TONE_COLORS[badge.tone] },
                                  ]}
                                />
                                <Text
                                  style={[styles.statusText, { color: TONE_COLORS[badge.tone] }]}
                                  numberOfLines={1}
                                >
                                  {badge.label}
                                </Text>
                              </View>
                            </View>
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </View>
                </View>
              ))}
            </Animated.View>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    marginBottom: spacing.md,
  },
  filters: {
    marginBottom: spacing.lg + 2,
  },
  stack: {
    gap: spacing.xl - 4,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl - 2,
    backgroundColor: colors.surfaceSubtle,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: spacing.lg,
  },
  rowDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.7,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowName: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  rowMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  rowTrailing: {
    alignItems: "flex-end",
    gap: 5,
  },
  rowTotal: {
    ...type.bodyStrong,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...type.micro,
    fontSize: 11,
    maxWidth: 110,
  },
});
