import { Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  LinearTransition,
  runOnJS,
  useAnimatedReaction,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Countdown } from "@/components/Countdown";
import { EventCover } from "@/components/EventCover";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { SkeletonList } from "@/components/ui/Skeleton";
import { buildEventICS, directionsUrl, openDirections, shareEventICS } from "@/lib/calendar";
import { firstName, fmtDate, fmtDay, greeting, isUpcoming, money } from "@/lib/format";
import { ORDER_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Ticket } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function HomeScreen() {
  const router = useRouter();
  const { member } = useSession();
  const { data, plans, counts, refreshing, refreshAll } = usePortalData();

  // Earliest upcoming ticket drives the hero and the "coming up" copy.
  const nextTicket = useMemo(() => {
    const upcoming = (data?.tickets || [])
      .filter((t) => t.eventDate && isUpcoming(t.eventDate))
      .sort((a, b) => new Date(a.eventDate).getTime() - new Date(b.eventDate).getTime());
    return upcoming[0] || null;
  }, [data]);

  const stats = useMemo(() => {
    const tickets = data?.tickets || [];
    const memberships = data?.memberships || [];
    const orders = data?.orders || [];
    const upcoming = tickets.filter((t) => isUpcoming(t.eventDate)).length;
    const activeMemberships = memberships.filter((m) => m.status === "Active").length;
    const spent = orders
      .filter((o) => o.status !== "refunded" && o.status !== "cancelled")
      .reduce((sum, o) => sum + Number(o.total || 0), 0);
    return { upcoming, tickets: tickets.length, memberships: activeMemberships, spent };
  }, [data]);

  const availablePlans = useMemo(
    () => (plans.plans || []).filter((p) => !p.held).length,
    [plans],
  );

  const recentOrders = (data?.orders || []).slice(0, 4);
  const loading = data === null;

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll}>
      <View style={styles.headRow}>
        <View style={styles.headStack}>
          <Text style={styles.greeting}>
            {greeting()}, {firstName(member?.name, member?.email)}
          </Text>
          <Text style={styles.subtitle}>
            {nextTicket
              ? "Here's what's coming up."
              : "You're all caught up — no upcoming events."}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Notifications"
          onPress={() => router.push("/notifications")}
          style={styles.bell}
        >
          <Feather name="bell" size={20} color={colors.foreground} />
          {counts.notifications ? <View style={styles.bellDot} /> : null}
        </Pressable>
      </View>

      {loading ? (
        <SkeletonList rows={5} />
      ) : (
        <Animated.View layout={LinearTransition} style={styles.stack}>
          {nextTicket ? (
            <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
              <NextEventHero ticket={nextTicket} onOpen={() => router.push(`/tickets/${nextTicket.id}`)} />
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
            <View style={styles.statsGrid}>
              <StatTile icon="calendar" label="Upcoming" value={stats.upcoming} />
              <StatTile icon="credit-card" label="Tickets" value={stats.tickets} />
              <StatTile icon="check-circle" label="Memberships" value={stats.memberships} />
              <StatTile icon="dollar-sign" label="Total spent" value={stats.spent} money />
            </View>
          </Animated.View>

          {availablePlans > 0 && stats.memberships === 0 ? (
            <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Become a member"
                onPress={() => router.push("/memberships")}
                style={styles.memberCard}
              >
                <View style={styles.memberIcon}>
                  <Feather name="check-circle" size={20} color={colors.primary} />
                </View>
                <View style={styles.memberText}>
                  <Text style={styles.memberTitle}>Become a member</Text>
                  <Text style={styles.memberSub}>
                    Unlock member pricing and perks — {availablePlans}{" "}
                    {availablePlans === 1 ? "plan" : "plans"} available.
                  </Text>
                </View>
                <Feather name="arrow-right" size={16} color={colors.primary} />
              </Pressable>
            </Animated.View>
          ) : null}

          {recentOrders.length ? (
            <Animated.View entering={FadeInDown.delay(stagger(3)).springify()}>
              <SectionTitle
                action={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="View all orders"
                    onPress={() => router.push("/orders")}
                    style={styles.viewAll}
                    hitSlop={8}
                  >
                    <Text style={styles.viewAllText}>View all</Text>
                  </Pressable>
                }
              >
                Recent orders
              </SectionTitle>
              <Card style={styles.ordersCard}>
                {recentOrders.map((o, idx) => {
                  const pill = statusPill(ORDER_STATUS, o.status);
                  return (
                    <ListRow
                      key={o.id}
                      title={o.eventName}
                      subtitle={fmtDate(o.createdAt)}
                      trailing={
                        <View style={styles.orderTrailing}>
                          <Pill label={pill.label} tone={pill.tone} />
                          <Text style={styles.orderTotal}>{money(o.total)}</Text>
                        </View>
                      }
                      divider={idx < recentOrders.length - 1}
                    />
                  );
                })}
              </Card>
            </Animated.View>
          ) : null}
        </Animated.View>
      )}
    </Screen>
  );
}

