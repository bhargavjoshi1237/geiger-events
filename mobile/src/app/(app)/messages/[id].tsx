import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";

import { ChatComposer } from "@/components/ChatComposer";
import { MessageBubble } from "@/components/MessageBubble";
import { ScreenHeader } from "@/components/ScreenHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { Screen } from "@/components/ui/Screen";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { usePoll } from "@/lib/use_poll";
import { useSession } from "@/state/session";
import { colors, spacing, type } from "@/theme/tokens";
import type { ThreadDetail, ThreadMessage } from "@/types/portal";

const POLL_MS = 5_000;
const GROUP_MS = 5 * 60 * 1000;

function mergeMessages(prev: ThreadMessage[], fresh: ThreadMessage[]): ThreadMessage[] {
  const byId = new Map(fresh.map((m) => [m.id, m]));
  const seen = new Set<string>();
  const out = prev.map((m) => {
    seen.add(m.id);
    return byId.get(m.id) || m;
  });
  for (const m of fresh) if (!seen.has(m.id)) out.push(m);
  return out;
}

function replaceTemp(messages: ThreadMessage[], tempId: string, real: ThreadMessage): ThreadMessage[] {
  const rest = messages.filter((m) => m.id !== tempId);
  const i = rest.findIndex((m) => m.id === real.id);
  if (i >= 0) rest[i] = real;
  else rest.push(real);
  return rest;
}

export default function ThreadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { token } = useSession();
  const { error: toastError } = useToast();
  const [thread, setThread] = useState<ThreadDetail | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    const res = await api<{ thread: ThreadDetail }>(`/api/portal/threads/${id}`, { token });
    if (res.ok) {
      setThread((prev) =>
        prev
          ? { ...res.data.thread, messages: mergeMessages(prev.messages, res.data.thread.messages) }
          : res.data.thread,
      );
    }
    setLoaded(true);
  }, [id, token]);

  usePoll(load, POLL_MS, true);

  const messages = useMemo(() => thread?.messages || [], [thread]);
  const reversed = useMemo(() => [...messages].reverse(), [messages]);
  const closed = thread?.status === "closed";

  const isGrouped = useCallback(
    (m: ThreadMessage, i: number) => {
      const older = reversed[i + 1];
      if (!older || older.sender !== m.sender) return false;
      const a = m.createdAt ? new Date(m.createdAt).getTime() : 0;
      const b = older.createdAt ? new Date(older.createdAt).getTime() : 0;
      return a > 0 && b > 0 && a - b <= GROUP_MS;
    },
    [reversed],
  );

  const onSend = useCallback(
    async (text: string): Promise<boolean> => {
      if (!token) return false;
      const temp: ThreadMessage = {
        id: `temp-${Date.now()}`,
        sender: "member",
        body: text,
        createdAt: new Date().toISOString(),
      };
      setThread((t) => (t ? { ...t, messages: [...t.messages, temp] } : t));
      const res = await api<{ message: ThreadMessage }>(`/api/portal/threads/${id}/messages`, {
        method: "POST",
        token,
        body: { body: text },
      });
      if (res.ok) {
        setThread((t) =>
          t ? { ...t, messages: replaceTemp(t.messages, temp.id, res.data.message) } : t,
        );
        return true;
      }
      setThread((t) =>
        t ? { ...t, messages: t.messages.filter((m) => m.id !== temp.id) } : t,
      );
      toastError(res.error);
      return false;
    },
    [token, id, toastError],
  );

  if (!loaded) {
    return (
      <Screen>
        <ScreenHeader title="Message" />
        <SkeletonList rows={5} />
      </Screen>
    );
  }

  if (!thread) {
    return (
      <Screen>
        <ScreenHeader title="Message" />
        <EmptyState
          icon="mail"
          title="Thread not found"
          message="This conversation isn't on your account anymore."
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader
        title={thread.subject}
        subtitle={`${closed ? "Closed" : "Open"} · started ${fmtDateTime(thread.createdAt)}`}
      />
      {messages.length ? (
        <FlatList
          data={reversed}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => (
            <View style={styles.messageRow}>
              <MessageBubble
                message={item}
                isOwn={item.sender === "member"}
                grouped={isGrouped(item, index)}
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
        disabled={closed}
        disabledReason={closed ? "This conversation is closed." : undefined}
        placeholder="Reply…"
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
});
