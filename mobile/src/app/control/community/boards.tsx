import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { Byline } from "@/components/control/community/Byline";
import { TOPIC_STATUS_META } from "@/components/control/community/meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { CountBadge } from "@/components/ui/CountBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { Icon } from "@/components/ui/icons";
import { ListGroup } from "@/components/ui/ListGroup";
import { Pill } from "@/components/ui/Pill";
import { Readout } from "@/components/ui/Readout";
import { Screen } from "@/components/ui/Screen";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtCompactTime, pluralize } from "@/lib/format";
import { errorFeedback, successFeedback, tapFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, spacing, type } from "@/theme/tokens";
import type { CommunityBoard, CommunityBoards, CommunityModeration, CommunityPost, CommunityReport, CommunityTopic } from "@/types/control_community";

const STATUS_CHIPS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "pending", label: "Awaiting approval" },
  { value: "hidden", label: "Hidden" },
];

const stagger = (i: number) => Math.min(i, 8) * 50;

export default function BoardsScreen() {
  const { project } = useControl();
  const [tab, setTab] = useState("topics");
  const allowed = Boolean(project?.can.inbox);
  const moderation = useControlQuery<CommunityModeration>(project && allowed ? `/api/control/community/projects/${project.id}/moderation` : null);
  const openReports = (moderation.data?.reports ?? []).filter((r) => r.status === "open").length;
  const queue = (moderation.data?.topics.length ?? 0) + (moderation.data?.posts.length ?? 0) + openReports;

  return (
    <Screen scroll header={<ScreenHeader title="Discussion boards" />}>
      {!allowed || !project ? (
        <EmptyState icon="shield" title="Not available" message="Your role can't moderate the boards in this project." />
      ) : (
        <>
          <View style={styles.tabs}>
            <Segmented
              options={[
                { value: "topics", label: "Topics" },
                { value: "moderation", label: queue ? `Moderation · ${queue}` : "Moderation" },
              ]}
              value={tab}
              onChange={setTab}
            />
          </View>
          {tab === "topics" ? <Topics projectId={project.id} /> : <Moderation query={moderation} projectId={project.id} />}
        </>
      )}
    </Screen>
  );
}

