import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import { ChatComposer } from "@/components/ChatComposer";
import { MessageBubble } from "@/components/MessageBubble";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { tapFeedback } from "@/lib/haptics";
import { usePoll } from "@/lib/use_poll";
import { useSession } from "@/state/session";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { ChannelDetail, ChatMessage } from "@/types/portal";

type ChannelRoomProps = {
  channelId: string;
  routeBase: string;
};

const POLL_MS = 5_000;
const GROUP_MS = 5 * 60 * 1000;

// Merges the polled history into the existing one by id, keeping message object
// identity so the inverted list never flickers as new messages arrive.
function mergeMessages(prev: ChatMessage[], fresh: ChatMessage[]): ChatMessage[] {
  const byId = new Map(fresh.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const out = prev.map((m) => {
    seen.add(m.id);
    return byId.get(m.id) || m;
  });
  for (const m of fresh) if (!seen.has(m.id)) out.push(m);
  return out;
}

function replaceTemp(messages: ChatMessage[], tempId: string, real: ChatMessage): ChatMessage[] {
  const rest = messages.filter((m) => m.id !== tempId);
  const i = rest.findIndex((m) => m.id === real.id);
  if (i >= 0) rest[i] = real;
  else rest.push(real);
  return rest;
}

function upsertMessage(messages: ChatMessage[], m: ChatMessage): ChatMessage[] {
  const i = messages.findIndex((x) => x.id === m.id);
  if (i >= 0) {
    const next = [...messages];
    next[i] = m;
    return next;
  }
  return [...messages, m];
}

// The shared chat room for event channels and Q&A threads: an inverted message
// list, reactions/polls/replies, and a polling composer.
export function ChannelRoom({ channelId }: ChannelRoomProps) {
  const { token, member } = useSession();
  const { error: toastError } = useToast();
  const [channel, setChannel] = useState<ChannelDetail | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [reactingId, setReactingId] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
  const [sendBlocked, setSendBlocked] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<{ channel: ChannelDetail }>(
      `/api/portal/chat/channels/${channelId}`,
      { token },
    );
    if (res.ok) {
      setSendBlocked(false);
      setChannel((prev) =>
        prev
          ? { ...res.data.channel, messages: mergeMessages(prev.messages, res.data.channel.messages) }
          : res.data.channel,
      );
    }
    setLoaded(true);
  }, [channelId, token]);

  usePoll(load, POLL_MS, true);

  // The GET above already marks read; a final POST on blur keeps the cursor fresh.
  useFocusEffect(
    useCallback(() => {
      return () => {
        if (token) void api(`/api/portal/chat/channels/${channelId}/read`, { method: "POST", token });
      };
    }, [channelId, token]),
  );

  const messages = useMemo(() => channel?.messages || [], [channel]);
  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const byId = useMemo(() => new Map(messages.map((m) => [m.id, m])), [messages]);
  const meKey = member?.id ? `m:${member.id}` : null;

  const canPost = Boolean(channel?.canPost) && !sendBlocked;
  const disabledReason = channel?.muted
    ? "You've been muted in this chat."
    : "Only the organiser can post here.";

  const isGrouped = useCallback(
    (m: ChatMessage, i: number) => {
      const older = reversed[i + 1];
      if (!older || older.senderKind === "system" || m.senderKind === "system") return false;
      if (older.authorKey !== m.authorKey) return false;
      const a = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const b = older.createdAt ? new Date(older.createdAt).getTime() : 0;
      return a > 0 && b > 0 && a - b <= GROUP_MS;
    },
    [reversed],
  );

  const quoteFor = useCallback(
    (m: ChatMessage) => {
      const parent = m.replyTo ? byId.get(m.replyTo) : null;
      return parent ? { authorName: parent.authorName, text: parent.text } : null;
    },
    [byId],
  );

  const onSend = useCallback(
    async (text: string): Promise<boolean> => {
      if (!token || !member) return false;
      const temp: ChatMessage = {
        id: `temp-${Date.now()}`,
        channelId,
        authorKey: `m:${member.id}`,
        authorName: member.name || "You",
        senderKind: "member",
        text,
        reactions: {},
        replyTo: replyTarget?.id ?? null,
        type: "text",
        poll: null,
        deleted: false,
        createdAt: new Date().toISOString(),
      };
      const replyTo = replyTarget?.id ?? null;
      setReplyTarget(null);
      // Optimistic append; swapped for the server's message (or removed) below.
      setChannel((prev) => (prev ? { ...prev, messages: [...prev.messages, temp] } : prev));
      const res = await api<{ message: ChatMessage }>(
        `/api/portal/chat/channels/${channelId}/messages`,
        { method: "POST", token, body: { body: text, replyTo } },
      );
      if (res.ok) {
        setChannel((prev) =>
          prev ? { ...prev, messages: replaceTemp(prev.messages, temp.id, res.data.message) } : prev,
        );
        return true;
      }
      setChannel((prev) =>
        prev ? { ...prev, messages: prev.messages.filter((m) => m.id !== temp.id) } : prev,
      );
      toastError(res.error);
      if (res.status === 403) setSendBlocked(true);
      return false;
    },
    [token, member, channelId, replyTarget, toastError],
  );

  const onPickReaction = useCallback(
    async (message: ChatMessage, emoji: string) => {
      setReactingId(null);
      if (!token) return;
      const res = await api<{ message: ChatMessage }>(
        `/api/portal/chat/channels/${channelId}/reactions`,
        { method: "POST", token, body: { messageId: message.id, emoji } },
      );
      if (res.ok) {
        setChannel((prev) =>
          prev ? { ...prev, messages: upsertMessage(prev.messages, res.data.message) } : prev,
        );
      }
    },
    [token, channelId],
  );

  const onVote = useCallback(
    async (message: ChatMessage, optionId: string) => {
      if (!token) return;
      const res = await api<{ message: ChatMessage }>(
        `/api/portal/chat/channels/${channelId}/vote`,
        { method: "POST", token, body: { messageId: message.id, optionId } },
      );
      if (res.ok) {
        setChannel((prev) =>
          prev ? { ...prev, messages: upsertMessage(prev.messages, res.data.message) } : prev,
        );
      }
    },
    [token, channelId],
  );

  if (!loaded) {
    return (
      <Screen>
        <ScreenHeader title="Chat" />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!channel) {
    return (
      <Screen>
        <ScreenHeader title="Chat" />
        <EmptyState
          icon="message-circle"
          title="Channel not found"
          message="This chat isn't available anymore."
        />
      </Screen>
    );
  }

  const replyStrip = replyTarget ? (
    <View style={styles.replyStrip}>
      <View style={styles.replyText}>
        <Text style={styles.replyName} numberOfLines={1}>
          {replyTarget.authorName}
        </Text>
        <Text style={styles.replyBody} numberOfLines={2}>
          {replyTarget.text}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Clear reply"
        onPress={() => setReplyTarget(null)}
        hitSlop={8}
        style={styles.replyClear}
      >
        <Feather name="x" size={16} color={colors.textTertiary} />
      </Pressable>
    </View>
  ) : null;

  return (
    <Screen>
      <ScreenHeader title={channel.name} subtitle={channel.topic || undefined} />
      {messages.length ? (
        <FlatList
          data={reversed}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => (
            <View style={styles.messageRow}>
              <MessageBubble
                message={item}
                isOwn={item.authorKey === meKey}
                grouped={isGrouped(item, index)}
                meKey={meKey ?? undefined}
                quotedMessage={quoteFor(item)}
                reacting={reactingId === item.id}
                onLongPress={() => setReactingId(item.id)}
                onPickReaction={(emoji) => void onPickReaction(item, emoji)}
                onReply={() => {
                  tapFeedback();
                  setReplyTarget(item);
                }}
                onVote={(optionId) => void onVote(item, optionId)}
              />
            </View>
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <View style={styles.emptyList}>
          <Text style={styles.emptyText}>No messages yet — say hello.</Text>
        </View>
      )}
      <ChatComposer
        onSend={onSend}
        disabled={!canPost}
        disabledReason={canPost ? undefined : disabledReason}
        placeholder="Write a message…"
        accessory={replyStrip}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
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
  replyStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.surfaceSubtle,
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  replyText: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  replyName: {
    ...type.caption,
    color: colors.textSecondary,
  },
  replyBody: {
    ...type.caption,
    color: colors.mutedForeground,
  },
  replyClear: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
});
