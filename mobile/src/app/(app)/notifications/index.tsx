import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  LinearTransition,
  useSharedValue,
} from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtTimeAgo } from "@/lib/format";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { NotificationItem } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function NotificationsScreen() {
  const { notifications, loading, refreshing, refreshAll, markNotificationsRead } = usePortalData();
  const scrollY = useSharedValue(0);

  // Mark the feed read the moment the member opens it, once.
  useFocusEffect(
    useCallback(() => {
      if (notifications.unread > 0) void markNotificationsRead();
    }, [notifications.unread, markNotificationsRead]),
  );

  return (
    <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
      <ScreenHeader
        title="Notifications"
        subtitle="Updates and announcements from the events you're attending."
        scrollY={scrollY}
      />

      {loading.notifications ? (
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
          message="Updates from organisers will show up here."
        />
      )}
    </Screen>
  );
}

function NotificationCard({ n }: { n: NotificationItem }) {
  return (
    <Card style={n.unread ? styles.unreadCard : undefined}>
      <View style={styles.row}>
        <View style={styles.iconTile}>
          <Feather name="bell" size={16} color={colors.mutedForeground} />
        </View>
        <View style={styles.stack}>
          <View style={styles.titleRow}>
            {n.unread ? (
              <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(200)} style={styles.dot} />
            ) : null}
            <Text style={styles.title} numberOfLines={2}>
              {n.title}
            </Text>
          </View>
          {n.body ? (
            <Text style={styles.body} numberOfLines={4}>
              {n.body}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            {n.channel ? <Pill label={n.channel} tone="neutral" /> : null}
            <Text style={styles.time}>{fmtTimeAgo(n.createdAt)}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  unreadCard: {
    backgroundColor: `${colors.primary}0D`,
    borderColor: `${colors.primary}4D`,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  iconTile: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  title: {
    ...type.label,
    flex: 1,
    color: colors.foreground,
  },
  body: {
    ...type.caption,
    color: colors.mutedForeground,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: 2,
  },
  time: {
    ...type.caption,
    color: colors.textTertiary,
  },
});
