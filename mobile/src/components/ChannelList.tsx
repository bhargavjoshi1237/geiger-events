import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Icon } from "@/components/ui/icons";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtCompactTime } from "@/lib/format";
import { usePoll } from "@/lib/use_poll";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";

type ChannelListProps = {
  kind: "event" | "qa";
  emptyTitle: string;
  emptyMessage: string;
  routeBase: string;
};

const stagger = (i: number) => Math.min(i, 11) * 40;
const POLL_MS = 15_000;

export function ChannelList({ kind, emptyTitle, emptyMessage, routeBase }: ChannelListProps) {
  const router = useRouter();
  const { channels, qaChannels, refreshChannels } = usePortalData();

  usePoll(refreshChannels, POLL_MS, true);

  const list = kind === "qa" ? qaChannels : channels;

  if (list === null) return <SkeletonList rows={4} />;
  if (!list.length) {
    return <EmptyState icon="message-circle" title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <Animated.View layout={LinearTransition} style={styles.list}>
      {list.map((c, idx) => {
        const announce = c.postingMode === "announce";
        return (
          <Animated.View
            key={c.id}
            entering={FadeInDown.delay(stagger(idx)).springify()}
            layout={LinearTransition}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c.unread ? `${c.name}, ${c.unread} unread` : c.name}
              onPress={() => router.push(`${routeBase}/${c.id}` as Href)}
              style={({ pressed }) => [styles.card, pressed && styles.pressed]}
            >
              <Avatar name={c.name} size={40} shape="square" />
              <View style={styles.stack}>
                <View style={styles.titleRow}>
                  <Text style={styles.name} numberOfLines={1}>
                    {c.name}
                  </Text>
                  <View
                    style={[styles.badge, announce ? styles.badgeInfo : styles.badgeSuccess]}
                  >
                    <Icon
                      name={announce ? "volume-2" : "users"}
                      size={10}
                      color={announce ? colors.info : colors.success}
                    />
                    <Text
                      style={[
                        styles.badgeText,
                        { color: announce ? colors.info : colors.success },
                      ]}
                    >
                      {announce ? "Announce" : c.participantCount || "Open"}
                    </Text>
                  </View>
                </View>
                <Text style={styles.preview} numberOfLines={1}>
                  {c.lastPreview || c.topic || "No messages yet"}
                </Text>
              </View>
              <View style={styles.trailing}>
                <Text style={styles.time}>{fmtCompactTime(c.lastMessageAt)}</Text>
                {c.unread > 0 ? (
                  <View style={styles.unread}>
                    <Text style={styles.unreadText}>{c.unread > 99 ? "99+" : c.unread}</Text>
                  </View>
                ) : (
                  <View style={styles.messageCount}>
                    <Icon name="message-square" size={12} color={colors.textTertiary} />
                    <Text style={styles.messageCountText}>{c.messageCount}</Text>
                  </View>
                )}
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
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
  pressed: {
    opacity: 0.7,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    ...type.bodyStrong,
    flexShrink: 1,
    color: colors.foreground,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 2,
    paddingHorizontal: 7,
  },
  badgeSuccess: {
    backgroundColor: `${colors.success}1A`,
    borderColor: `${colors.success}40`,
  },
  badgeInfo: {
    backgroundColor: `${colors.info}1A`,
    borderColor: `${colors.info}40`,
  },
  badgeText: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
  },
  preview: {
    ...type.caption,
    fontSize: 13,
    color: colors.textSecondary,
  },
  trailing: {
    alignItems: "flex-end",
    gap: 6,
  },
  time: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
  unread: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
  },
  unreadText: {
    ...type.micro,
    fontSize: 11,
    lineHeight: 14,
    color: colors.primaryForeground,
    fontVariant: ["tabular-nums"],
  },
  messageCount: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  messageCountText: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
    fontVariant: ["tabular-nums"],
  },
});