function Topics({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [board, setBoard] = useState("all");
  const [status, setStatus] = useState("all");
  const params = [board !== "all" ? `board=${board}` : "", status !== "all" ? `status=${status}` : ""].filter(Boolean).join("&");
  const base = `/api/control/community/projects/${projectId}/boards`;
  const list = useControlQuery<CommunityBoards>(params ? `${base}?${params}` : base);
  // The unfiltered load names the boards, so the chips stay put while a filter reloads the topics.
  const all = useControlQuery<CommunityBoards>(base, { refetchOnFocus: false });
  const boards = useMemo(() => all.data?.boards ?? list.data?.boards ?? [], [all.data, list.data]);
  const boardById = useMemo(() => new Map(boards.map((b) => [b.id, b])), [boards]);
  const topics = list.data?.topics ?? [];
  const filtered = board !== "all" || status !== "all";
  const topicTotal = boards.reduce((sum, b) => sum + b.topicCount, 0);
  const postTotal = boards.reduce((sum, b) => sum + b.postCount, 0);

  return (
    <View style={styles.stack}>
      {boards.length ? (
        <Animated.View entering={FadeInDown.delay(stagger(0)).springify()}>
          <Readout
            lead={{ label: "Topics", value: topicTotal.toLocaleString("en-US"), hint: `on ${boards.length} ${pluralize(boards.length, "board", "boards")}` }}
            items={[
              { label: "Posts", value: postTotal.toLocaleString("en-US") },
              { label: "Q&A boards", value: String(boards.filter((b) => b.format === "qa").length) },
            ]}
          />
        </Animated.View>
      ) : null}
      <View style={styles.filters}>
        {boards.length > 1 ? (
          <FilterChips options={[{ value: "all", label: "All boards" }, ...boards.map((b) => ({ value: b.id, label: b.name }))]} value={board} onChange={setBoard} />
        ) : null}
        <FilterChips options={STATUS_CHIPS} value={status} onChange={setStatus} />
      </View>
      {list.error && !list.data ? (
        <EmptyState icon="circle-alert" title="Couldn't load the boards" message={list.error} actionLabel="Try again" onAction={() => void list.reload()} />
      ) : !list.data ? (
        <SkeletonList rows={5} variant="divided" />
      ) : !list.data.boards.length ? (
        <EmptyState icon="messages-square" title="No boards yet" message="Boards are created on the dashboard; their topics are moderated here." />
      ) : !topics.length ? (
        <EmptyState
          icon="search"
          title={filtered ? "Nothing matches" : "No topics yet"}
          message={filtered ? "Try another board or status." : "Topics members start will appear here."}
          actionLabel={filtered ? "Show everything" : undefined}
          onAction={
            filtered
              ? () => {
                  setBoard("all");
                  setStatus("all");
                }
              : undefined
          }
        />
      ) : (
        <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
          <ListGroup title={`${topics.length} ${pluralize(topics.length, "topic", "topics")}`}>
            {topics.map((t, i) => (
              <TopicRow
                key={t.id}
                topic={t}
                board={boardById.get(t.boardId)}
                onPress={() => router.push({ pathname: "/control/community/topic/[id]", params: { id: t.id } })}
                divider={i < topics.length - 1}
              />
            ))}
          </ListGroup>
        </Animated.View>
      )}
    </View>
  );
}

// A topic: who started it, where and when, its flags, and replies as a count; an unanswered Q&A question is flagged.
function TopicRow({ topic: t, board, onPress, divider }: { topic: CommunityTopic; board?: CommunityBoard; onPress: () => void; divider: boolean }) {
  const meta = TOPIC_STATUS_META[t.status];
  const isQa = board?.format === "qa";
  const answered = Boolean(t.acceptedPostId);
  const unanswered = isQa && !answered && t.replyCount === 0 && t.status === "published";
  const context = [t.authorName, board?.name].filter(Boolean).join(" · ");
  const flags = t.pinned || t.locked || answered || t.status !== "published";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t.title}, ${t.replyCount} ${pluralize(t.replyCount, "reply", "replies")}${unanswered ? ", unanswered" : ""}${t.status !== "published" ? `, ${meta.label}` : ""}`}
      onPress={() => {
        tapFeedback();
        onPress();
      }}
      style={({ pressed }) => [styles.row, divider && styles.divided, pressed && styles.pressed]}
    >
      <Avatar name={t.authorName} size={40} inverted={t.authorKind === "organiser"} />
      <View style={styles.rowStack}>
        <View style={styles.titleRow}>
          <Text style={[styles.topicTitle, t.status === "hidden" && styles.muted]} numberOfLines={2}>
            {t.title}
          </Text>
          {t.lastActivityAt ? <Text style={styles.time}>{fmtCompactTime(t.lastActivityAt)}</Text> : null}
        </View>
        {context ? (
          <Text style={styles.context} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
        {flags ? (
          <View style={styles.flags}>
            {t.status !== "published" ? <Pill label={meta.label} tone={meta.tone} variant="outline" /> : null}
            {t.pinned ? <Flag icon="star" label="Pinned" /> : null}
            {t.locked ? <Flag icon="lock" label="Locked" /> : null}
            {answered ? <Flag icon="circle-check" label="Answered" tint={colors.success} /> : null}
          </View>
        ) : null}
      </View>
      <CountBadge value={t.replyCount} tone={unanswered ? "warning" : "neutral"} />
      <Icon name="chevron-right" size={18} color={colors.textTertiary} />
    </Pressable>
  );
}

function Flag({ icon, label, tint = colors.textSecondary }: { icon: "star" | "lock" | "circle-check"; label: string; tint?: string }) {
  return (
    <View style={styles.flag}>
      <Icon name={icon} size={12} color={tint} />
      <Text style={[styles.flagText, { color: tint }]}>{label}</Text>
    </View>
  );
}

type ModerationQuery = { data: CommunityModeration | null; error: string | null; reload: () => Promise<void>; setData: (next: CommunityModeration | ((prev: CommunityModeration | null) => CommunityModeration | null)) => void };

// Held topics and replies to approve or hide, and member reports to action or dismiss.
function Moderation({ query, projectId }: { query: ModerationQuery; projectId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (key: string, path: string, init: { method: string; body?: unknown }, message: string, drop: (prev: CommunityModeration) => CommunityModeration) => {
    setBusy(key);
    const res = await controlApi<unknown>(path, init);
    setBusy(null);
    if (!res.ok) {
      errorFeedback();
      return toast.error(res.error);
    }
    successFeedback();
    toast.success(message);
    query.setData((prev) => (prev ? drop(prev) : prev));
  };

  const topicAction = (t: CommunityTopic, status: "published" | "hidden") =>
    run(`t:${t.id}:${status}`, `/api/control/community/topics/${t.id}`, { method: "PATCH", body: { status } }, status === "published" ? "Topic approved." : "Topic hidden.", (prev) => ({
      ...prev,
      topics: prev.topics.filter((x) => x.id !== t.id),
    }));

  const postAction = (p: CommunityPost, status: "published" | "hidden") =>
    run(`p:${p.id}:${status}`, `/api/control/community/posts/${p.id}`, { method: "PATCH", body: { status } }, status === "published" ? "Reply approved." : "Reply hidden.", (prev) => ({
      ...prev,
      posts: prev.posts.filter((x) => x.id !== p.id),
    }));

  const resolve = (group: ReportGroup, status: "actioned" | "dismissed") =>
    run(
      `r:${group.key}:${status}`,
      `/api/control/community/projects/${projectId}/moderation`,
      { method: "POST", body: { ids: group.reports.map((r) => r.id), status } },
      status === "actioned" ? "Marked as actioned." : "Reports dismissed.",
      (prev) => ({ ...prev, reports: prev.reports.map((r) => (group.reports.some((g) => g.id === r.id) ? { ...r, status } : r)) }),
    );

  const groups = useMemo(() => groupReports(query.data?.reports ?? []), [query.data]);

  if (query.error && !query.data) {
    return <EmptyState icon="circle-alert" title="Couldn't load the queue" message={query.error} actionLabel="Try again" onAction={() => void query.reload()} />;
  }
  if (!query.data) return <SkeletonList rows={4} variant="card" />;
  const { topics, posts } = query.data;
  if (!topics.length && !posts.length && !groups.length) {
    return <EmptyState icon="shield-check" title="All clear" message="Nothing is waiting for approval and no reports are open." actionLabel="Check again" onAction={() => void query.reload()} />;
  }
  const held = topics.length + posts.length;
  const reportCount = groups.reduce((sum, g) => sum + g.reports.length, 0);
  let step = 0;

  return (
    <View style={styles.stack}>
      <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
        <Readout
          lead={{ label: "In the queue", value: String(held + groups.length), hint: "waiting on a decision", tone: "warning" }}
          items={[
            { label: "Topics held", value: String(topics.length) },
            { label: "Replies held", value: String(posts.length) },
            { label: "Reports", value: String(reportCount), hint: groups.length ? `on ${groups.length} ${pluralize(groups.length, "post", "posts")}` : undefined, tone: reportCount ? "warning" : "neutral" },
          ]}
        />
      </Animated.View>

      {held ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Awaiting approval" action={<CountBadge value={held} tone="warning" />}>
            {topics.map((t, i) => (
              <QueueItem
                key={t.id}
                author={t.authorName}
                organiser={t.authorKind === "organiser"}
                at={t.createdAt}
                context="New topic"
                title={t.title}
                body={t.body}
                divider={i < topics.length - 1 || posts.length > 0}
                onOpen={() => router.push({ pathname: "/control/community/topic/[id]", params: { id: t.id } })}
                actions={
                  <>
                    <Button title="Hide" size="sm" variant="ghost" loading={busy === `t:${t.id}:hidden`} onPress={() => void topicAction(t, "hidden")} />
                    <Button title="Approve" size="sm" icon="check" loading={busy === `t:${t.id}:published`} onPress={() => void topicAction(t, "published")} />
                  </>
                }
              />
            ))}
            {posts.map((p, i) => (
              <QueueItem
                key={p.id}
                author={p.authorName}
                organiser={p.authorKind === "organiser"}
                at={p.createdAt}
                context={p.topic ? `Reply in “${p.topic.title}”` : "Reply"}
                body={p.body}
                divider={i < posts.length - 1}
                onOpen={() => router.push({ pathname: "/control/community/topic/[id]", params: { id: p.topicId } })}
                actions={
                  <>
                    <Button title="Hide" size="sm" variant="ghost" loading={busy === `p:${p.id}:hidden`} onPress={() => void postAction(p, "hidden")} />
                    <Button title="Approve" size="sm" icon="check" loading={busy === `p:${p.id}:published`} onPress={() => void postAction(p, "published")} />
                  </>
                }
              />
            ))}
          </ListGroup>
        </Animated.View>
      ) : null}

      {groups.length ? (
        <Animated.View entering={FadeInDown.delay(stagger(step++)).springify()}>
          <ListGroup title="Open reports" action={<CountBadge value={groups.length} tone="warning" />}>
            {groups.map((g, i) => {
              const reasons = [...new Set(g.reports.map((r) => r.reason).filter(Boolean))].join(", ");
              const reporters = [...new Set(g.reports.map((r) => r.reporterName).filter(Boolean))];
              const detail = g.reports.find((r) => r.details)?.details;
              return (
                <QueueItem
                  key={g.key}
                  author={g.post?.authorName ?? g.topic?.authorName ?? "Member"}
                  organiser={(g.post?.authorKind ?? g.topic?.authorKind) === "organiser"}
                  at={g.post?.createdAt ?? g.topic?.createdAt}
                  context={g.post ? (g.topic ? `Reply in “${g.topic.title}”` : "Reply") : "Topic"}
                  badge={<CountBadge value={g.reports.length} tone="warning" />}
                  title={g.post ? undefined : g.topic?.title}
                  body={g.post?.body ?? g.topic?.body ?? ""}
                  report={{
                    reasons: reasons || "Reported",
                    by: reporters.length ? `${reporters.slice(0, 2).join(", ")}${reporters.length > 2 ? ` and ${reporters.length - 2} more` : ""}` : "",
                    detail,
                  }}
                  divider={i < groups.length - 1}
                  onOpen={g.topicId ? () => router.push({ pathname: "/control/community/topic/[id]", params: { id: g.topicId } }) : undefined}
                  actions={
                    <>
                      <Button title="Dismiss" size="sm" variant="ghost" loading={busy === `r:${g.key}:dismissed`} onPress={() => void resolve(g, "dismissed")} />
                      <Button title="Mark actioned" size="sm" variant="secondary" loading={busy === `r:${g.key}:actioned`} onPress={() => void resolve(g, "actioned")} />
                    </>
                  }
                />
              );
            })}
          </ListGroup>
        </Animated.View>
      ) : null}
    </View>
  );
}

type ReportGroup = { key: string; topicId: string; topic: CommunityTopic | null; post: CommunityPost | null; reports: CommunityReport[] };

// One card per reported piece of content, however many members reported it, as the dashboard groups them.
function groupReports(reports: CommunityReport[]): ReportGroup[] {
  const map = new Map<string, ReportGroup>();
  for (const r of reports) {
    if (r.status !== "open") continue;
    const key = r.postId || r.topicId;
    const group = map.get(key) ?? { key, topicId: r.topicId, topic: r.topic, post: r.post, reports: [] };
    group.reports.push(r);
    map.set(key, group);
  }
  return [...map.values()];
}

type QueueItemProps = {
  author: string;
  organiser: boolean;
  at?: string | null;
  context: string;
  title?: string;
  body: string;
  badge?: React.ReactNode;
  report?: { reasons: string; by: string; detail?: string };
  actions: React.ReactNode;
  divider: boolean;
  onOpen?: () => void;
};

// A held post or a reported one in the queue: who wrote it, what it says, and the two calls to make on it.
function QueueItem({ author, organiser, at, context, title, body, badge, report, actions, divider, onOpen }: QueueItemProps) {
  const content = (
    <>
      <Byline name={author} at={at} organiser={organiser} context={context} trailing={badge} />
      {report ? (
        <View style={styles.report}>
          <Icon name="circle-alert" size={14} color={colors.warning} />
          <View style={styles.reportText}>
            <Text style={styles.reportReason} numberOfLines={2}>
              {report.reasons}
            </Text>
            {report.by ? (
              <Text style={styles.reportBy} numberOfLines={1}>
                {`Reported by ${report.by}`}
              </Text>
            ) : null}
            {report.detail ? (
              <Text style={styles.reportBy} numberOfLines={2}>
                {`“${report.detail}”`}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}
      {title ? (
        <Text style={styles.queueTitle} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text style={styles.queueBody} numberOfLines={4}>
          {body}
        </Text>
      ) : null}
    </>
  );

  return (
    <View style={[styles.queue, divider && styles.divided]}>
      {onOpen ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${context} by ${author}. Open the topic`}
          onPress={() => {
            tapFeedback();
            onOpen();
          }}
          style={({ pressed }) => [styles.queueContent, pressed && styles.pressed]}
        >
          {content}
        </Pressable>
      ) : (
        <View style={styles.queueContent}>{content}</View>
      )}
      <View style={styles.actions}>{actions}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.xl,
  },
  filters: {
    gap: spacing.md,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 14,
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.surfaceActive,
  },
  pressed: {
    opacity: 0.6,
  },
  rowStack: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  topicTitle: {
    ...type.label,
    fontSize: 15,
    lineHeight: 20,
    flex: 1,
    color: colors.foreground,
  },
  muted: {
    color: colors.textSecondary,
  },
  time: {
    ...type.monoSmall,
    fontSize: 11,
    lineHeight: 20,
    color: colors.textTertiary,
  },
  context: {
    ...type.caption,
    color: colors.textSecondary,
  },
  flags: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.md,
    marginTop: 3,
  },
  flag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  flagText: {
    ...type.captionStrong,
    fontSize: 11,
  },
  queue: {
    paddingVertical: spacing.md + 2,
    gap: spacing.md,
  },
  queueContent: {
    gap: spacing.sm,
  },
  report: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  reportText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  reportReason: {
    ...type.captionStrong,
    color: colors.warning,
  },
  reportBy: {
    ...type.caption,
    color: colors.textSecondary,
  },
  queueTitle: {
    ...type.bodyStrong,
    color: colors.foreground,
  },
  queueBody: {
    ...type.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.mutedForeground,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
  },
});
