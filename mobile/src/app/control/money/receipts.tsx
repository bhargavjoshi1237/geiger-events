import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { byDay, clock, totalIn } from "@/components/control/money/ledger";
import { MoneyRow } from "@/components/control/money/MoneyRow";
import { useCursorPages } from "@/components/control/money/useCursorPages";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { ListGroup } from "@/components/ui/ListGroup";
import { Readout, type ReadoutFigure } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { moneyIn, ORDER_STATUS_META } from "@/lib/control_meta";
import { pluralize } from "@/lib/format";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlOrder } from "@/types/portal";

type ReceiptPage = { receipts: ControlOrder[]; nextBefore: string | null };

const receiptsOf = (page: ReceiptPage) => page.receipts;
const stagger = (i: number) => Math.min(i, 8) * 50;

export default function ReceiptsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { project } = useControl();
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const path = project ? `/api/control/money/projects/${project.id}/receipts${term ? `?q=${encodeURIComponent(term)}` : ""}` : null;
  const pages = useCursorPages<ReceiptPage, ControlOrder>(path, receiptsOf);

  let body: React.ReactNode;
  if (pages.error && !pages.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load receipts" message={pages.error} actionLabel="Try again" onAction={() => void pages.reload()} />;
  } else if (!pages.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!pages.items.length) {
    body = term ? (
      <EmptyState icon="search" title="No matching receipts" message="Try another buyer, email or ticket." actionLabel="Clear search" onAction={() => setQuery("")} />
    ) : (
      <EmptyState icon="receipt" title="No receipts yet" message="Every order gets a receipt here once tickets sell." />
    );
  } else {
    const items = pages.items;
    const billed = totalIn(items, (o) => o.total, (o) => o.currency);
    const refunded = totalIn(items, (o) => o.refunded, (o) => o.currency);
    const tickets = items.reduce((n, o) => n + (o.quantity || 0), 0);
    const lead: ReadoutFigure = billed
      ? { label: "Billed", value: moneyIn(billed.total, billed.currency), hint: `${items.length} ${pluralize(items.length, "receipt", "receipts")}` }
      : { label: "Receipts", value: String(items.length), hint: "mixed currencies" };
    const figures: ReadoutFigure[] = [
      ...(refunded ? [{ label: "Refunded", value: moneyIn(refunded.total, refunded.currency), tone: refunded.total > 0 ? ("info" as const) : ("neutral" as const) }] : []),
      { label: "Tickets", value: String(tickets) },
    ];
    const days = byDay(items, (o) => o.createdAt);

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout lead={lead} items={figures} />
          <Text style={styles.scope}>
            {pages.nextBefore ? `Totals cover the ${items.length} loaded below. Load more to count older receipts.` : term ? "Totals cover every matching receipt." : "Totals cover every receipt."}
          </Text>
        </Animated.View>
        {days.map((day, di) => (
          <Animated.View key={day.key} entering={FadeInDown.delay(stagger(di + 1)).springify()}>
            <ListGroup title={day.label} action={<CountBadge value={day.items.length} />}>
              {day.items.map((o, i) => (
                <MoneyRow
                  key={o.id}
                  time={clock(o.createdAt)}
                  title={o.name || o.email || "Unnamed buyer"}
                  meta={[o.eventName, `${o.ticket || "Admission"}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`].filter(Boolean).join(" · ")}
                  code={o.code}
                  amount={moneyIn(o.total, o.currency)}
                  amountTone={o.cancelled ? "void" : "default"}
                  status={ORDER_STATUS_META[o.status]}
                  onPress={() => router.push({ pathname: "/control/order/[id]", params: { id: o.id } })}
                  divider={i < day.items.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ))}
        {pages.nextBefore ? (
          <Button
            title="Load older receipts"
            variant="secondary"
            loading={pages.loadingMore}
            onPress={() => void pages.loadMore().then((error) => error && toast.error(error))}
            fullWidth
          />
        ) : null}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Billing & receipts" />}>
      <View style={styles.controls}>
        <Text style={styles.lede}>One receipt per live order. Open one for the order, its refunds and timeline.</Text>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search buyers or tickets…" autoCapitalize="none" />
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  controls: {
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  lede: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  stack: {
    gap: spacing.xl,
  },
  scope: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
});
