import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { byDay, clock, signedMoney, totalIn } from "@/components/control/money/ledger";
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
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { pluralize } from "@/lib/format";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { LedgerLine, LedgerPage } from "@/types/control_money";

const TYPES = [
  { value: "all", label: "All" },
  { value: "charge", label: "Charges" },
  { value: "refund", label: "Refunds" },
];

const linesOf = (page: LedgerPage) => page.lines;
const stagger = (i: number) => Math.min(i, 8) * 50;

export default function TransactionsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { project } = useControl();
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");

  // Server-side search, so typing waits for a pause before refetching.
  useEffect(() => {
    const timer = setTimeout(() => setTerm(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const path = project ? `/api/control/money/projects/${project.id}/transactions?type=${kind}${term ? `&q=${encodeURIComponent(term)}` : ""}` : null;
  const ledger = useCursorPages<LedgerPage, LedgerLine>(path, linesOf);
  const searched = Boolean(term) || kind !== "all";

  let body: React.ReactNode;
  if (ledger.error && !ledger.data) {
    body = <EmptyState icon="circle-alert" title="Couldn't load transactions" message={ledger.error} actionLabel="Try again" onAction={() => void ledger.reload()} />;
  } else if (!ledger.data) {
    body = <SkeletonList rows={6} variant="divided" />;
  } else if (!ledger.items.length) {
    body = searched ? (
      <EmptyState
        icon="search"
        title="Nothing matches"
        message="Try another buyer, ticket or type."
        actionLabel="Clear filters"
        onAction={() => {
          setQuery("");
          setKind("all");
        }}
      />
    ) : (
      <EmptyState icon="arrow-left-right" title="No transactions yet" message="Charges and refunds show up here as tickets sell." />
    );
  } else {
    const lines = ledger.items;
    const net = totalIn(lines, (l) => l.amount, (l) => l.currency);
    const charges = lines.filter((l) => l.amount >= 0);
    const refunds = lines.filter((l) => l.amount < 0);
    const lineCount = `${lines.length} ${pluralize(lines.length, "line", "lines")}`;
    let lead: ReadoutFigure;
    let figures: ReadoutFigure[];
    if (net) {
      lead = { label: "Net", value: signedMoney(net.total, net.currency), hint: lineCount };
      figures = [
        { label: "Charges", value: signedMoney(charges.reduce((s, l) => s + l.amount, 0), net.currency), hint: `${charges.length} ${pluralize(charges.length, "charge", "charges")}` },
        {
          label: "Refunds",
          value: signedMoney(refunds.reduce((s, l) => s + l.amount, 0), net.currency),
          hint: `${refunds.length} ${pluralize(refunds.length, "refund", "refunds")}`,
          tone: refunds.length ? "info" : "neutral",
        },
      ];
    } else {
      // Lines in more than one currency can't be summed, so the panel counts them instead.
      lead = { label: "Transactions", value: String(lines.length), hint: "mixed currencies" };
      figures = [
        { label: "Charges", value: String(charges.length) },
        { label: "Refunds", value: String(refunds.length), tone: refunds.length ? "info" : "neutral" },
      ];
    }
    const days = byDay(lines, (l) => l.at);

    body = (
      <View style={styles.stack}>
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout lead={lead} items={figures} />
          <Text style={styles.scope}>
            {ledger.nextBefore ? `Totals cover the ${lines.length} loaded below. Load more to count older ones.` : searched ? "Totals cover every matching transaction." : "Totals cover every transaction."}
          </Text>
        </Animated.View>
        {days.map((day, di) => (
          <Animated.View key={day.key} entering={FadeInDown.delay(stagger(di + 1)).springify()}>
            <ListGroup title={day.label} action={<CountBadge value={day.items.length} />}>
              {day.items.map((line, i) => (
                <MoneyRow
                  key={line.id}
                  time={clock(line.at)}
                  title={line.name || line.email || "Unnamed buyer"}
                  meta={[line.type === "refund" ? "Refund" : "Charge", line.eventName, line.ticket].filter(Boolean).join(" · ")}
                  code={line.orderCode || undefined}
                  amount={signedMoney(line.amount, line.currency)}
                  amountTone={line.amount < 0 ? "negative" : "default"}
                  onPress={line.orderId ? () => router.push({ pathname: "/control/order/[id]", params: { id: line.orderId as string } }) : undefined}
                  divider={i < day.items.length - 1}
                />
              ))}
            </ListGroup>
          </Animated.View>
        ))}
        {ledger.nextBefore ? (
          <Button
            title="Load older transactions"
            variant="secondary"
            loading={ledger.loadingMore}
            onPress={() => void ledger.loadMore().then((error) => error && toast.error(error))}
            fullWidth
          />
        ) : null}
      </View>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Transactions" />}>
      <View style={styles.controls}>
        <Segmented options={TYPES} value={kind} onChange={setKind} />
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
