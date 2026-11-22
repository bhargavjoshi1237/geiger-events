import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatComposer } from "@/components/ChatComposer";
import { dayLabel, localDay } from "@/components/control/money/ledger";
import { StatusButton } from "@/components/control/StatusButton";
import { MessageBubble } from "@/components/MessageBubble";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { statusPill, THREAD_STATUS } from "@/lib/status";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { ChatMessage, ControlConversation, ControlThread } from "@/types/portal";

const POLL_MS = 5_000;
const GROUP_MS = 5 * 60 * 1000;

type Pending = { id: string; body: string; createdAt: string };

// MessageBubble labels thread messages "Organiser"; as chat messages the buyer's side carries their own name.
function asBubble(m: { id: string; sender: string; body: string; createdAt: string | null }, buyer: string): ChatMessage {
  return {
    id: m.id,
    channelId: "",
    authorKey: m.sender,
    authorName: m.sender === "organiser" ? "You" : buyer,
    senderKind: m.sender,
    text: m.body,
    reactions: {},
    replyTo: null,
    type: "text",
    poll: null,
    deleted: false,
    createdAt: m.createdAt,
  };
}

export default function ControlThreadScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { project } = useControl();
  const { error: toastError } = useToast();
  const path = `/api/control/threads/${id}`;
  const { data, error, reload, setData } = useControlQuery<ControlConversation>(path);
  const [pending, setPending] = useState<Pending | null>(null);
  const [toggling, setToggling] = useState(false);
  const focused = useAppFocused();

  // Each write bumps the sequence, so a poll that started before a reply or close can't land after it and undo it.
  const seq = useRef(0);
  const writing = useRef(false);
  const poll = useCallback(async () => {
    if (writing.current) return;
    const ticket = ++seq.current;
    const res = await controlApi<ControlConversation>(path);
    if (res.ok && ticket === seq.current && !writing.current) setData(res.data);
  }, [path, setData]);

  useEffect(() => {
    if (!focused) return undefined;
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [focused, poll]);

  const thread = data?.thread;
  const buyer = thread?.name || thread?.email || "Buyer";
  const closed = thread?.status === "closed";

  const reversed = useMemo(() => {
    const list = (data?.messages ?? []).map((m) => asBubble(m, buyer));
    if (pending) list.push(asBubble({ ...pending, sender: "organiser" }, buyer));
    return list.reverse();
  }, [data, pending, buyer]);

  // A message opens a new day when the one before it (next in the reversed list) fell on another day.
  const opensDay = useCallback(
    (m: ChatMessage, i: number) => {
      const older = reversed[i + 1];
      return Boolean(m.createdAt) && (!older || localDay(older.createdAt) !== localDay(m.createdAt));
    },
    [reversed],
  );

  const isGrouped = useCallback(
    (m: ChatMessage, i: number) => {
      const older = reversed[i + 1];
      if (!older || older.authorKey !== m.authorKey) return false;
      const a = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const b = older.createdAt ? new Date(older.createdAt).getTime() : 0;
      return a > 0 && b > 0 && a - b <= GROUP_MS;
    },
    [reversed],
  );

  const onSend = useCallback(
    async (text: string): Promise<boolean> => {
      setPending({ id: `temp-${Date.now()}`, body: text, createdAt: new Date().toISOString() });
      writing.current = true;
      seq.current += 1;
      const res = await controlApi<ControlConversation>(path, { method: "POST", body: { body: text } });
      writing.current = false;
      setPending(null);
      if (res.ok) {
        setData(res.data);
        return true;
      }
      errorFeedback();
      toastError(res.error);
      return false;
    },
    [path, setData, toastError],
  );

  const toggleStatus = async () => {
    if (!thread || toggling) return;
    setToggling(true);
    writing.current = true;
    seq.current += 1;
    const res = await controlApi<ControlConversation>(path, { method: "PATCH", body: { status: closed ? "open" : "closed" } });
    writing.current = false;
    setToggling(false);
    if (!res.ok) {
      errorFeedback();
      toastError(res.error);
      return;
    }
    successFeedback();
    setData(res.data);
  };

  const openOrder = thread?.orderId && project?.can.orders ? () => router.push({ pathname: "/control/order/[id]", params: { id: thread.orderId as string } }) : undefined;
  const subtitle = thread ? [thread.subject, thread.eventName, closed ? "Closed" : ""].filter(Boolean).join(" · ") : undefined;
  const intro = thread ? <ThreadIntro thread={thread} buyer={buyer} count={data?.messages.length ?? 0} onOpenOrder={openOrder} /> : null;

  return (
    // No tab bar on pushed Control screens, so this frame skips Screen's tab-bar clearance and sits the composer on the inset.
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.sm }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader
          title={thread ? buyer : "Conversation"}
          subtitle={subtitle}
          leading={thread ? <Avatar name={thread.name} email={thread.email} size={36} shape="square" /> : undefined}
          right={
            thread ? (
              <>
                {openOrder ? <IconButton icon="receipt" label="View order" variant="plain" onPress={openOrder} /> : null}
                <IconButton
                  icon={closed ? "rotate-ccw" : "circle-check"}
                  label={closed ? "Reopen conversation" : "Close conversation"}
                  variant="plain"
                  onPress={() => void toggleStatus()}
                />
              </>
            ) : undefined
          }
          bordered
        />

        {error && !data ? (
          <EmptyState icon="circle-alert" title="Couldn't open this conversation" message={error} actionLabel="Try again" onAction={() => void reload()} />
        ) : !data || !thread ? (
          <SkeletonList rows={5} variant="chat" />
        ) : (
          <>
            {reversed.length ? (
              <FlatList
                style={styles.flex}
                data={reversed}
                inverted
                keyExtractor={(m) => m.id}
                renderItem={({ item, index }) => {
                  const newDay = opensDay(item, index);
                  return (
                    <View style={styles.messageRow}>
                      {newDay ? <DayRule label={dayLabel(item.createdAt)} /> : null}
                      <MessageBubble message={item} isOwn={item.authorKey === "organiser"} grouped={!newDay && isGrouped(item, index)} />
                    </View>
                  );
                }}
                // Inverted, so the footer sits above the oldest message: the conversation opens with who and what it's about.
                ListFooterComponent={intro}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <View style={styles.flex}>
                {intro}
                <View style={styles.emptyList}>
                  <Text style={styles.emptyText}>No messages yet. Your reply starts the conversation.</Text>
                </View>
              </View>
            )}

            <ChatComposer onSend={onSend} placeholder={closed ? "Reply to reopen…" : "Reply…"} />
          </>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

// The head of the conversation: who wrote in, where it stands, and the event and order it's about.
function ThreadIntro({ thread, buyer, count, onOpenOrder }: { thread: ControlThread; buyer: string; count: number; onOpenOrder?: () => void }) {
  const status = statusPill(THREAD_STATUS, thread.status);
  const hasContext = Boolean(thread.eventName) || Boolean(onOpenOrder);
  return (
    <Animated.View entering={FadeInDown.springify()} style={styles.intro}>
      <View style={styles.introHead}>
        <Avatar name={thread.name} email={thread.email} size={56} shape="square" />
        <View style={styles.introText}>
          <Text style={styles.introName} numberOfLines={2}>
            {buyer}
          </Text>
          {thread.name && thread.email ? (
            <Text style={styles.introEmail} numberOfLines={1}>
              {thread.email}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.metaRow}>
        <StatusButton label={status.label} tone={status.tone} />
        <Text style={styles.metaMono}>{`${count} ${pluralize(count, "message", "messages")}`}</Text>
      </View>
      {thread.subject ? <Text style={styles.subject}>{thread.subject}</Text> : null}
      {hasContext ? (
        <ListGroup>
          {thread.eventName ? <ListRow leading={<IconTile icon="calendar" size={36} />} title={thread.eventName} subtitle="The event this is about" divider={Boolean(onOpenOrder)} /> : null}
          {onOpenOrder ? (
            <ListRow leading={<IconTile icon="receipt" size={36} />} title="View order" subtitle="Tickets, refunds and the order timeline" onPress={onOpenOrder} divider={false} />
          ) : null}
        </ListGroup>
      ) : null}
    </Animated.View>
  );
}

function DayRule({ label }: { label: string }) {
  return (
    <View style={styles.dayRule} accessibilityRole="header" accessibilityLabel={label}>
      <View style={styles.dayLine} />
      <Text style={styles.dayText}>{label}</Text>
      <View style={styles.dayLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  flex: {
    flex: 1,
  },
  intro: {
    gap: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  introHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md + 2,
  },
  introText: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  introName: {
    ...type.title,
    color: colors.foreground,
  },
  introEmail: {
    ...type.caption,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm + 2,
  },
  metaMono: {
    ...type.monoSmall,
    color: colors.textSecondary,
  },
  subject: {
    ...type.heading,
    color: colors.foreground,
  },
  messageRow: {
    paddingVertical: spacing.xs,
  },
  dayRule: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  dayLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.surfaceHover,
  },
  dayText: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: colors.textTertiary,
  },
  listContent: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  emptyList: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    ...type.caption,
    color: colors.textTertiary,
    textAlign: "center",
  },
});
