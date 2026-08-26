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
          <Text style={styles.greeting}>{greeting()},</Text>
          <Text style={styles.name}>{firstName(member?.name, member?.email)}</Text>
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
          ) : (
            <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
              <Text style={styles.caughtUp}>You&apos;re all caught up — no upcoming events.</Text>
            </Animated.View>
          )}

          <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
            <Card>
              <View style={styles.statsRow}>
                <StatCell label="Upcoming" value={stats.upcoming} />
                <View style={styles.statsDivider} />
                <StatCell label="Tickets" value={stats.tickets} />
              </View>
              <View style={styles.statsRule} />
              <View style={styles.statsRow}>
                <StatCell label="Memberships" value={stats.memberships} />
                <View style={styles.statsDivider} />
                <StatCell label="Total spent" value={money(stats.spent)} />
              </View>
            </Card>
          </Animated.View>

          {availablePlans > 0 && stats.memberships === 0 ? (
            <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Become a member"
                onPress={() => router.push("/memberships")}
                style={({ pressed }) => [styles.memberCard, pressed && styles.pressed]}
              >
                <View style={styles.memberIcon}>
                  <Feather name="star" size={18} color={colors.primary} />
                </View>
                <View style={styles.memberText}>
                  <Text style={styles.memberTitle}>Become a member</Text>
                  <Text style={styles.memberSub}>
                    Unlock member pricing and perks — {availablePlans}{" "}
                    {availablePlans === 1 ? "plan" : "plans"} available.
                  </Text>
                </View>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
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
      <View>
        <EventCover uri={ticket.coverUrl} name={ticket.eventName} height={210} radius={0} />
        <LinearGradient
          colors={[colors.overlay, "transparent"]}
          start={{ x: 0, y: 1 }}
          end={{ x: 0, y: 0 }}
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
            {ticket.eventDate ? fmtDay(ticket.eventDate) : "Date TBA"}
            {ticket.eventTime ? ` · ${ticket.eventTime}` : ""}
          </Text>
          {loc ? (
            <Text style={styles.heroLine} numberOfLines={1}>
              {loc}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.heroBody}>
        <Countdown dateStr={ticket.eventDate} />
        <View style={styles.heroActions}>
          <View style={styles.heroPrimaryWrap}>
            <Button title="View ticket" onPress={onOpen} fullWidth icon="credit-card" />
          </View>
          {hasCalendar ? (
            <HeroIconButton icon="calendar" label="Add to calendar" onPress={() => void shareEventICS(ticket)} />
          ) : null}
          {hasDirections ? (
            <HeroIconButton icon="navigation" label="Directions" onPress={() => void openDirections(ticket)} />
          ) : null}
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

function StatCell({ label, value }: { label: string; value: number | string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      {typeof value === "number" ? <AnimatedValue target={value} /> : null}
      {typeof value === "string" ? <Text style={styles.statValueString}>{value}</Text> : null}
    </View>
  );
}

function AnimatedValue({ target }: { target: number }) {
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

  return <Text style={styles.statValue}>{String(Math.round(shown))}</Text>;
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
    marginBottom: spacing.xl,
  },
  headStack: {
    flex: 1,
  },
  greeting: {
    ...type.body,
    color: colors.textSecondary,
  },
  name: {
    ...type.display,
    color: colors.foreground,
  },
  bell: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.xs,
  },
  bellDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  caughtUp: {
    ...type.heading,
    color: colors.textSecondary,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  hero: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  heroChip: {
    position: "absolute",
    top: spacing.md,
    left: spacing.md,
    backgroundColor: colors.chipScrim,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  heroChipText: {
    ...type.kicker,
    textTransform: "uppercase",
    color: colors.primary,
  },
  heroText: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.xs,
    padding: spacing.lg,
  },
  heroName: {
    ...type.title,
    color: colors.primary,
  },
  heroLine: {
    ...type.caption,
    color: colors.primary,
  },
  heroBody: {
    gap: spacing.lg,
    padding: spacing.lg,
  },
  heroActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  heroPrimaryWrap: {
    flex: 1,
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
  statsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  statsDivider: {
    width: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.xs,
  },
  statsRule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: spacing.lg,
  },
  statCell: {
    flex: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  statLabel: {
    ...type.kicker,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  statValue: {
    ...type.title,
    color: colors.foreground,
    fontVariant: ["tabular-nums"],
  },
  statValueString: {
    ...type.title,
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
    width: 38,
    height: 38,
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
    ...type.label,
    fontSize: 12,
    color: colors.textSecondary,
  },
  ordersCard: {
    padding: 0,
    paddingHorizontal: spacing.md,
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
