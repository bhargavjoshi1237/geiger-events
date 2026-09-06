import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useCallback, useState } from "react";
import { BackHandler, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/icons";
import { DetailRow } from "@/components/DetailRow";
import { RefundSheet } from "@/components/RefundSheet";
import { ScreenHeader } from "@/components/ScreenHeader";
import { ShareTicketSheet } from "@/components/ShareTicketSheet";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { directionsUrl, openDirections } from "@/lib/calendar";
import { fmtDateTime, fmtShortDay, money } from "@/lib/format";
import { goBack } from "@/lib/nav_history";
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
  const { data } = usePortalData();
  const [refunding, setRefunding] = useState(false);
  const [sharing, setSharing] = useState(false);

  const ticket = data?.tickets?.find((t) => t.id === id);
  const loading = data === null;
  const { height: winHeight } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  // Same landing banner as the receipt: 20% of the viewport, clamped for small/large screens.
  const heroHeight = Math.max(160, Math.min(240, Math.round(winHeight * 0.2)));
  // Pull the hero under the status bar so the cover extends to the top edge.
  const bleedTop = insets.top + spacing.md;

  // Hardware back should match the in-app back: ticket list, not the previous tab.
  // Let open sheets close themselves first (Modal onRequestClose).
  useFocusEffect(
    useCallback(() => {
      if (refunding || sharing) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack("/(app)/tickets" as Href);
        return true;
      });
      return () => sub.remove();
    }, [refunding, sharing]),
  );

  if (loading) {
    return (
      <Screen scroll>
        <ScreenHeader title="Ticket" />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!ticket) {
    return (
      <Screen scroll>
        <ScreenHeader title="Ticket" />
        <EmptyState
          icon="credit-card"
          title="Ticket not found"
          message="This ticket isn't on your account anymore."
          actionLabel="Go back"
          onAction={() => goBack()}
        />
      </Screen>
    );
  }

  const loc = [ticket.venue, ticket.address, ticket.city].filter(Boolean).join(", ");
  const when = [ticket.eventDate ? fmtShortDay(ticket.eventDate) : "Date TBA", ticket.eventTime]
    .filter(Boolean)
    .join(" · ");
  const canRefund = !ticket.refund && ticket.paid && ticket.status === "confirmed";
  const collectables = (ticket.entitlements || []).filter((e) => e.entitled > 0);

  return (
    <Screen scroll>
      <View
        style={[
          styles.hero,
          { height: heroHeight + bleedTop + 56, marginTop: -bleedTop, paddingTop: bleedTop },
        ]}
      >
        {ticket.coverUrl ? (
          <Image
            source={{ uri: ticket.coverUrl }}
            contentFit="cover"
            contentPosition="center"
            transition={200}
            style={[StyleSheet.absoluteFill, styles.heroImage]}
          />
        ) : null}
        {/* Top scrim keeps the back button legible; bottom fades into the page. */}
        <LinearGradient
          colors={[colors.scrim, "transparent", colors.scrim, colors.background]}
          locations={[0, 0.35, 0.62, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        {/* Transparent nav over the cover so the image runs edge to edge. */}
        <View style={styles.heroNav}>
          <ScreenHeader
            title="Ticket"
            subtitle={`${ticket.ticket || "Admission"}${ticket.quantity > 1 ? ` × ${ticket.quantity}` : ""} · ${ticket.buyerName || ticket.buyerEmail}`}
            onBack={() => goBack("/(app)/tickets" as Href)}
          />
        </View>
        <View style={styles.heroContent} pointerEvents="none">
          {ticket.coverUrl ? null : (
            <Icon name="file-text" size={19} color={colors.mutedForeground} />
          )}
          <Text style={styles.heroName} numberOfLines={2}>
            {ticket.eventName}
          </Text>
          <Text style={styles.heroMeta} numberOfLines={1}>
            {when}
          </Text>
        </View>
      </View>

      <View style={styles.actions}>
        <View style={styles.primary}>
          <Button
            title="Show pass"
            icon="qr-code"
            onPress={() => router.push(`/pass/${ticket.id}` as Href)}
            fullWidth
          />
        </View>
        <IconButton
          icon="share"
          label="Share"
          shape="square"
          size={48}
          variant="solid"
          onPress={() => setSharing(true)}
        />
        {directionsUrl(ticket) ? (
          <IconButton
            icon="navigation"
            label="Directions"
            shape="square"
            size={48}
            variant="solid"
            onPress={() => void openDirections(ticket)}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <DetailRow icon="calendar" label="When" value={when} />
        <DetailRow icon="map-pin" label="Where" value={loc || "To be announced"} />
        <DetailRow icon="briefcase" label="Organiser" value={ticket.organizer || "—"} />
        <DetailRow icon="dollar-sign" label="Paid" value={ticket.paid ? money(ticket.total) : "Free"} />
        <DetailRow icon="file-text" label="Order" value={ticket.orderCode} mono divider={false} />
      </View>

      {ticket.eventId ? (
        <View style={styles.card}>
          <ListRow
            leading={<IconTile icon="calendar" size={34} />}
            title="Event details"
            subtitle="Rooms, recordings, chat and everything you hold"
            onPress={() => router.push(`/events/${ticket.eventId}` as Href)}
            divider={false}
          />
        </View>
      ) : null}

      {collectables.length ? (
        <View style={[styles.card, styles.cardPadded]}>
          <Text style={styles.cardTitle}>Collect at the event</Text>
          <Text style={styles.cardHint}>Show the pass at the desk to pick these up.</Text>
          {collectables.map((e) => (
            <EntitlementRow key={e.allocationId} e={e} />
          ))}
        </View>
      ) : null}

      {ticket.offerings?.length || ticket.purchasables?.length ? (
        <View style={[styles.card, styles.cardPadded]}>
          <Text style={styles.cardTitle}>Add-ons</Text>
          {ticket.offerings?.map((o, i) => (
            <Text key={`o-${i}`} style={styles.addonLine}>
              {addonLabel(o)}
            </Text>
          ))}
          {ticket.purchasables?.map((p, i) => {
            const name = typeof p.name === "string" ? p.name : "Add-on";
            const qty = typeof p.quantity === "number" ? p.quantity : 0;
            const total = typeof p.total === "number" ? p.total : 0;
            return (
              <View key={`p-${i}`} style={styles.addonRow}>
                <Text style={styles.addonLine}>
                  {name}
                  {qty > 1 ? ` × ${qty}` : ""}
                </Text>
                {total > 0 ? <Text style={styles.addonTotal}>{money(total)}</Text> : null}
              </View>
            );
          })}
        </View>
      ) : null}

      {ticket.refund ? (
        <View style={[styles.card, styles.cardPadded]}>
          <View style={styles.refundHead}>
            <Text style={styles.cardTitle}>Refund</Text>
            <Pill
              label={statusPill(REFUND_STATUS, ticket.refund.status).label}
              tone={statusPill(REFUND_STATUS, ticket.refund.status).tone}
            />
          </View>
          {ticket.refund.reason ? (
            <Text style={styles.refundReason}>“{ticket.refund.reason}”</Text>
          ) : null}
          <Text style={styles.refundMeta}>Requested {fmtDateTime(ticket.refund.createdAt)}</Text>
        </View>
      ) : null}

      <View style={styles.footerActions}>
        <View style={styles.footerHalf}>
          <Button
            title="Message"
            variant="secondary"
            icon="message-square"
            onPress={() => pushMessage(router, ticket)}
            fullWidth
          />
        </View>
        {canRefund ? (
          <View style={styles.footerHalf}>
            <Button
              title="Refund"
              variant="secondary"
              icon="rotate-ccw"
              onPress={() => setRefunding(true)}
              fullWidth
            />
          </View>
        ) : null}
      </View>

      <RefundSheet visible={refunding} onClose={() => setRefunding(false)} orderId={ticket.id} />
      <ShareTicketSheet ticket={ticket} visible={sharing} onClose={() => setSharing(false)} />
    </Screen>
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
          <Icon name="package" size={17} color={colors.textTertiary} />
        </View>
      )}
      <View style={styles.entStack}>
        <Text style={styles.entName} numberOfLines={1}>
          {e.name} · {done ? "collected" : `${e.collected} of ${e.entitled}`}
        </Text>
        {e.periodLabel || e.blockedReason ? (
          <Text style={styles.entMeta} numberOfLines={1}>
            {e.blockedReason || e.periodLabel}
          </Text>
        ) : null}
      </View>
      {done ? <Icon name="check" size={17} color={colors.success} /> : null}
    </View>
  );
}

// Refund status colour comes from the Pill; this screen only owns layout.
const styles = StyleSheet.create({
  hero: {
    alignSelf: "stretch",
    overflow: "hidden",
    marginHorizontal: -spacing.lg,
    marginBottom: spacing.lg + 2,
    backgroundColor: colors.background,
  },
  heroImage: {
    opacity: 0.4,
  },
  // Restores the page padding the full-bleed hero escapes, so the nav
  // sits exactly where it does on every other pushed screen.
  heroNav: {
    paddingHorizontal: spacing.lg,
  },
  heroContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroName: {
    ...type.title,
    textAlign: "center",
    color: colors.primary,
  },
  heroMeta: {
    ...type.caption,
    textAlign: "center",
    color: colors.mutedForeground,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 2,
    marginTop: -spacing.xl - 4,
    marginBottom: spacing.lg + 4,
  },
  primary: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceCard,
    paddingHorizontal: spacing.lg,
    marginBottom: 14,
  },
  cardPadded: {
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    ...type.labelStrong,
    color: colors.foreground,
  },
  cardHint: {
    ...type.caption,
    color: colors.textSecondary,
  },
  entRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  entImage: {
    width: 38,
    height: 38,
    borderRadius: radius.sm + 2,
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
    gap: 2,
  },
  entName: {
    ...type.body,
    fontSize: 14,
    color: colors.foreground,
  },
  entMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  addonLine: {
    ...type.body,
    fontSize: 14,
    color: colors.mutedForeground,
  },
  addonRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  addonTotal: {
    ...type.label,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  refundHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
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
  footerActions: {
    flexDirection: "row",
    gap: spacing.md - 2,
  },
  footerHalf: {
    flex: 1,
  },
});
