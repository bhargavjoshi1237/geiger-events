"use client";

import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ArrowBigUp,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Heart,
  Lock,
  MessageSquare,
  MessagesSquare,
  Pin,
  Plus,
  Sparkles,
  TrendingUp,
  X,
} from "lucide-react";

import { EmptyState, SearchInput, SegmentedTabs, Toolbar } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { LucideIcon } from "@geiger/ui/icon-picker";
import { LoadingArea } from "@geiger/ui";
import { cn } from "@/lib/utils";
import { relTime } from "@/lib/boards/constants";
import {
  Avatar,
  OrganiserBadge,
  StatusTag,
  TagChip,
  TopicDialog,
  boardRequest,
  reactionCount,
} from "./discussion_kit";

const SORTS = [
  { value: "latest", label: "Latest", icon: Clock },
  { value: "top", label: "Top", icon: TrendingUp },
  { value: "new", label: "New", icon: Sparkles },
];

function TopicRow({ topic, reactionKind, onOpen }) {
  const organiser = topic.author.kind === "organiser";
  return (
    <button
      type="button"
      onClick={() => onOpen(topic)}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-surface-subtle px-4 py-3 text-left transition-colors hover:border-border-strong hover:bg-surface-hover"
    >
      <Avatar name={topic.author.name} organiser={organiser} />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {topic.unread ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="New activity" /> : null}
          {topic.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" aria-label="Pinned" /> : null}
          <span className={cn("text-sm text-foreground", topic.unread ? "font-semibold" : "font-medium")}>
            {topic.title}
          </span>
          {topic.locked ? <Lock className="h-3 w-3 shrink-0 text-text-tertiary" aria-label="Locked" /> : null}
          {topic.acceptedPostId ? (
            <StatusTag tone="success" icon={CheckCircle2}>
              Answered
            </StatusTag>
          ) : null}
          {topic.status === "pending" ? <StatusTag tone="warning">Awaiting approval</StatusTag> : null}
        </span>
        {topic.preview ? (
          <span className="mt-0.5 line-clamp-1 block text-xs text-text-secondary">{topic.preview}</span>
        ) : null}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-tertiary">
          <span className="font-medium text-text-secondary">{topic.author.isMe ? "You" : topic.author.name}</span>
          {organiser ? <OrganiserBadge /> : null}
          <span>{relTime(topic.createdAt)}</span>
          {topic.replyCount && topic.lastReplyName ? (
            <span>
              · last reply by {topic.lastReplyName} {relTime(topic.lastActivityAt)}
            </span>
          ) : null}
          {topic.tags.map((t) => (
            <TagChip key={t} tag={t} />
          ))}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1 text-[11px] text-text-tertiary">
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="h-3.5 w-3.5" /> {topic.replyCount}
        </span>
        <span className="inline-flex items-center gap-1">
          {reactionKind === "upvote" ? <ArrowBigUp className="h-3.5 w-3.5" /> : <Heart className="h-3.5 w-3.5" />}
          {reactionCount(topic.reactions, reactionKind)}
        </span>
      </span>
    </button>
  );
}

export function TopicList({ boardId, onBack, onOpenTopic }) {
  const [data, setData] = useState(null);
  const [sort, setSort] = useState("latest");
  const [tag, setTag] = useState("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [composeKey, setComposeKey] = useState(0);
  const [composing, setComposing] = useState(false);
  const [busy, setBusy] = useState(false);
  const debounce = useRef(null);

  // Debounce typing into the search query that hits the API.
  const onSearch = (v) => {
    setSearch(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => setQuery(v.trim()), 300);
  };
  useEffect(() => () => clearTimeout(debounce.current), []);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ sort });
    if (query) params.set("q", query);
    if (tag) params.set("tag", tag);
    boardRequest(`/api/portal/boards/${boardId}?${params.toString()}`).then(({ ok, data: d }) => {
      if (!alive) return;
      if (!ok) {
        toast.error(d.error || "Couldn't load this board.");
        setData({ board: null, topics: [], tags: [] });
        return;
      }
      setData(d);
    });
    return () => {
      alive = false;
    };
  }, [boardId, sort, query, tag]);

  const board = data?.board || null;
  const topics = data?.topics || [];

  const createTopic = async (draft) => {
    setBusy(true);
    const { ok, data: d } = await boardRequest(`/api/portal/boards/${boardId}/topics`, { method: "POST", body: draft });
    setBusy(false);
    if (!ok) {
      toast.error(d.error || "Couldn't post your topic.");
      return;
    }
    setComposing(false);
    if (d.pending) {
      toast.success("Sent for approval — it appears once the organiser approves it.");
      setData((prev) => (prev ? { ...prev, topics: [d.topic, ...prev.topics] } : prev));
    } else {
      toast.success("Topic posted.");
      onOpenTopic(d.topic);
    }
  };

  if (data && !board) {
    return (
      <div className="rounded-xl border border-border bg-surface-subtle">
        <EmptyState
          icon={MessagesSquare}
          title="Board unavailable"
          description="This board was closed or you no longer have access."
          action={
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" /> All boards
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="All boards"
          onClick={onBack}
          className="mt-1 shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card text-muted-foreground">
          {board ? <LucideIcon name={board.icon} fallback={MessagesSquare} className="h-5 w-5" /> : null}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-foreground">{board?.name || "Board"}</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {board?.description || (board?.eventName ? `Discussion for ${board.eventName}` : "")}
          </p>
        </div>
        {board?.canStartTopic ? (
          <Button
            onClick={() => {
              setComposeKey((k) => k + 1);
              setComposing(true);
            }}
            className="shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New topic</span>
          </Button>
        ) : null}
      </div>

      {board?.banned ? (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
          You&apos;ve been restricted from posting in these discussions. You can still read them.
        </p>
      ) : board && board.postingPolicy === "moderators_only" ? (
        <p className="text-xs text-text-tertiary">Only the organiser starts topics here — you can reply to them.</p>
      ) : null}

      <Toolbar>
        <div className="flex items-center gap-2">
          <SegmentedTabs className="w-fit sm:w-fit" value={sort} onChange={setSort} tabs={SORTS} />
        </div>
        <SearchInput value={search} onChange={onSearch} placeholder="Search topics…" />
      </Toolbar>

      {data?.tags?.length || tag ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {tag ? (
            <button
              type="button"
              onClick={() => setTag("")}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
            >
              #{tag} <X className="h-3 w-3" />
            </button>
          ) : null}
          {(data?.tags || [])
            .filter((t) => t !== tag)
            .slice(0, 16)
            .map((t) => (
              <TagChip key={t} tag={t} onClick={() => setTag(t)} />
            ))}
        </div>
      ) : null}

      {!data ? (
        <LoadingArea size={40} label="Loading topics" />
      ) : topics.length ? (
        <div className="space-y-2">
          {topics.map((t) => (
            <TopicRow key={t.id} topic={t} reactionKind={board.reactionKind} onOpen={onOpenTopic} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={MessagesSquare}
            title={query || tag ? "No topics match" : "No topics yet"}
            description={
              query || tag
                ? "Try a different search or tag."
                : board?.canStartTopic
                  ? "Start the first conversation on this board."
                  : "The organiser hasn't posted here yet."
            }
          />
        </div>
      )}

      <TopicDialog
        key={composeKey}
        open={composing}
        onOpenChange={setComposing}
        suggestedTags={data?.tags || []}
        busy={busy}
        onSubmit={createTopic}
        title="New topic"
        submitLabel="Post topic"
      />
    </div>
  );
}

export default TopicList;
