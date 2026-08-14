import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { SkeletonList } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { fmtTimeAgo } from "@/lib/format";
import { usePoll } from "@/lib/use_poll";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { Channel } from "@/types/portal";

type ChannelListProps = {
  kind: string;
  emptyTitle: string;
  emptyMessage: string;
  routeBase: string;
};

const stagger = (i: number) => Math.min(i, 11) * 40;
const POLL_MS = 15_000;

// The shared event-channel / Q&A channel list. Polls while focused so unread
// counts and previews stay fresh; the route files are thin wrappers over this.
export function ChannelList({ kind, emptyTitle, emptyMessage, routeBase }: ChannelListProps) {
  const router = useRouter();
  const { token } = useSession();
  const [channels, setChannels] = useState<Channel[] | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<{ channels: Channel[] }>(`/api/portal/chat/channels?kind=${kind}`, { token });
    setChannels(res.ok ? res.data.channels : []);
  }, [kind, token]);

  usePoll(load, POLL_MS, true);

  if (channels === null) return <SkeletonList rows={4} />;
  if (!channels.length) {
    return <EmptyState icon="message-circle" title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <Animated.View layout={LinearTransition} style={styles.list}>
      {channels.map((c, idx) => (
        <Animated.View
          key={c.id}
          entering={FadeInDown.delay(stagger(idx)).springify()}
          layout={LinearTransition}
        >
          <Card onPress={() => router.push(`${routeBase}/${c.id}`)} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.stack}>
                <View style={styles.titleRow}>
                  {c.postingMode === "announce" ? (
                    <Feather name="volume-2" size={13} color={colors.textTertiary} />
                  ) : null}
                  <Text style={styles.name} numberOfLines={1}>
                    {c.name}
                  </Text>
                </View>
                {c.topic ? (
                  <Text style={styles.topic} numberOfLines={1}>
                    {c.topic}
                  </Text>
                ) : null}
                {c.lastPreview ? (
                  <Text style={styles.preview} numberOfLines={1}>
                    {c.lastPreview}
                  </Text>
                ) : null}
              </View>
              <View style={styles.trailing}>
                {c.unread > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{c.unread > 99 ? "99+" : c.unread}</Text>
                  </View>
                ) : null}
                <Text style={styles.time}>{fmtTimeAgo(c.lastMessageAt)}</Text>
              </View>
            </View>
          </Card>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  name: {
    flex: 1,
    ...type.label,
    fontWeight: "600",
    color: colors.foreground,
  },
  topic: {
    ...type.caption,
    color: colors.textSecondary,
  },
  preview: {
    ...type.caption,
    color: colors.textTertiary,
    marginTop: 2,
  },
  trailing: {
    alignItems: "flex-end",
    gap: spacing.sm,
  },
  badge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xs + 2,
  },
  badgeText: {
    ...type.caption,
    fontSize: 10,
    fontWeight: "700",
    color: colors.primaryForeground,
    fontVariant: ["tabular-nums"],
  },
  time: {
    ...type.caption,
    fontSize: 10,
    color: colors.textTertiary,
  },
});
