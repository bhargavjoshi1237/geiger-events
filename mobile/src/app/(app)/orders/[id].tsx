import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Icon } from "@/components/ui/icons";
import { DetailRow } from "@/components/DetailRow";
import { RefundSheet } from "@/components/RefundSheet";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
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

function addonLabel(o: Record<string, unknown>): string {
  const name = typeof o.name === "string" ? o.name : typeof o.label === "string" ? o.label : "";
  return name || JSON.stringify(o);
}

function amount(row: Record<string, unknown> | null): number {
  return row && typeof row.amount === "number" ? row.amount : 0;
}

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data } = usePortalData();
  const { success } = useToast();
  const [refunding, setRefunding] = useState(false);

  const order = data?.orders?.find((o) => o.id === id);
  const loading = data === null;

  if (loading) {
    return (
      <Screen scroll>
        <ScreenHeader title="Order" />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!order) {
    return (
      <Screen scroll>
        <ScreenHeader title="Order" />
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
    <Screen scroll>
      <ScreenHeader title="Receipt" subtitle={order.eventName} />

      <View style={styles.head}>
        <View style={styles.headCover}>
          {order.coverUrl ? (
            <Image
              source={{ uri: order.coverUrl }}
              contentFit="cover"
              transition={200}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <Icon name="file-text" size={19} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.headText}>
          <Text style={styles.headName} numberOfLines={1}>
            {order.eventName}
          </Text>
          <Text style={styles.headCode}>{order.orderCode}</Text>
        </View>
      </View>

      <View style={styles.receipt}>
        <View style={styles.receiptHead}>
          <Text style={styles.receiptKicker}>Summary</Text>
          <Pill label={status.label} tone={status.tone} variant="outline" />
        </View>

        <View style={styles.lines}>
          <Line
            label={`${order.ticket || "Admission"} × ${order.quantity}`}
            value={money(order.unitPrice * order.quantity)}
          />
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
              label={`Discount${typeof order.discount.code === "string" ? ` (${order.discount.code})` : ""}`}
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
            <View style={styles.bundle}>
              <Text style={styles.bundleTitle}>
                Bundle{typeof order.bundle.name === "string" ? ` · ${order.bundle.name}` : ""}
              </Text>
              {Array.isArray(order.bundle.items)
                ? order.bundle.items.map((it, i) => {
                    const item = it as Record<string, unknown>;
                    const name = typeof item.name === "string" ? item.name : "Ticket";
                    const qty = typeof item.qty === "number" ? item.qty : 0;
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
        </View>

        <DashedRule />

        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total paid</Text>
          <Text style={styles.totalValue}>{money(order.total)}</Text>
        </View>
      </View>

      <SectionTitle variant="kicker">Details</SectionTitle>
      <View style={styles.card}>
        <DetailRow label="Buyer" value={order.buyerName || "—"} />
        <DetailRow label="Email" value={order.buyerEmail || "—"} />
        <DetailRow label="Payment" value={order.paid ? "Paid" : "Free"} />
        <DetailRow label="Purchased" value={fmtDateTime(order.createdAt)} />
        <DetailRow
          label="Event date"
          value={order.eventDate ? fmtDate(order.eventDate) : "TBA"}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Copy order code"
          onPress={copyCode}
          style={({ pressed }) => [styles.copyRow, pressed && styles.pressed]}
        >
          <Text style={styles.copyLabel}>Order code</Text>
          <View style={styles.copyValue}>
            <Text style={styles.copyCode}>{order.orderCode}</Text>
            <Icon name="copy" size={15} color={colors.textSecondary} />
          </View>
        </Pressable>
      </View>

      {order.refund ? (
        <View style={[styles.card, styles.cardPadded]}>
          <View style={styles.refundHead}>
            <Text style={styles.refundTitle}>Refund</Text>
            <Pill
              label={statusPill(REFUND_STATUS, order.refund.status).label}
              tone={statusPill(REFUND_STATUS, order.refund.status).tone}
            />
          </View>
          {order.refund.reason ? (
            <Text style={styles.refundReason}>“{order.refund.reason}”</Text>
          ) : null}
          <Text style={styles.refundMeta}>
            {money(order.refund.amount)} · requested {fmtDateTime(order.refund.createdAt)}
          </Text>
        </View>
      ) : canRefund ? (
        <View style={[styles.card, styles.cardPadded]}>
          <Text style={styles.refundTitle}>Request A Refund</Text>
          <Text style={styles.refundHint}>
            The organiser reviews this. You keep your ticket until they approve it.
          </Text>
          <Button
            title="Request Refund"
            variant="secondary"
            icon="rotate-ccw"
            onPress={() => setRefunding(true)}
            fullWidth
          />
        </View>
      ) : null}

      <Button
        title="Message organiser"
        variant="secondary"
        icon="message-square"
        onPress={() => pushMessage(router, order)}
        fullWidth
      />

      <RefundSheet visible={refunding} onClose={() => setRefunding(false)} orderId={order.id} />
    </Screen>
  );
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

function DashedRule() {
  return (
    <View style={styles.dashRow} pointerEvents="none">
      {Array.from({ length: 48 }).map((_, i) => (
        <View key={i} style={styles.dash} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg + 2,
  },
  headCover: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: colors.surfaceActive,
    borderRadius: radius.md,
  },
  headText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  headName: {
    ...type.bodyStrong,
    fontSize: 16,
    color: colors.foreground,
  },
  headCode: {
    ...type.monoSmall,
    color: colors.textTertiary,
  },
  receipt: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    overflow: "hidden",
    marginBottom: spacing.lg + 2,
  },
  receiptHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceHover,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  receiptKicker: {
    ...type.micro,
    letterSpacing: 0.9,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  lines: {
    gap: spacing.sm + 2,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  line: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  lineLabel: {
    ...type.body,
    fontSize: 14,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  lineValue: {
    ...type.body,
    fontSize: 14,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  lineSuccess: {
    color: colors.success,
  },
  bundle: {
    gap: 3,
  },
  bundleTitle: {
    ...type.caption,
    color: colors.textSecondary,
  },
  bundleItem: {
    ...type.caption,
    color: colors.foreground,
  },
  dashRow: {
    flexDirection: "row",
    overflow: "hidden",
  },
  dash: {
    width: 6,
    height: 1,
    marginRight: 6,
    backgroundColor: colors.border,
  },
  totalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  totalLabel: {
    ...type.label,
    color: colors.mutedForeground,
  },
  totalValue: {
    ...type.title,
    fontSize: 20,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg + 2,
  },
  cardPadded: {
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  copyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 14,
  },
  pressed: {
    opacity: 0.6,
  },
  copyLabel: {
    ...type.body,
    fontSize: 14,
    color: colors.textSecondary,
  },
  copyValue: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  copyCode: {
    ...type.mono,
    color: colors.foreground,
  },
  refundHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  refundTitle: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  refundHint: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  refundReason: {
    ...type.body,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  refundMeta: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
