import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition, useSharedValue } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtDate, money } from "@/lib/format";
import { ORDER_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, spacing, type } from "@/theme/tokens";

const stagger = (i: number) => Math.min(i, 11) * 40;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "confirmed", label: "Confirmed" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

export default function OrdersScreen() {
  const router = useRouter();
  const { data, refreshing, refreshAll } = usePortalData();
  const scrollY = useSharedValue(0);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(query), 200);
    return () => clearTimeout(id);
  }, [query]);

  const orders = useMemo(() => data?.orders || [], [data]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return orders.filter((o) => {
      if (status !== "all" && o.status !== status) return false;
      if (!q) return true;
      return (
        o.eventName.toLowerCase().includes(q) ||
        (o.orderCode || "").toLowerCase().includes(q) ||
        (o.ticket || "").toLowerCase().includes(q)
      );
    });
  }, [orders, debounced, status]);

  const hasFilters = Boolean(debounced.trim()) || status !== "all";
  const clearFilters = () => {
    setQuery("");
    setDebounced("");
    setStatus("all");
  };

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title="Orders" subtitle="Your purchases and receipts." scrollY={scrollY} />

      {data === null ? (
        <SkeletonList rows={5} />
      ) : !orders.length ? (
        <EmptyState
          icon="shopping-bag"
          title="No orders yet"
          message="Your ticket purchases and receipts will show up here."
        />
      ) : (
        <View style={styles.stack}>
          <Segmented options={STATUS_OPTIONS} value={status} onChange={setStatus} />
          <Input
            leftIcon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Search orders…"
            autoCapitalize="none"
          />

          {filtered.length ? (
            <Animated.View layout={LinearTransition} style={styles.list}>
              {filtered.map((o, idx) => {
                const pill = statusPill(ORDER_STATUS, o.status);
                return (
                  <Animated.View
                    key={o.id}
                    entering={FadeInDown.delay(stagger(idx)).springify()}
                    layout={LinearTransition}
                  >
                    <Card onPress={() => router.push(`/orders/${o.id}`)} style={styles.rowCard}>
                      <ListRow
                        title={o.eventName}
                        subtitle={`${fmtDate(o.createdAt)} · ${o.orderCode}`}
                        trailing={
                          <View style={styles.rowTrailing}>
                            <Pill label={pill.label} tone={pill.tone} />
                            <Text style={styles.rowTotal}>{money(o.total)}</Text>
                          </View>
                        }
                        divider={false}
                      />
                    </Card>
                  </Animated.View>
                );
              })}
            </Animated.View>
          ) : (
            <EmptyState
              icon="file-text"
              title="No matching orders"
              message="Try a different search or clear the status filter."
              actionLabel={hasFilters ? "Clear filters" : undefined}
              onAction={hasFilters ? clearFilters : undefined}
            />
          )}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  rowCard: {
    padding: 0,
  },
  rowTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rowTotal: {
    ...type.label,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
});
