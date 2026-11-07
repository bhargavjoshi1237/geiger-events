"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { LayoutList, MessagesSquare, Plus, Settings2, ShieldAlert } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { ScreenHeader, SegmentedTabs, StatsBar } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { LoadingArea } from "@geiger/ui";
import { useProject } from "@/context/project-context";
import { listEvents } from "@/lib/supabase/events";
import {
  banMember,
  createBoard,
  createOrganiserTopic,
  deliverTopicEmails,
  getBoardSettings,
  getBoardStats,
  liftBan,
  listBans,
  listBoards,
  listPendingPosts,
  listReports,
  listTopics,
  reorderBoards,
  resolveReports,
  saveBoardSettings,
  softDeleteBoard,
  softDeleteTopic,
  updateBoard,
  updatePost,
  updateTopic,
} from "@/lib/supabase/boards";
import { normalizeSettings, uniqueSlug } from "@/lib/boards/constants";
import { BoardsTab } from "./discussion_boards/boards_tab";
import { BoardDialog } from "./discussion_boards/board_dialog";
import { TopicsTab } from "./discussion_boards/topics_tab";
import { TopicDrawer } from "./discussion_boards/topic_drawer";
import { NewTopicDialog } from "./discussion_boards/new_topic_dialog";
import { ModerationTab } from "./discussion_boards/moderation_tab";
import { SettingsTab } from "./discussion_boards/settings_tab";
import { BanDialog, ConfirmDialog, MoveTopicDialog } from "./discussion_boards/shared";

// Discussion Boards: persistent, threaded topic boards members use from the portal between events.
// Boards (CRUD + audience + order) · Topics (all threads, organiser replies) · Moderation (approvals, reports, bans) · Settings.

const DAY = 864e5;

// Client-side stats for when the board_stats RPC isn't available (e.g. the landing playground).
function fallbackStats({ boards, topics, reports, pendingPosts }) {
  const now = Date.now();
  const recent = (iso, days) => iso && now - new Date(iso).getTime() < days * DAY;
  return {
    boards: boards.filter((b) => !b.archived).length,
    topics: topics.filter((t) => t.status === "published").length,
    pendingTopics: topics.filter((t) => t.status === "pending").length,
    pendingPosts: pendingPosts.length,
    postsThisWeek: topics.filter((t) => recent(t.createdAt, 7)).length,
    activeMembers: new Set(topics.filter((t) => t.authorMemberId && recent(t.createdAt, 30)).map((t) => t.authorMemberId)).size,
    openReports: reports.filter((r) => r.status === "open").length,
  };
}

