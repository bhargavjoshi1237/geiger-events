import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Icon } from "@/components/ui/icons";
import { Countdown } from "@/components/Countdown";
import { DetailRow } from "@/components/DetailRow";
import { EventCover } from "@/components/EventCover";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Pill } from "@/components/ui/Pill";
import { PulseDot } from "@/components/ui/PulseDot";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { buildEventICS, directionsUrl, openDirections, shareEventICS } from "@/lib/calendar";
import { fmtShortDay, isUpcoming, money, pluralize } from "@/lib/format";
import { REFUND_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Entitlement, Ticket } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

// Live rooms and recordings only carry an event name, not an id.
const sameEvent = (a: string, b: string) =>
  Boolean(a) && Boolean(b) && a.trim().toLowerCase() === b.trim().toLowerCase();

function mergeEntitlements(tickets: Ticket[]): Entitlement[] {
  const byItem = new Map<string, Entitlement>();
  for (const t of tickets) {
    for (const e of t.entitlements || []) {
      if (e.entitled <= 0) continue;
      const prev = byItem.get(e.itemId);
      if (!prev) {
        byItem.set(e.itemId, { ...e });
        continue;
      }
      byItem.set(e.itemId, {
        ...prev,
        entitled: prev.entitled + e.entitled,
        collected: prev.collected + e.collected,
        remaining: prev.remaining + e.remaining,
      });
    }
  }
  return [...byItem.values()];
}

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, live, watch, channels } = usePortalData();

  const tickets = useMemo(
    () => (data?.tickets || []).filter((t) => t.eventId === id),
    [data, id],
  );
  const event = tickets[0] || null;
  const eventName = event?.eventName || "";

  const rooms = useMemo(
    () => (live || []).filter((r) => sameEvent(r.eventName, eventName)),
    [live, eventName],
  );
  const recordings = useMemo(
    () => (watch || []).filter((w) => sameEvent(w.eventName, eventName)),
    [watch, eventName],
  );
  const chats = useMemo(
    () => (channels || []).filter((c) => c.eventId === id),
    [channels, id],
  );
  const collectables = useMemo(() => mergeEntitlements(tickets), [tickets]);

  if (data === null) {
    return (
      <Screen scroll>
        <ScreenHeader title="Event" />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen scroll>
        <ScreenHeader title="Event" />
        <EmptyState
          icon="calendar"
          title="Event not found"
          message="You don't have a ticket for this event anymore."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  const when = [event.eventDate ? fmtShortDay(event.eventDate) : "Date TBA", event.eventTime]
    .filter(Boolean)
    .join(" · ");
  const loc = [event.venue, event.address, event.city].filter(Boolean).join(", ");
  const upcoming = isUpcoming(event.eventDate);
  const totalPaid = tickets.reduce((sum, t) => sum + (t.paid ? t.total : 0), 0);
  const totalSeats = tickets.reduce((sum, t) => sum + (t.quantity || 0), 0);
  const passTicket = tickets.find((t) => !t.refund) || event;

  return (
    <Screen scroll>
      <ScreenHeader title={event.eventName} subtitle={when} />

      <Animated.View entering={FadeInDown.delay(stagger(0)).springify()} style={styles.hero}>
        <EventCover uri={event.coverUrl} name={event.eventName} height={180} radius={0} />
        <LinearGradient
          colors={["transparent", "rgba(26,26,26,0.55)", colors.surfaceSubtle]}
          locations={[0.3, 0.72, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroText} pointerEvents="none">
          <Text style={styles.heroName} numberOfLines={2}>
            {event.eventName}
          </Text>
          {loc ? (
            <Text style={styles.heroLine} numberOfLines={1}>
              {loc}
            </Text>
          ) : null}
        </View>
      </Animated.View>

      {upcoming ? (
        <View style={styles.countdown}>
          <Countdown dateStr={event.eventDate} />
        </View>
      ) : null}

      <View style={styles.actions}>
        <View style={styles.primary}>
          <Button
            title="Show pass"
            icon="maximize"
            onPress={() => router.push(`/pass/${passTicket.id}` as Href)}
            fullWidth
          />
        </View>
        {buildEventICS(event) ? (
          <IconButton
            icon="calendar"
            label="Add to calendar"
            shape="square"
            size={48}
            variant="solid"
            onPress={() => void shareEventICS(event)}
          />
        ) : null}
        {directionsUrl(event) ? (
          <IconButton
            icon="navigation"
            label="Directions"
            shape="square"
            size={48}
            variant="solid"
            onPress={() => void openDirections(event)}
          />
        ) : null}
      </View>

      <View style={styles.card}>
        <DetailRow icon="calendar" label="When" value={when} />
        <DetailRow icon="map-pin" label="Where" value={loc || "To be announced"} />
        <DetailRow icon="briefcase" label="Organiser" value={event.organizer || "—"} />
        <DetailRow
          icon="users"
          label="Admits"
          value={`${totalSeats} ${pluralize(totalSeats, "person", "people")}`}
        />
        <DetailRow
          icon="dollar-sign"
          label="Paid"
          value={totalPaid > 0 ? money(totalPaid) : "Free"}
          divider={false}
        />
      </View>

      <SectionTitle>Your tickets</SectionTitle>
      <View style={styles.card}>
        {tickets.map((t, idx) => {
          const refund = t.refund ? statusPill(REFUND_STATUS, t.refund.status) : null;
          return (
            <Pressable
              key={t.id}
              accessibilityRole="button"
              accessibilityLabel={`${t.ticket || "Admission"}, order ${t.orderCode}`}
              onPress={() => router.push(`/tickets/${t.id}`)}
              style={({ pressed }) => [
                styles.row,
                idx < tickets.length - 1 && styles.rowDivided,
                pressed && styles.pressed,
              ]}
            >
              <IconTile icon="credit-card" size={34} />
              <View style={styles.rowStack}>
                <Text style={styles.rowTitle} numberOfLines={1}>
                  {t.ticket || "Admission"}
                  {t.quantity > 1 ? ` × ${t.quantity}` : ""}
                </Text>
                <Text style={styles.rowSub} numberOfLines={1}>
                  {t.orderCode}
                </Text>
              </View>
              {refund ? <Pill label={refund.label} tone={refund.tone} /> : null}
              <Icon name="chevron-right" size={17} color={colors.textTertiary} />
            </Pressable>
          );
        })}
      </View>

      {collectables.length ? (
        <>
          <SectionTitle>Collect at the event</SectionTitle>
          <View style={styles.card}>
            {collectables.map((e, idx) => (
              <View
                key={e.itemId}
                style={[styles.row, idx < collectables.length - 1 && styles.rowDivided]}
              >
                <IconTile icon="package" size={34} />
                <View style={styles.rowStack}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {e.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {e.remaining <= 0 ? "Collected" : `${e.collected} of ${e.entitled}`}
                  </Text>
                </View>
                {e.remaining <= 0 ? (
                  <Icon name="check" size={17} color={colors.success} />
                ) : null}
              </View>
            ))}
          </View>
        </>
      ) : null}

      {rooms.length ? (
        <>
          <SectionTitle>Live rooms</SectionTitle>
          <View style={styles.card}>
            {rooms.map((r, idx) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={r.name}
                onPress={() => router.push(`/live/${r.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  idx < rooms.length - 1 && styles.rowDivided,
                  pressed && styles.pressed,
                ]}
              >
                <IconTile icon="radio" size={34} tone={r.openNow ? "success" : "neutral"} />
                <View style={styles.rowStack}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {r.openNow
                      ? `Live${r.liveNow > 0 ? ` · ${r.liveNow} watching` : ""}`
                      : r.state || "Not open yet"}
                  </Text>
                </View>
                {r.openNow ? <PulseDot size={8} /> : null}
                <Icon name="chevron-right" size={17} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {recordings.length ? (
        <>
          <SectionTitle>Recordings</SectionTitle>
          <View style={styles.card}>
            {recordings.map((w, idx) => (
              <Pressable
                key={w.id}
                accessibilityRole="button"
                accessibilityLabel={w.name}
                onPress={() => router.push(`/watch/${w.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  idx < recordings.length - 1 && styles.rowDivided,
                  pressed && styles.pressed,
                ]}
              >
                <IconTile icon="circle-play" size={34} />
                <View style={styles.rowStack}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {w.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {[w.session, w.duration].filter(Boolean).join(" · ") || "Recording"}
                  </Text>
                </View>
                <Icon name="chevron-right" size={17} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {chats.length ? (
        <>
          <SectionTitle>Chat</SectionTitle>
          <View style={styles.card}>
            {chats.map((c, idx) => (
              <Pressable
                key={c.id}
                accessibilityRole="button"
                accessibilityLabel={c.name}
                onPress={() => router.push(`/community/${c.id}`)}
                style={({ pressed }) => [
                  styles.row,
                  idx < chats.length - 1 && styles.rowDivided,
                  pressed && styles.pressed,
                ]}
              >
                <IconTile icon="message-circle" size={34} />
                <View style={styles.rowStack}>
                  <Text style={styles.rowTitle} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <Text style={styles.rowSub} numberOfLines={1}>
                    {c.lastPreview || c.topic || "No messages yet"}
                  </Text>
                </View>
                {c.unread > 0 ? <Pill label={String(c.unread)} tone="neutral" /> : null}
                <Icon name="chevron-right" size={17} color={colors.textTertiary} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      <View style={styles.footer}>
        <Button
          title="Message Organiser"
          variant="secondary"
          icon="message-square"
          onPress={() =>
            router.push({
              pathname: "/messages/new",
              params: {
                subject: `Re: ${event.eventName}`,
                orderId: event.id,
                contextLabel: `${event.eventName} · ${event.orderCode}`,
              },
            })
          }
          fullWidth
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSubtle,
  },
  heroText: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: 6,
    padding: spacing.lg,
  },
  heroName: {
    ...type.title,
    color: colors.primary,
  },
  heroLine: {
    ...type.caption,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  countdown: {
    marginTop: spacing.lg,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 2,
    marginTop: spacing.lg,
    marginBottom: spacing.xl,
  },
  primary: {
    flex: 1,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
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
  rowTitle: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    color: colors.foreground,
  },
  rowSub: {
    ...type.caption,
    color: colors.textSecondary,
  },
  footer: {
    marginTop: spacing.sm,
  },
});
