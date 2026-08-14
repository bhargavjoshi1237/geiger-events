import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSharedValue } from "react-native-reanimated";

import { Countdown } from "@/components/Countdown";
import { DetailRow } from "@/components/DetailRow";
import { EventCover } from "@/components/EventCover";
import { RefundSheet } from "@/components/RefundSheet";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TicketQr } from "@/components/TicketQr";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { buildEventICS, directionsUrl, openDirections, shareEventICS } from "@/lib/calendar";
import { fmtDateTime, isUpcoming, money } from "@/lib/format";
import { REFUND_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Entitlement, Order } from "@/types/portal";

function addonLabel(o: Record<string, unknown>): string {
  const name = typeof o.name === "string" ? o.name : typeof o.label === "string" ? o.label : "";
  return name || JSON.stringify(o);
}

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

export default function TicketDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, refreshing, refreshAll } = usePortalData();
  const [refunding, setRefunding] = useState(false);
  const scrollY = useSharedValue(0);

  const ticket = data?.tickets?.find((t) => t.id === id);
  const loading = data === null;

  if (loading) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Ticket" scrollY={scrollY} />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!ticket) {
    return (
      <Screen scroll onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader title="Ticket" scrollY={scrollY} />
        <EmptyState
          icon="credit-card"
          title="Ticket not found"
          message="This ticket isn't on your account anymore."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const loc = [ticket.venue, ticket.city].filter(Boolean).join(", ");
  const hasCalendar = Boolean(buildEventICS(ticket));
  const hasDirections = Boolean(directionsUrl(ticket));
  const canRefund = !ticket.refund && ticket.paid && ticket.status === "confirmed";

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader
        title={ticket.eventName}
        subtitle={ticket.ticket ? `${ticket.ticket} · ${ticket.orderCode}` : ticket.orderCode}
        scrollY={scrollY}
      />

      <View style={styles.coverWrap}>
        <EventCover uri={ticket.coverUrl} name={ticket.eventName} height={200} radius={0} />
        <LinearGradient
          colors={[colors.overlay, "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.coverText}>
          <Text style={styles.coverName} numberOfLines={2}>
            {ticket.eventName}
          </Text>
          <Text style={styles.coverMeta}>
            {ticket.eventDate ? `${fmtDateTime(ticket.eventDate)}` : "Date TBA"}
            {ticket.eventTime ? ` · ${ticket.eventTime}` : ""}
          </Text>
          {loc ? <Text style={styles.coverMeta}>{loc}</Text> : null}
        </View>
      </View>

      <Card style={styles.qrCard}>
        <TicketQr orderId={ticket.id} orderCode={ticket.orderCode} />
        <Text style={styles.qrHint}>Show this at the door</Text>
      </Card>

      {isUpcoming(ticket.eventDate) ? (
        <View style={styles.countdownRow}>
          <Countdown dateStr={ticket.eventDate} />
        </View>
      ) : null}

      <View style={styles.actionRow}>
        {hasCalendar ? (
          <ActionButton icon="calendar" label="Add to calendar" onPress={() => void shareEventICS(ticket)} />
        ) : null}
        {hasDirections ? (
          <ActionButton icon="navigation" label="Directions" onPress={() => void openDirections(ticket)} />
        ) : null}
        <ActionButton icon="message-square" label="Message organiser" onPress={() => pushMessage(router, ticket)} />
      </View>

      <SectionTitle>Details</SectionTitle>
      <Card style={styles.rowsCard}>
        <DetailRow label="Organiser" value={ticket.organizer || "—"} />
        <DetailRow label="Ticket" value={`${ticket.ticket || "Admission"} × ${ticket.quantity}`} />
        <DetailRow label="Unit price" value={money(ticket.unitPrice)} />
        <DetailRow label="Total" value={money(ticket.total)} />
        <DetailRow label="Purchased" value={fmtDateTime(ticket.createdAt)} />
        <DetailRow label="Order" value={ticket.orderCode} />
        <DetailRow label="Payment" value={ticket.paid ? "Paid" : "Free"} />
      </Card>

      {ticket.offerings?.length || ticket.purchasables?.length ? (
        <>
          <SectionTitle>Add-ons</SectionTitle>
          <Card>
            {ticket.offerings?.map((o, i) => (
              <Text key={i} style={styles.addonLine}>
                {addonLabel(o)}
              </Text>
            ))}
            {ticket.purchasables?.map((p, i) => {
              const name = typeof p.name === "string" ? p.name : "Add-on";
              const qty = typeof p.quantity === "number" ? p.quantity : 0;
              const total = typeof p.total === "number" ? p.total : 0;
              return (
                <View key={i} style={styles.addonRow}>
                  <Text style={styles.addonLine}>
                    {name}
                    {qty > 1 ? ` × ${qty}` : ""}
                  </Text>
                  {total > 0 ? (
                    <Text style={styles.addonTotal}>{money(total)}</Text>
                  ) : null}
                </View>
              );
            })}
          </Card>
        </>
      ) : null}

      {ticket.entitlements?.length ? (
        <>
          <SectionTitle>What&apos;s included</SectionTitle>
          <Card>
            {ticket.entitlements.map((e) => (
              <EntitlementRow key={e.allocationId} e={e} />
            ))}
          </Card>
        </>
      ) : null}

      {ticket.refund ? (
        <>
          <SectionTitle>Refund</SectionTitle>
          <Card>
            <View style={styles.refundHead}>
              <Text style={styles.refundLabel}>Refund</Text>
              <Pill
                label={statusPill(REFUND_STATUS, ticket.refund.status).label}
                tone={statusPill(REFUND_STATUS, ticket.refund.status).tone}
              />
            </View>
            {ticket.refund.reason ? (
              <Text style={styles.refundReason}>“{ticket.refund.reason}”</Text>
            ) : null}
          </Card>
        </>
      ) : canRefund ? (
        <Button
          title="Request a refund"
          variant="destructiveGhost"
          icon="rotate-ccw"
          onPress={() => setRefunding(true)}
          fullWidth
        />
      ) : null}

      <RefundSheet visible={refunding} onClose={() => setRefunding(false)} orderId={ticket.id} />
    </Screen>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}
    >
      <Feather name={icon} size={18} color={colors.foreground} />
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function EntitlementRow({ e }: { e: Entitlement }) {
  const done = e.remaining <= 0;
  return (
    <View style={styles.entRow}>
      {e.imageUrl ? (
        <Image source={{ uri: e.imageUrl }} contentFit="cover" transition={200} style={styles.entImage} />
      ) : (
        <View style={[styles.entImage, styles.entImageFallback]}>
          <Feather name="package" size={16} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.entStack}>
        <Text style={styles.entName} numberOfLines={1}>
          {e.name}
        </Text>
        <Text style={styles.entMeta}>
          {done ? "Collected" : `${e.remaining} of ${e.entitled} remaining`}
          {e.periodLabel ? ` · ${e.periodLabel}` : ""}
        </Text>
        {e.blockedReason ? <Text style={styles.entBlocked}>{e.blockedReason}</Text> : null}
      </View>
      {done ? <Feather name="check" size={16} color={colors.success} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  coverWrap: {
    overflow: "hidden",
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  coverText: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  coverName: {
    ...type.title,
    color: colors.primary,
  },
  coverMeta: {
    ...type.caption,
    color: colors.primary,
  },
  qrCard: {
    alignItems: "center",
  },
  qrHint: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
  countdownRow: {
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  actionButton: {
    flexGrow: 1,
    flexBasis: 90,
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.6,
  },
  actionLabel: {
    ...type.caption,
    textAlign: "center",
    color: colors.textSecondary,
  },
  rowsCard: {
    padding: 0,
    paddingHorizontal: spacing.lg,
  },
  addonLine: {
    ...type.caption,
    color: colors.textSecondary,
    paddingVertical: 4,
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  addonTotal: {
    ...type.caption,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  entRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  entImage: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
  },
  entImageFallback: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSubtle,
  },
  entStack: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  entName: {
    ...type.label,
    color: colors.foreground,
  },
  entMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  entBlocked: {
    ...type.caption,
    color: colors.textTertiary,
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
