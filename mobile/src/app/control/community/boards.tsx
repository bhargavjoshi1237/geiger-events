import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { TOPIC_STATUS_META } from "@/components/control/community/meta";
import { ScreenHeader } from "@/components/ScreenHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { FilterChips } from "@/components/ui/FilterChips";
import { IconTile } from "@/components/ui/IconTile";
import { ListRow } from "@/components/ui/ListRow";
import { Pill } from "@/components/ui/Pill";
import { Screen } from "@/components/ui/Screen";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { Segmented } from "@/components/ui/Segmented";
import { SkeletonList } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { controlApi } from "@/lib/control_api";
import { fmtTimeAgo } from "@/lib/format";
import { errorFeedback, successFeedback } from "@/lib/haptics";
import { useControlQuery } from "@/lib/use_control_query";
import { useControl } from "@/state/control";
import { colors, radius, spacing, type } from "@/theme/tokens";
import type { CommunityBoards, CommunityModeration, CommunityPost, CommunityReport, CommunityTopic } from "@/types/control_community";

const STATUS_CHIPS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "pending", label: "Awaiting approval" },
  { value: "hidden", label: "Hidden" },
];

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
  const boardName = useMemo(() => new Map(boards.map((b) => [b.id, b.name])), [boards]);
  const topics = list.data?.topics ?? [];
  const filtered = board !== "all" || status !== "all";

  return (
    <View style={styles.stack}>
      {boards.length > 1 ? (
        <FilterChips options={[{ value: "all", label: "All boards" }, ...boards.map((b) => ({ value: b.id, label: b.name }))]} value={board} onChange={setBoard} />
      ) : null}
      <FilterChips options={STATUS_CHIPS} value={status} onChange={setStatus} />
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
        <View style={styles.group}>
          {topics.map((t, i) => {
            const meta = TOPIC_STATUS_META[t.status];
            return (
              <ListRow
                key={t.id}
                leading={<IconTile icon={t.pinned ? "star" : t.locked ? "lock" : "message-square"} size={36} />}
                title={t.title}
                subtitle={[boardName.get(t.boardId), `${t.replyCount} ${t.replyCount === 1 ? "reply" : "replies"}`, t.lastActivityAt ? fmtTimeAgo(t.lastActivityAt) : ""].filter(Boolean).join(" · ")}
                trailing={t.status !== "published" ? <Pill label={meta.label} tone={meta.tone} variant="outline" /> : undefined}
                onPress={() => router.push({ pathname: "/control/community/topic/[id]", params: { id: t.id } })}
                divider={i < topics.length - 1}
              />
            );
          })}
        </View>
      )}
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

  return (
    <View style={styles.stack}>
      {topics.length || posts.length ? (
        <View style={styles.stack}>
          <SectionTitle variant="kicker">Awaiting approval</SectionTitle>
          {topics.map((t) => (
            <QueueCard
              key={t.id}
              kicker={`Topic · ${t.authorName}`}
              title={t.title}
              body={t.body}
              onOpen={() => router.push({ pathname: "/control/community/topic/[id]", params: { id: t.id } })}
              actions={
                <>
                  <Button title="Hide" size="sm" variant="ghost" loading={busy === `t:${t.id}:hidden`} onPress={() => void topicAction(t, "hidden")} />
                  <Button title="Approve" size="sm" loading={busy === `t:${t.id}:published`} onPress={() => void topicAction(t, "published")} />
                </>
              }
            />
          ))}
          {posts.map((p) => (
            <QueueCard
              key={p.id}
              kicker={`Reply · ${p.authorName}${p.topic ? ` · ${p.topic.title}` : ""}`}
              body={p.body}
              onOpen={() => router.push({ pathname: "/control/community/topic/[id]", params: { id: p.topicId } })}
              actions={
                <>
                  <Button title="Hide" size="sm" variant="ghost" loading={busy === `p:${p.id}:hidden`} onPress={() => void postAction(p, "hidden")} />
                  <Button title="Approve" size="sm" loading={busy === `p:${p.id}:published`} onPress={() => void postAction(p, "published")} />
                </>
              }
            />
          ))}
        </View>
      ) : null}

      {groups.length ? (
        <View style={styles.stack}>
          <SectionTitle variant="kicker">Open reports</SectionTitle>
          {groups.map((g) => (
            <QueueCard
              key={g.key}
              kicker={`${g.reports.length} ${g.reports.length === 1 ? "report" : "reports"} · ${[...new Set(g.reports.map((r) => r.reason))].join(", ")}`}
              title={g.post ? undefined : g.topic?.title}
              body={g.post?.body ?? g.topic?.body ?? ""}
              onOpen={g.topicId ? () => router.push({ pathname: "/control/community/topic/[id]", params: { id: g.topicId } }) : undefined}
              actions={
                <>
                  <Button title="Dismiss" size="sm" variant="ghost" loading={busy === `r:${g.key}:dismissed`} onPress={() => void resolve(g, "dismissed")} />
                  <Button title="Actioned" size="sm" variant="secondary" loading={busy === `r:${g.key}:actioned`} onPress={() => void resolve(g, "actioned")} />
                </>
              }
            />
          ))}
        </View>
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

function QueueCard({ kicker, title, body, actions, onOpen }: { kicker: string; title?: string; body: string; actions: React.ReactNode; onOpen?: () => void }) {
  return (
    <Card tone="subtle" onPress={onOpen}>
      <Text style={styles.kicker} numberOfLines={1}>
        {kicker}
      </Text>
      {title ? (
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
      ) : null}
      {body ? (
        <Text style={styles.body} numberOfLines={4}>
          {body}
        </Text>
      ) : null}
      <View style={styles.actions}>{actions}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  tabs: {
    marginBottom: spacing.lg,
  },
  stack: {
    gap: spacing.md,
  },
  group: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceSubtle,
    paddingHorizontal: spacing.lg,
  },
  kicker: {
    ...type.caption,
    color: colors.textSecondary,
  },
  title: {
    ...type.bodyStrong,
    color: colors.foreground,
    marginTop: spacing.xs,
  },
  body: {
    ...type.body,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});
