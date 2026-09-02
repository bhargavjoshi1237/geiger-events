import { useRouter } from "expo-router";
import type { Href } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { Icon, type IconName } from "@/components/ui/icons";
import { ScreenTitle } from "@/components/ScreenTitle";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtCompactTime } from "@/lib/format";
import { tapFeedback } from "@/lib/haptics";
import { usePoll } from "@/lib/use_poll";
import { usePortalData } from "@/state/data";
import { colors, radius, spacing, type } from "@/theme/tokens";

const stagger = (i: number) => Math.min(i, 11) * 40;
const POLL_MS = 20_000;

type Source = "organiser" | "updates" | "chats";

type Tag = {
  label: string;
  icon: IconName;
  tone: "neutral" | "success" | "info";
};

type InboxItem = {
  key: string;
  source: Source;
  title: string;
  preview: string;
  at: string | null;
  unread: number;
  dot: boolean;
  href: Href | null;
  avatar?: string;
  icon?: IconName;
  tag?: Tag;
};

export default function InboxScreen() {
  const router = useRouter();
  const {
    data,
    threads,
    notifications,
    channels,
    qaChannels,
    loading,
    counts,
    refreshChannels,
  } = usePortalData();
  const [filter, setFilter] = useState<"all" | Source>("all");

  usePoll(refreshChannels, POLL_MS, true);

  const items = useMemo<InboxItem[]>(() => {
    const orderCode = new Map((data?.orders || []).map((o) => [o.id, o.orderCode]));

    const fromThreads: InboxItem[] = (threads || []).map((t) => ({
      key: `thread:${t.id}`,
      source: "organiser",
      title: t.subject || "Organiser",
      preview: t.preview || "",
      at: t.lastMessageAt,
      unread: t.unread ? 1 : 0,
      dot: t.unread,
      href: `/messages/${t.id}` as Href,
      avatar: t.subject,
      tag:
        t.orderId && orderCode.get(t.orderId)
          ? { label: orderCode.get(t.orderId) as string, icon: "file-text", tone: "neutral" }
          : undefined,
    }));

    const fromNotifications: InboxItem[] = (notifications.items || []).map((n) => ({
      key: `note:${n.id}`,
      source: "updates",
      title: n.title,
      preview: n.body || "",
      at: n.createdAt,
      unread: n.unread ? 1 : 0,
      dot: n.unread,
      href: "/notifications" as Href,
      icon: "volume-2",
    }));

    const fromChannels: InboxItem[] = [
      ...(channels || []).map((c) => ({ c, base: "/community" })),
      ...(qaChannels || []).map((c) => ({ c, base: "/qa" })),
    ].map(({ c, base }) => ({
      key: `chan:${c.id}`,
      source: "chats" as const,
      title: c.name,
      preview: c.lastPreview || c.topic || "",
      at: c.lastMessageAt,
      unread: c.unread || 0,
      dot: false,
      href: `${base}/${c.id}` as Href,
      avatar: c.name,
      tag:
        c.postingMode === "announce"
          ? { label: "Announce only", icon: "volume-2" as const, tone: "info" as const }
          : c.participantCount > 0
            ? {
                label: `Group chat · ${c.participantCount}`,
                icon: "users" as const,
                tone: "success" as const,
              }
            : undefined,
    }));

    return [...fromThreads, ...fromNotifications, ...fromChannels].sort(
      (a, b) => new Date(b.at || 0).getTime() - new Date(a.at || 0).getTime(),
    );
  }, [data, threads, notifications, channels, qaChannels]);

  const visible = filter === "all" ? items : items.filter((i) => i.source === filter);
  const first = loading.threads || loading.notifications || loading.channels;
  const empty = threads === null && channels === null && !notifications.items.length;

  return (
    <Screen scroll>
      <ScreenTitle
        title="Inbox"
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

      <View style={styles.filters}>
        <FilterChips
          value={filter}
          onChange={(v) => setFilter(v as "all" | Source)}
          options={[
            { value: "all", label: "All", count: counts.inbox },
            { value: "organiser", label: "Organiser", count: counts.messages },
            { value: "updates", label: "Updates", count: counts.notifications },
            { value: "chats", label: "Chats", count: counts.chats },
          ]}
        />
      </View>

      {first && empty ? (
        <SkeletonList rows={5} />
      ) : !items.length ? (
        <EmptyState
          icon="inbox"
          title="Nothing here yet"
          message="Organiser replies, event announcements and group chats all land in this one list."
          actionLabel="Message an organiser"
          onAction={() => router.push("/messages/new")}
        />
      ) : !visible.length ? (
        <EmptyState
          icon="funnel"
          title="Nothing in this filter"
          message="Switch back to All to see everything in your inbox."
          actionLabel="Show all"
          onAction={() => setFilter("all")}
        />
      ) : (
        <Animated.View layout={LinearTransition}>
          {visible.map((item, idx) => (
            <Animated.View
              key={item.key}
              entering={FadeInDown.delay(stagger(idx)).springify()}
              layout={LinearTransition}
            >
              <InboxRow
                item={item}
                last={idx === visible.length - 1}
                onPress={() => {
                  if (!item.href) return;
                  tapFeedback();
                  router.push(item.href);
                }}
              />
            </Animated.View>
          ))}
        </Animated.View>
      )}
    </Screen>
  );
}

