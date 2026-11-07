"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowRightLeft,
  Ban,
  CheckCircle2,
  CornerDownRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LockOpen,
  Pin,
  PinOff,
  Reply,
  Send,
  Trash2,
} from "lucide-react";

import { StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Textarea } from "@geiger/ui/textarea";
import { ActionMenu } from "@geiger/ui/action-menu";
import { LoadingArea } from "@geiger/ui";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@geiger/ui/sheet";
import { BoardMarkdown } from "@/components/boards/board_markdown";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/boards/constants";
import {
  createOrganiserPost,
  deliverTopicEmails,
  getTopic,
  listTopicPosts,
  softDeletePost,
  updatePost,
  updateTopic,
} from "@/lib/supabase/boards";
import { AuthorAvatar, OrganiserBadge, TOPIC_STATUS_MAP, formatDateTime } from "./shared";

function ReplyBox({ placeholder, busy, onSubmit, onCancel, autoFocus = false }) {
  const [text, setText] = useState("");
  const submit = async () => {
    if (!text.trim() || busy) return;
    if (await onSubmit(text.trim())) setText("");
  };
  return (
    <div className="rounded-xl border border-border bg-surface-card p-2">
      <Textarea
        rows={3}
        autoFocus={autoFocus}
        value={text}
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
        <span className="inline-flex items-center gap-1.5 text-[11px] text-text-tertiary">
          Replying as <OrganiserBadge />
        </span>
        <div className="flex items-center gap-1.5">
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
            Reply
          </Button>
        </div>
      </div>
    </div>
  );
}

