import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition, useSharedValue } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ScreenHeader } from "@/components/ScreenHeader";
import { TAB_BAR_HEIGHT } from "@/components/TabBar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtTimeAgo } from "@/lib/format";
import { THREAD_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Thread } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function MessagesScreen() {
  const router = useRouter();
  const { threads, loading, refreshing, refreshAll } = usePortalData();
  const scrollY = useSharedValue(0);
  const insets = useSafeAreaInsets();
  const fabBottom = insets.bottom + TAB_BAR_HEIGHT + spacing.lg;

  return (
    <View style={styles.wrap}>
      <Screen scroll refreshing={refreshing} onRefresh={refreshAll} onScroll={(y) => (scrollY.value = y)}>
        <ScreenHeader
          title="Messages"
          subtitle="Questions about an event or order? Chat directly with the organiser."
          scrollY={scrollY}
        />
        {loading.threads ? (
          <SkeletonList rows={4} />
        ) : threads?.length ? (
          <Animated.View layout={LinearTransition} style={styles.list}>
            {threads.map((t, idx) => (
              <Animated.View
                key={t.id}
                entering={FadeInDown.delay(stagger(idx)).springify()}
                layout={LinearTransition}
              >
                <ThreadRow t={t} onPress={() => router.push(`/messages/${t.id}`)} />
              </Animated.View>
            ))}
          </Animated.View>
        ) : (
          <EmptyState
            icon="mail"
            title="No messages"
            message="Reach out to an organiser about any order."
            actionLabel="New message"
            onAction={() => router.push("/messages/new")}
          />
        )}
      </Screen>

      {/* Floating composer entry, above the tab bar. */}
      <Animated.View
        entering={FadeInDown.delay(120).springify()}
        style={[styles.fab, { bottom: fabBottom }]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New message"
          onPress={() => router.push("/messages/new")}
          style={styles.fabBtn}
          hitSlop={4}
        >
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

function ThreadRow({ t, onPress }: { t: Thread; onPress: () => void }) {
  const pill = statusPill(THREAD_STATUS, t.status);
  return (
    <Card onPress={onPress} style={styles.rowCard}>
      <View style={styles.row}>
        <View style={styles.stack}>
          <View style={styles.titleRow}>
            {t.unread ? <View style={styles.unreadDot} /> : null}
            <Text style={[styles.subject, t.unread && styles.subjectUnread]} numberOfLines={1}>
              {t.subject}
            </Text>
          </View>
          {t.preview ? (
            <Text style={styles.preview} numberOfLines={1}>
              {t.preview}
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            <Pill label={pill.label} tone={pill.tone} />
            <Text style={styles.time}>{fmtTimeAgo(t.lastMessageAt)}</Text>
          </View>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
  },
  list: {
    gap: spacing.md,
  },
  rowCard: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.primary,
  },
  subject: {
    flex: 1,
    ...type.label,
    fontWeight: "600",
    color: colors.foreground,
  },
  subjectUnread: {
    fontWeight: "700",
  },
  preview: {
    ...type.caption,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  time: {
    ...type.caption,
    fontSize: 10,
    color: colors.textTertiary,
  },
  fab: {
    position: "absolute",
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    shadowColor: colors.background,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  fabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
