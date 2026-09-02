import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtCompactTime } from "@/lib/format";
import { THREAD_STATUS, statusPill } from "@/lib/status";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Thread } from "@/types/portal";

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function MessagesScreen() {
  const router = useRouter();
  const { threads, loading } = usePortalData();

  return (
    <Screen scroll>
      <ScreenHeader
        title="Organiser"
        subtitle="Direct threads about your orders"
        right={
          <IconButton
            icon="square-pen"
            label="New message"
            variant="primary"
            iconSize={20}
            onPress={() => router.push("/messages/new")}
          />
        }
      />

      {loading.threads && threads === null ? (
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
          message="Reach out to an organiser about any order — replies land here and in your inbox."
          actionLabel="New message"
          onAction={() => router.push("/messages/new")}
        />
      )}
    </Screen>
  );
}

function ThreadRow({ t, onPress }: { t: Thread; onPress: () => void }) {
  const pill = statusPill(THREAD_STATUS, t.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t.unread ? `${t.subject}, unread` : t.subject}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <Avatar name={t.subject} size={40} shape="square" />
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={[styles.subject, t.unread && styles.subjectUnread]} numberOfLines={1}>
            {t.subject}
          </Text>
          <Text style={styles.time}>{fmtCompactTime(t.lastMessageAt)}</Text>
        </View>
        {t.preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {t.preview}
          </Text>
        ) : null}
        <Pill label={pill.label} tone={pill.tone} />
      </View>
      {t.unread ? <View style={styles.dot} /> : null}
    </Pressable>
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
  subject: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    color: colors.foreground,
  },
  subjectUnread: {
    ...type.bodyStrong,
    flex: 1,
  },
  time: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
  preview: {
    ...type.caption,
    fontSize: 13,
    color: colors.mutedForeground,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
});