function PostCard({ post, nested, isQa, accepted, onReply, onStatus, onAccept, onBan, onDelete }) {
  const organiser = post.authorKind === "organiser";
  return (
    <div
      className={cn(
        "rounded-xl border bg-surface-subtle p-3",
        accepted ? "border-emerald-500/40" : "border-border",
        post.status === "hidden" && "opacity-60",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <AuthorAvatar name={post.authorName} organiser={organiser} small={nested} />
          <span className="truncate text-xs font-medium text-foreground">{post.authorName}</span>
          {organiser ? <OrganiserBadge /> : null}
          <span className="text-[11px] text-text-tertiary">
            {formatDateTime(post.createdAt)}
            {post.editedAt ? " · edited" : ""}
          </span>
          {post.status !== "published" ? <StatusPill status={post.status} map={TOPIC_STATUS_MAP} /> : null}
          {accepted ? (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-3 w-3" /> Accepted answer
            </span>
          ) : null}
        </div>
        <ActionMenu
          label="Reply actions"
          items={[
            !nested && post.status === "published" && { icon: Reply, label: "Reply", onSelect: () => onReply(post) },
            post.status === "pending" && { icon: CheckCircle2, label: "Approve", onSelect: () => onStatus(post, "published") },
            post.status === "hidden"
              ? { icon: Eye, label: "Restore", onSelect: () => onStatus(post, "published") }
              : { icon: EyeOff, label: "Hide", onSelect: () => onStatus(post, "hidden") },
            isQa && post.status === "published" && {
              icon: CheckCircle2,
              label: accepted ? "Unmark answer" : "Mark as answer",
              onSelect: () => onAccept(post),
            },
            post.authorMemberId && { icon: Ban, label: "Ban author", onSelect: () => onBan(post) },
            { separator: true },
            { icon: Trash2, label: "Delete", destructive: true, onSelect: () => onDelete(post) },
          ]}
        />
      </div>
      {post.authorEmail && !organiser ? (
        <p className="mt-0.5 pl-10 text-[11px] text-text-tertiary">{post.authorEmail}</p>
      ) : null}
      <BoardMarkdown text={post.body} className={cn("mt-2", nested ? "pl-8" : "pl-10")} />
    </div>
  );
}

// Organiser view of a topic thread: read, reply as organiser, moderate the topic and individual replies.
export function TopicDrawer({ topicId, boards, onOpenChange, onTopicChange, onMove, onDelete, onBan }) {
  const [topic, setTopic] = useState(null);
  const [posts, setPosts] = useState(null);
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!topicId) return undefined;
    let alive = true;
    Promise.all([getTopic(topicId), listTopicPosts(topicId)]).then(([t, p]) => {
      if (!alive) return;
      setTopic(t);
      setPosts(p ?? []);
    });
    return () => {
      alive = false;
      setTopic(null);
      setPosts(null);
      setReplyTo(null);
    };
  }, [topicId]);

  const board = (boards || []).find((b) => b.id === topic?.boardId) || null;
  const isQa = board?.format === "qa";

  const refreshTopic = async () => {
    const fresh = await getTopic(topicId);
    if (fresh) {
      setTopic(fresh);
      onTopicChange(fresh);
    }
  };

  const changeTopic = async (patch, message) => {
    const saved = await updateTopic(topicId, patch);
    if (!saved) {
      toast.error("Couldn't update the topic.");
      return;
    }
    setTopic(saved);
    onTopicChange(saved);
    if (message) toast.success(message);
  };

  const reply = async (body, parentPostId = null) => {
    setBusy(true);
    const saved = await createOrganiserPost({ topicId, body, parentPostId });
    setBusy(false);
    if (!saved) {
      toast.error("Couldn't post your reply.");
      return false;
    }
    setPosts((prev) => [...(prev || []), saved]);
    setReplyTo(null);
    deliverTopicEmails(topicId);
    refreshTopic();
    return true;
  };

  const setPostStatus = async (post, status) => {
    const saved = await updatePost(post.id, { status });
    if (!saved) return toast.error("Couldn't update the reply.");
    setPosts((prev) => prev.map((p) => (p.id === post.id ? saved : p)));
    toast.success(status === "hidden" ? "Reply hidden." : status === "published" ? "Reply published." : "Updated.");
    if (status === "published") deliverTopicEmails(topicId);
    refreshTopic();
  };

  const removePost = async (post) => {
    const ok = await softDeletePost(post.id);
    if (!ok) return toast.error("Couldn't delete the reply.");
    setPosts((prev) => prev.filter((p) => p.id !== post.id && p.parentPostId !== post.id));
    toast.success("Reply deleted.");
    refreshTopic();
  };

  const accept = (post) =>
    changeTopic(
      { acceptedPostId: topic.acceptedPostId === post.id ? null : post.id },
      topic.acceptedPostId === post.id ? "Answer unmarked." : "Marked as the answer.",
    );

  const top = (posts || []).filter((p) => !p.parentPostId);
  const childrenOf = (id) => (posts || []).filter((p) => p.parentPostId === id);
  const handlers = {
    isQa,
    onReply: (p) => setReplyTo(p.id),
    onStatus: setPostStatus,
    onAccept: accept,
    onBan: (p) => onBan({ memberId: p.authorMemberId, name: p.authorName, email: p.authorEmail }),
    onDelete: removePost,
  };

  return (
    <Sheet open={Boolean(topicId)} onOpenChange={(o) => !o && onOpenChange(false)}>
      <SheetContent className="w-full gap-0 overflow-y-auto p-0 sm:max-w-xl">
        {!topic ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>Topic</SheetTitle>
              <SheetDescription>Loading the thread</SheetDescription>
            </SheetHeader>
            <LoadingArea size={48} label="Loading topic" />
          </>
        ) : (
          <>
            <SheetHeader className="border-b border-border p-5">
              <p className="text-xs text-text-tertiary">{board?.name || "Board"}</p>
              <SheetTitle className="pr-6 text-base leading-snug">{topic.title}</SheetTitle>
              <SheetDescription asChild>
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <StatusPill status={topic.status} map={TOPIC_STATUS_MAP} />
                  <span>
                    {topic.authorName}
                    {topic.authorEmail && topic.authorKind !== "organiser" ? ` · ${topic.authorEmail}` : ""}
                  </span>
                  <span className="text-text-tertiary">· {formatDateTime(topic.createdAt)}</span>
                </div>
              </SheetDescription>
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                {topic.status === "pending" ? (
                  <Button
                    size="sm"
                    onClick={() => changeTopic({ status: "published" }, "Topic approved.")}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeTopic({ pinned: !topic.pinned }, topic.pinned ? "Unpinned." : "Pinned to the top.")}
                >
                  {topic.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                  {topic.pinned ? "Unpin" : "Pin"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => changeTopic({ locked: !topic.locked }, topic.locked ? "Replies reopened." : "Topic locked.")}
                >
                  {topic.locked ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {topic.locked ? "Unlock" : "Lock"}
                </Button>
                <ActionMenu
                  label="More topic actions"
                  items={[
                    topic.status === "hidden"
                      ? { icon: Eye, label: "Restore", onSelect: () => changeTopic({ status: "published" }, "Topic restored.") }
                      : { icon: EyeOff, label: "Hide", onSelect: () => changeTopic({ status: "hidden" }, "Topic hidden.") },
                    { icon: ArrowRightLeft, label: "Move to…", onSelect: () => onMove(topic) },
                    topic.authorMemberId && {
                      icon: Ban,
                      label: "Ban author",
                      onSelect: () =>
                        onBan({ memberId: topic.authorMemberId, name: topic.authorName, email: topic.authorEmail }),
                    },
                    { separator: true },
                    { icon: Trash2, label: "Delete topic", destructive: true, onSelect: () => onDelete(topic) },
                  ]}
                />
              </div>
            </SheetHeader>

            <div className="space-y-5 p-5">
              <BoardMarkdown text={topic.body} />
              {topic.tags.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {topic.tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-border bg-surface-card px-2 py-0.5 text-[11px] text-text-secondary"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="text-xs text-text-tertiary">
                {topic.replyCount} {topic.replyCount === 1 ? "reply" : "replies"} · {topic.viewCount} views
              </p>

              {posts === null ? (
                <LoadingArea size={40} label="Loading replies" />
              ) : (
                <div className="space-y-3">
                  {top.map((p) => (
                    <div key={p.id} className="space-y-2">
                      <PostCard post={p} accepted={topic.acceptedPostId === p.id} {...handlers} />
                      {childrenOf(p.id).length || replyTo === p.id ? (
                        <div className="ml-4 space-y-2 border-l border-border pl-3">
                          {childrenOf(p.id).map((c) => (
                            <PostCard key={c.id} post={c} nested accepted={topic.acceptedPostId === c.id} {...handlers} />
                          ))}
                          {replyTo === p.id ? (
                            <div className="flex gap-2">
                              <CornerDownRight className="mt-3 h-4 w-4 shrink-0 text-text-tertiary" />
                              <div className="min-w-0 flex-1">
                                <ReplyBox
                                  autoFocus
                                  busy={busy}
                                  placeholder={`Reply to ${p.authorName}…`}
                                  onCancel={() => setReplyTo(null)}
                                  onSubmit={(body) => reply(body, p.id)}
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))}
                  {!top.length ? <p className="text-sm text-text-secondary">No replies yet.</p> : null}
                </div>
              )}

              {topic.status === "published" ? (
                <ReplyBox busy={busy && !replyTo} placeholder="Write a reply…" onSubmit={(body) => reply(body)} />
              ) : (
                <p className="rounded-lg border border-border bg-surface-card px-3 py-2.5 text-center text-xs text-text-secondary">
                  {topic.status === "pending" ? "Approve this topic to open it for replies." : "This topic is hidden from members."}
                </p>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default TopicDrawer;