function NextEventHero({ ticket, onOpen }: { ticket: Ticket; onOpen: () => void }) {
  const loc = [ticket.venue, ticket.city].filter(Boolean).join(", ");
  const hasCalendar = Boolean(buildEventICS(ticket));
  const hasDirections = Boolean(directionsUrl(ticket));

  return (
    <View style={styles.hero}>
      <EventCover uri={ticket.coverUrl} name={ticket.eventName} height={180} radius={0} />
      <LinearGradient
        colors={[colors.overlay, "transparent"]}
        start={{ x: 0, y: 1 }}
        end={{ x: 0, y: 0 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroText}>
        <Text style={styles.heroKicker}>Your next event</Text>
        <Text style={styles.heroName} numberOfLines={2}>
          {ticket.eventName}
        </Text>
        <View style={styles.heroLine}>
          <Feather name="calendar" size={13} color={colors.primary} />
          <Text style={styles.heroLineText}>
            {ticket.eventDate ? fmtDay(ticket.eventDate) : "Date TBA"}
            {ticket.eventTime ? ` · ${ticket.eventTime}` : ""}
          </Text>
        </View>
        {loc ? (
          <View style={styles.heroLine}>
            <Feather name="map-pin" size={13} color={colors.primary} />
            <Text style={styles.heroLineText}>{loc}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.heroBody}>
        <Countdown dateStr={ticket.eventDate} />
        <View style={styles.heroActions}>
          <Button title="View ticket" onPress={onOpen} fullWidth icon="credit-card" />
          <View style={styles.heroIconRow}>
            {hasCalendar ? (
              <HeroIconButton icon="calendar" label="Add to calendar" onPress={() => void shareEventICS(ticket)} />
            ) : null}
            {hasDirections ? (
              <HeroIconButton icon="navigation" label="Directions" onPress={() => void openDirections(ticket)} />
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function HeroIconButton({
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
      style={({ pressed }) => [styles.heroIconBtn, pressed && styles.pressed]}
      hitSlop={4}
    >
      <Feather name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

function StatTile({
  icon,
  label,
  value,
  money: isMoney,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: number;
  money?: boolean;
}) {
  return (
    <View style={styles.statTile}>
      <View style={styles.statLabelRow}>
        <Feather name={icon} size={14} color={colors.textSecondary} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <AnimatedValue target={value} money={isMoney} />
    </View>
  );
}

// Counts up to the target on mount with a 420ms withTiming counter.
function AnimatedValue({ target, money: isMoney }: { target: number; money?: boolean }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(reduced ? target : 0);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) progress.value = target;
    else progress.value = withTiming(target, { duration: 420 });
  }, [target, reduced, progress]);

  useAnimatedReaction(
    () => progress.value,
    (v) => runOnJS(setShown)(v),
  );

  return (
    <Text style={styles.statValue}>{isMoney ? money(shown) : String(Math.round(shown))}</Text>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.xl,
  },
  headRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  headStack: {
    flex: 1,
    gap: spacing.xs,
  },
  greeting: {
    ...type.display,
    color: colors.foreground,
  },
  subtitle: {
    ...type.body,
    color: colors.textSecondary,
  },
  bell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  bellDot: {
    position: "absolute",
    top: 9,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  hero: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  heroText: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  heroKicker: {
    ...type.caption,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: colors.primary,
  },
  heroName: {
    ...type.title,
    color: colors.primary,
  },
  heroLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  heroLineText: {
    ...type.caption,
    flexShrink: 1,
    color: colors.primary,
  },
  heroBody: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heroActions: {
    gap: spacing.md,
  },
  heroIconRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  heroIconBtn: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceActive,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
  },
  pressed: {
    opacity: 0.6,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
  },
  statTile: {
    flexGrow: 1,
    flexBasis: "42%",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  statLabel: {
    ...type.caption,
    color: colors.textSecondary,
  },
  statValue: {
    ...type.title,
    fontSize: 22,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  memberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: `${colors.primary}29`,
    backgroundColor: `${colors.primary}14`,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  memberIcon: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${colors.primary}26`,
    borderRadius: radius.md,
  },
  memberText: {
    flex: 1,
    gap: 2,
  },
  memberTitle: {
    ...type.label,
    fontWeight: "600",
    color: colors.foreground,
  },
  memberSub: {
    ...type.caption,
    color: colors.textSecondary,
  },
  viewAll: {
    paddingVertical: spacing.xs,
  },
  viewAllText: {
    ...type.caption,
    color: colors.textSecondary,
  },
  ordersCard: {
    padding: 0,
  },
  orderTrailing: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  orderTotal: {
    ...type.label,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
});
