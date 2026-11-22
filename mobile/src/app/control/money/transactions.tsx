import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { MoneyRow } from "@/components/control/money/MoneyRow";
import { useCursorPages } from "@/components/control/money/useCursorPages";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { moneyIn } from "@/lib/control_meta";
import { fmtShortDay } from "@/lib/format";
import { useControl } from "@/state/control";
import { colors, radius, spacing } from "@/theme/tokens";
import type { LedgerLine, LedgerPage } from "@/types/control_money";

const TYPES = [
  { value: "all", label: "All" },
  { value: "charge", label: "Charges" },
  { value: "refund", label: "Refunds" },
];

const linesOf = (page: LedgerPage) => page.lines;

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
        actionLabel="Clear"
        onAction={() => {
          setQuery("");
          setKind("all");
        }}
      />
    ) : (
      <EmptyState icon="arrow-left-right" title="No transactions yet" message="Charges and refunds show up here as tickets sell." />
    );
  } else {
    body = (
      <>
        <View style={styles.group}>
          {ledger.items.map((line, i) => (
            <MoneyRow
              key={line.id}
              icon={line.type === "refund" ? "undo-2" : "credit-card"}
              title={line.name || line.email || "Unnamed buyer"}
              meta={[line.type === "refund" ? "Refund" : "Charge", line.eventName, line.ticket, fmtShortDay(line.at)].filter(Boolean).join(" · ")}
              amount={moneyIn(line.amount, line.currency)}
              amountTone={line.amount < 0 ? "negative" : "default"}
              onPress={line.orderId ? () => router.push({ pathname: "/control/order/[id]", params: { id: line.orderId as string } }) : undefined}
              divider={i < ledger.items.length - 1}
            />
          ))}
        </View>
        {ledger.nextBefore ? (
          <View style={styles.more}>
            <Button
              title="Load more"
              variant="secondary"
              loading={ledger.loadingMore}
              onPress={() => void ledger.loadMore().then((error) => error && toast.error(error))}
              fullWidth
            />
          </View>
        ) : null}
      </>
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
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  more: {
    marginTop: spacing.lg,
  },
});
