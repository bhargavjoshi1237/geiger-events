import { useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtCompactTime } from "@/lib/format";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { NotificationItem } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function NotificationsScreen() {
  const { notifications, loading, markNotificationsRead } = usePortalData();

  useFocusEffect(
    useCallback(() => {
      if (notifications.unread > 0) void markNotificationsRead();
    }, [notifications.unread, markNotificationsRead]),
  );

  return (
    <Screen scroll>
      <ScreenHeader title="Updates" subtitle="Announcements from your organisers" />

      {loading.notifications && !notifications.items.length ? (
        <SkeletonList rows={4} />
      ) : notifications.items.length ? (
        <Animated.View layout={LinearTransition} style={styles.list}>
          {notifications.items.map((n, idx) => (
            <Animated.View
              key={n.id}
              entering={FadeInDown.delay(stagger(idx)).springify()}
              layout={LinearTransition}
            >
              <NotificationCard n={n} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : (
        <EmptyState
          icon="bell"
          title="Nothing yet"
          message="Gate changes, schedule updates and refund news will show up here."
        />
      )}
    </Screen>
  );
}

function NotificationCard({ n }: { n: NotificationItem }) {
  return (
    <View style={[styles.card, n.unread && styles.cardUnread]}>
      <IconTile icon="volume-2" size={44} />
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={2}>
            {n.title}
          </Text>
          <Text style={styles.time}>{fmtCompactTime(n.createdAt)}</Text>
        </View>
        {n.body ? (
          <Text style={styles.body} numberOfLines={5}>
            {n.body}
          </Text>
        ) : null}
        {n.channel ? <Text style={styles.channel}>{n.channel}</Text> : null}
      </View>
      {n.unread ? <View style={styles.dot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
  },
  cardUnread: {
    backgroundColor: colors.surfaceCard,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 5,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  title: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  time: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
  body: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 19,
    color: colors.mutedForeground,
  },
  channel: {
    ...type.micro,
    fontSize: 11,
    color: colors.textTertiary,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
