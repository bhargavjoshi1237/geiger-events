import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { DetailRow } from "@/components/DetailRow";
import { RefundSheet } from "@/components/RefundSheet";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { fmtDate, fmtDateTime, money } from "@/lib/format";
import { ORDER_STATUS, REFUND_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Order } from "@/types/portal";

function pushMessage(router: ReturnType<typeof useRouter>, order: Order) {
  router.push({
    pathname: "/messages/new",
    params: {
      subject: order.eventName ? `Re: ${order.eventName}` : "",
      orderId: order.id,
      contextLabel: `${order.eventName || "Order"} · ${order.orderCode || ""}`,
    },
  });
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, refreshing, refreshAll } = usePortalData();
  const { success } = useToast();
  const [refunding, setRefunding] = useState(false);
  const scrollY = useSharedValue(0);

  const order = data?.orders?.find((o) => o.id === id);
  const loading = data === null;

  if (loading) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Order" scrollY={scrollY} />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Order" scrollY={scrollY} />
        <EmptyState
          icon="file-text"
          title="Order not found"
          message="This receipt isn't on your account anymore."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const copyCode = async () => {
    await Clipboard.setStringAsync(order.orderCode);
    success("Order code copied.");
  };

  const canRefund = !order.refund && order.paid && order.status === "confirmed";
  const status = statusPill(ORDER_STATUS, order.status);

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader title="Order" subtitle={order.eventName} scrollY={scrollY} />

      <View style={styles.headCard}>
        <View style={styles.headCover}>
          {order.coverUrl ? (
            <Image source={{ uri: order.coverUrl }} contentFit="cover" transition={200} style={StyleSheet.absoluteFill} />
          ) : (
            <Feather name="file-text" size={20} color={colors.textTertiary} />
          )}
        </View>
        <View style={styles.headText}>
          <Text style={styles.headName} numberOfLines={1}>
            {order.eventName}
          </Text>
          <Text style={styles.headCode}>{order.orderCode}</Text>
        </View>
      </View>

      <Card style={styles.receiptCard}>
        <View style={styles.breakdownHead}>
          <Text style={styles.breakdownTitle}>Summary</Text>
          <Pill label={status.label} tone={status.tone} />
        </View>

        <Line label={`${order.ticket || "Admission"} × ${order.quantity}`} value={money(order.unitPrice * order.quantity)} />

        {order.offerings?.map((o, i) => (
          <Line key={`o-${i}`} label={addonLabel(o)} value="" />
        ))}
        {order.purchasables?.map((p, i) => {
          const name = typeof p.name === "string" ? p.name : "Add-on";
          const qty = typeof p.quantity === "number" ? p.quantity : 0;
          const total = typeof p.total === "number" ? p.total : 0;
          return (
            <Line
              key={`p-${i}`}
              label={qty > 1 ? `${name} × ${qty}` : name}
              value={total > 0 ? money(total) : ""}
            />
          );
        })}

        {order.discount ? (
          <Line
            label={`Discount (${typeof order.discount.code === "string" ? order.discount.code : ""})`}
            value={`−${money(amount(order.discount))}`}
            success
          />
        ) : null}
        {order.earlybird && amount(order.earlybird) > 0 ? (
          <Line label="Early bird" value={`−${money(amount(order.earlybird))}`} success />
        ) : null}
        {order.donation && amount(order.donation) > 0 ? (
          <Line
            label={`Donation${typeof order.donation.cause === "string" && order.donation.cause ? ` · ${order.donation.cause}` : ""}`}
            value={money(amount(order.donation))}
          />
        ) : null}
        {order.group && typeof order.group.size === "number" && order.group.size > 0 ? (
          <Line label="Group order" value={`1 of ${order.group.size}`} />
        ) : null}
        {order.bundle ? (
          <View style={styles.bundleBlock}>
            <Text style={styles.bundleTitle}>
              Bundle · {typeof order.bundle.name === "string" ? order.bundle.name : ""}
            </Text>
            {Array.isArray(order.bundle.items)
              ? order.bundle.items.map((it, i) => {
                  const item = it as Record<string, unknown>;
                  const itemName = item.name;
                  const itemQty = item.qty;
                  const name = typeof itemName === "string" ? itemName : "Ticket";
                  const qty = typeof itemQty === "number" ? itemQty : 0;
                  return (
                    <Text key={i} style={styles.bundleItem}>
                      {name}
                      {qty > 1 ? ` × ${qty}` : ""}
                    </Text>
                  );
                })
              : null}
          </View>
        ) : null}

        <View style={styles.dashedDivider} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total paid</Text>
          <Text style={styles.totalValue}>{money(order.total)}</Text>
        </View>
      </Card>

      <SectionLabel>Details</SectionLabel>
      <Card style={styles.rowsCard}>
        <DetailRow label="Buyer" value={order.buyerName || "—"} />
        <DetailRow label="Email" value={order.buyerEmail || "—"} />
        <DetailRow label="Payment" value={order.paid ? "Paid" : "Free"} />
        <DetailRow label="Purchased" value={fmtDateTime(order.createdAt)} />
        <DetailRow label="Event date" value={order.eventDate ? fmtDate(order.eventDate) : "TBA"} />
        <ListRow
          title="Order code"
          subtitle={order.orderCode}
          trailing={<Feather name="copy" size={16} color={colors.textSecondary} />}
          onPress={copyCode}
          divider={false}
        />
      </Card>

      <View style={styles.actions}>
        <Button title="Message organiser" variant="secondary" icon="message-square" onPress={() => pushMessage(router, order)} fullWidth />
        {order.refund ? (
          <Card>
            <View style={styles.refundHead}>
              <Text style={styles.refundLabel}>Refund</Text>
              <Pill label={statusPill(REFUND_STATUS, order.refund.status).label} tone={statusPill(REFUND_STATUS, order.refund.status).tone} />
            </View>
            {order.refund.reason ? <Text style={styles.refundReason}>“{order.refund.reason}”</Text> : null}
          </Card>
        ) : canRefund ? (
          <Button
            title="Request a refund"
            variant="destructiveGhost"
            icon="rotate-ccw"
            onPress={() => setRefunding(true)}
            fullWidth
          />
        ) : null}
      </View>

      <RefundSheet visible={refunding} onClose={() => setRefunding(false)} orderId={order.id} />
    </Screen>
  );
}

