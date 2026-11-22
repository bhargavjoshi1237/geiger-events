import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TOPIC_STATUS_META } from "@/components/control/community/meta";
import { ChatComposer } from "@/components/ChatComposer";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/icons";
import { IconButton } from "@/components/ui/IconButton";
import { Pill } from "@/components/ui/Pill";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Sheet } from "@/components/ui/Sheet";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { CommunityPost, CommunityTopicDetail } from "@/types/control_community";

export default function TopicScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const path = `/api/control/community/topics/${id}`;
  const { data, error, reload, setData } = useControlQuery<CommunityTopicDetail>(path);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [target, setTarget] = useState<CommunityPost | null>(null);
  const [replyTo, setReplyTo] = useState<CommunityPost | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const topic = data?.topic;
  const isQa = data?.board?.format === "qa";
  const posts = data?.posts ?? [];
  const top = posts.filter((p) => !p.parentPostId);
  const childrenOf = (postId: string) => posts.filter((p) => p.parentPostId === postId);

  const changeTopic = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    const res = await controlApi<CommunityTopicDetail>(path, { method: "PATCH", body });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(message);
    setData(res.data);
  };

  const deleteTopic = async () => {
    setBusy(true);
    const res = await controlApi<{ deleted: boolean }>(path, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Topic deleted.");
    router.back();
  };

  const postStatus = async (post: CommunityPost, status: "published" | "hidden") => {
    setTarget(null);
    const res = await controlApi<{ post: CommunityPost }>(`/api/control/community/posts/${post.id}`, { method: "PATCH", body: { status } });
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(status === "hidden" ? "Reply hidden." : "Reply published.");
    setData((prev) => (prev ? { ...prev, posts: prev.posts.map((p) => (p.id === post.id ? res.data.post : p)) } : prev));
  };

  const deletePost = async (post: CommunityPost) => {
    setTarget(null);
    const res = await controlApi<{ deleted: boolean }>(`/api/control/community/posts/${post.id}`, { method: "DELETE" });
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success("Reply deleted.");
    setData((prev) => (prev ? { ...prev, posts: prev.posts.filter((p) => p.id !== post.id && p.parentPostId !== post.id) } : prev));
  };

  const accept = (post: CommunityPost) => {
    setTarget(null);
    const unmark = topic?.acceptedPostId === post.id;
    void changeTopic({ acceptedPostId: unmark ? null : post.id }, unmark ? "Answer unmarked." : "Marked as the answer.");
  };

  const send = async (text: string): Promise<boolean> => {
    const res = await controlApi<{ post: CommunityPost }>(`${path}/posts`, { method: "POST", body: { body: text, parentPostId: replyTo?.id ?? null } });
    if (!res.ok) {
      errorFeedback();
      toast.error(res.error);
      return false;
    }
    successFeedback();
    setReplyTo(null);
    setData((prev) => (prev ? { ...prev, topic: { ...prev.topic, replyCount: prev.topic.replyCount + 1 }, posts: [...prev.posts, res.data.post] } : prev));
    return true;
  };

  const renderPost = (post: CommunityPost, nested = false) => {
    const accepted = topic?.acceptedPostId === post.id;
    return (
      <View key={post.id} style={nested ? styles.nested : undefined}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Reply by ${post.authorName}. Open actions`}
          onPress={() => {
            tapFeedback();
            setTarget(post);
          }}
          style={({ pressed }) => [styles.post, post.status === "hidden" && styles.dimmed, pressed && styles.pressed]}
        >
          <View style={styles.postHead}>
            <Text style={styles.author} numberOfLines={1}>
              {post.authorKind === "organiser" ? `${post.authorName} · Organiser` : post.authorName}
            </Text>
            {accepted ? <Pill label="Answer" tone="success" /> : null}
            {post.status !== "published" ? <Pill label={TOPIC_STATUS_META[post.status].label} tone={TOPIC_STATUS_META[post.status].tone} variant="outline" /> : null}
            <Text style={styles.time}>{post.createdAt ? fmtTimeAgo(post.createdAt) : ""}</Text>
          </View>
          <Text style={styles.postBody}>{post.body}</Text>
        </Pressable>
        {!nested ? childrenOf(post.id).map((child) => renderPost(child, true)) : null}
      </View>
    );
  };

  const meta = topic ? TOPIC_STATUS_META[topic.status] : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + spacing.sm }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScreenHeader
          title={data?.board?.name ?? "Topic"}
          subtitle={topic ? `${topic.replyCount} ${topic.replyCount === 1 ? "reply" : "replies"}` : undefined}
          right={topic ? <IconButton icon="settings" label="Topic actions" variant="plain" onPress={() => setActionsOpen(true)} /> : undefined}
          bordered
        />

        {error && !data ? (
          <EmptyState icon="circle-alert" title="Couldn't open this topic" message={error} actionLabel="Try again" onAction={() => void reload()} />
        ) : !data || !topic || !meta ? (
          <SkeletonList rows={4} variant="card" />
        ) : (
          <>
            <ScrollView style={styles.flex} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              <Card>
                <View style={styles.badges}>
                  {topic.pinned ? <Pill label="Pinned" tone="info" variant="outline" dot={false} /> : null}
                  {topic.locked ? <Pill label="Locked" tone="neutral" variant="outline" dot={false} /> : null}
                  {topic.status !== "published" ? <Pill label={meta.label} tone={meta.tone} /> : null}
                </View>
                <Text style={styles.title}>{topic.title}</Text>
                <Text style={styles.time}>{[topic.authorName, topic.createdAt ? fmtTimeAgo(topic.createdAt) : ""].filter(Boolean).join(" · ")}</Text>
                {topic.body ? <Text style={styles.topicBody}>{topic.body}</Text> : null}
                {topic.status === "pending" ? (
                  <View style={styles.approve}>
                    <Button title="Approve topic" icon="circle-check" loading={busy} onPress={() => void changeTopic({ status: "published" }, "Topic approved.")} fullWidth />
                  </View>
                ) : null}
              </Card>

              <SectionTitle variant="kicker">Replies</SectionTitle>
              {top.length ? <View style={styles.posts}>{top.map((p) => renderPost(p))}</View> : <Text style={styles.time}>No replies yet.</Text>}
            </ScrollView>

            {replyTo ? (
              <View style={styles.replying}>
                <Icon name="reply" size={14} color={colors.textSecondary} />
                <Text style={styles.replyingText} numberOfLines={1}>
                  Replying to {replyTo.authorName}
                </Text>
                <IconButton icon="x" label="Stop replying to this post" variant="plain" size={32} iconSize={14} onPress={() => setReplyTo(null)} />
              </View>
            ) : null}
            <ChatComposer
              onSend={send}
              placeholder={topic.locked ? "Locked — only organisers can reply" : "Reply as the organiser…"}
              disabled={topic.status !== "published"}
              disabledReason={topic.status === "pending" ? "Approve the topic to open it for replies." : "This topic is hidden from members."}
            />
          </>
        )}
      </KeyboardAvoidingView>

      {topic ? (
        <Sheet visible={actionsOpen} onClose={() => setActionsOpen(false)} title="Topic">
          <View style={styles.sheetBody}>
            <Button
              title={topic.pinned ? "Unpin" : "Pin to the top"}
              icon="star"
              variant="secondary"
              loading={busy}
              onPress={() => void changeTopic({ pinned: !topic.pinned }, topic.pinned ? "Unpinned." : "Pinned to the top.")}
              fullWidth
            />
            <Button
              title={topic.locked ? "Reopen replies" : "Lock replies"}
              icon="lock"
              variant="secondary"
              loading={busy}
              onPress={() => void changeTopic({ locked: !topic.locked }, topic.locked ? "Replies reopened." : "Topic locked.")}
              fullWidth
            />
            <Button
              title={topic.status === "hidden" ? "Restore topic" : topic.status === "pending" ? "Approve topic" : "Hide topic"}
              icon={topic.status === "published" ? "eye" : "circle-check"}
              variant="secondary"
              loading={busy}
              onPress={() =>
                void changeTopic(
                  { status: topic.status === "published" ? "hidden" : "published" },
                  topic.status === "hidden" ? "Topic restored." : topic.status === "pending" ? "Topic approved." : "Topic hidden.",
                )
              }
              fullWidth
            />
            {confirmDelete ? (
              <View style={styles.sheetActions}>
                <Button title="Keep topic" variant="ghost" onPress={() => setConfirmDelete(false)} />
                <Button title="Delete for everyone" variant="destructive" loading={busy} onPress={() => void deleteTopic()} />
              </View>
            ) : (
              <Button title="Delete topic" icon="trash-2" variant="destructiveGhost" onPress={() => setConfirmDelete(true)} fullWidth />
            )}
          </View>
        </Sheet>
      ) : null}

      <Sheet visible={Boolean(target)} onClose={() => setTarget(null)} title="Reply">
        {target ? (
          <View style={styles.sheetBody}>
            <Text style={styles.postBody} numberOfLines={5}>
              {target.body}
            </Text>
            {target.status === "published" && !target.parentPostId ? (
              <Button
                title="Reply to this"
                icon="reply"
                variant="secondary"
                onPress={() => {
                  setReplyTo(target);
                  setTarget(null);
                }}
                fullWidth
              />
            ) : null}
            {isQa && target.status === "published" ? (
              <Button title={topic?.acceptedPostId === target.id ? "Unmark as the answer" : "Mark as the answer"} icon="circle-check" variant="secondary" onPress={() => accept(target)} fullWidth />
            ) : null}
            {target.status === "published" ? (
              <Button title="Hide reply" icon="eye" variant="secondary" onPress={() => void postStatus(target, "hidden")} fullWidth />
            ) : (
              <Button title={target.status === "pending" ? "Approve reply" : "Publish again"} icon="circle-check" variant="secondary" onPress={() => void postStatus(target, "published")} fullWidth />
            )}
            <Button title="Delete reply" icon="trash-2" variant="destructiveGhost" onPress={() => void deletePost(target)} fullWidth />
          </View>
        ) : null}
      </Sheet>
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
  scroll: {
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  badges: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  title: {
    ...type.title,
    color: colors.foreground,
    marginTop: spacing.sm,
  },
  topicBody: {
    ...type.body,
    color: colors.mutedForeground,
    marginTop: spacing.md,
  },
  approve: {
    marginTop: spacing.lg,
  },
  posts: {
    gap: spacing.sm,
  },
  post: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg - 2,
    backgroundColor: colors.surfaceSubtle,
    padding: spacing.md,
    gap: spacing.xs,
  },
  nested: {
    marginLeft: spacing.xl,
    marginTop: spacing.sm,
  },
  dimmed: {
    opacity: 0.6,
  },
  pressed: {
    opacity: 0.7,
  },
  postHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  author: {
    ...type.labelStrong,
    flexShrink: 1,
    color: colors.foreground,
  },
  time: {
    ...type.caption,
    color: colors.textSecondary,
  },
  postBody: {
    ...type.body,
    color: colors.foreground,
  },
  replying: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  replyingText: {
    ...type.caption,
    flex: 1,
    color: colors.textSecondary,
  },
  sheetBody: {
    gap: spacing.md,
  },
  sheetActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
