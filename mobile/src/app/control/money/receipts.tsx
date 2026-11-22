import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { MoneyRow } from "@/components/control/money/MoneyRow";
import { useCursorPages } from "@/components/control/money/useCursorPages";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { moneyIn, ORDER_STATUS_META } from "@/lib/control_meta";
import { fmtShortDay } from "@/lib/format";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ControlOrder } from "@/types/portal";

type ReceiptPage = { receipts: ControlOrder[]; nextBefore: string | null };

const receiptsOf = (page: ReceiptPage) => page.receipts;

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
    body = (
      <>
        <View style={styles.group}>
          {pages.items.map((o, i) => (
            <MoneyRow
              key={o.id}
              icon="receipt"
              title={`${o.code} · ${o.name || o.email || "Unnamed buyer"}`}
              meta={[o.eventName, `${o.ticket || "Admission"}${o.quantity > 1 ? ` × ${o.quantity}` : ""}`, fmtShortDay(o.createdAt)].filter(Boolean).join(" · ")}
              amount={moneyIn(o.total, o.currency)}
              status={ORDER_STATUS_META[o.status]}
              onPress={() => router.push({ pathname: "/control/order/[id]", params: { id: o.id } })}
              divider={i < pages.items.length - 1}
            />
          ))}
        </View>
        {pages.nextBefore ? (
          <View style={styles.more}>
            <Button
              title="Load more"
              variant="secondary"
              loading={pages.loadingMore}
              onPress={() => void pages.loadMore().then((error) => error && toast.error(error))}
              fullWidth
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <Screen scroll header={<ScreenHeader title="Billing & receipts" />}>
      <Text style={styles.lede}>One receipt per live order. Open one for the order, its refunds and timeline.</Text>
      <View style={styles.search}>
        <Input leftIcon="search" value={query} onChangeText={setQuery} placeholder="Search buyers or tickets…" autoCapitalize="none" />
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lede: {
    ...type.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  search: {
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
