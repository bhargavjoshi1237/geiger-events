import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Input } from "@/components/ui/Input";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn, ORDER_STATUS_META } from "@/lib/control_meta";
import { fmtShortDay, isToday } from "@/lib/format";
import type { Tone } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlOrder, ControlOrderPage } from "@/types/portal";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
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

const SEARCH_DELAY_MS = 300;
const stagger = (i: number) => Math.min(i, 11) * 40;

type Props = {
  basePath: string;
  showEvent?: boolean;
};

type Extra = { base: ControlOrderPage; orders: ControlOrder[]; nextBefore: string | null };

// Orders newest first, filtered and searched on the server; later pages append under the first.
export function OrderList({ basePath, showEvent = false }: Props) {
  const router = useRouter();
  const { error: toastError } = useToast();
  const [status, setStatus] = useState("all");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [extra, setExtra] = useState<Extra | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const path = `${basePath}?status=${status}${term ? `&q=${encodeURIComponent(term)}` : ""}`;
  const { data, error, loading, reload } = useControlQuery<ControlOrderPage>(path);

  // Appended pages belong to one first page; a refetch (focus, new filter) starts the list over.
  const more = extra && extra.base === data ? extra : null;
  const orders = useMemo(() => {
    if (!data) return [];
    if (!more) return data.orders;
    const seen = new Set(data.orders.map((o) => o.id));
    return [...data.orders, ...more.orders.filter((o) => !seen.has(o.id))];
  }, [data, more]);
  const nextBefore = more ? more.nextBefore : data?.nextBefore ?? null;

  const groups = useMemo(() => {
    const out: { day: string; items: ControlOrder[] }[] = [];
    for (const o of orders) {
      const day = isToday(o.createdAt) ? "Today" : fmtShortDay(o.createdAt) || "Earlier";
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(o);
      else out.push({ day, items: [o] });
    }
    return out;
  }, [orders]);

  const loadMore = async () => {
    if (!data || !nextBefore || loadingMore) return;
    setLoadingMore(true);
    const res = await controlApi<ControlOrderPage>(`${path}&before=${encodeURIComponent(nextBefore)}`);
    setLoadingMore(false);
    if (!res.ok) {
      toastError(res.error);
      return;
    }
    setExtra({ base: data, orders: [...(more?.orders ?? []), ...res.data.orders], nextBefore: res.data.nextBefore });
  };

  const clearSearch = () => {
    setQuery("");
    setTerm("");
  };

  const tabLabel = STATUS_TABS.find((t) => t.value === status)?.label.toLowerCase() || "";

  return (
    <View>
      <View style={styles.toolbar}>
        <View style={styles.segment}>
          <Segmented options={STATUS_TABS} value={status} onChange={setStatus} />
        </View>
        <IconButton
          icon={searching ? "x" : "search"}
          label={searching ? "Close search" : "Search orders"}
          onPress={() => {
            setSearching((s) => !s);
            clearSearch();
          }}
        />
      </View>

      {searching ? (
        <View style={styles.search}>
          <Input
            leftIcon="search"
            value={query}
            onChangeText={setQuery}
            placeholder="Buyer, email or ticket…"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
        </View>
      ) : null}

      {error && !data ? (
        <EmptyState icon="circle-alert" title="Couldn't load orders" message={error} actionLabel="Try again" onAction={() => void reload()} />
      ) : loading || !data ? (
        <SkeletonList rows={6} variant="divided" />
      ) : !orders.length ? (
        term ? (
          <EmptyState
            icon="search"
            title="No matching orders"
            message="Try a different buyer name, email or ticket."
            actionLabel="Clear search"
            onAction={clearSearch}
          />
        ) : status !== "all" ? (
          <EmptyState
            icon="shopping-bag"
            title={`No ${tabLabel} orders`}
            message="Orders with this status will show up here."
            actionLabel="Show all orders"
            onAction={() => setStatus("all")}
          />
        ) : (
          <EmptyState icon="shopping-bag" title="No orders yet" message="Ticket sales show up here as soon as they happen." />
        )
      ) : (
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {groups.map((group, gi) => (
            <View key={group.day}>
              <SectionTitle variant="kicker">{group.day}</SectionTitle>
              <View style={styles.group}>
                {group.items.map((o, idx) => {
                  const meta = ORDER_STATUS_META[o.status];
                  const tint = TONE_COLORS[meta.tone];
                  const detail = [
                    showEvent ? o.eventName : "",
                    `${o.ticket || "Admission"}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`,
                    o.code,
                  ]
                    .filter(Boolean)
                    .join(" · ");
                  return (
                    <Animated.View key={o.id} entering={FadeInDown.delay(stagger(gi + idx)).springify()}>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${o.name || o.email}, ${moneyIn(o.total, o.currency)}, ${meta.label}`}
                        onPress={() => router.push({ pathname: "/control/order/[id]", params: { id: o.id } })}
                        style={({ pressed }) => [
                          styles.row,
                          idx < group.items.length - 1 && styles.rowDivided,
                          pressed && styles.pressed,
                        ]}
                      >
                        <IconTile icon={o.cancelled ? "ban" : o.refunded > 0 ? "undo-2" : "receipt"} size={44} />
                        <View style={styles.rowStack}>
                          <Text style={styles.rowName} numberOfLines={1}>
                            {o.name || o.email || "Buyer"}
                          </Text>
                          <Text style={styles.rowMeta} numberOfLines={1}>
                            {detail}
                          </Text>
                        </View>
                        <View style={styles.rowTrailing}>
                          <Text style={styles.rowTotal}>{moneyIn(o.total, o.currency)}</Text>
                          <View style={styles.statusRow}>
                            <View style={[styles.statusDot, { backgroundColor: tint }]} />
                            <Text style={[styles.statusText, { color: tint }]} numberOfLines={1}>
                              {meta.label}
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
          {nextBefore ? (
            <Button title="Load more" variant="secondary" onPress={() => void loadMore()} loading={loadingMore} fullWidth />
          ) : null}
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  segment: {
    flex: 1,
  },
  search: {
    marginBottom: spacing.lg,
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
