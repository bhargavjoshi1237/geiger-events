import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ChatComposer } from "@/components/ChatComposer";
import { Byline } from "@/components/control/community/Byline";
import { StatusButton } from "@/components/control/StatusButton";
import { MessageBubble } from "@/components/MessageBubble";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { IconTile } from "@/components/ui/IconTile";
import { ListGroup } from "@/components/ui/ListGroup";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Segmented } from "@/components/ui/Segmented";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useAppFocused } from "@/lib/use_poll";
import { colors, spacing, type } from "@/theme/tokens";
import type { CommunityChannelDetail, CommunityParticipant } from "@/types/control_community";
import type { ChatMessage } from "@/types/portal";

const POLL_MS = 5_000;
const GROUP_MS = 5 * 60 * 1000;

export default function CommunityChatScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const path = `/api/control/community/channels/${id}`;
  const { data, error, reload, setData } = useControlQuery<CommunityChannelDetail>(path);
  const [target, setTarget] = useState<ChatMessage | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const focused = useAppFocused();

  // Each write bumps the sequence, so a poll that started before it can't land afterwards and undo it.
  const seq = useRef(0);
  const writing = useRef(false);
  const poll = useCallback(async () => {
    if (writing.current) return;
    const ticket = ++seq.current;
    const res = await controlApi<CommunityChannelDetail>(path);
    if (res.ok && ticket === seq.current && !writing.current) setData(res.data);
  }, [path, setData]);

  useEffect(() => {
    if (!focused) return undefined;
    const timer = setInterval(() => void poll(), POLL_MS);
    return () => clearInterval(timer);
  }, [focused, poll]);

  const write = useCallback(async <T,>(run: () => Promise<T>): Promise<T> => {
    writing.current = true;
    seq.current += 1;
    try {
      return await run();
    } finally {
      writing.current = false;
    }
  }, []);

  const channel = data?.channel;
  const archived = channel?.status === "archived";
  const reversed = useMemo(() => [...(data?.messages ?? [])].reverse(), [data]);

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
      const res = await write(() => controlApi<{ message: ChatMessage }>(`${path}/messages`, { method: "POST", body: { body: text } }));
      if (!res.ok) {
        errorFeedback();
        toast.error(res.error);
        return false;
      }
      setData((prev) => (prev ? { ...prev, messages: [...prev.messages, res.data.message] } : prev));
      return true;
    },
    [path, setData, toast, write],
  );

  const deleteMessage = async (message: ChatMessage) => {
    setTarget(null);
    const res = await write(() => controlApi<{ deleted: boolean }>(`/api/control/community/messages/${message.id}`, { method: "DELETE" }));
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    setData((prev) => (prev ? { ...prev, messages: prev.messages.map((m) => (m.id === message.id ? { ...m, deleted: true, text: "" } : m)) } : prev));
  };

  const subtitle = channel?.eventName || undefined;

  return (
    // Pushed Control screens have no tab bar, so the composer sits on the bottom inset.
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.sm }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader
          title={channel?.name ?? "Chat"}
          subtitle={subtitle}
          right={channel ? <IconButton icon="settings" label="Chat settings" variant="plain" onPress={() => setSettingsOpen(true)} /> : undefined}
          bordered
        />

        {error && !data ? (
          <EmptyState icon="circle-alert" title="Couldn't open this chat" message={error} actionLabel="Try again" onAction={() => void reload()} />
        ) : !data || !channel ? (
          <SkeletonList rows={5} variant="chat" />
        ) : (
          <>
            <View style={styles.strip}>
              <StatusButton
                label={archived ? "Archived" : "Active"}
                tone={archived ? "neutral" : "success"}
                onPress={() => setSettingsOpen(true)}
                accessibilityLabel={`${archived ? "Archived" : "Active"}. Open chat settings`}
              />
              <View style={styles.stripFacts}>
                <Icon name={channel.postingMode === "open" ? "messages-square" : "megaphone"} size={13} color={colors.textSecondary} />
                <Text style={styles.stripText} numberOfLines={1}>
                  {channel.postingMode === "open" ? "Everyone posts" : "Organisers post"}
                </Text>
              </View>
              <Text style={styles.stripCount} numberOfLines={1}>
                {`${channel.participantCount} ${pluralize(channel.participantCount, "attendee", "attendees")}`}
              </Text>
            </View>
            {reversed.length ? (
              <FlatList
                style={styles.flex}
                data={reversed}
                inverted
                keyExtractor={(m) => m.id}
                renderItem={({ item, index }) => (
                  <View style={styles.messageRow}>
                    <MessageBubble
                      message={item}
                      isOwn={item.senderKind === "organiser"}
                      grouped={isGrouped(item, index)}
                      onLongPress={item.deleted ? undefined : () => setTarget(item)}
                    />
                  </View>
                )}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            ) : (
              <View style={styles.emptyList}>
                <Icon name="messages-square" size={22} color={colors.textTertiary} />
                <Text style={styles.emptyText}>No messages yet.</Text>
                {!archived ? <Text style={styles.note}>{channel.kind === "qa" ? "Post a prompt below to get questions going." : "Post below to start the conversation."}</Text> : null}
              </View>
            )}
            <ChatComposer
              onSend={onSend}
              placeholder={channel.kind === "qa" ? "Answer or post to the thread…" : "Message attendees…"}
              disabled={archived}
              disabledReason="This chat is archived. Reopen it in the chat settings to post."
            />
          </>
        )}
      </KeyboardAvoidingView>

      <Sheet visible={Boolean(target)} onClose={() => setTarget(null)} title="Message">
        <View style={styles.sheetBody}>
          {target ? (
            <ListGroup>
              <View style={styles.quoteBlock}>
                <Byline name={target.authorName} at={target.createdAt} organiser={target.senderKind === "organiser"} />
                <Text style={styles.quote} numberOfLines={4}>
                  {target.text}
                </Text>
              </View>
            </ListGroup>
          ) : null}
          <Text style={styles.note}>Deleting removes it for everyone in the chat.</Text>
          <View style={styles.sheetActions}>
            <Button title="Keep" variant="ghost" onPress={() => setTarget(null)} />
            <Button title="Delete message" variant="destructive" onPress={() => target && void deleteMessage(target)} />
          </View>
        </View>
      </Sheet>

      {channel ? (
        <Sheet visible={settingsOpen} onClose={() => setSettingsOpen(false)} title="Chat settings">
          <ChatSettings
            detail={data}
            path={path}
            write={write}
            onChanged={(next) => setData(next)}
            onDeleted={() => {
              setSettingsOpen(false);
              router.back();
            }}
          />
        </Sheet>
      ) : null}
    </View>
  );
}