function addonLabel(o: Record<string, unknown>): string {
  const name = typeof o.name === "string" ? o.name : typeof o.label === "string" ? o.label : "";
  return name || JSON.stringify(o);
}

function amount(row: Record<string, unknown> | null): number {
  return row && typeof row.amount === "number" ? row.amount : 0;
}

function Line({ label, value, success }: { label: string; value: string; success?: boolean }) {
  return (
    <View style={styles.line}>
      <Text style={[styles.lineLabel, success && styles.lineSuccess]}>{label}</Text>
      {value ? (
        <Text style={[styles.lineValue, success && styles.lineSuccess]}>{value}</Text>
      ) : null}
    </View>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

const styles = StyleSheet.create({
  headCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    padding: spacing.lg,
    marginBottom: spacing.lg,
  },
  headCover: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  headName: {
    ...type.label,
    color: colors.foreground,
  },
  headCode: {
    ...type.caption,
    color: colors.textTertiary,
    fontVariant: ["tabular-nums"],
  },
  receiptCard: {
    gap: spacing.sm,
  },
  breakdownHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  breakdownTitle: {
    ...type.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
  },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  lineLabel: {
    ...type.caption,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  lineValue: {
    ...type.caption,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  lineSuccess: {
    color: colors.success,
  },
  bundleBlock: {
    gap: 2,
  },
  bundleTitle: {
    ...type.caption,
    color: colors.textSecondary,
  },
  bundleItem: {
    ...type.caption,
    color: colors.foreground,
  },
  dashedDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.sm,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  totalLabel: {
    ...type.label,
    fontWeight: "600",
    color: colors.textSecondary,
  },
  totalValue: {
    ...type.title,
    fontSize: 18,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  sectionLabel: {
    ...type.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.textTertiary,
    marginBottom: spacing.sm,
  },
  rowsCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  actions: {
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  refundHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  refundLabel: {
    ...type.label,
    color: colors.textSecondary,
  },
  refundReason: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
});