export function DiscussionBoardsScreen() {
  const { projectId } = useProject();
  const [tab, setTab] = useState("boards");
  const [loading, setLoading] = useState(true);
  const [boards, setBoards] = useState([]);
  const [topics, setTopics] = useState([]);
  const [events, setEvents] = useState([]);
  const [reports, setReports] = useState([]);
  const [pendingPosts, setPendingPosts] = useState([]);
  const [bans, setBans] = useState([]);
  const [settings, setSettings] = useState(() => normalizeSettings(null));
  const [settingsKey, setSettingsKey] = useState(0);
  const [stats, setStats] = useState(null);

  const [openTopicId, setOpenTopicId] = useState(null);
  const [boardDialog, setBoardDialog] = useState({ open: false, board: null, key: 0 });
  const [newTopic, setNewTopic] = useState({ open: false, key: 0 });
  const [moveTarget, setMoveTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [banTarget, setBanTarget] = useState(null);

  useEffect(() => {
    let alive = true;
    Promise.all([
      listBoards(projectId),
      listTopics(projectId),
      listEvents(projectId),
      listReports(projectId),
      listPendingPosts(projectId),
      listBans(projectId),
      getBoardSettings(projectId),
      getBoardStats(projectId),
    ]).then(([b, t, ev, rep, pend, bn, cfg, st]) => {
      if (!alive) return;
      const next = { boards: b ?? [], topics: t ?? [], reports: rep ?? [], pendingPosts: pend ?? [] };
      setBoards(next.boards);
      setTopics(next.topics);
      setEvents(ev ?? []);
      setReports(next.reports);
      setPendingPosts(next.pendingPosts);
      setBans(bn ?? []);
      setSettings(cfg ?? normalizeSettings(null));
      setSettingsKey((k) => k + 1);
      setStats(st && typeof st === "object" ? st : fallbackStats(next));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const eventNames = useMemo(() => Object.fromEntries((events || []).map((e) => [e.id, e.name || "Untitled event"])), [events]);
  const liveBoardIds = useMemo(() => new Set(boards.map((b) => b.id)), [boards]);
  const liveTopics = useMemo(() => topics.filter((t) => liveBoardIds.has(t.boardId)), [topics, liveBoardIds]);
  // Moderation only concerns content still on a live board.
  const onLiveBoard = (topic) => Boolean(topic && !topic.deletedAt && liveBoardIds.has(topic.boardId));
  const liveReports = reports.filter((r) => onLiveBoard(r.topic));
  const livePending = pendingPosts.filter((p) => onLiveBoard(p.topic));

  const refreshStats = () =>
    getBoardStats(projectId).then((st) => {
      if (st && typeof st === "object") setStats(st);
    });
  const refreshBoards = () => listBoards(projectId).then((b) => b && setBoards(b));
  const refreshAfterTopicChange = () => {
    refreshStats();
    refreshBoards();
  };

  // --- boards ---
  const saveBoard = async (draft) => {
    const editing = boardDialog.board;
    if (editing) {
      const saved = await updateBoard(editing.id, draft);
      if (!saved) {
        toast.error("Couldn't save the board.");
        return false;
      }
      setBoards((prev) => prev.map((b) => (b.id === saved.id ? saved : b)));
      toast.success("Board saved.");
      return true;
    }
    const saved = await createBoard({
      ...draft,
      projectId,
      slug: uniqueSlug(draft.name, boards),
      sortOrder: boards.length,
    });
    if (!saved) {
      toast.error("Couldn't create the board.");
      return false;
    }
    setBoards((prev) => [...prev, saved]);
    toast.success("Board created — members in its audience can see it now.");
    refreshStats();
    return true;
  };

  const archiveBoard = async (board, archived) => {
    setBoards((prev) => prev.map((b) => (b.id === board.id ? { ...b, archived } : b)));
    const saved = await updateBoard(board.id, { archived });
    if (!saved) {
      toast.error("Couldn't update the board.");
      refreshBoards();
      return;
    }
    toast.success(archived ? "Board archived — hidden from members." : "Board restored.");
    refreshStats();
  };

  const reorder = async (ids) => {
    const rank = new Map(ids.map((id, i) => [id, i]));
    setBoards((prev) =>
      [...prev].sort((a, b) => (rank.get(a.id) ?? ids.length + a.sortOrder) - (rank.get(b.id) ?? ids.length + b.sortOrder)),
    );
    if (!(await reorderBoards(ids))) {
      toast.error("Couldn't save the new order.");
      refreshBoards();
    }
  };

  // --- topics ---
  const changeTopic = async (topic, patch) => {
    setTopics((prev) => prev.map((t) => (t.id === topic.id ? { ...t, ...patch } : t)));
    const saved = await updateTopic(topic.id, patch);
    if (!saved) {
      toast.error("Couldn't update the topic.");
      listTopics(projectId).then((t) => t && setTopics(t));
      return;
    }
    setTopics((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
    if ("status" in patch) {
      toast.success(patch.status === "published" ? "Topic published." : patch.status === "hidden" ? "Topic hidden." : "Updated.");
    } else if ("boardId" in patch) {
      toast.success("Topic moved.");
    }
    refreshAfterTopicChange();
  };

  const createTopic = async (draft) => {
    const saved = await createOrganiserTopic({
      boardId: draft.boardId,
      title: draft.title,
      body: draft.body,
      tags: draft.tags,
      pinned: draft.pinned,
    });
    if (!saved) {
      toast.error("Couldn't post the topic.");
      return false;
    }
    setTopics((prev) => [saved, ...prev]);
    toast.success("Topic posted.");
    refreshAfterTopicChange();
    return true;
  };

  const removeTopic = async (topic) => {
    setTopics((prev) => prev.filter((t) => t.id !== topic.id));
    if (openTopicId === topic.id) setOpenTopicId(null);
    if (!(await softDeleteTopic(topic.id))) {
      toast.error("Couldn't delete the topic.");
      listTopics(projectId).then((t) => t && setTopics(t));
      return;
    }
    toast.success("Topic deleted.");
    refreshAfterTopicChange();
  };

  const removeBoard = async (board) => {
    setBoards((prev) => prev.filter((b) => b.id !== board.id));
    if (!(await softDeleteBoard(board.id))) {
      toast.error("Couldn't delete the board.");
      refreshBoards();
      return;
    }
    toast.success("Board deleted.");
    refreshStats();
  };

  // --- moderation ---
  const changePostStatus = async (post, status) => {
    setPendingPosts((prev) => prev.filter((p) => p.id !== post.id));
    const saved = await updatePost(post.id, { status });
    if (!saved) {
      toast.error("Couldn't update the reply.");
      listPendingPosts(projectId).then((p) => p && setPendingPosts(p));
      return;
    }
    toast.success(status === "published" ? "Reply published." : "Reply hidden.");
    if (status === "published") deliverTopicEmails(post.topicId);
    refreshAfterTopicChange();
  };

  const markReports = async (group, status) => {
    const ids = group.reports.map((r) => r.id);
    const ok = await resolveReports(ids, status);
    if (!ok) {
      toast.error("Couldn't update the reports.");
      return false;
    }
    setReports((prev) => prev.map((r) => (ids.includes(r.id) ? { ...r, status } : r)));
    refreshStats();
    return true;
  };

  const resolveGroup = async (group, action) => {
    if (action === "dismiss") {
      if (await markReports(group, "dismissed")) toast.success("Report dismissed.");
      return;
    }
    if (action === "hide") {
      const saved = group.postId
        ? await updatePost(group.postId, { status: "hidden" })
        : await updateTopic(group.topicId, { status: "hidden" });
      if (!saved) {
        toast.error("Couldn't hide the content.");
        return;
      }
      if (!group.postId) setTopics((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
      if (await markReports(group, "actioned")) toast.success("Content hidden and report closed.");
      refreshBoards();
      return;
    }
    const target = group.post || group.topic;
    setBanTarget({
      memberId: target?.authorMemberId,
      name: target?.authorName,
      email: target?.authorEmail,
      group,
    });
  };

  const confirmBan = async ({ reason, expiresAt }) => {
    if (!banTarget?.memberId) return false;
    const saved = await banMember({
      projectId,
      memberId: banTarget.memberId,
      memberName: banTarget.name || "",
      memberEmail: banTarget.email || "",
      reason,
      expiresAt,
    });
    if (!saved) {
      toast.error("Couldn't ban this member — they may already be banned.");
      return false;
    }
    setBans((prev) => [saved, ...prev]);
    if (banTarget.group) await markReports(banTarget.group, "actioned");
    toast.success(`${saved.memberName} can no longer post.`);
    return true;
  };

  const lift = async (ban) => {
    setBans((prev) => prev.filter((b) => b.id !== ban.id));
    if (!(await liftBan(ban.id))) {
      toast.error("Couldn't lift the ban.");
      listBans(projectId).then((b) => b && setBans(b));
      return;
    }
    toast.success(`${ban.memberName} can post again.`);
  };

  const saveSettings = async (config) => {
    const saved = await saveBoardSettings(projectId, config);
    if (!saved) {
      toast.error("Couldn't save settings.");
      return;
    }
    setSettings(saved);
    toast.success("Settings saved.");
  };

  // --- render ---
  const s = stats || {};
  const pendingCount = (s.pendingTopics ?? 0) + (s.pendingPosts ?? 0);
  const statTiles = [
    { label: "Topics", value: String(s.topics ?? 0), footer: `${s.boards ?? 0} active boards` },
    { label: "Posts this week", value: String(s.postsThisWeek ?? 0), footer: "Topics and replies" },
    { label: "Active members", value: String(s.activeMembers ?? 0), footer: "Posted in the last 30 days" },
    { label: "Open reports", value: String(s.openReports ?? 0), footer: `${pendingCount} awaiting approval` },
  ];
  const queue =
    liveTopics.filter((t) => t.status === "pending").length +
    livePending.length +
    new Set(liveReports.filter((r) => r.status === "open").map((r) => r.postId || r.topicId)).size;

  const headerAction =
    tab === "boards" ? (
      <Button
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={() => setBoardDialog((d) => ({ open: true, board: null, key: d.key + 1 }))}
      >
        <Plus className="h-4 w-4" /> New board
      </Button>
    ) : tab === "topics" ? (
      <Button
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={!boards.some((b) => !b.archived)}
        onClick={() => setNewTopic((d) => ({ open: true, key: d.key + 1 }))}
      >
        <Plus className="h-4 w-4" /> New topic
      </Button>
    ) : null;

  return (
    <MainScreenWrapper>
      <ScreenHeader
        title="Discussion Boards"
        description="Persistent, threaded topic boards your members use between events — moderated by you, read in their portal."
        actions={headerAction}
      />

      <StatsBar stats={statTiles} />

      <SegmentedTabs
        className="w-fit sm:w-fit"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "boards", label: "Boards", icon: LayoutList },
          { value: "topics", label: "Topics", icon: MessagesSquare },
          { value: "moderation", label: queue ? `Moderation (${queue})` : "Moderation", icon: ShieldAlert },
          { value: "settings", label: "Settings", icon: Settings2 },
        ]}
      />

      {loading ? (
        <LoadingArea size={48} panel label="Loading discussion boards" />
      ) : tab === "boards" ? (
        <BoardsTab
          boards={boards}
          eventNames={eventNames}
          onCreate={() => setBoardDialog((d) => ({ open: true, board: null, key: d.key + 1 }))}
          onEdit={(board) => setBoardDialog((d) => ({ open: true, board, key: d.key + 1 }))}
          onArchive={archiveBoard}
          onDelete={(board) => setDeleteTarget({ kind: "board", item: board })}
          onReorder={reorder}
        />
      ) : tab === "topics" ? (
        <TopicsTab
          topics={liveTopics}
          boards={boards}
          onOpen={(t) => setOpenTopicId(t.id)}
          onUpdate={changeTopic}
          onMove={setMoveTarget}
          onDelete={(t) => setDeleteTarget({ kind: "topic", item: t })}
        />
      ) : tab === "moderation" ? (
        <ModerationTab
          topics={liveTopics}
          pendingPosts={livePending}
          reports={liveReports}
          bans={bans}
          boards={boards}
          onOpenTopic={(t) => setOpenTopicId(t.id)}
          onTopicStatus={(t, status) => changeTopic(t, { status })}
          onPostStatus={changePostStatus}
          onResolve={resolveGroup}
          onLift={lift}
        />
      ) : (
        <SettingsTab key={settingsKey} settings={settings} onSave={saveSettings} />
      )}

      <BoardDialog
        key={`board-${boardDialog.key}`}
        open={boardDialog.open}
        onOpenChange={(open) => setBoardDialog((d) => ({ ...d, open }))}
        projectId={projectId}
        board={boardDialog.board}
        emailDefault={settings.emailDefault}
        onSave={saveBoard}
      />
      <NewTopicDialog
        key={`topic-${newTopic.key}`}
        open={newTopic.open}
        onOpenChange={(open) => setNewTopic((d) => ({ ...d, open }))}
        boards={boards}
        onCreate={createTopic}
      />
      <TopicDrawer
        topicId={openTopicId}
        boards={boards}
        onOpenChange={(open) => !open && setOpenTopicId(null)}
        onTopicChange={(saved) => {
          setTopics((prev) => prev.map((t) => (t.id === saved.id ? saved : t)));
          refreshAfterTopicChange();
        }}
        onMove={setMoveTarget}
        onDelete={(t) => setDeleteTarget({ kind: "topic", item: t })}
        onBan={(author) => setBanTarget(author)}
      />
      <MoveTopicDialog
        key={moveTarget?.id || "move"}
        topic={moveTarget}
        boards={boards}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        onMove={(t, boardId) => changeTopic(t, { boardId })}
      />
      <BanDialog target={banTarget} onOpenChange={(o) => !o && setBanTarget(null)} onConfirm={confirmBan} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.kind === "board" ? "Delete board" : "Delete topic"}
        description={
          deleteTarget?.kind === "board"
            ? `Delete “${deleteTarget?.item?.name}”? Members lose access to it and its topics. Archive it instead to keep it readable for you.`
            : `Delete “${deleteTarget?.item?.title}” and its replies? Members won't see it any more.`
        }
        onConfirm={() =>
          deleteTarget?.kind === "board" ? removeBoard(deleteTarget.item) : removeTopic(deleteTarget.item)
        }
      />
    </MainScreenWrapper>
  );
}

export default DiscussionBoardsScreen;