type Write = <T>(run: () => Promise<T>) => Promise<T>;

// Posting mode, archive/reopen, participants and (for Q&A threads) delete — the dashboard's chat controls.
function ChatSettings({ detail, path, write, onChanged, onDeleted }: { detail: CommunityChannelDetail; path: string; write: Write; onChanged: (next: CommunityChannelDetail) => void; onDeleted: () => void }) {
  const toast = useToast();
  const { channel } = detail;
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const people = useControlQuery<{ participants: CommunityParticipant[] }>(`${path}/participants`, { refetchOnFocus: false });

  const patch = async (body: Record<string, string>, message: string) => {
    setBusy(true);
    const res = await write(() => controlApi<CommunityChannelDetail>(path, { method: "PATCH", body }));
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(message);
    onChanged(res.data);
  };

  const participant = async (p: CommunityParticipant, action: "mute" | "remove") => {
    const res =
      action === "mute"
        ? await controlApi<{ participant: CommunityParticipant }>(`/api/control/community/participants/${p.id}`, { method: "PATCH", body: { muted: !p.muted } })
        : await controlApi<{ removed: boolean }>(`/api/control/community/participants/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    people.setData((prev) =>
      prev
        ? { participants: action === "mute" ? prev.participants.map((x) => (x.id === p.id ? { ...x, muted: !p.muted } : x)) : prev.participants.filter((x) => x.id !== p.id) }
        : prev,
    );
  };

  const remove = async () => {
    setBusy(true);
    const res = await write(() => controlApi<{ deleted: boolean }>(path, { method: "DELETE" }));
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Thread deleted.");
    onDeleted();
  };

  const members = people.data?.participants ?? [];
  const muted = members.filter((p) => p.muted).length;

  return (
    <ScrollView style={styles.settings} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled">
      <ListGroup title="Who can post" footer={channel.postingMode === "open" ? "Attendees can post and reply." : "Only organisers can post; attendees read along."}>
        <View style={styles.segment}>
          <Segmented
            options={[
              { value: "open", label: "Everyone" },
              { value: "announce", label: "Organisers only" },
            ]}
            value={channel.postingMode}
            onChange={(v) => void patch({ postingMode: v }, v === "open" ? "Attendees can post." : "Only organisers can post now.")}
          />
        </View>
      </ListGroup>

      <Button
        title={channel.status === "archived" ? "Reopen chat" : "Archive chat"}
        icon={channel.status === "archived" ? "rotate-ccw" : "box"}
        variant="secondary"
        loading={busy}
        onPress={() => void patch({ status: channel.status === "archived" ? "active" : "archived" }, channel.status === "archived" ? "Chat reopened." : "Chat archived.")}
        fullWidth
      />

      <View>
        {people.loading ? (
          <SkeletonList rows={2} variant="divided" />
        ) : !members.length ? (
          <ListGroup title="Attendees">
            <Text style={styles.emptyGroup}>No attendees have joined yet; they join as they buy tickets.</Text>
          </ListGroup>
        ) : (
          <ListGroup title={`${members.length} ${members.length === 1 ? "attendee" : "attendees"}${muted ? ` · ${muted} muted` : ""}`}>
            {members.map((p, i) => (
              <ListRow
                key={p.id}
                leading={<IconTile icon={p.muted ? "ban" : "users"} size={32} tone={p.muted ? "warning" : "neutral"} />}
                title="Attendee"
                subtitle={p.joinedAt ? `Joined ${fmtTimeAgo(p.joinedAt)}` : undefined}
                trailing={
                  <View style={styles.rowActions}>
                    {p.muted ? <Pill label="Muted" tone="warning" variant="outline" dot={false} /> : null}
                    <IconButton icon={p.muted ? "volume-2" : "ban"} label={p.muted ? "Unmute attendee" : "Mute attendee"} variant="plain" size={36} iconSize={16} onPress={() => void participant(p, "mute")} />
                    <IconButton icon="x" label="Remove from chat" variant="plain" size={36} iconSize={16} onPress={() => void participant(p, "remove")} />
                  </View>
                }
                divider={i < members.length - 1}
              />
            ))}
          </ListGroup>
        )}
      </View>

      {channel.kind === "qa" ? (
        confirmDelete ? (
          <View style={styles.sheetActions}>
            <Button title="Keep thread" variant="ghost" onPress={() => setConfirmDelete(false)} />
            <Button title="Delete for everyone" variant="destructive" loading={busy} onPress={() => void remove()} />
          </View>
        ) : (
          <Button title="Delete thread" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
        )
      ) : (
        <Text style={styles.note}>An event&apos;s chat is set up from the event; archive it here to stop new posts.</Text>
      )}
    </ScrollView>
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
  messageRow: {
    paddingVertical: spacing.xs,
  },
  listContent: {
    paddingVertical: spacing.sm,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  stripFacts: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
  },
  stripText: {
    ...type.captionStrong,
    flexShrink: 1,
    color: colors.textSecondary,
  },
  stripCount: {
    ...type.monoSmall,
    fontSize: 11,
    color: colors.textSecondary,
  },
  emptyList: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyText: {
    ...type.bodyStrong,
    color: colors.mutedForeground,
  },
  settings: {
    maxHeight: 560,
  },
  sheetBody: {
    gap: spacing.lg,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
  quoteBlock: {
    gap: spacing.sm + 2,
    paddingVertical: spacing.md + 2,
  },
  quote: {
    ...type.body,
    color: colors.foreground,
  },
  note: {
    ...type.caption,
    color: colors.textSecondary,
  },
  segment: {
    paddingVertical: spacing.md,
  },
  emptyGroup: {
    ...type.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.lg,
  },
  rowActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
});
