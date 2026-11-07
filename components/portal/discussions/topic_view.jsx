"use client";

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Bell,
  BellOff,
  CheckCircle2,
  CornerDownRight,
  Flag,
  Loader2,
  Lock,
  MessagesSquare,
  Pencil,
  Pin,
  Reply,
  Send,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LoadingArea } from "@geiger/ui";
import { BoardMarkdown } from "@/components/boards/board_markdown";
import { cn } from "@/lib/utils";
import { LIMITS, editWindowLabel } from "@/lib/boards/constants";
import {
  AuthorLine,
  ConfirmDialog,
  MARKDOWN_HINT,
  ReactionButton,
  ReportDialog,
  StatusTag,
  TagChip,
  TopicDialog,
  boardRequest,
  reactionCount,
} from "./discussion_kit";

// Apply `fn` to the post with `id`, whether it is a top-level reply or nested under one.
function mapPost(posts, id, fn) {
  return posts.map((p) => {
    if (p.id === id) return fn(p);
    if (p.replies?.some((r) => r.id === id)) {
      return { ...p, replies: p.replies.map((r) => (r.id === id ? fn(r) : r)) };
    }
    return p;
  });
}

function Composer({ placeholder, busy, onSubmit, onCancel, autoFocus = false, initial = "", submitLabel = "Reply" }) {
  const [text, setText] = useState(initial);
  const submit = async () => {
    if (!text.trim() || busy) return;
    const ok = await onSubmit(text.trim());
    if (ok) setText("");
  };
  return (
    <div className="rounded-xl border border-border bg-surface-card p-2">
      <Textarea
        rows={3}
        value={text}
        autoFocus={autoFocus}
        maxLength={LIMITS.body}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={placeholder}
        className="min-h-[72px] resize-y border-none bg-transparent shadow-none focus-visible:ring-0"
      />
      <div className="flex items-center justify-between gap-2 px-1 pt-1">
        <span className="hidden text-[11px] text-text-tertiary sm:inline">{MARKDOWN_HINT}</span>
        <div className="ml-auto flex items-center gap-1.5">
          {onCancel ? (
            <Button variant="ghost" size="sm" onClick={onCancel} className="text-muted-foreground">
              Cancel
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={submit}
            disabled={busy || !text.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            {submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PostItem({ post, nested = false, board, topic, canReply, onReply, onReact, onAccept, onEdit, onDelete, onReport }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  if (post.removed) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs italic text-text-tertiary">
        This reply was removed.
      </p>
    );
  }

  const menu = [
    post.canEdit && { icon: Pencil, label: "Edit", onSelect: () => setEditing(true) },
    post.canDelete && { icon: Trash2, label: "Delete", destructive: true, onSelect: () => onDelete(post) },
    !post.author.isMe && { icon: Flag, label: "Report", onSelect: () => onReport(post) },
  ];

  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-subtle p-3 sm:p-4",
        post.accepted ? "border-emerald-500/40" : "border-border",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <AuthorLine author={post.author} createdAt={post.createdAt} editedAt={post.editedAt} size={nested ? "sm" : "md"} />
        <div className="flex shrink-0 items-center gap-1">
          {post.accepted ? (
            <StatusTag tone="success" icon={CheckCircle2}>
              Accepted answer
            </StatusTag>
          ) : null}
          {post.status === "pending" ? <StatusTag tone="warning">Awaiting approval</StatusTag> : null}
          <ActionMenu label="Reply actions" items={menu} />
        </div>
      </div>

      <div className={cn("mt-2", nested ? "pl-8" : "pl-10")}>
        {editing ? (
          <Composer
            autoFocus
            initial={post.body}
            busy={saving}
            submitLabel="Save"
            placeholder="Edit your reply"
            onCancel={() => setEditing(false)}
            onSubmit={async (body) => {
              setSaving(true);
              const ok = await onEdit(post, body);
              setSaving(false);
              if (ok) setEditing(false);
              return ok;
            }}
          />
        ) : (
          <BoardMarkdown text={post.body} />
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1">
          <ReactionButton
            kind={board.reactionKind}
            count={reactionCount(post.reactions, board.reactionKind)}
            active={post.myReaction === board.reactionKind}
            disabled={board.banned || post.status !== "published"}
            onToggle={() => onReact(post)}
          />
          {!nested && canReply ? (
            <button
              type="button"
              onClick={() => onReply(post)}
              className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              <Reply className="h-3.5 w-3.5" /> Reply
            </button>
          ) : null}
          {topic.canAccept && board.format === "qa" && post.status === "published" ? (
            <button
              type="button"
              onClick={() => onAccept(post)}
              className={cn(
                "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                post.accepted
                  ? "text-emerald-600 hover:bg-surface-hover dark:text-emerald-400"
                  : "text-text-secondary hover:bg-surface-hover hover:text-foreground",
              )}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              {post.accepted ? "Unmark answer" : "Mark as answer"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function TopicView({ topicId, onBack }) {
  const [data, setData] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [posting, setPosting] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [editingTopic, setEditingTopic] = useState(false);
  const [savingTopic, setSavingTopic] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = useCallback(async () => {
    const { ok, data: d } = await boardRequest(`/api/portal/boards/topics/${topicId}`);
    setData(ok ? d : { missing: true, error: d.error });
  }, [topicId]);

  useEffect(() => {
    let alive = true;
    boardRequest(`/api/portal/boards/topics/${topicId}`).then(({ ok, data: d }) => {
      if (alive) setData(ok ? d : { missing: true, error: d.error });
    });
    return () => {
      alive = false;
    };
  }, [topicId]);

  if (!data) return <LoadingArea size={40} label="Loading topic" />;

  if (data.missing) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={MessagesSquare}
          title="Topic unavailable"
          description={data.error || "It may have been removed, or you no longer have access."}
          action={
            <Button variant="outline" onClick={() => onBack(null)}>
              <ArrowLeft className="h-4 w-4" /> Back to discussions
            </Button>
          }
        />
      </div>
    );
  }

  const { board, topic, posts } = data;
  const canReply = data.canReply;

  const patchTopic = (patch) => setData((d) => ({ ...d, topic: { ...d.topic, ...patch } }));

  const reply = async (body, parentPostId = null) => {
    setPosting(true);
    const { ok, data: d } = await boardRequest(`/api/portal/boards/topics/${topicId}/posts`, {
      method: "POST",
      body: { body, parentPostId },
    });
    setPosting(false);
    if (!ok) {
      toast.error(d.error || "Couldn't post your reply.");
      return false;
    }
    if (d.pending) toast.success("Sent for approval — it appears once the organiser approves it.");
    const parentId = d.post.parentPostId;
    setData((prev) => ({
      ...prev,
      topic: d.pending ? prev.topic : { ...prev.topic, replyCount: prev.topic.replyCount + 1, subscribed: true },
      posts: parentId
        ? prev.posts.map((p) => (p.id === parentId ? { ...p, replies: [...(p.replies || []), d.post] } : p))
        : [...prev.posts, d.post],
    }));
    setReplyTo(null);
    return true;
  };

  const reactTopic = async () => {
    const { ok, data: d } = await boardRequest("/api/portal/boards/reactions", { method: "POST", body: { topicId } });
    if (!ok) return toast.error(d.error || "Couldn't react.");
    patchTopic({ reactions: d.reactions, myReaction: d.myReaction });
  };

  const reactPost = async (post) => {
    const { ok, data: d } = await boardRequest("/api/portal/boards/reactions", {
      method: "POST",
      body: { topicId, postId: post.id },
    });
    if (!ok) return toast.error(d.error || "Couldn't react.");
    setData((prev) => ({
      ...prev,
      posts: mapPost(prev.posts, post.id, (p) => ({ ...p, reactions: d.reactions, myReaction: d.myReaction })),
    }));
  };

  const toggleSubscribe = async () => {
    const on = !topic.subscribed;
    const { ok, data: d } = await boardRequest(`/api/portal/boards/topics/${topicId}/subscribe`, {
      method: "POST",
      body: { on },
    });
    if (!ok) return toast.error(d.error || "Couldn't update.");
    patchTopic({ subscribed: d.subscribed });
    toast.success(d.subscribed ? "You'll be notified about replies." : "You won't be notified about this topic.");
  };

  const accept = async (post) => {
    const { ok, data: d } = await boardRequest(`/api/portal/boards/topics/${topicId}/accept`, {
      method: "POST",
      body: { postId: post.id },
    });
    if (!ok) return toast.error(d.error || "Couldn't update the answer.");
    patchTopic({ acceptedPostId: d.acceptedPostId });
    setData((prev) => ({
      ...prev,
      posts: prev.posts.map((p) => ({
        ...p,
        accepted: p.id === d.acceptedPostId,
        replies: (p.replies || []).map((r) => ({ ...r, accepted: r.id === d.acceptedPostId })),
      })),
    }));
  };

  const editPost = async (post, body) => {
    const { ok, data: d } = await boardRequest(`/api/portal/boards/posts/${post.id}`, { method: "PATCH", body: { body } });
    if (!ok) {
      toast.error(d.error || "Couldn't save your changes.");
      return false;
    }
    if (d.pending) toast.success("Your edit was sent for approval.");
    setData((prev) => ({
      ...prev,
      posts: mapPost(prev.posts, post.id, (p) => ({ ...p, body: d.post.body, editedAt: d.post.editedAt, status: d.post.status })),
    }));
    return true;
  };

  const saveTopic = async (draft) => {
    setSavingTopic(true);
    const { ok, data: d } = await boardRequest(`/api/portal/boards/topics/${topicId}`, { method: "PATCH", body: draft });
    setSavingTopic(false);
    if (!ok) return toast.error(d.error || "Couldn't save your changes.");
    if (d.pending) toast.success("Your edit was sent for approval.");
    patchTopic({ ...d.topic, subscribed: topic.subscribed });
    setEditingTopic(false);
  };

  const confirmDelete = async () => {
    const target = deleteTarget;
    if (!target) return;
    const path = target.kind === "topic" ? `/api/portal/boards/topics/${topicId}` : `/api/portal/boards/posts/${target.id}`;
    const { ok, data: d } = await boardRequest(path, { method: "DELETE" });
    if (!ok) return toast.error(d.error || "Couldn't delete.");
    toast.success(target.kind === "topic" ? "Topic deleted." : "Reply deleted.");
    if (target.kind === "topic") onBack(board.id);
    else load();
  };

  const sendReport = async ({ reason, details }) => {
    const { ok, data: d } = await boardRequest("/api/portal/boards/reports", {
      method: "POST",
      body: { topicId, postId: reportTarget?.postId || null, reason, details },
    });
    if (!ok) {
      toast.error(d.error || "Couldn't send the report.");
      return false;
    }
    toast.success("Thanks — the organiser will take a look.");
    return true;
  };

  const topicMenu = [
    topic.canEdit && {
      icon: Pencil,
      label: "Edit topic",
      onSelect: () => {
        setEditKey((k) => k + 1);
        setEditingTopic(true);
      },
    },
    topic.canDelete && {
      icon: Trash2,
      label: "Delete topic",
      destructive: true,
      onSelect: () => setDeleteTarget({ kind: "topic", id: topic.id }),
    },
    !topic.author.isMe && { icon: Flag, label: "Report topic", onSelect: () => setReportTarget({ postId: null }) },
  ];

  const handlers = {
    board,
    topic,
    canReply,
    onReply: (p) => setReplyTo(p.id),
    onReact: reactPost,
    onAccept: accept,
    onEdit: editPost,
    onDelete: (p) => setDeleteTarget({ kind: "post", id: p.id }),
    onReport: (p) => setReportTarget({ postId: p.id }),
  };

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => onBack(board.id)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {board.name}
      </button>

      <article className="rounded-xl border border-border bg-surface-subtle p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              {topic.pinned ? (
                <StatusTag tone="info" icon={Pin}>
                  Pinned
                </StatusTag>
              ) : null}
              {topic.locked ? <StatusTag icon={Lock}>Locked</StatusTag> : null}
              {topic.acceptedPostId ? (
                <StatusTag tone="success" icon={CheckCircle2}>
                  Answered
                </StatusTag>
              ) : null}
              {topic.status === "pending" ? <StatusTag tone="warning">Awaiting approval</StatusTag> : null}
            </div>
            <h1 className="mt-1 text-lg font-semibold leading-snug text-foreground sm:text-xl">{topic.title}</h1>
          </div>
          <ActionMenu label="Topic actions" items={topicMenu} />
        </div>

        <div className="mt-3">
          <AuthorLine author={topic.author} createdAt={topic.createdAt} editedAt={topic.editedAt} />
        </div>
        <BoardMarkdown text={topic.body} className="mt-3" />
        {topic.tags.length ? (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {topic.tags.map((t) => (
              <TagChip key={t} tag={t} />
            ))}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-border pt-3">
          <ReactionButton
            kind={board.reactionKind}
            count={reactionCount(topic.reactions, board.reactionKind)}
            active={topic.myReaction === board.reactionKind}
            disabled={data.banned || topic.status !== "published"}
            onToggle={reactTopic}
          />
          <span className="px-2 text-xs text-text-tertiary">
            {topic.replyCount} {topic.replyCount === 1 ? "reply" : "replies"} · {topic.viewCount} views
          </span>
          {topic.status === "published" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSubscribe}
              className="ml-auto h-7 text-xs text-text-secondary hover:bg-surface-hover hover:text-foreground"
            >
              {topic.subscribed ? <BellOff className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
              {topic.subscribed ? "Unfollow" : "Follow"}
            </Button>
          ) : null}
        </div>
      </article>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">
          {posts.length ? `Replies` : "No replies yet"}
        </h2>
        {posts.map((post) => (
          <div key={post.id} className="space-y-2">
            <PostItem post={post} {...handlers} />
            {post.replies?.length || replyTo === post.id ? (
              <div className="ml-4 space-y-2 border-l border-border pl-3 sm:ml-6 sm:pl-4">
                {(post.replies || []).map((r) => (
                  <PostItem key={r.id} post={r} nested {...handlers} />
                ))}
                {replyTo === post.id ? (
                  <div className="flex gap-2">
                    <CornerDownRight className="mt-3 h-4 w-4 shrink-0 text-text-tertiary" />
                    <div className="min-w-0 flex-1">
                      <Composer
                        autoFocus
                        busy={posting}
                        placeholder={`Reply to ${post.author.isMe ? "yourself" : post.author.name}…`}
                        onCancel={() => setReplyTo(null)}
                        onSubmit={(body) => reply(body, post.id)}
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ))}
      </section>

      {canReply ? (
        <Composer
          busy={posting && !replyTo}
          placeholder={board.format === "qa" ? "Write an answer…" : "Write a reply…"}
          onSubmit={(body) => reply(body)}
        />
      ) : (
        <p className="rounded-lg border border-border bg-surface-card px-3 py-2.5 text-center text-xs text-text-secondary">
          {data.banned
            ? "You've been restricted from posting in these discussions."
            : topic.locked
              ? "This topic is locked — no new replies."
              : "Replies open once the organiser approves this topic."}
        </p>
      )}
      {data.editWindowMinutes > 0 ? (
        <p className="text-center text-[11px] text-text-tertiary">
          You can edit or delete your posts for {editWindowLabel(data.editWindowMinutes).toLowerCase()} after posting.
        </p>
      ) : null}

      <TopicDialog
        key={`edit-${editKey}`}
        open={editingTopic}
        onOpenChange={setEditingTopic}
        initial={topic}
        busy={savingTopic}
        onSubmit={saveTopic}
        title="Edit topic"
        submitLabel="Save changes"
      />
      <ReportDialog target={reportTarget} onOpenChange={(o) => !o && setReportTarget(null)} onSubmit={sendReport} />
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={deleteTarget?.kind === "topic" ? "Delete topic?" : "Delete reply?"}
        description="This can't be undone."
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default TopicView;