const TAG_TINTS = {
  neutral: colors.textSecondary,
  success: colors.success,
  info: colors.info,
} as const;

function InboxRow({
  item,
  last,
  onPress,
}: {
  item: InboxItem;
  last: boolean;
  onPress: () => void;
}) {
  const unreadish = item.unread > 0 || item.dot;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={
        item.unread > 0 ? `${item.title}, ${item.unread} unread` : item.title
      }
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivided, pressed && styles.pressed]}
    >
      {item.icon ? (
        <IconTile icon={item.icon} size={44} />
      ) : (
        <Avatar name={item.avatar} size={44} shape="square" />
      )}

      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text
            style={[styles.title, unreadish && styles.titleUnread]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          <Text style={styles.time}>{fmtCompactTime(item.at)}</Text>
        </View>
        {item.preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {item.preview}
          </Text>
        ) : null}
        {item.tag ? (
          <View
            style={[
              styles.tag,
              item.tag.tone === "neutral"
                ? styles.tagNeutral
                : {
                    backgroundColor: `${TAG_TINTS[item.tag.tone]}1A`,
                    borderColor: `${TAG_TINTS[item.tag.tone]}40`,
                  },
            ]}
          >
            <Icon name={item.tag.icon} size={11} color={TAG_TINTS[item.tag.tone]} />
            <Text style={[styles.tagText, { color: TAG_TINTS[item.tag.tone] }]} numberOfLines={1}>
              {item.tag.label}
            </Text>
          </View>
        ) : null}
      </View>

      {item.unread > 1 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.unread > 99 ? "99+" : item.unread}</Text>
        </View>
      ) : unreadish ? (
        <View style={styles.dot} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  filters: {
    marginBottom: spacing.md + 2,
  },
  pressed: {
    opacity: 0.65,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: 14,
  },
  rowDivided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  stack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.sm,
  },
  title: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    color: colors.foreground,
  },
  titleUnread: {
    ...type.bodyStrong,
    flex: 1,
    color: colors.foreground,
  },
  time: {
    ...type.caption,
    fontSize: 11,
    color: colors.textTertiary,
  },
  preview: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  tag: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: radius.pill,
    paddingVertical: 3,
    paddingHorizontal: spacing.sm,
    marginTop: 1,
  },
  tagNeutral: {
    backgroundColor: colors.surfaceActive,
    borderColor: colors.surfaceActive,
    borderRadius: radius.sm - 2,
  },
  tagText: {
    ...type.micro,
    fontSize: 10,
    lineHeight: 13,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  badge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    marginTop: 2,
  },
  badgeText: {
    ...type.micro,
    fontSize: 11,
    lineHeight: 14,
    color: colors.primaryForeground,
    fontVariant: ["tabular-nums"],
  },
});
