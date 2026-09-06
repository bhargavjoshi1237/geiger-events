import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

import { colors, radius, spacing } from "@/theme/tokens";

type SkeletonProps = {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  circle?: boolean;
};

export function Skeleton({
  width = "100%",
  height,
  radius: round = radius.sm,
  circle = false,
}: SkeletonProps) {
  const opacity = useSharedValue(0.35);
  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        styles.block,
        {
          width,
          height,
          borderRadius: circle ? height / 2 : round,
        },
        animStyle,
      ]}
    />
  );
}

type SkeletonListProps = {
  rows?: number;
  variant?: "card" | "divided" | "chat";
};

// Mirrors the ChannelList/Inbox row: square avatar, two text lines, trailing time.
export function SkeletonList({ rows = 4, variant = "card" }: SkeletonListProps) {
  if (variant === "chat") return <ChatSkeleton rows={rows} />;
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={variant === "card" ? styles.rowCard : styles.rowDivided}>
          <Skeleton width={variant === "card" ? 40 : 44} height={variant === "card" ? 40 : 44} radius={radius.md} />
          <View style={styles.rowStack}>
            <View style={styles.rowTitleLine}>
              <Skeleton width="55%" height={15} radius={4} />
              <Skeleton width={28} height={11} radius={4} />
            </View>
            <Skeleton width="85%" height={13} radius={4} />
          </View>
        </View>
      ))}
    </View>
  );
}

// Alternating bubbles mirroring MessageBubble alignment.
function ChatSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={[styles.chatRow, i % 2 === 1 && styles.chatRowRight]}>
          {i % 2 === 0 ? <Skeleton width={32} height={32} circle /> : null}
          <Skeleton
            width={i % 3 === 0 ? "72%" : i % 3 === 1 ? "55%" : "64%"}
            height={44}
            radius={radius.lg}
          />
        </View>
      ))}
    </View>
  );
}

// Mirrors the gated content of HomeScreen: next-event hero, shortcuts, recent orders.
// The greeting title renders above this, so it starts at the hero.
export function HomeSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.heroCard}>
        <Skeleton width="100%" height={170} radius={0} />
        <View style={styles.heroBody}>
          <View style={styles.countdownRow}>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} width={56} height={52} radius={radius.md} />
            ))}
          </View>
          <View style={styles.actionRow}>
            <View style={styles.actionPrimary}>
              <Skeleton width="100%" height={48} radius={radius.md} />
            </View>
            <Skeleton width={48} height={48} radius={radius.md} />
            <Skeleton width={48} height={48} radius={radius.md} />
          </View>
        </View>
      </View>
      <View style={styles.shortcutRow}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.shortcutCard}>
            <Skeleton width={34} height={34} radius={radius.md} />
            <Skeleton width="80%" height={14} radius={4} />
            <Skeleton width="65%" height={12} radius={4} />
          </View>
        ))}
      </View>
      <View style={styles.ordersCard}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[styles.orderRow, i < 2 && styles.orderDivided]}>
            <View style={styles.rowStack}>
              <Skeleton width="60%" height={14} radius={4} />
              <Skeleton width="40%" height={12} radius={4} />
            </View>
            <Skeleton width={64} height={24} radius={radius.pill} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Mirrors the gated content of TicketsScreen: stacked pass cards.
// Title and Upcoming/Past segmented render above this.
export function TicketsSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.passCard}>
            <View style={styles.passHead}>
              <Skeleton width={56} height={56} radius={radius.md} />
              <View style={styles.rowStack}>
                <Skeleton width="75%" height={16} radius={4} />
                <Skeleton width="90%" height={13} radius={4} />
                <Skeleton width="55%" height={12} radius={4} />
              </View>
            </View>
            <View style={styles.passStub}>
              <Skeleton width={72} height={24} radius={radius.pill} />
              <Skeleton width={52} height={15} radius={4} />
              <Skeleton width={76} height={34} radius={radius.md} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Mirrors the gated content of EventDetailScreen: 180 hero, countdown, actions, detail card.
// The nav header renders above this in the loading branch.
export function EventDetailSkeleton() {
  return (
    <View style={styles.stack}>
      <Skeleton width="100%" height={180} radius={radius.lg} />
      <View style={styles.countdownRow}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} width={56} height={52} radius={radius.md} />
        ))}
      </View>
      <View style={styles.actionRow}>
        <View style={styles.actionPrimary}>
          <Skeleton width="100%" height={48} radius={radius.md} />
        </View>
        <Skeleton width={48} height={48} radius={radius.md} />
        <Skeleton width={48} height={48} radius={radius.md} />
      </View>
      <View style={styles.detailCard}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={[styles.detailRow, i < 4 && styles.orderDivided]}>
            <Skeleton width="30%" height={14} radius={4} />
            <Skeleton width="45%" height={14} radius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

// Mirrors the gated content of WatchScreen: 196 featured poster, thumb rows.
// The Watch title renders above this.
export function WatchSkeleton() {
  return (
    <View style={styles.stack}>
      <View style={styles.featuredCard}>
        <Skeleton width="100%" height={196} radius={0} />
        <View style={styles.featuredBody}>
          <Skeleton width="80%" height={16} radius={4} />
          <Skeleton width="60%" height={13} radius={4} />
        </View>
      </View>
      <View style={styles.list}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.watchRow}>
            <Skeleton width={120} height={68} radius={radius.md} />
            <View style={styles.rowStack}>
              <Skeleton width="85%" height={14} radius={4} />
              <Skeleton width="60%" height={12} radius={4} />
              <Skeleton width="50%" height={11} radius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

// Mirrors InboxScreen rows: divided avatar rows with tag pill.
// Title and filter chips render above this.
export function InboxSkeleton() {
  return (
    <View style={styles.list}>
      {[0, 1, 2, 3, 4].map((i) => (
        <View key={i} style={styles.rowDivided}>
          <Skeleton width={44} height={44} radius={radius.md} />
          <View style={styles.rowStack}>
            <View style={styles.rowTitleLine}>
              <Skeleton width="55%" height={15} radius={4} />
              <Skeleton width={28} height={11} radius={4} />
            </View>
            <Skeleton width="85%" height={13} radius={4} />
          </View>
          <View style={styles.inboxTrailing}>
            <Skeleton width={20} height={20} circle />
            <Skeleton width={28} height={20} radius={radius.pill} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surfaceStrong,
  },
  list: {
    gap: spacing.md,
  },
  stack: {
    gap: spacing.xl,
  },
  rowCard: {
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
  rowDivided: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  rowTitleLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  inboxTrailing: {
    alignSelf: "stretch",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 2,
    paddingBottom: 1,
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  chatRowRight: {
    justifyContent: "flex-end",
  },
  heroCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    backgroundColor: colors.surfaceSubtle,
  },
  heroBody: {
    gap: 14,
    padding: spacing.lg,
  },
  countdownRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  actionPrimary: {
    flex: 1,
  },
  shortcutRow: {
    flexDirection: "row",
    gap: spacing.sm + 2,
  },
  shortcutCard: {
    width: 132,
    gap: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    padding: 14,
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
    gap: spacing.md,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  orderDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  passCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.xl - 2,
    overflow: "hidden",
  },
  passHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: spacing.lg,
  },
  passStub: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  detailCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
    overflow: "hidden",
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    paddingVertical: 14,
  },
  featuredCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
  },
  featuredBody: {
    padding: 14,
    gap: 6,
  },
  watchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
});
