import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { byDay, clock } from "@/components/control/money/ledger";
import { MoneyRow } from "@/components/control/money/MoneyRow";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { moneyIn, ORDER_STATUS_META } from "@/lib/control_meta";
import { useControlQuery } from "@/lib/use_control_query";
import { spacing } from "@/theme/tokens";
import type { ControlOrder, ControlOrderPage } from "@/types/portal";

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "refunded", label: "Refunded" },
  { value: "cancelled", label: "Cancelled" },
];

const SEARCH_DELAY_MS = 300;
// The segmented track is 36pt segments plus 3pt padding, so the search button matches it at 42.
const TOOLBAR_HEIGHT = 42;
const stagger = (i: number) => Math.min(i, 8) * 50;

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

  const groups = useMemo(() => byDay(orders, (o) => o.createdAt), [orders]);

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
          shape="square"
          size={TOOLBAR_HEIGHT}
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
            <Animated.View key={group.key} entering={FadeInDown.delay(stagger(gi)).springify()}>
              <ListGroup title={group.label} action={<CountBadge value={group.items.length} />}>
                {group.items.map((o, idx) => (
                  <MoneyRow
                    key={o.id}
                    time={clock(o.createdAt)}
                    title={o.name || o.email || "Buyer"}
                    meta={[showEvent ? o.eventName : "", `${o.ticket || "Admission"}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`].filter(Boolean).join(" · ")}
                    code={o.code}
                    amount={moneyIn(o.total, o.currency)}
                    amountTone={o.cancelled ? "void" : "default"}
                    status={ORDER_STATUS_META[o.status]}
                    onPress={() => router.push({ pathname: "/control/order/[id]", params: { id: o.id } })}
                    divider={idx < group.items.length - 1}
                  />
                ))}
              </ListGroup>
            </Animated.View>
          ))}
          {nextBefore ? (
            <Button title="Load older orders" variant="secondary" onPress={() => void loadMore()} loading={loadingMore} fullWidth />
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
    gap: spacing.xl,
  },
});
