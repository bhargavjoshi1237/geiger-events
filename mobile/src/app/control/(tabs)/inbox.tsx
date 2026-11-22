import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown, LinearTransition } from "react-native-reanimated";

import { ScreenTitle } from "@/components/ScreenTitle";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { fmtCompactTime } from "@/lib/format";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { ControlThread } from "@/types/portal";

const POLL_MS = 15_000;
const STATUS_TABS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
];

const stagger = (i: number) => Math.min(i, 11) * 40;

export default function ControlInboxScreen() {
  const router = useRouter();
  const { project } = useControl();
  const [status, setStatus] = useState("open");
  const allowed = Boolean(project?.can.inbox);
  const path = project && allowed ? `/api/control/projects/${project.id}/threads?status=${status}` : null;
  const { data, error, reload } = useControlQuery<{ threads: ControlThread[] }>(path);
  const focused = useAppFocused();

  // The query already loads on focus, so the interval only adds the in-between refreshes.
  useEffect(() => {
    if (!focused || !path) return undefined;
    const timer = setInterval(() => void reload(), POLL_MS);
    return () => clearInterval(timer);
  }, [focused, path, reload]);

  const threads = data?.threads ?? [];

  return (
    <Screen scroll>
      <ScreenTitle title="Inbox" eyebrow={project?.name} />
      {!project ? (
        <EmptyState icon="briefcase" title="No project yet" message="Once you're on an event team, buyer messages show up here." />
      ) : !allowed ? (
        <EmptyState icon="lock" title="Your role can't see the inbox" message="Ask a project admin for access to Community." />
      ) : (
        <>
          <View style={styles.segment}>
            <Segmented options={STATUS_TABS} value={status} onChange={setStatus} />
          </View>
          {error && !data ? (
            <EmptyState icon="circle-alert" title="Couldn't load the inbox" message={error} actionLabel="Try again" onAction={() => void reload()} />
          ) : !data ? (
            <SkeletonList rows={6} variant="divided" />
          ) : !threads.length ? (
            status === "open" ? (
              <EmptyState
                icon="inbox"
                title="Inbox zero"
                message="Messages from buyers land here. You can also reach everyone at an event from its Announce screen."
                actionLabel="Show closed"
                onAction={() => setStatus("closed")}
              />
            ) : (
              <EmptyState
                icon="inbox"
                title="No closed conversations"
                message="Conversations you close move here."
                actionLabel="Show open"
                onAction={() => setStatus("open")}
              />
            )
          ) : (
            <Animated.View layout={LinearTransition}>
              {threads.map((thread, idx) => (
                <Animated.View key={thread.id} entering={FadeInDown.delay(stagger(idx)).springify()} layout={LinearTransition}>
                  <ThreadRow
                    thread={thread}
                    last={idx === threads.length - 1}
                    onPress={() => router.push({ pathname: "/control/thread/[id]", params: { id: thread.id } })}
                  />
                </Animated.View>
              ))}
            </Animated.View>
          )}
        </>
      )}
    </Screen>
  );
}

function ThreadRow({ thread, last, onPress }: { thread: ControlThread; last: boolean; onPress: () => void }) {
  const who = thread.name || thread.email || "Buyer";
  const context = [thread.subject, thread.eventName].filter(Boolean).join(" · ");
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${who}, ${thread.subject}${thread.unread ? ", unread" : ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.row, !last && styles.rowDivided, pressed && styles.pressed]}
    >
      <Avatar name={thread.name} email={thread.email} size={44} shape="square" />
      <View style={styles.stack}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, thread.unread && styles.titleUnread]} numberOfLines={1}>
            {who}
          </Text>
          <Text style={styles.time}>{fmtCompactTime(thread.lastMessageAt)}</Text>
        </View>
        {context ? (
          <Text style={styles.context} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
        {thread.preview ? (
          <Text style={styles.preview} numberOfLines={1}>
            {thread.preview}
          </Text>
        ) : null}
      </View>
      {thread.unread ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  segment: {
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
  context: {
    ...type.captionStrong,
    color: colors.textSecondary,
  },
  preview: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.mutedForeground,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
});
