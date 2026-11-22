import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatComposer } from "@/components/ChatComposer";
import { MessageBubble } from "@/components/MessageBubble";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { EmptyState } from "@/components/ui/EmptyState";
import { IconButton } from "@/components/ui/IconButton";
import { Icon } from "@/components/ui/icons";
import { IconTile } from "@/components/ui/IconTile";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ChatMessage, ControlConversation } from "@/types/portal";

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

  const subtitle = thread ? [thread.subject, thread.eventName, closed ? "Closed" : ""].filter(Boolean).join(" · ") : undefined;

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
              <IconButton
                icon={closed ? "rotate-ccw" : "circle-check"}
                label={closed ? "Reopen conversation" : "Close conversation"}
                variant="plain"
                onPress={() => void toggleStatus()}
              />
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
            {thread.orderId && project?.can.orders ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="View order"
                onPress={() => router.push({ pathname: "/control/order/[id]", params: { id: thread.orderId as string } })}
                style={({ pressed }) => [styles.context, pressed && styles.pressed]}
              >
                <IconTile icon="receipt" size={38} />
                <View style={styles.contextStack}>
                  <Text style={styles.contextName} numberOfLines={1}>
                    View order
                  </Text>
                  <Text style={styles.contextMeta} numberOfLines={1}>
                    {thread.eventName || thread.email}
                  </Text>
                </View>
                <Icon name="chevron-right" size={17} color={colors.textTertiary} />
              </Pressable>
            ) : null}

            {reversed.length ? (
              <FlatList
                style={styles.flex}
                data={reversed}
                inverted
                keyExtractor={(m) => m.id}
                renderItem={({ item, index }) => (
                  <View style={styles.messageRow}>
                    <MessageBubble message={item} isOwn={item.authorKey === "organiser"} grouped={isGrouped(item, index)} />
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <View style={styles.emptyList}>
                <Text style={styles.emptyText}>No messages yet.</Text>
              </View>
            )}

            <ChatComposer onSend={onSend} placeholder={closed ? "Reply to reopen…" : "Reply…"} />
          </>
        )}
      </KeyboardAvoidingView>
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
  context: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    paddingVertical: spacing.md,
    paddingHorizontal: 14,
    marginTop: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  contextStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  contextName: {
    ...type.captionStrong,
    fontSize: 13,
    color: colors.foreground,
  },
  contextMeta: {
    ...type.caption,
    color: colors.textTertiary,
  },
  messageRow: {
    paddingVertical: spacing.xs,
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
  },
});
