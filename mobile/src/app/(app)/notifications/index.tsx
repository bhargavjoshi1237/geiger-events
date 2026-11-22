import { useFocusEffect, useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useCallback } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconTile } from "@/components/ui/IconTile";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtCompactTime } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { appRoute } from "@/lib/push";
import { notificationIcon } from "@/lib/push_catalog";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { NotificationItem } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function NotificationsScreen() {
  const router = useRouter();
  const { notifications, loading, markNotificationsRead } = usePortalData();

  useFocusEffect(
    useCallback(() => {
      if (notifications.unread > 0) void markNotificationsRead();
    }, [notifications.unread, markNotificationsRead]),
  );

  return (
    <Screen scroll>
      <ScreenHeader title="Updates" subtitle="Tickets, reminders, messages and announcements" />

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
              <NotificationCard n={n} onOpen={(route) => router.push(route as Href)} />
            </Animated.View>
          ))}
        </Animated.View>
      ) : (
        <EmptyState
          icon="geiger"
          title="Nothing yet"
          message="Order news, event changes and organiser messages will show up here."
          actionLabel="Notification settings"
          onAction={() => router.push("/account/notifications" as Href)}
        />
      )}
    </Screen>
  );
}

function NotificationCard({
  n,
  onOpen,
}: {
  n: NotificationItem;
  onOpen: (route: string) => void;
}) {
  const linked = appRoute(n.route);
  // Announcements and meetings point back at this feed, so they stay plain cards.
  const route = linked && linked.split(/[?#]/)[0] !== "/notifications" ? linked : null;
  const body = (
    <>
      <IconTile icon={notificationIcon(n.kind)} size={44} />
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
    </>
  );

  if (!route) return <View style={[styles.card, n.unread && styles.cardUnread]}>{body}</View>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={n.unread ? `${n.title}, unread` : n.title}
      onPress={() => {
        tapFeedback();
        onOpen(route);
      }}
      style={({ pressed }) => [styles.card, n.unread && styles.cardUnread, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
    marginTop: spacing.md,
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
  pressed: {
    opacity: 0.7,
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
