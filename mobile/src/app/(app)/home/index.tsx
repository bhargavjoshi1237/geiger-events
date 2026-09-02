import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icons";
import { Countdown } from "@/components/Countdown";
import { EventCover } from "@/components/EventCover";
import { ScreenTitle } from "@/components/ScreenTitle";
import { TicketQr } from "@/components/TicketQr";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Perforation } from "@/components/ui/Perforation";
import { Pill } from "@/components/ui/Pill";
import { PulseDot } from "@/components/ui/PulseDot";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { buildEventICS, directionsUrl, openDirections, shareEventICS } from "@/lib/calendar";
import {
  firstName,
  fmtDate,
  fmtShortDay,
  greeting,
  isToday,
  isUpcoming,
  money,
  pluralize,
} from "@/lib/format";
import { ORDER_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Entitlement, LiveRoom, Ticket } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function HomeScreen() {
  const router = useRouter();
  const { member } = useSession();
  const { data, live, channels, counts } = usePortalData();

  const nextTicket = useMemo(() => {
    const upcoming = (data?.tickets || [])
      .filter((t) => t.eventDate && isUpcoming(t.eventDate) && !t.refund)
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    return upcoming[0] || null;
  }, [data]);

  const liveRoom = useMemo(() => (live || []).find((r) => r.openNow) || null, [live]);
  const recentOrders = (data?.orders || []).slice(0, 3);
  const eventDay = Boolean(nextTicket && isToday(nextTicket.eventDate));
  const loading = data === null;

  // Greet with the name they put on a ticket — that is what staff read at the door.
  const greetName = useMemo(() => {
    const onTicket =
      nextTicket?.buyerName?.trim() ||
      (data?.tickets || []).find((t) => t.buyerName?.trim())?.buyerName;
    return firstName(onTicket || member?.name, member?.email);
  }, [nextTicket, data, member]);

  const chatCount = (channels || []).length;
  const chatUnread = (channels || []).reduce((sum, c) => sum + (c.unread || 0), 0);
  const activePlan = (data?.memberships || []).find((m) => m.status === "Active") || null;

  return (
    <Screen scroll>
      {eventDay ? (
        <TodayHeader />
      ) : (
        <ScreenTitle
          eyebrow={`${greeting()},`}
          title={greetName}
          right={
            <>
              <IconButton
                icon="bell"
                label="Notifications"
                badge={Boolean(counts.notifications)}
                onPress={() => router.push("/notifications")}
              />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Account"
                onPress={() => router.push("/account")}
              >
                <Avatar name={member?.name} email={member?.email} size={44} />
              </Pressable>
            </>
          }
        />
      )}

      {loading ? (
        <SkeletonList rows={5} />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {nextTicket ? (
            <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
              {eventDay ? (
                <EventDayPass
                  ticket={nextTicket}
                  onOpenPass={() => router.push(`/pass/${nextTicket.id}` as Href)}
                />
              ) : (
                <NextEventHero
                  ticket={nextTicket}
                  onShowPass={() => router.push(`/pass/${nextTicket.id}` as Href)}
                  onOpen={() =>
                    router.push(
                      (nextTicket.eventId
                        ? `/events/${nextTicket.eventId}`
                        : `/tickets/${nextTicket.id}`) as Href,
                    )
                  }
                />
              )}
            </Animated.View>
          ) : (
            <EmptyState
              icon="calendar"
              title="Nothing coming up"
              message="Tickets you buy show up here with a countdown and a pass."
              actionLabel="See your tickets"
              onAction={() => router.push("/tickets")}
            />
          )}

          {liveRoom ? (
            <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
              <LiveStrip room={liveRoom} onPress={() => router.push(`/live/${liveRoom.id}`)} />
            </Animated.View>
          ) : null}

          {eventDay && nextTicket ? (
            <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
              <EventDayRows
                ticket={nextTicket}
                onOpenTicket={() => router.push(`/tickets/${nextTicket.id}`)}
              />
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(stagger(3)).springify()}>
            <Shortcuts
              chats={chatCount}
              chatsUnread={chatUnread}
              watch={counts.watch || 0}
              plan={activePlan?.planName || null}
              onGo={(href) => router.push(href as Href)}
            />
          </Animated.View>

          {recentOrders.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(4)).springify()}>
              <SectionTitle
                action={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="All orders"
                    onPress={() => router.push("/orders")}
                    hitSlop={8}
                  >
                    <Text style={styles.viewAll}>All</Text>
                  </Pressable>
                }
              >
                Recent orders
              </SectionTitle>
              <View style={styles.ordersCard}>
                {recentOrders.map((o, idx) => {
                  const pill = statusPill(ORDER_STATUS, o.status);
                  return (
                    <Pressable
                      key={o.id}
                      accessibilityRole="button"
                      accessibilityLabel={`${o.eventName}, ${pill.label}`}
                      onPress={() => router.push(`/orders/${o.id}`)}
                      style={({ pressed }) => [
                        styles.orderRow,
                        idx < recentOrders.length - 1 && styles.orderRowDivided,
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={styles.orderStack}>
                        <Text style={styles.orderName} numberOfLines={1}>
                          {o.eventName}
                        </Text>
                        <Text style={styles.orderDate}>{fmtDate(o.createdAt)}</Text>
                      </View>
                      <View style={styles.orderTrailing}>
                        <Pill label={pill.label} tone={pill.tone} variant="outline" />
                        <Text style={styles.orderTotal}>{money(o.total)}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}

function TodayHeader() {
  return (
    <View style={styles.todayRow}>
      <View style={styles.todayLeft}>
        <PulseDot size={8} />
        <Text style={styles.todayTitle}>Today</Text>
      </View>
      <View style={styles.offlinePill}>
        <Icon name="wifi-off" size={13} color={colors.mutedForeground} />
        <Text style={styles.offlineText}>Offline ready</Text>
      </View>
    </View>
  );
}

function NextEventHero({
  ticket,
  onShowPass,
  onOpen,
}: {
  ticket: Ticket;
  onShowPass: () => void;
  onOpen: () => void;
}) {
  const loc = [ticket.venue, ticket.city].filter(Boolean).join(", ");
  const when = [ticket.eventDate ? fmtShortDay(ticket.eventDate) : "Date TBA", ticket.eventTime]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.hero}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open ${ticket.eventName}`}
        onPress={onOpen}
      >
        <EventCover uri={ticket.coverUrl} name={ticket.eventName} height={170} radius={0} />
        {/* The poster dissolves into the card body instead of stopping at a hard edge. */}
        <LinearGradient
          colors={["transparent", "rgba(26,26,26,0.55)", colors.surfaceSubtle]}
          locations={[0.3, 0.72, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.heroChip} pointerEvents="none">
          <Text style={styles.heroChipText}>Next up</Text>
        </View>
        <View style={styles.heroText} pointerEvents="none">
          <Text style={styles.heroName} numberOfLines={2}>
            {ticket.eventName}
          </Text>
          <Text style={styles.heroLine} numberOfLines={1}>
            {[when, loc].filter(Boolean).join(" · ")}
          </Text>
        </View>
      </Pressable>
      <View style={styles.heroBody}>
        <Countdown dateStr={ticket.eventDate} />
        <View style={styles.heroActions}>
          <View style={styles.heroPrimary}>
            <Button title="Show Pass" icon="qr-code" onPress={onShowPass} fullWidth />
          </View>
          {buildEventICS(ticket) ? (
            <IconButton
              icon="calendar"
              label="Add to calendar"
              shape="square"
              size={48}
              variant="solid"
              onPress={() => void shareEventICS(ticket)}
            />
          ) : null}
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
      </View>
    </View>
  );
}

function EventDayPass({ ticket, onOpenPass }: { ticket: Ticket; onOpenPass: () => void }) {
  const loc = [ticket.venue, ticket.city].filter(Boolean).join(", ");
  const line = [
    `${ticket.ticket || "Admission"}${ticket.quantity > 1 ? ` × ${ticket.quantity}` : ""}`,
    loc,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={styles.pass}>
      <Text style={styles.passKicker}>
        {ticket.eventTime ? `Doors open ${ticket.eventTime}` : "Present at entrance"}
      </Text>
      <Text style={styles.passName} numberOfLines={2}>
        {ticket.eventName}
      </Text>
      <Text style={styles.passLine} numberOfLines={2}>
        {line}
      </Text>

      <View style={styles.passRule}>
        <Perforation dashColor={colors.paperDash} notchColor={colors.background} notchSize={20} />
      </View>

      <View style={styles.passRow}>
        <TicketQr orderId={ticket.id} size={104} padded={false} />
        <View style={styles.passMeta}>
          <Text style={styles.passMetaLabel}>Order</Text>
          <Text style={styles.passCode}>{ticket.orderCode}</Text>
          <Text style={[styles.passMetaLabel, styles.passMetaSpaced]}>Attendee</Text>
          <Text style={styles.passAttendee} numberOfLines={1}>
            {ticket.buyerName || ticket.buyerEmail}
          </Text>
        </View>
      </View>

      <View style={styles.passAction}>
        <Button title="Open full pass" icon="maximize" variant="paper" onPress={onOpenPass} fullWidth />
      </View>
    </View>
  );
}

function EventDayRows({ ticket, onOpenTicket }: { ticket: Ticket; onOpenTicket: () => void }) {
  const collectables = (ticket.entitlements || []).filter((e) => e.entitled > 0);
  const loc = [ticket.venue, ticket.address, ticket.city].filter(Boolean).join(", ");

  return (
    <View style={styles.rows}>
      {collectables.length ? (
        <ActionRow
          icon="package"
          title="Collect at the event"
          subtitle={collectables.map(collectSummary).join(" · ")}
          onPress={onOpenTicket}
        />
      ) : null}
      {directionsUrl(ticket) ? (
        <ActionRow
          icon="navigation"
          title={ticket.venue || "Venue"}
          subtitle={loc || "Get directions"}
          onPress={() => void openDirections(ticket)}
        />
      ) : null}
    </View>
  );
}

function collectSummary(e: Entitlement): string {
  return e.remaining <= 0
    ? `${e.name} · collected`
    : `${e.name} · ${e.collected} of ${e.entitled}`;
}

function ActionRow({
  icon,
  title,
  subtitle,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.actionRow, pressed && styles.pressed]}
    >
      <IconTile icon={icon} size={40} />
      <View style={styles.actionStack}>
        <Text style={styles.actionTitle} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.actionSub} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

type Shortcut = {
  href: string;
  icon: IconName;
  label: string;
  value: string;
};

// The design brief calls Home "next event, live, shortcuts" — this is the third.
function Shortcuts({
  chats,
  chatsUnread,
  watch,
  plan,
  onGo,
}: {
  chats: number;
  chatsUnread: number;
  watch: number;
  plan: string | null;
  onGo: (href: string) => void;
}) {
  const items: Shortcut[] = [
    {
      href: "/community",
      icon: "message-circle",
      label: "Group chat",
      value: chatsUnread
        ? `${chatsUnread} unread`
        : chats
          ? `${chats} ${pluralize(chats, "chat", "chats")}`
          : "No chats yet",
    },
    {
      href: "/watch",
      icon: "circle-play",
      label: "Watch",
      value: watch ? `${watch} ${pluralize(watch, "video", "videos")}` : "Nothing yet",
    },
    {
      href: "/memberships",
      icon: "award",
      label: "Membership",
      value: plan || "Not a member",
    },
  ];

  return (
    <View>
      <SectionTitle>Shortcuts</SectionTitle>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.shortcutScroll}
        contentContainerStyle={styles.shortcutRow}
      >
        {items.map((s) => (
          <Pressable
            key={s.href}
            accessibilityRole="button"
            accessibilityLabel={`${s.label}, ${s.value}`}
            onPress={() => onGo(s.href)}
            style={({ pressed }) => [styles.shortcut, pressed && styles.pressed]}
          >
            <IconTile icon={s.icon} size={34} />
            <View style={styles.shortcutStack}>
              <Text style={styles.shortcutLabel} numberOfLines={1}>
                {s.label}
              </Text>
              <Text style={styles.shortcutValue} numberOfLines={1}>
                {s.value}
              </Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function LiveStrip({ room, onPress }: { room: LiveRoom; onPress: () => void }) {
  const meta = [room.liveNow > 0 ? `${room.liveNow} watching` : null, room.eventName]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${room.name} is live`}
      onPress={onPress}
      style={({ pressed }) => [styles.liveStrip, pressed && styles.pressed]}
    >
      <IconTile icon="radio" size={40} tone="success" />
      <View style={styles.liveStack}>
        <View style={styles.liveTitleRow}>
          <PulseDot size={7} />
          <Text style={styles.liveTitle} numberOfLines={1}>
            {room.name} is live
          </Text>
        </View>
        {meta ? (
          <Text style={styles.liveMeta} numberOfLines={1}>
            {meta}
          </Text>
        ) : null}
      </View>
      <Icon name="chevron-right" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  pressed: {
    opacity: 0.7,
  },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg + 2,
  },
  todayLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  todayTitle: {
    ...type.title,
    fontSize: 20,
    color: colors.foreground,
  },
  offlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingVertical: 6,
    paddingHorizontal: spacing.md - 2,
  },
  offlineText: {
    ...type.micro,
    color: colors.mutedForeground,
  },
  hero: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSubtle,
  },
  heroChip: {
    position: "absolute",
    top: 14,
    left: 14,
    backgroundColor: colors.scrim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: 5,
    paddingHorizontal: spacing.md - 2,
  },
  heroChipText: {
    ...type.kicker,
    letterSpacing: 0.7,
    textTransform: "uppercase",
    color: colors.primary,
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
    fontSize: 21,
    lineHeight: 25,
    color: colors.primary,
  },
  heroLine: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: "rgba(255,255,255,0.75)",
  },
  heroBody: {
    gap: 14,
    padding: spacing.lg,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md - 2,
  },
  heroPrimary: {
    flex: 1,
  },
  pass: {
    backgroundColor: colors.paper,
    borderRadius: radius.xxl,
    padding: 22,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 14 },
    elevation: 10,
  },
  passKicker: {
    ...type.kicker,
    textTransform: "uppercase",
    color: colors.paperSecondary,
  },
  passName: {
    ...type.title,
    fontSize: 24,
    lineHeight: 28,
    color: colors.paperForeground,
    marginTop: spacing.sm + 2,
  },
  passLine: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.paperMuted,
    marginTop: 6,
  },
  passRule: {
    marginVertical: spacing.xl - 4,
    marginHorizontal: -22,
  },
  passRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  passMeta: {
    flex: 1,
    minWidth: 0,
  },
  passMetaLabel: {
    ...type.captionStrong,
    fontSize: 13,
    color: colors.paperMuted,
  },
  passMetaSpaced: {
    marginTop: spacing.md,
  },
  passCode: {
    ...type.mono,
    fontSize: 16,
    lineHeight: 20,
    color: colors.paperForeground,
    marginTop: 2,
  },
  passAttendee: {
    ...type.bodyStrong,
    color: colors.paperForeground,
    marginTop: 2,
  },
  passAction: {
    marginTop: spacing.xl - 4,
  },
  rows: {
    gap: spacing.md - 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  actionStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  actionTitle: {
    ...type.label,
    color: colors.foreground,
  },
  actionSub: {
    ...type.caption,
    color: colors.textSecondary,
  },
  liveStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.success}40`,
    backgroundColor: `${colors.success}14`,
    borderRadius: radius.lg,
    padding: 14,
  },
  liveStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  liveTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  liveTitle: {
    ...type.labelStrong,
    flexShrink: 1,
    color: colors.foreground,
  },
  liveMeta: {
    ...type.caption,
    color: colors.textSecondary,
  },
  // Bleed past the screen padding so the row scrolls off both edges.
  shortcutScroll: {
    marginHorizontal: -spacing.lg,
  },
  shortcutRow: {
    flexDirection: "row",
    gap: spacing.md - 2,
    paddingHorizontal: spacing.lg,
  },
  shortcut: {
    width: 132,
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: 14,
  },
  shortcutStack: {
    gap: 2,
  },
  shortcutLabel: {
    ...type.labelStrong,
    color: colors.foreground,
  },
  shortcutValue: {
    ...type.caption,
    color: colors.textSecondary,
  },
  viewAll: {
    ...type.captionStrong,
    fontSize: 13,
    color: colors.textSecondary,
  },
  ordersCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    overflow: "hidden",
  },
  orderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  orderRowDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  orderStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  orderName: {
    ...type.label,
    color: colors.foreground,
  },
  orderDate: {
    ...type.caption,
    color: colors.textTertiary,
  },
  orderTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  orderTotal: {
    ...type.label,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
});
